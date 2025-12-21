/**
 * 工作服务 - 打工、抢劫等收入相关功能
 */

import type { PluginContext } from '@napgram/sdk';
import { getDatabase } from '../models';
import type { SlaveMarketConfig } from '../config';
import { TransactionService } from './transaction.service';
import { PlayerService } from './player.service';

export type RobStrategy = '稳健' | '激进' | '平衡';

export class WorkService {
    constructor(
        private ctx: PluginContext,
        private config: SlaveMarketConfig,
        private transactionService: TransactionService,
        private playerService: PlayerService
    ) { }

    /**
     * 打工
     */
    async work(userId: string): Promise<{
        income: number;
        ownerShare: number;
        newBalance: number;
        ownerName?: string;
    }> {
        const db = getDatabase();
        const player = await db.slaveMarketPlayer.findUnique({
            where: { userId },
            include: { owner: true },
        });

        if (!player) {
            throw new Error('玩家不存在');
        }

        // 基础收入 = 身价 * 收益比例
        const baseIncome = Math.floor(player.worth * this.config.打工收益比例);
        let income = baseIncome;
        let ownerShare = 0;
        let ownerName: string | undefined;

        // 如果有主人，分成给主人
        if (player.owner) {
            ownerShare = Math.floor(income * 0.3); // 主人抽成30%
            income -= ownerShare;
            ownerName = player.owner.nickname;

            // 给主人加钱
            await db.slaveMarketPlayer.update({
                where: { userId: player.owner.userId },
                data: {
                    balance: {
                        increment: ownerShare,
                    },
                },
            });

            // 记录主人收益
            await this.transactionService.createTransaction({
                userId: player.owner.userId,
                type: 'work',
                amount: ownerShare,
                balance: player.owner.balance + ownerShare,
                targetId: userId,
                description: `牛马打工分成(${player.nickname})`,
            });
        }

        // 更新玩家余额
        const result = await db.slaveMarketPlayer.update({
            where: { userId },
            data: {
                balance: player.balance + income,
            },
        });

        // 记录交易
        await this.transactionService.createTransaction({
            userId,
            type: 'work',
            amount: income,
            balance: result.balance,
            description: ownerName ? `打工(主人: ${ownerName})` : '打工',
        });

        return {
            income,
            ownerShare,
            newBalance: result.balance,
            ownerName,
        };
    }

    /**
     * 抢劫
     */
    async rob(
        robberId: string,
        targetId: string,
        strategy: RobStrategy = '平衡'
    ): Promise<{
        success: boolean;
        amount: number;
        newBalance: number;
        targetBalance: number;
        penalty?: number;
        jailTime?: number;
    }> {
        const db = getDatabase();

        if (robberId === targetId) {
            throw new Error('不能抢劫自己');
        }

        const [robber, target] = await Promise.all([
            db.slaveMarketPlayer.findUnique({ where: { userId: robberId } }),
            db.slaveMarketPlayer.findUnique({ where: { userId: targetId } }),
        ]);

        if (!robber || !target) {
            throw new Error('玩家不存在');
        }

        // 检查目标是否有保镖
        const hasGuard = target.bodyguardEndTime && Number(target.bodyguardEndTime) > Date.now();

        if (hasGuard) {
            throw new Error(`目标有保镖保护，无法抢劫`);
        }

        // 根据策略计算成功率和收益率
        const strategyConfig = this.getStrategyConfig(strategy);
        const successRate = strategyConfig.successRate;
        const yieldRate = strategyConfig.yieldRate;

        // 判断是否成功
        const success = Math.random() < successRate;

        if (success) {
            // 抢劫成功
            const maxAmount = Math.floor(target.balance * yieldRate);
            const amount = Math.min(maxAmount, target.balance);

            if (amount <= 0) {
                throw new Error('目标余额不足，无法抢劫');
            }

            await db.$transaction([
                // 增加抢劫者余额
                db.slaveMarketPlayer.update({
                    where: { userId: robberId },
                    data: { balance: robber.balance + amount },
                }),
                // 扣除目标余额
                db.slaveMarketPlayer.update({
                    where: { userId: targetId },
                    data: { balance: target.balance - amount },
                }),
            ]);

            // 记录交易
            await Promise.all([
                this.transactionService.createTransaction({
                    userId: robberId,
                    type: 'rob',
                    amount,
                    balance: robber.balance + amount,
                    targetId,
                    description: `抢劫成功(${target.nickname})`,
                }),
                this.transactionService.createTransaction({
                    userId: targetId,
                    type: 'rob',
                    amount: -amount,
                    balance: target.balance - amount,
                    targetId: robberId,
                    description: `被抢劫(${robber.nickname})`,
                }),
            ]);

            return {
                success: true,
                amount,
                newBalance: robber.balance + amount,
                targetBalance: target.balance - amount,
            };
        } else {
            // 抢劫失败，罚款和入狱
            const penalty = Math.floor(robber.balance * 0.1); // 罚款10%
            const jailTime = 10 * 60 * 1000; // 入狱10分钟

            await db.slaveMarketPlayer.update({
                where: { userId: robberId },
                data: {
                    balance: Math.max(0, robber.balance - penalty),
                    jailEndTime: BigInt(Date.now() + jailTime),
                },
            });

            // 记录交易
            if (penalty > 0) {
                await this.transactionService.createTransaction({
                    userId: robberId,
                    type: 'rob',
                    amount: -penalty,
                    balance: Math.max(0, robber.balance - penalty),
                    targetId,
                    description: `抢劫失败罚款`,
                });
            }

            return {
                success: false,
                amount: 0,
                newBalance: Math.max(0, robber.balance - penalty),
                targetBalance: target.balance,
                penalty,
                jailTime: jailTime / 60000, // 转换为分钟
            };
        }
    }

    /**
     * 转账
     */
    async transfer(
        senderId: string,
        receiverId: string,
        amount: number,
        isAdmin: boolean = false
    ): Promise<{
        fee: number;
        actualAmount: number;
        newBalance: number;
        receiverBalance: number;
    }> {
        const db = getDatabase();

        if (senderId === receiverId) {
            throw new Error('不能给自己转账');
        }

        if (amount <= 0) {
            throw new Error('转账金额必须大于0');
        }

        const [sender, receiver] = await Promise.all([
            db.slaveMarketPlayer.findUnique({ where: { userId: senderId } }),
            db.slaveMarketPlayer.findUnique({ where: { userId: receiverId } }),
        ]);

        if (!sender || !receiver) {
            throw new Error('玩家不存在');
        }

        // 计算手续费（管理员免费）
        const fee = isAdmin ? 0 : Math.ceil(amount * this.config.转账手续费);
        const total = amount + fee;

        if (sender.balance < total) {
            throw new Error(`余额不足，需要 ${total} (含手续费 ${fee})`);
        }

        await db.$transaction([
            // 扣除发送者余额
            db.slaveMarketPlayer.update({
                where: { userId: senderId },
                data: { balance: sender.balance - total },
            }),
            // 增加接收者余额
            db.slaveMarketPlayer.update({
                where: { userId: receiverId },
                data: { balance: receiver.balance + amount },
            }),
        ]);

        // 记录交易
        await Promise.all([
            this.transactionService.createTransaction({
                userId: senderId,
                type: 'transfer',
                amount: -total,
                balance: sender.balance - total,
                targetId: receiverId,
                description: `转账给 ${receiver.nickname}`,
            }),
            this.transactionService.createTransaction({
                userId: receiverId,
                type: 'transfer',
                amount,
                balance: receiver.balance + amount,
                targetId: senderId,
                description: `收到转账(${sender.nickname})`,
            }),
        ]);

        return {
            fee,
            actualAmount: amount,
            newBalance: sender.balance - total,
            receiverBalance: receiver.balance + amount,
        };
    }

    /**
     * 获取抢劫策略配置
     */
    private getStrategyConfig(strategy: RobStrategy): {
        successRate: number;
        yieldRate: number;
    } {
        switch (strategy) {
            case '稳健':
                return { successRate: 0.8, yieldRate: 0.2 }; // 80%成功率，抢20%
            case '激进':
                return { successRate: 0.3, yieldRate: 0.5 }; // 30%成功率，抢50%
            case '平衡':
            default:
                return { successRate: 0.5, yieldRate: 0.3 }; // 50%成功率，抢30%
        }
    }
}
