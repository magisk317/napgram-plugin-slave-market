/**
 * 银行服务 - 存款、取款、利息、贷款管理
 */

import type { PluginContext } from '@napgram/sdk';
import { getDatabase, type SlaveMarketPlayer } from '../models';
import type { Prisma } from '@prisma/client';
import type { SlaveMarketConfig } from '../config';
import { TransactionService } from './transaction.service';

const HOUR_MS = 60 * 60 * 1000;
const MAX_INTEREST_HOURS = 24; // 最多累计24小时利息

export class BankService {
    constructor(
        private ctx: PluginContext,
        private config: SlaveMarketConfig,
        private transactionService: TransactionService
    ) { }

    /**
     * 存款
     */
    async deposit(userId: string, amount: number): Promise<{
        newDeposit: number;
        newBalance: number;
    }> {
        const db = getDatabase();
        const player = await db.slaveMarketPlayer.findUnique({ where: { userId } });

        if (!player) {
            throw new Error('玩家不存在');
        }

        if (amount <= 0) {
            throw new Error('存款金额必须大于0');
        }

        const now = Date.now();
        const interest = this.calculateInterest(player);
        let balanceAfterInterest = player.balance;

        if (interest > 0) {
            balanceAfterInterest += interest;
        }

        if (balanceAfterInterest < amount) {
            throw new Error('余额不足');
        }

        const newDeposit = player.deposit + amount;

        if (newDeposit > player.depositLimit) {
            throw new Error(`超过存款上限(${player.depositLimit})，请先升级信用等级`);
        }

        const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
            if (interest > 0) {
                await tx.slaveMarketTransaction.create({
                    data: {
                        userId,
                        type: 'interest',
                        amount: interest,
                        balance: balanceAfterInterest,
                        description: '存款利息结算',
                    },
                });
            }

            const updated = await tx.slaveMarketPlayer.update({
                where: { userId },
                data: {
                    balance: balanceAfterInterest - amount,
                    deposit: newDeposit,
                    lastInterestTime: BigInt(now),
                },
            });

            await tx.slaveMarketTransaction.create({
                data: {
                    userId,
                    type: 'deposit',
                    amount: -amount,
                    balance: updated.balance,
                    description: '存款',
                },
            });

            return updated;
        });

        return {
            newDeposit: result.deposit,
            newBalance: result.balance,
        };
    }

    /**
     * 取款
     */
    async withdraw(userId: string, amount: number): Promise<{
        newDeposit: number;
        newBalance: number;
    }> {
        const db = getDatabase();
        const player = await db.slaveMarketPlayer.findUnique({ where: { userId } });

        if (!player) {
            throw new Error('玩家不存在');
        }

        if (amount <= 0) {
            throw new Error('取款金额必须大于0');
        }

        const now = Date.now();
        const interest = this.calculateInterest(player);
        let balanceAfterInterest = player.balance;

        if (interest > 0) {
            balanceAfterInterest += interest;
        }

        if (player.deposit < amount) {
            throw new Error('存款不足');
        }

        const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
            if (interest > 0) {
                await tx.slaveMarketTransaction.create({
                    data: {
                        userId,
                        type: 'interest',
                        amount: interest,
                        balance: balanceAfterInterest,
                        description: '存款利息结算',
                    },
                });
            }

            const updated = await tx.slaveMarketPlayer.update({
                where: { userId },
                data: {
                    balance: balanceAfterInterest + amount,
                    deposit: player.deposit - amount,
                    lastInterestTime: BigInt(now),
                },
            });

            await tx.slaveMarketTransaction.create({
                data: {
                    userId,
                    type: 'withdraw',
                    amount,
                    balance: updated.balance,
                    description: '取款',
                },
            });

            return updated;
        });

        return {
            newDeposit: result.deposit,
            newBalance: result.balance,
        };
    }

    /**
     * 计算利息
     */
    calculateInterest(player: SlaveMarketPlayer): number {
        if (player.deposit <= 0) {
            return 0;
        }

        const lastTime = player.lastInterestTime ? Number(player.lastInterestTime) : Date.now();
        const now = Date.now();
        const elapsedHours = Math.min(
            Math.floor((now - lastTime) / HOUR_MS),
            MAX_INTEREST_HOURS
        );

        if (elapsedHours <= 0) {
            return 0;
        }

        const rate = this.config.存款利率;
        const interest = Math.floor(player.deposit * rate * elapsedHours);

        return interest;
    }

    /**
     * 领取利息
     */
    async claimInterest(userId: string): Promise<{
        interest: number;
        newBalance: number;
        hours: number;
    }> {
        const db = getDatabase();
        const player = await db.slaveMarketPlayer.findUnique({ where: { userId } });

        if (!player) {
            throw new Error('玩家不存在');
        }

        const interest = this.calculateInterest(player);

        if (interest <= 0) {
            throw new Error('当前没有可领取的利息');
        }

        const lastTime = player.lastInterestTime ? Number(player.lastInterestTime) : Date.now();
        const now = Date.now();
        const hours = Math.min(
            Math.floor((now - lastTime) / HOUR_MS),
            MAX_INTEREST_HOURS
        );

        const result = await db.slaveMarketPlayer.update({
            where: { userId },
            data: {
                balance: player.balance + interest,
                lastInterestTime: BigInt(now),
            },
        });

        // 记录交易
        await this.transactionService.createTransaction({
            userId,
            type: 'interest',
            amount: interest,
            balance: result.balance,
            description: `利息(${hours}小时)`,
        });

        return {
            interest,
            newBalance: result.balance,
            hours,
        };
    }

    /**
     * 升级信用等级
     */
    async upgradeCredit(userId: string): Promise<{
        newLevel: number;
        newLimit: number;
        cost: number;
    }> {
        const db = getDatabase();
        const player = await db.slaveMarketPlayer.findUnique({ where: { userId } });

        if (!player) {
            throw new Error('玩家不存在');
        }

        const currentLevel = player.creditLevel;
        const cost = Math.floor(1000 * Math.pow(2, currentLevel - 1));

        if (player.balance < cost) {
            throw new Error(`升级需要 ${cost} 金币，当前余额不足`);
        }

        const newLevel = currentLevel + 1;
        const newLimit = Math.floor(this.config.初始存款上限 * Math.pow(2, newLevel - 1));

        const result = await db.slaveMarketPlayer.update({
            where: { userId },
            data: {
                balance: player.balance - cost,
                creditLevel: newLevel,
                depositLimit: newLimit,
            },
        });

        // 记录交易
        await this.transactionService.createTransaction({
            userId,
            type: 'system',
            amount: -cost,
            balance: result.balance,
            description: `升级信用等级至 ${newLevel}`,
        });

        return {
            newLevel,
            newLimit,
            cost,
        };
    }

    /**
     * 计算贷款额度
     */
    calculateLoanLimit(player: SlaveMarketPlayer): number {
        const { 基础额度, 等级加成 } = this.config.贷款系统;
        const level = player.loanCreditLevel || 1;
        return Math.floor(基础额度 + (level - 1) * 等级加成);
    }

    /**
     * 申请贷款
     */
    async applyLoan(userId: string, amount: number): Promise<{
        newLoanBalance: number;
        newBalance: number;
    }> {
        const db = getDatabase();
        const player = await db.slaveMarketPlayer.findUnique({ where: { userId } });

        if (!player) {
            throw new Error('玩家不存在');
        }

        if (amount <= 0) {
            throw new Error('贷款金额必须大于0');
        }

        const limit = this.calculateLoanLimit(player);
        const available = limit - player.loanBalance;

        if (amount > available) {
            throw new Error(`可用额度不足，当前可贷: ${available}`);
        }

        const result = await db.slaveMarketPlayer.update({
            where: { userId },
            data: {
                balance: player.balance + amount,
                loanBalance: player.loanBalance + amount,
                lastLoanInterestTime: BigInt(Date.now()),
            },
        });

        // 记录交易
        await this.transactionService.createTransaction({
            userId,
            type: 'loan',
            amount,
            balance: result.balance,
            description: '贷款',
        });

        return {
            newLoanBalance: result.loanBalance,
            newBalance: result.balance,
        };
    }

    /**
     * 还款
     */
    async repayLoan(userId: string, amount: number): Promise<{
        newLoanBalance: number;
        newBalance: number;
    }> {
        const db = getDatabase();
        const player = await db.slaveMarketPlayer.findUnique({ where: { userId } });

        if (!player) {
            throw new Error('玩家不存在');
        }

        if (amount <= 0) {
            throw new Error('还款金额必须大于0');
        }

        if (player.loanBalance <= 0) {
            throw new Error('当前没有贷款');
        }

        const actualAmount = Math.min(amount, player.loanBalance);

        if (player.balance < actualAmount) {
            throw new Error('余额不足');
        }

        const result = await db.slaveMarketPlayer.update({
            where: { userId },
            data: {
                balance: player.balance - actualAmount,
                loanBalance: player.loanBalance - actualAmount,
            },
        });

        // 记录交易
        await this.transactionService.createTransaction({
            userId,
            type: 'repay',
            amount: -actualAmount,
            balance: result.balance,
            description: '还款',
        });

        return {
            newLoanBalance: result.loanBalance,
            newBalance: result.balance,
        };
    }

    /**
     * 计算贷款利息
     */
    calculateLoanInterest(player: SlaveMarketPlayer): number {
        if (player.loanBalance <= 0) {
            return 0;
        }

        const lastTime = player.lastLoanInterestTime ? Number(player.lastLoanInterestTime) : Date.now();
        const now = Date.now();
        const elapsedHours = Math.floor((now - lastTime) / HOUR_MS);

        if (elapsedHours <= 0) {
            return 0;
        }

        const rate = this.config.贷款系统.利率;
        const interest = Math.max(1, Math.floor(player.loanBalance * rate * elapsedHours));

        return interest;
    }

    /**
     * 累计贷款利息
     */
    async accrueLoanInterest(userId: string): Promise<SlaveMarketPlayer> {
        const db = getDatabase();
        const player = await db.slaveMarketPlayer.findUnique({ where: { userId } });

        if (!player || player.loanBalance <= 0) {
            return player!;
        }

        const interest = this.calculateLoanInterest(player);

        if (interest <= 0) {
            return player;
        }

        const lastTime = player.lastLoanInterestTime ? Number(player.lastLoanInterestTime) : Date.now();
        const now = Date.now();
        const elapsedHours = Math.floor((now - lastTime) / HOUR_MS);
        const nextTime = lastTime + elapsedHours * HOUR_MS;

        const result = await db.slaveMarketPlayer.update({
            where: { userId },
            data: {
                loanBalance: player.loanBalance + interest,
                lastLoanInterestTime: BigInt(nextTime),
            },
        });

        return result;
    }
}
