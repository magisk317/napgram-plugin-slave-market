/**
 * 玩家服务 - 管理玩家数据的核心服务
 */

import type { PluginContext } from '@napgram/sdk';
import { getDatabase, type SlaveMarketPlayer } from '../models';
import type { SlaveMarketConfig } from '../config';

export class PlayerService {
    constructor(
        private ctx: PluginContext,
        private config: SlaveMarketConfig
    ) { }

    /**
     * 获取或创建玩家
     */
    async getOrCreatePlayer(
        userId: string,
        nickname: string,
        groupId?: string
    ): Promise<SlaveMarketPlayer> {
        const result = await this.getOrCreatePlayerWithStatus(userId, nickname, groupId);
        return result.player;
    }

    /**
     * 获取或创建玩家（带是否新建标记）
     */
    async getOrCreatePlayerWithStatus(
        userId: string,
        nickname: string,
        groupId?: string
    ): Promise<{ player: SlaveMarketPlayer; created: boolean }> {
        const db = getDatabase();

        let player = await db.slaveMarketPlayer.findUnique({
            where: { userId },
        });

        if (!player) {
            const plainUserId = userId.includes(':') ? userId.split(':')[1] : userId;

            player = await db.slaveMarketPlayer.create({
                data: {
                    userId,
                    plainUserId,
                    nickname,
                    balance: this.config.初始余额,
                    worth: this.config.初始身价,
                    depositLimit: this.config.初始存款上限,
                    registerTime: BigInt(Date.now()),
                    registerSource: groupId,
                },
            });

            this.ctx.logger.info(`[slave-market] New player registered: ${nickname} (${userId})`);
            return { player, created: true };
        }

        return { player, created: false };
    }

    /**
     * 根据 userId 获取玩家
     */
    async getPlayer(userId: string): Promise<SlaveMarketPlayer | null> {
        const db = getDatabase();
        return db.slaveMarketPlayer.findUnique({
            where: { userId },
        });
    }

    /**
     * 更新玩家数据
     */
    async updatePlayer(userId: string, data: Partial<SlaveMarketPlayer>): Promise<SlaveMarketPlayer> {
        const db = getDatabase();
        return db.slaveMarketPlayer.update({
            where: { userId },
            data,
        });
    }

    /**
     * 增加余额
     */
    async addBalance(userId: string, amount: number): Promise<SlaveMarketPlayer> {
        const db = getDatabase();
        return db.slaveMarketPlayer.update({
            where: { userId },
            data: {
                balance: {
                    increment: amount,
                },
            },
        });
    }

    /**
     * 扣除余额
     */
    async deductBalance(userId: string, amount: number): Promise<SlaveMarketPlayer> {
        const db = getDatabase();
        const player = await this.getPlayer(userId);

        if (!player) {
            throw new Error('玩家不存在');
        }

        if (player.balance < amount) {
            throw new Error('余额不足');
        }

        return db.slaveMarketPlayer.update({
            where: { userId },
            data: {
                balance: {
                    decrement: amount,
                },
            },
        });
    }

    /**
     * 检查是否为管理员
     */
    async isAdmin(userId: string): Promise<boolean> {
        const db = getDatabase();
        const plainUserId = userId.includes(':') ? userId.split(':')[1] : userId;
        const adminList = this.config.管理员列表 || [];

        if (adminList.includes(userId) || adminList.includes(plainUserId)) {
            return true;
        }
        const player = await this.getPlayer(userId);

        if (player?.isAdmin) {
            return true;
        }

        // 检查管理员表
        const admin = await db.slaveMarketAdmin.findUnique({
            where: { userId },
        });

        return !!admin;
    }

    /**
     * 检查是否为VIP
     */
    async isVip(userId: string): Promise<boolean> {
        const player = await this.getPlayer(userId);

        if (!player) {
            return false;
        }

        // 管理员永久VIP
        if (this.config.VIP配置.管理员永久VIP && await this.isAdmin(userId)) {
            return true;
        }

        // 检查VIP到期时间
        if (player.vipEndTime && player.vipEndTime > BigInt(Date.now())) {
            return true;
        }

        return false;
    }

    /**
     * 获取玩家的主人
     */
    async getOwner(userId: string): Promise<SlaveMarketPlayer | null> {
        const db = getDatabase();
        const player = await db.slaveMarketPlayer.findUnique({
            where: { userId },
            include: { owner: true },
        });

        return player?.owner || null;
    }

    /**
     * 获取玩家拥有的奴隶列表
     */
    async getSlaves(userId: string): Promise<SlaveMarketPlayer[]> {
        const db = getDatabase();
        return db.slaveMarketPlayer.findMany({
            where: { ownerId: userId },
            orderBy: { worth: 'desc' },
        });
    }

    /**
     * 购买玩家
     */
    async buyPlayer(buyerId: string, targetId: string, price: number): Promise<void> {
        const db = getDatabase();

        await db.$transaction(async (tx: any) => {
            // 扣除购买者余额
            await tx.slaveMarketPlayer.update({
                where: { userId: buyerId },
                data: {
                    balance: {
                        decrement: price,
                    },
                },
            });

            // 设置目标玩家的主人
            await tx.slaveMarketPlayer.update({
                where: { userId: targetId },
                data: {
                    ownerId: buyerId,
                    ownedTime: BigInt(Date.now()),
                    worth: Math.floor(price * 1.1), // 身价上涨10%
                },
            });

            // 记录交易
            await tx.slaveMarketTransaction.create({
                data: {
                    userId: buyerId,
                    type: 'buy_player',
                    amount: -price,
                    balance: 0, // 将在外部更新
                    targetId,
                    description: `购买玩家`,
                },
            });
        });
    }

    /**
     * 释放玩家
     */
    async releasePlayer(ownerId: string, targetId: string): Promise<void> {
        const db = getDatabase();

        await db.slaveMarketPlayer.update({
            where: { userId: targetId, ownerId },
            data: {
                ownerId: null,
            },
        });
    }
}
