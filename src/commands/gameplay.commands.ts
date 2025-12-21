/**
 * 牛马市场和农场命令
 */

import { createCommand, makeText } from '@napgram/sdk';
import type { PluginContext, MessageEvent } from '@napgram/sdk';
import type { SlaveMarketConfig } from '../config';
import {
    PlayerService,
    CooldownService,
    TransactionService,
    MarketService,
    FarmService,
    BodyguardService,
} from '../services';

export function registerMarketAndFarmCommands(
    ctx: PluginContext,
    config: SlaveMarketConfig,
    services: {
        playerService: PlayerService;
        cooldownService: CooldownService;
        transactionService: TransactionService;
        marketService: MarketService;
        farmService: FarmService;
        bodyguardService: BodyguardService;
    }
) {
    const { playerService, cooldownService, marketService, farmService, bodyguardService } = services;

    // ========== 牛马市场命令 ==========

    // 牛马市场命令
    ctx.command(createCommand({
        name: '牛马市场',
        aliases: ['市场', 'market'],
        description: '查看可购买的玩家',
        handler: async (event: MessageEvent) => {
            try {
                const userId = event.sender.userId;
                const player = await playerService.getPlayer(userId);

                if (player?.commandBanned) {
                    await event.reply([makeText('❌ 你的命令权限已被禁用')]);
                    return;
                }
                const scopeKey = event.channelType === 'group' ? event.channelId : undefined;
                const players = await marketService.getMarketPlayers(scopeKey, 15);

                if (players.length === 0) {
                    await event.reply([makeText('🏪 牛马市场\n\n当前没有可购买的玩家！')]);
                    return;
                }

                let message = '🏪 牛马市场（自由玩家）\n\n';

                for (let i = 0; i < players.length; i++) {
                    const p = players[i];
                    message += `${i + 1}. ${p.nickname}\n`;
                    message += `   💎 身价: ${p.worth}\n`;
                    message += `   ⏰ 注册: ${Math.floor((Date.now() - Number(p.registerTime)) / 86400000)}天前\n\n`;
                }

                message += `💡 使用\"购买玩家 @用户\"进行购买`;

                await event.reply([makeText(message)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 查询失败：${error.message}`)]);
            }
        }
    }));

    // 我的牛马命令
    ctx.command(createCommand({
        name: '我的牛马',
        aliases: ['牛马', 'slaves'],
        description: '查看自己拥有的牛马',
        handler: async (event: MessageEvent) => {
            try {
                const userId = event.sender.userId;
                const player = await playerService.getPlayer(userId);

                if (!player) {
                    await event.reply([makeText('❌ 你还未注册')]);
                    return;
                }

                if (player.commandBanned) {
                    await event.reply([makeText('❌ 你的命令权限已被禁用')]);
                    return;
                }
                const slaves = await playerService.getSlaves(userId);

                if (slaves.length === 0) {
                    await event.reply([makeText('你还没有牛马！\n\n💡 使用\"牛马市场\"查看可购买的玩家')]);
                    return;
                }

                let message = `🐂 我的牛马 (${slaves.length}个)\n\n`;

                for (let i = 0; i < slaves.length; i++) {
                    const s = slaves[i];
                    message += `${i + 1}. ${s.nickname}\n`;
                    message += `   💎 身价: ${s.worth}\n`;
                    if (s.ownedTime) {
                        message += `   ⏰ 购买: ${Math.floor((Date.now() - Number(s.ownedTime)) / 86400000)}天前\n\n`;
                    } else {
                        message += `   ⏰ 购买: 未知\n\n`;
                    }
                }

                await event.reply([makeText(message)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 查询失败：${error.message}`)]);
            }
        }
    }));

    // 购买玩家命令
    ctx.command(createCommand({
        name: '购买玩家',
        aliases: ['购买', 'buy'],
        description: '购买其他玩家成为牛马',
        handler: async (event: MessageEvent, args: string[]) => {
            try {
                const userId = event.sender.userId;
                const player = await playerService.getPlayer(userId);

                if (!player) {
                    await event.reply([makeText('❌ 你还未注册')]);
                    return;
                }

                if (player.commandBanned) {
                    await event.reply([makeText('❌ 你的命令权限已被禁用')]);
                    return;
                }
                const isAdmin = await playerService.isAdmin(userId);

                if (!isAdmin) {
                    await cooldownService.ensureReady(userId, '购买');
                }

                const atSegments = event.message.segments.filter(s => s.type === 'at');
                const targetId = atSegments[0]?.data.userId || args[0];
                if (!targetId || targetId === userId) {
                    await event.reply([makeText('❌ 请@一个有效的目标玩家')]);
                    return;
                }

                const targetPlayer = await playerService.getPlayer(targetId);
                if (!targetPlayer) {
                    await event.reply([makeText('❌ 目标玩家不存在')]);
                    return;
                }

                const result = await marketService.buyPlayer(userId, targetId, isAdmin);

                await cooldownService.updateCooldown(userId, '购买');

                await event.reply([makeText(`✅ 购买成功！\n\n🐂 购买: ${targetPlayer.nickname}\n💰 花费: ${result.price}\n💵 剩余余额: ${result.newBalance}\n\n现在ta是你的牛马了！`)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 购买失败：${error.message}`)]);
            }
        }
    }));

    // 放生命令
    ctx.command(createCommand({
        name: '放生',
        aliases: ['释放', 'release'],
        description: '释放牛马恢复其自由身',
        handler: async (event: MessageEvent, args: string[]) => {
            try {
                const userId = event.sender.userId;
                const player = await playerService.getPlayer(userId);

                if (!player) {
                    await event.reply([makeText('❌ 你还未注册')]);
                    return;
                }

                if (player.commandBanned) {
                    await event.reply([makeText('❌ 你的命令权限已被禁用')]);
                    return;
                }

                const atSegments = event.message.segments.filter(s => s.type === 'at');
                const targetId = atSegments[0]?.data.userId || args[0];
                if (!targetId) {
                    await event.reply([makeText('❌ 请@要释放的牛马')]);
                    return;
                }

                const targetPlayer = await playerService.getPlayer(targetId);
                if (!targetPlayer) {
                    await event.reply([makeText('❌ 目标玩家不存在')]);
                    return;
                }

                await marketService.releasePlayer(userId, targetId);

                await event.reply([makeText(`✅ 放生成功！\n\n已释放 ${targetPlayer.nickname}，ta恢复了自由！`)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 放生失败：${error.message}`)]);
            }
        }
    }));

    // 赎身命令
    ctx.command(createCommand({
        name: '赎身',
        aliases: ['ransom'],
        description: '支付赎金获得自由',
        handler: async (event: MessageEvent) => {
            try {
                const userId = event.sender.userId;
                const player = await playerService.getPlayer(userId);

                if (!player) {
                    await event.reply([makeText('❌ 你还未注册')]);
                    return;
                }

                if (player.commandBanned) {
                    await event.reply([makeText('❌ 你的命令权限已被禁用')]);
                    return;
                }
                const result = await marketService.ransom(userId);

                await event.reply([makeText(`✅ 赎身成功！\n\n💸 赎身费: ${result.price}\n💵 剩余余额: ${result.newBalance}\n\n🎉 你自由了！`)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 赎身失败：${error.message}`)]);
            }
        }
    }));

    // 抢牛马命令
    ctx.command(createCommand({
        name: '抢牛马',
        aliases: ['snatch'],
        description: '强制抢夺其他玩家的牛马',
        handler: async (event: MessageEvent, args: string[]) => {
            try {
                const userId = event.sender.userId;
                const player = await playerService.getPlayer(userId);

                if (!player) {
                    await event.reply([makeText('❌ 你还未注册')]);
                    return;
                }

                if (player.commandBanned) {
                    await event.reply([makeText('❌ 你的命令权限已被禁用')]);
                    return;
                }
                const isAdmin = await playerService.isAdmin(userId);

                if (!isAdmin) {
                    await cooldownService.ensureReady(userId, '购买');
                }

                const atSegments = event.message.segments.filter(s => s.type === 'at');
                const targetId = atSegments[0]?.data.userId || args[0];
                if (!targetId || targetId === userId) {
                    await event.reply([makeText('❌ 请@一个有效的目标玩家')]);
                    return;
                }

                const targetPlayer = await playerService.getPlayer(targetId);
                if (!targetPlayer) {
                    await event.reply([makeText('❌ 目标玩家不存在')]);
                    return;
                }

                const result = await marketService.snatchPlayer(userId, targetId, isAdmin);

                await cooldownService.updateCooldown(userId, '购买');

                await event.reply([makeText(`✅ 抢牛马成功！\n\n🐂 抢得: ${targetPlayer.nickname}\n💰 花费: ${result.price}\n💵 剩余余额: ${result.newBalance}`)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 抢牛马失败：${error.message}`)]);
            }
        }
    }));

    // ========== 农场系统 ==========

    // 开地命令
    ctx.command(createCommand({
        name: '开地',
        aliases: ['buy-land'],
        description: '购买新地块',
        handler: async (event: MessageEvent) => {
            try {
                const userId = event.sender.userId;
                const player = await playerService.getPlayer(userId);

                if (!player) {
                    await event.reply([makeText('❌ 你还未注册')]);
                    return;
                }

                if (player.commandBanned) {
                    await event.reply([makeText('❌ 你的命令权限已被禁用')]);
                    return;
                }

                const isAdmin = await playerService.isAdmin(userId);
                const result = await farmService.buyLand(userId, isAdmin);

                await event.reply([makeText(`✅ 开地成功！\n\n🌾 地块编号: ${result.plotIndex}\n💰 花费: ${result.cost}\n💵 剩余余额: ${result.newBalance}\n\n💡 使用\"种地\"开始种植`)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 开地失败：${error.message}`)]);
            }
        }
    }));

    // 种地命令
    ctx.command(createCommand({
        name: '种地',
        aliases: ['plant'],
        description: '在地块上种植作物',
        handler: async (event: MessageEvent, args: string[]) => {
            try {
                const userId = event.sender.userId;
                const player = await playerService.getPlayer(userId);

                if (!player) {
                    await event.reply([makeText('❌ 你还未注册')]);
                    return;
                }

                if (player.commandBanned) {
                    await event.reply([makeText('❌ 你的命令权限已被禁用')]);
                    return;
                }
                const crop = args[0] || '小麦';
                const plotIndex = args[1] ? Number(args[1]) : undefined;

                if (plotIndex !== undefined && (isNaN(plotIndex) || plotIndex < 1)) {
                    await event.reply([makeText('❌ 地块编号无效')]);
                    return;
                }

                const validCrops = ['小麦', '玉米', '土豆', '胡萝卜', '番茄', '黄瓜', '茄子', '辣椒'];
                if (!validCrops.includes(crop)) {
                    await event.reply([makeText(`❌ 作物类型错误\n\n可选作物：${validCrops.join('、')}`)]);
                    return;
                }

                const isAdmin = await playerService.isAdmin(userId);
                const result = await farmService.plantCrop(userId, crop, plotIndex, isAdmin);

                await event.reply([makeText(`✅ 种植成功！\n\n🌾 作物: ${crop}\n📍 地块: ${result.plotsPlanted.join(', ')}\n💰 花费: ${result.cost}\n💵 剩余余额: ${result.newBalance}\n\n💡 到时使用\"收获\"收割作物`)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 种植失败：${error.message}`)]);
            }
        }
    }));

    // 收获命令
    ctx.command(createCommand({
        name: '收获',
        aliases: ['harvest'],
        description: '收获成熟的作物',
        handler: async (event: MessageEvent) => {
            try {
                const userId = event.sender.userId;
                const player = await playerService.getPlayer(userId);

                if (!player) {
                    await event.reply([makeText('❌ 你还未注册')]);
                    return;
                }

                if (player.commandBanned) {
                    await event.reply([makeText('❌ 你的命令权限已被禁用')]);
                    return;
                }
                const result = await farmService.harvestCrops(userId);

                if (result.harvested.length === 0) {
                    await event.reply([makeText('❌ 没有可收获的作物\n\n💡 使用\"地块状态\"查看农场')]);
                    return;
                }

                let message = `✅ 收获成功！\n\n`;
                message += `🌾 收获数量: ${result.harvested.length} 块地\n`;
                message += `💰 总收入: ${result.totalIncome}\n`;
                message += `💵 当前余额: ${result.newBalance}\n\n`;
                message += `收获详情：\n`;

                for (const h of result.harvested) {
                    message += `  地块${h.plotIndex}: ${h.cropName} → ${h.income}金币\n`;
                }

                await event.reply([makeText(message)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 收获失败：${error.message}`)]);
            }
        }
    }));

    // 地块状态命令
    ctx.command(createCommand({
        name: '地块状态',
        aliases: ['farm', 'land'],
        description: '查看农场地块状态',
        handler: async (event: MessageEvent) => {
            try {
                const userId = event.sender.userId;
                const player = await playerService.getPlayer(userId);

                if (!player) {
                    await event.reply([makeText('❌ 你还未注册')]);
                    return;
                }

                if (player.commandBanned) {
                    await event.reply([makeText('❌ 你的命令权限已被禁用')]);
                    return;
                }
                const lands = await farmService.getPlayerLands(userId);

                if (lands.length === 0) {
                    await event.reply([makeText('🌾 农场状态\n\n你还没有地块！\n\n💡 使用\"开地\"购买地块')]);
                    return;
                }

                const now = Date.now();
                let message = `🌾 农场状态 (${lands.length}块地)\n\n`;

                for (const land of lands) {
                    message += `📍 地块${land.plotIndex}:\n`;

                    if (land.cropType) {
                        message += `   作物: ${land.cropType}\n`;
                        const harvestTime = Number(land.harvestTime || 0);
                        if (harvestTime <= now) {
                            message += `   状态: ✅ 可收获\n`;
                        } else {
                            const remaining = Math.ceil((harvestTime - now) / 60000);
                            message += `   状态: 🌱 生长中 (${remaining}分钟)\n`;
                        }
                    } else {
                        message += `   状态: 空闲\n`;
                    }

                    message += `\n`;
                }

                message += `💡 使用\"种地\"种植，\"收获\"收割`;

                await event.reply([makeText(message)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 查询失败：${error.message}`)]);
            }
        }
    }));

    // ========== 保镖系统 ==========

    // 保镖市场命令
    ctx.command(createCommand({
        name: '保镖市场',
        aliases: ['bodyguards'],
        description: '查看可雇佣的保镖',
        handler: async (event: MessageEvent) => {
            try {
                const userId = event.sender.userId;
                const player = await playerService.getPlayer(userId);

                if (player?.commandBanned) {
                    await event.reply([makeText('❌ 你的命令权限已被禁用')]);
                    return;
                }
                const message = bodyguardService.formatBodyguardList();
                await event.reply([makeText(message)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 查询失败：${error.message}`)]);
            }
        }
    }));

    // 雇佣保镖命令
    ctx.command(createCommand({
        name: '雇佣保镖',
        aliases: ['hire'],
        description: '雇佣保镖保护自己',
        handler: async (event: MessageEvent, args: string[]) => {
            try {
                const userId = event.sender.userId;
                const player = await playerService.getPlayer(userId);

                if (!player) {
                    await event.reply([makeText('❌ 你还未注册')]);
                    return;
                }

                if (player.commandBanned) {
                    await event.reply([makeText('❌ 你的命令权限已被禁用')]);
                    return;
                }
                const name = args[0];

                if (!name) {
                    await event.reply([makeText('❌ 用法：雇佣保镖 <名称>')]);
                    return;
                }

                const isAdmin = await playerService.isAdmin(userId);
                const result = await bodyguardService.hireBodyguard(userId, name, isAdmin);

                await event.reply([makeText(`✅ 雇佣成功！\n\n🛡️ 保镖: ${name}\n⏰ 时长: ${result.duration}分钟\n💰 费用: ${result.cost}\n💵 剩余余额: ${result.newBalance}\n\n保镖将保护你免受抢劫！`)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 雇佣失败：${error.message}`)]);
            }
        }
    }));

    // 保镖状态命令
    ctx.command(createCommand({
        name: '保镖状态',
        aliases: ['bodyguard'],
        description: '查看当前保镖信息',
        handler: async (event: MessageEvent) => {
            try {
                const userId = event.sender.userId;
                const player = await playerService.getPlayer(userId);

                if (!player) {
                    await event.reply([makeText('❌ 你还未注册')]);
                    return;
                }

                if (player.commandBanned) {
                    await event.reply([makeText('❌ 你的命令权限已被禁用')]);
                    return;
                }

                if (!player.bodyguardName || !player.bodyguardEndTime || Number(player.bodyguardEndTime) <= Date.now()) {
                    await event.reply([makeText('🛡️ 保镖状态\n\n当前没有保镖\n\n💡 使用\"保镖市场\"查看可雇佣保镖')]);
                    return;
                }

                const remaining = Math.ceil((Number(player.bodyguardEndTime) - Date.now()) / 60000);
                const hours = Math.floor(remaining / 60);
                const minutes = remaining % 60;

                await event.reply([makeText(`🛡️ 保镖状态\n\n保镖: ${player.bodyguardName}\n⏰ 剩余: ${hours}小时${minutes}分钟\n\n你处于保镖的保护中！`)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 查询失败：${error.message}`)]);
            }
        }
    }));
}
