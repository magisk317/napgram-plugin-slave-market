/**
 * 管理员服务 - 系统管理、数据维护
 */

import type { PluginContext } from '@napgram/sdk';
import { getDatabase } from '../models';
import type { SlaveMarketConfig } from '../config';

export class AdminService {
    constructor(
        private ctx: PluginContext,
        private config: SlaveMarketConfig
    ) { }

    /**
     * 添加管理员
     */
    async addAdmin(adminId: string, targetId: string, targetName: string): Promise<void> {
        const db = getDatabase();

        // 检查是否已是管理员
        const existing = await db.slaveMarketAdmin.findUnique({
            where: { userId: targetId },
        });

        if (existing) {
            throw new Error('该用户已经是管理员');
        }

        await db.slaveMarketAdmin.create({
            data: {
                userId: targetId,
                nickname: targetName,
                addedBy: adminId,
            },
        });

        // 同时更新玩家记录
        const player = await db.slaveMarketPlayer.findUnique({
            where: { userId: targetId },
        });

        if (player) {
            await db.slaveMarketPlayer.update({
                where: { userId: targetId },
                data: { isAdmin: true },
            });
        }
    }

    /**
     * 移除管理员
     */
    async removeAdmin(targetId: string): Promise<void> {
        const db = getDatabase();

        await db.slaveMarketAdmin.delete({
            where: { userId: targetId },
        });

        // 同时更新玩家记录
        const player = await db.slaveMarketPlayer.findUnique({
            where: { userId: targetId },
        });

        if (player) {
            await db.slaveMarketPlayer.update({
                where: { userId: targetId },
                data: { isAdmin: false },
            });
        }
    }

    /**
     * 重置游戏数据
     */
    async resetGame(): Promise<{
        players: number;
        transactions: number;
        farmLands: number;
        redPackets: number;
        redPacketGrabs: number;
        appearances: number;
        vipCards: number;
        admins: number;
        systemConfigs: number;
    }> {
        const db = getDatabase();

        const [
            transactions,
            farmLands,
            appearances,
            redPacketGrabs,
            redPackets,
            vipCards,
            admins,
            systemConfigs,
            players,
        ] = await Promise.all([
            db.slaveMarketTransaction.deleteMany(),
            db.slaveMarketFarmLand.deleteMany(),
            db.slaveMarketAppearance.deleteMany(),
            db.slaveMarketRedPacketGrab.deleteMany(),
            db.slaveMarketRedPacket.deleteMany(),
            db.slaveMarketVipCard.deleteMany(),
            db.slaveMarketAdmin.deleteMany(),
            db.slaveMarketSystem.deleteMany(),
            db.slaveMarketPlayer.deleteMany(),
        ]);

        this.ctx.logger.info('[slave-market] Game data reset completed');

        return {
            players: players.count,
            transactions: transactions.count,
            farmLands: farmLands.count,
            redPackets: redPackets.count,
            redPacketGrabs: redPacketGrabs.count,
            appearances: appearances.count,
            vipCards: vipCards.count,
            admins: admins.count,
            systemConfigs: systemConfigs.count,
        };
    }

    /**
     * 获取系统统计
     */
    async getSystemStats(): Promise<{
        totalPlayers: number;
        totalTransactions: number;
        totalBalance: number;
        totalDeposit: number;
        activeVips: number;
        activePlayers24h: number;
    }> {
        const db = getDatabase();

        const [players, transactions] = await Promise.all([
            db.slaveMarketPlayer.findMany(),
            db.slaveMarketTransaction.count(),
        ]);

        const totalBalance = players.reduce((sum: number, p: any) => sum + p.balance, 0);
        const totalDeposit = players.reduce((sum: number, p: any) => sum + p.deposit, 0);
        const now = Date.now();
        const activeVips = players.filter((p: any) => p.vipEndTime && Number(p.vipEndTime) > now).length;

        const yesterday = now - 24 * 60 * 60 * 1000;
        const activePlayers24h = players.filter((p: any) =>
            p.lastWorkTime && Number(p.lastWorkTime) > yesterday
        ).length;

        return {
            totalPlayers: players.length,
            totalTransactions: transactions,
            totalBalance,
            totalDeposit,
            activeVips,
            activePlayers24h,
        };
    }

    /**
     * 禁用/启用玩家命令
     */
    async togglePlayerBan(targetId: string, banned: boolean): Promise<void> {
        const db = getDatabase();

        await db.slaveMarketPlayer.update({
            where: { userId: targetId },
            data: { commandBanned: banned },
        });
    }

    /**
     * 清理过期数据
     */
    async cleanupExpiredData(): Promise<{
        redPackets: number;
        vipCards: number;
    }> {
        const db = getDatabase();
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const [redPackets, vipCards] = await Promise.all([
            // 清理过期红包
            db.slaveMarketRedPacket.deleteMany({
                where: {
                    expiresAt: { lt: now },
                },
            }),
            // 清理已使用的旧卡密
            db.slaveMarketVipCard.deleteMany({
                where: {
                    used: true,
                    usedAt: { lt: thirtyDaysAgo },
                },
            }),
        ]);

        return {
            redPackets: redPackets.count,
            vipCards: vipCards.count,
        };
    }

    /**
     * 给玩家加钱
     */
    async giveBalance(targetId: string, amount: number): Promise<number> {
        const db = getDatabase();

        const player = await db.slaveMarketPlayer.update({
            where: { userId: targetId },
            data: {
                balance: { increment: amount },
            },
        });

        return player.balance;
    }
}
