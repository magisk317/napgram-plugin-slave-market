/**
 * 交易服务 - 记录和查询交易历史
 */

import type { PluginContext } from '@napgram/sdk';
import { getDatabase, type SlaveMarketTransaction } from '../models';
import type { TransactionType } from '../types';

export interface CreateTransactionParams {
    userId: string;
    type: TransactionType;
    amount: number;
    balance: number;
    targetId?: string;
    description?: string;
    metadata?: Record<string, any>;
}

export class TransactionService {
    constructor(private ctx: PluginContext) { }

    /**
     * 创建交易记录
     */
    async createTransaction(params: CreateTransactionParams): Promise<SlaveMarketTransaction> {
        const db = getDatabase();

        return db.slaveMarketTransaction.create({
            data: {
                userId: params.userId,
                type: params.type,
                amount: params.amount,
                balance: params.balance,
                targetId: params.targetId,
                description: params.description,
                metadata: params.metadata,
            },
        });
    }

    /**
     * 获取用户交易历史
     */
    async getTransactions(
        userId: string,
        options: {
            limit?: number;
            offset?: number;
            type?: TransactionType;
        } = {}
    ): Promise<SlaveMarketTransaction[]> {
        const db = getDatabase();
        const { limit = 20, offset = 0, type } = options;

        return db.slaveMarketTransaction.findMany({
            where: {
                userId,
                ...(type && { type }),
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: limit,
            skip: offset,
        });
    }

    /**
     * 获取交易统计
     */
    async getStatistics(userId: string): Promise<{
        totalIncome: number;
        totalExpense: number;
        transactionCount: number;
    }> {
        const db = getDatabase();

        const transactions = await db.slaveMarketTransaction.findMany({
            where: { userId },
            select: { amount: true },
        });

        let totalIncome = 0;
        let totalExpense = 0;

        for (const tx of transactions) {
            if (tx.amount > 0) {
                totalIncome += tx.amount;
            } else {
                totalExpense += Math.abs(tx.amount);
            }
        }

        return {
            totalIncome,
            totalExpense,
            transactionCount: transactions.length,
        };
    }

    /**
     * 获取最近的交易
     */
    async getRecentTransaction(
        userId: string,
        type: TransactionType
    ): Promise<SlaveMarketTransaction | null> {
        const db = getDatabase();

        return db.slaveMarketTransaction.findFirst({
            where: {
                userId,
                type,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    /**
     * 清除旧交易记录（保留最近N天）
     */
    async cleanOldTransactions(days: number = 30): Promise<number> {
        const db = getDatabase();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const result = await db.slaveMarketTransaction.deleteMany({
            where: {
                createdAt: {
                    lt: cutoffDate,
                },
            },
        });

        this.ctx.logger.info(`[slave-market] Cleaned ${result.count} old transactions`);
        return result.count;
    }
}
