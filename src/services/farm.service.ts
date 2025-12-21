/**
 * 种地服务 - 地块管理、作物种植、收获等
 */

import type { PluginContext } from '@napgram/sdk';
import { getDatabase, type SlaveMarketFarmLand } from '../models';
import type { SlaveMarketConfig } from '../config';
import { TransactionService } from './transaction.service';
import type { Crop } from '../types';

// 作物配置
export const CROPS: Crop[] = [
    { name: '小麦', emoji: '🌾', price: 100, growTime: 5 * 60 * 1000, baseYield: 150, yieldRange: [120, 180] },
    { name: '玉米', emoji: '🌽', price: 200, growTime: 10 * 60 * 1000, baseYield: 350, yieldRange: [280, 420] },
    { name: '土豆', emoji: '🥔', price: 150, growTime: 8 * 60 * 1000, baseYield: 250, yieldRange: [200, 300] },
    { name: '胡萝卜', emoji: '🥕', price: 180, growTime: 7 * 60 * 1000, baseYield: 280, yieldRange: [220, 340] },
    { name: '番茄', emoji: '🍅', price: 250, growTime: 12 * 60 * 1000, baseYield: 450, yieldRange: [360, 540] },
    { name: '黄瓜', emoji: '🥒', price: 220, growTime: 10 * 60 * 1000, baseYield: 400, yieldRange: [320, 480] },
    { name: '茄子', emoji: '🍆', price: 280, growTime: 15 * 60 * 1000, baseYield: 550, yieldRange: [440, 660] },
    { name: '辣椒', emoji: '🌶️', price: 300, growTime: 18 * 60 * 1000, baseYield: 650, yieldRange: [520, 780] },
];

export class FarmService {
    constructor(
        private ctx: PluginContext,
        private config: SlaveMarketConfig,
        private transactionService: TransactionService
    ) { }

    /**
     * 获取作物信息
     */
    getCrop(cropName: string): Crop | undefined {
        return CROPS.find(c => c.name === cropName);
    }

    /**
     * 获取玩家的地块
     */
    async getPlayerLands(userId: string): Promise<SlaveMarketFarmLand[]> {
        const db = getDatabase();

        return db.slaveMarketFarmLand.findMany({
            where: { userId },
            orderBy: { plotIndex: 'asc' },
        });
    }

    /**
     * 购买新地块
     */
    async buyLand(userId: string, isAdmin: boolean = false): Promise<{
        plotIndex: number;
        cost: number;
        newBalance: number;
    }> {
        const db = getDatabase();

        const lands = await this.getPlayerLands(userId);
        const nextIndex = lands.length + 1;

        if (nextIndex > this.config.种地系统.最大地块数) {
            throw new Error(`最多只能拥有 ${this.config.种地系统.最大地块数} 块地`);
        }

        const cost = isAdmin ? 0 : this.config.种地系统.地块价格[nextIndex - 1] || 10000;

        const player = await db.slaveMarketPlayer.findUnique({ where: { userId } });
        if (!player) {
            throw new Error('玩家不存在');
        }

        if (!isAdmin && player.balance < cost) {
            throw new Error(`开地需要 ${cost} 金币，余额不足`);
        }

        await db.$transaction([
            // 扣除玩家余额
            db.slaveMarketPlayer.update({
                where: { userId },
                data: {
                    balance: isAdmin ? player.balance : player.balance - cost,
                },
            }),
            // 创建新地块
            db.slaveMarketFarmLand.create({
                data: {
                    userId,
                    plotIndex: nextIndex,
                },
            }),
        ]);

        // 记录交易
        if (!isAdmin) {
            await this.transactionService.createTransaction({
                userId,
                type: 'buy_land',
                amount: -cost,
                balance: player.balance - cost,
                description: `购买地块${nextIndex}`,
            });
        }

        return {
            plotIndex: nextIndex,
            cost: isAdmin ? 0 : cost,
            newBalance: isAdmin ? player.balance : player.balance - cost,
        };
    }

    /**
     * 种植作物
     */
    async plantCrop(
        userId: string,
        cropName: string,
        plotIndex?: number,
        isAdmin: boolean = false
    ): Promise<{
        plotsPlanted: number[];
        cost: number;
        newBalance: number;
    }> {
        const db = getDatabase();

        const crop = this.getCrop(cropName);
        if (!crop) {
            throw new Error(`未知的作物：${cropName}`);
        }

        const lands = await this.getPlayerLands(userId);
        if (lands.length === 0) {
            throw new Error('还没有地块，请先"开地"');
        }

        let targetLands: SlaveMarketFarmLand[];

        if (plotIndex) {
            // 种植指定地块
            const land = lands.find(l => l.plotIndex === plotIndex);
            if (!land) {
                throw new Error(`地块${plotIndex}不存在`);
            }
            if (land.cropType) {
                throw new Error(`地块${plotIndex}已种植 ${land.cropType}`);
            }
            targetLands = [land];
        } else {
            // 种植所有空地
            targetLands = lands.filter(l => !l.cropType);
            if (targetLands.length === 0) {
                throw new Error('没有空地块可以种植');
            }
        }

        const totalCost = isAdmin ? 0 : crop.price * targetLands.length;

        const player = await db.slaveMarketPlayer.findUnique({ where: { userId } });
        if (!player) {
            throw new Error('玩家不存在');
        }

        if (!isAdmin && player.balance < totalCost) {
            throw new Error(`种植需要 ${totalCost} 金币，余额不足`);
        }

        const now = Date.now();
        const harvestTime = now + crop.growTime;

        await db.$transaction([
            // 扣除玩家余额
            db.slaveMarketPlayer.update({
                where: { userId },
                data: {
                    balance: isAdmin ? player.balance : player.balance - totalCost,
                },
            }),
            // 更新地块
            ...targetLands.map(land =>
                db.slaveMarketFarmLand.update({
                    where: { id: land.id },
                    data: {
                        cropType: cropName,
                        plantTime: BigInt(now),
                        harvestTime: BigInt(harvestTime),
                    },
                })
            ),
        ]);

        // 记录交易
        if (!isAdmin) {
            await this.transactionService.createTransaction({
                userId,
                type: 'plant',
                amount: -totalCost,
                balance: player.balance - totalCost,
                description: `种植 ${cropName} x${targetLands.length}`,
            });
        }

        return {
            plotsPlanted: targetLands.map(l => l.plotIndex),
            cost: isAdmin ? 0 : totalCost,
            newBalance: isAdmin ? player.balance : player.balance - totalCost,
        };
    }

    /**
     * 收获作物
     */
    async harvestCrops(userId: string): Promise<{
        harvested: Array<{
            plotIndex: number;
            cropName: string;
            income: number;
        }>;
        totalIncome: number;
        newBalance: number;
        notReady: Array<{
            plotIndex: number;
            cropName: string;
            remaining: number;
        }>;
    }> {
        const db = getDatabase();

        const lands = await this.getPlayerLands(userId);
        const now = Date.now();

        const ready = lands.filter(l => l.cropType && l.harvestTime && Number(l.harvestTime) <= now);
        const notReady = lands.filter(l => l.cropType && l.harvestTime && Number(l.harvestTime) > now);

        if (ready.length === 0) {
            const notReadyInfo = notReady.map(l => ({
                plotIndex: l.plotIndex,
                cropName: l.cropType!,
                remaining: Math.ceil((Number(l.harvestTime!) - now) / 60000),
            }));

            throw new Error(notReadyInfo.length > 0 ? '没有成熟的作物' : '没有种植作物');
        }

        // 计算收益
        const harvested = ready.map(land => {
            const crop = this.getCrop(land.cropType!);
            if (!crop) {
                return { plotIndex: land.plotIndex, cropName: land.cropType!, income: 0 };
            }

            // 随机收益
            const [min, max] = crop.yieldRange;
            const income = Math.floor(Math.random() * (max - min + 1)) + min;

            return {
                plotIndex: land.plotIndex,
                cropName: land.cropType!,
                income,
            };
        });

        const totalIncome = harvested.reduce((sum, h) => sum + h.income, 0);

        const player = await db.slaveMarketPlayer.findUnique({ where: { userId } });
        if (!player) {
            throw new Error('玩家不存在');
        }

        await db.$transaction([
            // 增加玩家余额
            db.slaveMarketPlayer.update({
                where: { userId },
                data: {
                    balance: player.balance + totalIncome,
                },
            }),
            // 清空地块
            ...ready.map(land =>
                db.slaveMarketFarmLand.update({
                    where: { id: land.id },
                    data: {
                        cropType: null,
                        plantTime: null,
                        harvestTime: null,
                    },
                })
            ),
        ]);

        // 记录交易
        await this.transactionService.createTransaction({
            userId,
            type: 'harvest',
            amount: totalIncome,
            balance: player.balance + totalIncome,
            description: `收获作物 x${ready.length}`,
        });

        return {
            harvested,
            totalIncome,
            newBalance: player.balance + totalIncome,
            notReady: notReady.map(l => ({
                plotIndex: l.plotIndex,
                cropName: l.cropType!,
                remaining: Math.ceil((Number(l.harvestTime!) - now) / 60000),
            })),
        };
    }

    /**
     * 格式化作物列表
     */
    formatCropList(): string {
        let list = '🌾 作物列表\n\n';

        for (const crop of CROPS) {
            const time = Math.floor(crop.growTime / 60000);
            const [min, max] = crop.yieldRange;
            list += `${crop.emoji} ${crop.name}\n`;
            list += `   成本: ${crop.price} | 时长: ${time}分钟\n`;
            list += `   收益: ${min}-${max} (平均${crop.baseYield})\n\n`;
        }

        return list;
    }
}
