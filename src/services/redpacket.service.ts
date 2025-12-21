/**
 * 红包服务 - 发红包、抢红包
 */

import type { PluginContext } from '@napgram/sdk';
import { getDatabase } from '../models';
import type { Prisma } from '@prisma/client';
import type { SlaveMarketConfig } from '../config';
import { TransactionService } from './transaction.service';

export class RedPacketService {
    constructor(
        private ctx: PluginContext,
        private config: SlaveMarketConfig,
        private transactionService: TransactionService
    ) { }

    /**
     * 发红包
     */
    async sendRedPacket(
        senderId: string,
        senderName: string,
        totalAmount: number,
        totalCount: number,
        scopeKey: string,
        isAdmin: boolean = false
    ): Promise<{
        packetId: string;
        fee: number;
        cost: number;
        newBalance: number;
    }> {
        const db = getDatabase();

        if (totalAmount <= 0 || totalCount <= 0) {
            throw new Error('金额和份数必须大于0');
        }

        if (totalAmount < totalCount) {
            throw new Error('总金额必须大于份数');
        }

        const player = await db.slaveMarketPlayer.findUnique({
            where: { userId: senderId },
        });

        if (!player) {
            throw new Error('玩家不存在');
        }

        // 计算手续费（管理员免费）
        const fee = isAdmin ? 0 : Math.ceil(totalAmount * 0.05);
        const cost = totalAmount + fee;

        if (player.balance < cost) {
            throw new Error(`余额不足，需要 ${cost} (含手续费 ${fee})`);
        }

        // 生成红包ID
        const packetId = this.generatePacketId();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时过期

        await db.$transaction([
            // 扣除发送者余额
            db.slaveMarketPlayer.update({
                where: { userId: senderId },
                data: {
                    balance: player.balance - cost,
                },
            }),
            // 创建红包
            db.slaveMarketRedPacket.create({
                data: {
                    packetId,
                    senderId,
                    senderName,
                    totalAmount,
                    totalCount,
                    remaining: totalCount,
                    scopeKey,
                    expiresAt,
                },
            }),
        ]);

        // 记录交易
        await this.transactionService.createTransaction({
            userId: senderId,
            type: 'red_packet',
            amount: -cost,
            balance: player.balance - cost,
            description: `发红包(${totalCount}个)`,
        });

        return {
            packetId,
            fee,
            cost,
            newBalance: player.balance - cost,
        };
    }

    /**
     * 抢红包
     */
    async grabRedPacket(
        userId: string,
        userName: string,
        packetId: string,
        scopeKey: string
    ): Promise<{
        amount: number;
        newBalance: number;
        remaining: number;
        lucky: boolean;
    }> {
        const db = getDatabase();
        type RedPacketRow = {
            packetId: string;
            senderId: string;
            senderName: string;
            totalAmount: number;
            totalCount: number;
            remaining: number;
            scopeKey: string;
            createdAt: Date;
            expiresAt: Date;
        };

        const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
            const packets = await tx.$queryRaw<RedPacketRow[]>`
                SELECT * FROM "slave_market_red_packets"
                WHERE "packetId" = ${packetId}
                FOR UPDATE
            `;
            const packet = packets[0];

            if (!packet) {
                throw new Error('红包不存在');
            }

            if (packet.scopeKey !== scopeKey) {
                throw new Error('红包不在当前群聊/私聊');
            }

            if (packet.expiresAt < new Date()) {
                throw new Error('红包已过期');
            }

            if (packet.remaining <= 0) {
                throw new Error('红包已被抢完');
            }

            const alreadyGrabbed = await tx.slaveMarketRedPacketGrab.findUnique({
                where: {
                    packetId_userId: {
                        packetId,
                        userId,
                    },
                },
            });

            if (alreadyGrabbed) {
                throw new Error('你已经抢过这个红包了');
            }

            const grabs = await tx.slaveMarketRedPacketGrab.findMany({
                where: { packetId },
                select: { amount: true },
            });
            const grabbedTotal = grabs.reduce((sum, g) => sum + g.amount, 0);
            const remainingCount = packet.remaining;

            let amount: number;
            if (remainingCount === 1) {
                amount = packet.totalAmount - grabbedTotal;
            } else {
                const remainingAmount = packet.totalAmount - grabbedTotal;
                const avg = Math.floor(remainingAmount / remainingCount);
                const min = 1;
                const max = Math.min(avg * 2, remainingAmount - (remainingCount - 1));
                amount = Math.floor(Math.random() * (max - min + 1)) + min;
            }

            const player = await tx.slaveMarketPlayer.findUnique({
                where: { userId },
            });

            if (!player) {
                throw new Error('玩家不存在');
            }

            const updatedPlayer = await tx.slaveMarketPlayer.update({
                where: { userId },
                data: {
                    balance: { increment: amount },
                },
            });

            const updatedPacket = await tx.slaveMarketRedPacket.update({
                where: { packetId },
                data: {
                    remaining: { decrement: 1 },
                },
            });

            await tx.slaveMarketRedPacketGrab.create({
                data: {
                    packetId,
                    userId,
                    userName,
                    amount,
                },
            });

            const allGrabs = [...grabs, { amount }];
            const maxAmount = Math.max(...allGrabs.map((g) => g.amount));
            const lucky = amount === maxAmount && remainingCount === 1;

            await tx.slaveMarketTransaction.create({
                data: {
                    userId,
                    type: 'red_packet',
                    amount,
                    balance: updatedPlayer.balance,
                    description: `抢红包(${packet.senderName})`,
                },
            });

            return {
                amount,
                newBalance: updatedPlayer.balance,
                remaining: updatedPacket.remaining,
                lucky,
            };
        });

        return result;
    }

    /**
     * 查询红包详情
     */
    async getRedPacket(packetId: string) {
        const db = getDatabase();
        return db.slaveMarketRedPacket.findUnique({
            where: { packetId },
            include: { grabs: true },
        });
    }

    /**
     * 生成红包ID
     */
    private generatePacketId(): string {
        return `RP${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    }

    /**
     * 清理过期红包
     */
    async cleanupExpiredPackets(): Promise<number> {
        const db = getDatabase();
        const now = new Date();

        const result = await db.slaveMarketRedPacket.deleteMany({
            where: {
                expiresAt: {
                    lt: now,
                },
            },
        });

        return result.count;
    }
}
