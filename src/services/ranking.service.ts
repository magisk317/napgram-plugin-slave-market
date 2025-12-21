/**
 * 排行榜服务
 */

import type { PluginContext } from '@napgram/sdk';
import { getDatabase, type SlaveMarketPlayer } from '../models';

export interface RankingItem {
    rank: number;
    player: SlaveMarketPlayer;
    value: number;
    extra?: any;
}

export class RankingService {
    constructor(private ctx: PluginContext) { }

    /**
     * 身价排行榜
     */
    async getWorthRanking(limit: number = 10): Promise<RankingItem[]> {
        const db = getDatabase();

        const players = await db.slaveMarketPlayer.findMany({
            orderBy: {
                worth: 'desc',
            },
            take: limit,
        });

        return players.map((p: any, i: number) => ({
            rank: i + 1,
            player: p,
            value: p.worth,
        }));
    }

    /**
     * 资产排行榜（余额+存款）
     */
    async getAssetRanking(limit: number = 10): Promise<RankingItem[]> {
        const db = getDatabase();

        const players = await db.slaveMarketPlayer.findMany();

        const ranked = players
            .map((p: any) => ({
                player: p,
                asset: p.balance + p.deposit,
            }))
            .sort((a: any, b: any) => b.asset - a.asset)
            .slice(0, limit);

        return ranked.map((item: any, i: number) => ({
            rank: i + 1,
            player: item.player,
            value: item.asset,
        }));
    }

    /**
     * 牛马数量排行榜
     */
    async getSlaveCountRanking(limit: number = 10): Promise<RankingItem[]> {
        const db = getDatabase();

        const players = await db.slaveMarketPlayer.findMany({
            include: {
                slaves: true,
            },
        });

        const ranked = players
            .map((p: any) => ({
                player: p,
                count: p.slaves.length,
            }))
            .filter((item: any) => item.count > 0)
            .sort((a: any, b: any) => b.count - a.count)
            .slice(0, limit);

        return ranked.map((item: any, i: number) => ({
            rank: i + 1,
            player: item.player,
            value: item.count,
            extra: { slaves: item.player.slaves },
        }));
    }
}
