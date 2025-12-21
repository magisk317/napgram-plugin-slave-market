/**
 * 冷却时间服务
 */

import type { PluginContext } from '@napgram/sdk';
import { getDatabase } from '../models';
import type { SlaveMarketConfig } from '../config';

export type CooldownAction =
    | '打工'
    | '抢劫'
    | '转账'
    | '购买'
    | '种地'
    | '收获';

export class CooldownService {
    private readonly cooldownMap: Map<CooldownAction, keyof SlaveMarketConfig['冷却时间']> = new Map([
        ['打工', '打工'],
        ['抢劫', '抢劫'],
        ['转账', '转账'],
        ['购买', '购买'],
        ['种地', '种地'],
        ['收获', '收获'],
    ]);

    private readonly timeFieldMap: Map<CooldownAction, string> = new Map([
        ['打工', 'lastWorkTime'],
        ['抢劫', 'lastRobTime'],
        ['转账', 'lastTransferTime'],
        ['购买', 'lastBuyTime'],
        ['种地', 'lastPlantTime'],
        ['收获', 'lastHarvestTime'],
    ]);

    constructor(
        private ctx: PluginContext,
        private config: SlaveMarketConfig
    ) { }

    /**
     * 检查冷却时间
     */
    async checkCooldown(userId: string, action: CooldownAction): Promise<{
        ready: boolean;
        remaining: number;
    }> {
        const db = getDatabase();
        const player = await db.slaveMarketPlayer.findUnique({
            where: { userId },
        });

        if (!player) {
            throw new Error('玩家不存在');
        }

        const timeField = this.timeFieldMap.get(action);
        if (!timeField) {
            throw new Error(`未知的冷却动作: ${action}`);
        }

        const lastTime = (player as any)[timeField];
        if (!lastTime) {
            return { ready: true, remaining: 0 };
        }

        const configKey = this.cooldownMap.get(action)!;
        const cooldownDuration = this.config.冷却时间[configKey];
        const now = Date.now();
        const elapsed = now - Number(lastTime);

        if (elapsed >= cooldownDuration) {
            return { ready: true, remaining: 0 };
        }

        return {
            ready: false,
            remaining: Math.ceil((cooldownDuration - elapsed) / 1000), // 剩余秒数
        };
    }

    /**
     * 更新冷却时间
     */
    async updateCooldown(userId: string, action: CooldownAction): Promise<void> {
        const db = getDatabase();
        const timeField = this.timeFieldMap.get(action);

        if (!timeField) {
            throw new Error(`未知的冷却动作: ${action}`);
        }

        await db.slaveMarketPlayer.update({
            where: { userId },
            data: {
                [timeField]: BigInt(Date.now()),
            },
        });
    }

    /**
     * 格式化剩余时间
     */
    formatRemaining(seconds: number): string {
        if (seconds < 60) {
            return `${seconds}秒`;
        }

        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        if (minutes < 60) {
            return remainingSeconds > 0
                ? `${minutes}分${remainingSeconds}秒`
                : `${minutes}分钟`;
        }

        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;

        return remainingMinutes > 0
            ? `${hours}小时${remainingMinutes}分钟`
            : `${hours}小时`;
    }

    /**
     * 检查并抛出错误（如果还在冷却中）
     */
    async ensureReady(userId: string, action: CooldownAction): Promise<void> {
        const { ready, remaining } = await this.checkCooldown(userId, action);

        if (!ready) {
            throw new Error(`操作冷却中，请 ${this.formatRemaining(remaining)} 后再试`);
        }
    }
}
