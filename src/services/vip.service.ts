/**
 * VIP服务 - 卡密管理、特权系统
 */

import type { PluginContext } from '@napgram/sdk';
import { getDatabase } from '../models';
import type { SlaveMarketConfig } from '../config';
import { TransactionService } from './transaction.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export class VipService {
    constructor(
        private ctx: PluginContext,
        private config: SlaveMarketConfig,
        private transactionService: TransactionService
    ) { }

    /**
     * 生成VIP卡密
     */
    async generateVipCards(
        creatorId: string,
        cardType: '日卡' | '周卡' | '月卡' | '小时卡',
        count: number,
        customHours?: number
    ): Promise<string[]> {
        const db = getDatabase();

        let duration: number;

        switch (cardType) {
            case '日卡':
                duration = DAY_MS;
                break;
            case '周卡':
                duration = 7 * DAY_MS;
                break;
            case '月卡':
                duration = 30 * DAY_MS;
                break;
            case '小时卡':
                if (!customHours || customHours <= 0) {
                    throw new Error('小时卡需要指定时长');
                }
                duration = customHours * HOUR_MS;
                break;
            default:
                throw new Error(`未知的卡类型: ${cardType}`);
        }

        const cards: string[] = [];

        for (let i = 0; i < count; i++) {
            const cardCode = this.generateCardCode();

            await db.slaveMarketVipCard.create({
                data: {
                    cardCode,
                    cardType,
                    duration,
                    createdBy: creatorId,
                },
            });

            cards.push(cardCode);
        }

        return cards;
    }

    /**
     * 兑换VIP卡
     */
    async redeemVipCard(userId: string, cardCode: string): Promise<{
        cardType: string;
        duration: number;
        newEndTime: number;
    }> {
        const db = getDatabase();

        const card = await db.slaveMarketVipCard.findUnique({
            where: { cardCode },
        });

        if (!card) {
            throw new Error('卡密不存在');
        }

        if (card.used) {
            throw new Error('该卡密已被使用');
        }

        const player = await db.slaveMarketPlayer.findUnique({
            where: { userId },
        });

        if (!player) {
            throw new Error('玩家不存在');
        }

        const now = Date.now();
        let newEndTime: number;

        if (player.vipEndTime && Number(player.vipEndTime) > now) {
            // 续期
            newEndTime = Number(player.vipEndTime) + card.duration;
        } else {
            // 新开
            newEndTime = now + card.duration;
        }

        await db.$transaction([
            // 更新玩家VIP状态
            db.slaveMarketPlayer.update({
                where: { userId },
                data: {
                    vipEndTime: BigInt(newEndTime),
                },
            }),
            // 标记卡密已使用
            db.slaveMarketVipCard.update({
                where: { cardCode },
                data: {
                    used: true,
                    usedBy: userId,
                    usedAt: new Date(),
                },
            }),
        ]);

        return {
            cardType: card.cardType,
            duration: Math.floor(card.duration / HOUR_MS),
            newEndTime,
        };
    }

    /**
     * 检查VIP状态
     */
    async checkVipStatus(userId: string): Promise<{
        isVip: boolean;
        remaining: number;
        isPermanent: boolean;
    }> {
        const db = getDatabase();
        const player = await db.slaveMarketPlayer.findUnique({
            where: { userId },
        });

        if (!player) {
            return { isVip: false, remaining: 0, isPermanent: false };
        }

        // 检查管理员永久VIP
        if (this.config.VIP配置.管理员永久VIP && player.isAdmin) {
            return { isVip: true, remaining: 0, isPermanent: true };
        }

        const admin = await db.slaveMarketAdmin.findUnique({
            where: { userId },
        });

        if (admin && this.config.VIP配置.管理员永久VIP) {
            return { isVip: true, remaining: 0, isPermanent: true };
        }

        // 检查VIP到期时间
        if (player.vipEndTime && Number(player.vipEndTime) > Date.now()) {
            const remaining = Math.ceil((Number(player.vipEndTime) - Date.now()) / HOUR_MS);
            return { isVip: true, remaining, isPermanent: false };
        }

        return { isVip: false, remaining: 0, isPermanent: false };
    }

    /**
     * 生成卡密码
     */
    private generateCardCode(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 16; i++) {
            if (i > 0 && i % 4 === 0) code += '-';
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    /**
     * 清理过期卡密
     */
    async cleanupExpiredCards(): Promise<number> {
        const db = getDatabase();
        const thirtyDaysAgo = new Date(Date.now() - 30 * DAY_MS);

        const result = await db.slaveMarketVipCard.deleteMany({
            where: {
                used: true,
                usedAt: {
                    lt: thirtyDaysAgo,
                },
            },
        });

        return result.count;
    }
}
