/**
 * 牛马市场服务 - 购买、放生、赎身、抢夺等
 */

import type { PluginContext } from '@napgram/sdk';
import { getDatabase, type SlaveMarketPlayer } from '../models';
import type { SlaveMarketConfig } from '../config';
import { TransactionService } from './transaction.service';
import { PlayerService } from './player.service';

export class MarketService {
    constructor(
        private ctx: PluginContext,
        private config: SlaveMarketConfig,
        private transactionService: TransactionService,
        private playerService: PlayerService
    ) { }

    /**
     * 获取市场上可购买的玩家（没有主人的）
     */
    async getMarketPlayers(scopeKey?: string, limit: number = 20): Promise<SlaveMarketPlayer[]> {
        const db = getDatabase();

        const where: any = {
            ownerId: null,
        };

        if (scopeKey) {
            where.registerSource = scopeKey;
        }

        return db.slaveMarketPlayer.findMany({
            where,
            orderBy: {
                worth: 'desc',
            },
            take: limit,
        });
    }

    /**
     * 购买玩家
     */
    async buyPlayer(
        buyerId: string,
        targetId: string,
        isAdmin: boolean = false
    ): Promise<{
        price: number;
        newWorth: number;
        newBalance: number;
    }> {
        const db = getDatabase();

        if (buyerId === targetId) {
            throw new Error('不能购买自己');
        }

        const [buyer, target] = await Promise.all([
            db.slaveMarketPlayer.findUnique({ where: { userId: buyerId } }),
            db.slaveMarketPlayer.findUnique({ where: { userId: targetId } }),
        ]);

        if (!buyer || !target) {
            throw new Error('玩家不存在');
        }

        if (target.ownerId) {
            throw new Error('该玩家已被购买');
        }

        const price = target.worth;

        // 管理员免费购买
        if (!isAdmin) {
            if (buyer.balance < price) {
                throw new Error(`余额不足，需要 ${price} 金币`);
            }
        }

        const ownedTime = BigInt(Date.now());
        const newWorth = Math.floor(price * 1.1); // 身价上涨10%

        await db.$transaction([
            // 扣除购买者余额（管理员不扣钱）
            db.slaveMarketPlayer.update({
                where: { userId: buyerId },
                data: {
                    balance: isAdmin ? buyer.balance : buyer.balance - price,
                },
            }),
            // 设置目标的主人，提升身价
            db.slaveMarketPlayer.update({
                where: { userId: targetId },
                data: {
                    ownerId: buyerId,
                    ownedTime,
                    worth: newWorth,
                },
            }),
        ]);

        // 记录交易
        if (!isAdmin) {
            await this.transactionService.createTransaction({
                userId: buyerId,
                type: 'buy_player',
                amount: -price,
                balance: buyer.balance - price,
                targetId,
                description: `购买玩家 ${target.nickname}`,
            });
        }

        return {
            price: isAdmin ? 0 : price,
            newWorth,
            newBalance: isAdmin ? buyer.balance : buyer.balance - price,
        };
    }

    /**
     * 放生（释放牛马）
     */
    async releasePlayer(ownerId: string, targetId: string): Promise<void> {
        const db = getDatabase();

        const target = await db.slaveMarketPlayer.findUnique({
            where: { userId: targetId },
        });

        if (!target) {
            throw new Error('玩家不存在');
        }

        if (target.ownerId !== ownerId) {
            throw new Error('该玩家不是你的牛马');
        }

        await db.slaveMarketPlayer.update({
            where: { userId: targetId },
            data: {
                ownerId: null,
            },
        });
    }

    /**
     * 赎身
     */
    async ransom(userId: string): Promise<{
        price: number;
        newBalance: number;
    }> {
        const db = getDatabase();
        const player = await db.slaveMarketPlayer.findUnique({
            where: { userId },
            include: { owner: true },
        });

        if (!player) {
            throw new Error('玩家不存在');
        }

        if (!player.ownerId || !player.owner) {
            throw new Error('你是自由身，无需赎身');
        }

        // 赎身价格 = 身价 * 1.2
        const price = Math.floor(player.worth * 1.2);

        if (player.balance < price) {
            throw new Error(`赎身需要 ${price} 金币，余额不足`);
        }

        await db.$transaction([
            // 扣除玩家余额
            db.slaveMarketPlayer.update({
                where: { userId },
                data: {
                    balance: player.balance - price,
                    ownerId: null,
                },
            }),
            // 给主人加钱
            db.slaveMarketPlayer.update({
                where: { userId: player.ownerId },
                data: {
                    balance: {
                        increment: price,
                    },
                },
            }),
        ]);

        // 记录交易
        await Promise.all([
            this.transactionService.createTransaction({
                userId,
                type: 'ransom',
                amount: -price,
                balance: player.balance - price,
                targetId: player.ownerId,
                description: `赎身`,
            }),
            this.transactionService.createTransaction({
                userId: player.ownerId,
                type: 'ransom',
                amount: price,
                balance: player.owner.balance + price,
                targetId: userId,
                description: `牛马赎身(${player.nickname})`,
            }),
        ]);

        return {
            price,
            newBalance: player.balance - price,
        };
    }

    /**
     * 抢夺牛马（从其他玩家手里强制购买）
     */
    async snatchPlayer(
        snatcherId: string,
        targetId: string,
        isAdmin: boolean = false
    ): Promise<{
        price: number;
        compensate: number;
        newBalance: number;
    }> {
        const db = getDatabase();

        if (snatcherId === targetId) {
            throw new Error('不能抢夺自己');
        }

        const [snatcher, target] = await Promise.all([
            db.slaveMarketPlayer.findUnique({ where: { userId: snatcherId } }),
            db.slaveMarketPlayer.findUnique({ where: { userId: targetId }, include: { owner: true } }),
        ]);

        if (!snatcher || !target) {
            throw new Error('玩家不存在');
        }

        if (!target.ownerId || !target.owner) {
            throw new Error('该玩家是自由身，请使用"购买玩家"命令');
        }

        if (target.ownerId === snatcherId) {
            throw new Error('这已经是你的牛马了');
        }

        // 抢夺价格 = 身价 * 2
        const price = Math.floor(target.worth * 2);

        if (!isAdmin && snatcher.balance < price) {
            throw new Error(`余额不足，抢夺需要 ${price} 金币`);
        }

        // 补偿原主人 = 身价 * 1.5
        const compensate = Math.floor(target.worth * 1.5);
        const ownedTime = BigInt(Date.now());

        await db.$transaction([
            // 扣除抢夺者余额
            db.slaveMarketPlayer.update({
                where: { userId: snatcherId },
                data: {
                    balance: isAdmin ? snatcher.balance : snatcher.balance - price,
                },
            }),
            // 补偿原主人
            db.slaveMarketPlayer.update({
                where: { userId: target.ownerId },
                data: {
                    balance: {
                        increment: compensate,
                    },
                },
            }),
            // 转移所有权，提升身价
            db.slaveMarketPlayer.update({
                where: { userId: targetId },
                data: {
                    ownerId: snatcherId,
                    ownedTime,
                    worth: Math.floor(target.worth * 1.2),
                },
            }),
        ]);

        // 记录交易
        if (!isAdmin) {
            await this.transactionService.createTransaction({
                userId: snatcherId,
                type: 'buy_player',
                amount: -price,
                balance: snatcher.balance - price,
                targetId,
                description: `抢夺牛马 ${target.nickname}`,
            });
        }

        return {
            price: isAdmin ? 0 : price,
            compensate,
            newBalance: isAdmin ? snatcher.balance : snatcher.balance - price,
        };
    }

    /**
     * 获取身价排行榜
     */
    async getWorthRanking(limit: number = 10): Promise<SlaveMarketPlayer[]> {
        const db = getDatabase();

        return db.slaveMarketPlayer.findMany({
            orderBy: {
                worth: 'desc',
            },
            take: limit,
        });
    }

    /**
     * 获取牛马数量排行榜
     */
    async getSlaveCountRanking(limit: number = 10): Promise<Array<{
        player: SlaveMarketPlayer;
        slaveCount: number;
    }>> {
        const db = getDatabase();

        const players = await db.slaveMarketPlayer.findMany({
            include: {
                slaves: true,
            },
        });

        const ranked = players
            .map((p: SlaveMarketPlayer & { slaves: SlaveMarketPlayer[] }) => ({
                player: p,
                slaveCount: p.slaves.length,
            }))
            .filter((r: any) => r.slaveCount > 0)
            .sort((a: any, b: any) => b.slaveCount - a.slaveCount)
            .slice(0, limit);

        return ranked;
    }
}
