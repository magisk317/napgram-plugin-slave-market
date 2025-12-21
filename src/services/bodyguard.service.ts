/**
 * 保镖服务 - 雇佣保镖、防护管理
 */

import type { PluginContext } from '@napgram/sdk';
import { getDatabase } from '../models';
import type { SlaveMarketConfig } from '../config';
import { TransactionService } from './transaction.service';
import type { Bodyguard } from '../types';

// 保镖配置
export const BODYGUARDS: Bodyguard[] = [
    { name: '普通保镖', price: 500, duration: 30 * 60 * 1000, defense: 0.6 },   // 30分钟，60%防御
    { name: '精英保镖', price: 1500, duration: 60 * 60 * 1000, defense: 0.8 },  // 1小时，80%防御
    { name: '专业保镖', price: 5000, duration: 120 * 60 * 1000, defense: 0.9 }, // 2小时，90%防御
    { name: '贴身保镖', price: 15000, duration: 360 * 60 * 1000, defense: 0.95 }, // 6小时，95%防御
];

export class BodyguardService {
    constructor(
        private ctx: PluginContext,
        private config: SlaveMarketConfig,
        private transactionService: TransactionService
    ) { }

    /**
     * 获取保镖信息
     */
    getBodyguard(name: string): Bodyguard | undefined {
        return BODYGUARDS.find(b => b.name === name);
    }

    /**
     * 雇佣保镖
     */
    async hireBodyguard(
        userId: string,
        bodyguardName: string,
        isAdmin: boolean = false
    ): Promise<{
        cost: number;
        duration: number;
        endTime: number;
        newBalance: number;
    }> {
        const db = getDatabase();

        const bodyguard = this.getBodyguard(bodyguardName);
        if (!bodyguard) {
            throw new Error(`未知的保镖：${bodyguardName}`);
        }

        const player = await db.slaveMarketPlayer.findUnique({ where: { userId } });
        if (!player) {
            throw new Error('玩家不存在');
        }

        // 检查是否已有保镖
        if (player.bodyguardEndTime && Number(player.bodyguardEndTime) > Date.now()) {
            const remaining = Math.ceil((Number(player.bodyguardEndTime) - Date.now()) / 60000);
            throw new Error(`当前保镖还有 ${remaining} 分钟，无需重复雇佣`);
        }

        const cost = isAdmin ? 0 : bodyguard.price;

        if (!isAdmin && player.balance < cost) {
            throw new Error(`雇佣${bodyguardName}需要 ${cost} 金币，余额不足`);
        }

        const now = Date.now();
        const endTime = now + bodyguard.duration;

        await db.slaveMarketPlayer.update({
            where: { userId },
            data: {
                balance: isAdmin ? player.balance : player.balance - cost,
                bodyguardName: bodyguard.name,
                bodyguardEndTime: BigInt(endTime),
            },
        });

        // 记录交易
        if (!isAdmin) {
            await this.transactionService.createTransaction({
                userId,
                type: 'hire_guard',
                amount: -cost,
                balance: player.balance - cost,
                description: `雇佣${bodyguardName}`,
            });
        }

        return {
            cost: isAdmin ? 0 : cost,
            duration: Math.floor(bodyguard.duration / 60000), // 分钟
            endTime,
            newBalance: isAdmin ? player.balance : player.balance - cost,
        };
    }

    /**
     * 检查保镖是否有效
     */
    async hasActiveBodyguard(userId: string): Promise<boolean> {
        const db = getDatabase();
        const player = await db.slaveMarketPlayer.findUnique({ where: { userId } });

        if (!player || !player.bodyguardEndTime) {
            return false;
        }

        return Number(player.bodyguardEndTime) > Date.now();
    }

    /**
     * 格式化保镖列表
     */
    formatBodyguardList(): string {
        let list = '🛡️ 保镖市场\n\n';

        for (const guard of BODYGUARDS) {
            const time = Math.floor(guard.duration / 60000);
            list += `${guard.name}\n`;
            list += `   价格: ${guard.price} 金币\n`;
            list += `   时长: ${time} 分钟\n`;
            list += `   防御: ${(guard.defense * 100).toFixed(0)}%\n\n`;
        }

        list += '💡 保镖可防止被抢劫';

        return list;
    }
}
