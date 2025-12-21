/**
 * 社交功能命令 - VIP、红包、排行榜
 */

import { createCommand, makeText } from '@napgram/sdk';
import type { PluginContext, MessageEvent } from '@napgram/sdk';
import type { SlaveMarketConfig } from '../config';
import {
    PlayerService,
    VipService,
    RedPacketService,
    RankingService,
} from '../services';

export function registerSocialCommands(
    ctx: PluginContext,
    config: SlaveMarketConfig,
    services: {
        playerService: PlayerService;
        vipService: VipService;
        redPacketService: RedPacketService;
        rankingService: RankingService;
    }
) {
    const { playerService, vipService, redPacketService, rankingService } = services;

    // ========== VIP系统 ==========

    // 生成VIP卡命令（仅管理员）
    ctx.command(createCommand({
        name: '生成vip卡',
        description: '生成VIP卡密（管理员）',
        handler: async (event: MessageEvent, args: string[]) => {
            try {
                const userId = event.sender.userId;
                const player = await playerService.getPlayer(userId);

                if (player?.commandBanned) {
                    await event.reply([makeText('❌ 你的命令权限已被禁用')]);
                    return;
                }
                const isAdmin = await playerService.isAdmin(userId);

                if (!isAdmin) {
                    await event.reply([makeText('❌ 只有管理员可以生成VIP卡')]);
                    return;
                }

                const type = args[0];
                const count = Number(args[1]);
                const hours = args[2] ? Number(args[2]) : undefined;

                if (!type || isNaN(count) || count <= 0 || count > 100) {
                    await event.reply([makeText('❌ 用法：生成vip卡 <类型> <数量> [小时]\n类型：日卡、周卡、月卡、小时卡\n数量：1-100')]);
                    return;
                }

                let cardType: '日卡' | '周卡' | '月卡' | '小时卡';

                switch (type) {
                    case '日卡':
                        cardType = '日卡';
                        break;
                    case '周卡':
                        cardType = '周卡';
                        break;
                    case '月卡':
                        cardType = '月卡';
                        break;
                    case '小时卡':
                        if (!hours || hours <= 0) {
                            await event.reply([makeText('❌ 小时卡需要指定时长')]);
                            return;
                        }
                        cardType = '小时卡';
                        break;
                    default:
                        await event.reply([makeText('❌ 卡类型错误，支持：日卡、周卡、月卡、小时卡')]);
                        return;
                }

                const cards = await vipService.generateVipCards(userId, cardType, count, hours);

                let message = `✅ 生成成功！\n\n`;
                message += `🎫 卡类型: ${cardType}\n`;
                message += `📦 数量: ${count}\n\n`;
                message += `卡密列表：\n`;

                for (let i = 0; i < cards.length; i++) {
                    message += `${i + 1}. ${cards[i]}\n`;
                }

                await event.reply([makeText(message)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 生成失败：${error.message}`)]);
            }
        }
    }));

    // VIP兑换命令
    ctx.command(createCommand({
        name: 'vip兑换',
        description: '兑换VIP卡密',
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
                const code = args[0];

                if (!code) {
                    await event.reply([makeText('❌ 请输入卡密')]);
                    return;
                }

                const result = await vipService.redeemVipCard(userId, code.toUpperCase());

                await event.reply([makeText(`✅ 兑换成功！\n\n🎫 卡类型: ${result.cardType}\n⏰ 时长: ${result.duration} 小时\n📅 到期时间: ${new Date(result.newEndTime).toLocaleString('zh-CN')}\n\n👑 VIP特权已激活！`)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 兑换失败：${error.message}`)]);
            }
        }
    }));

    // VIP状态命令
    ctx.command(createCommand({
        name: 'vip状态',
        aliases: ['vip'],
        description: '查看VIP状态',
        handler: async (event: MessageEvent) => {
            try {
                const userId = event.sender.userId;
                const player = await playerService.getPlayer(userId);

                if (player?.commandBanned) {
                    await event.reply([makeText('❌ 你的命令权限已被禁用')]);
                    return;
                }
                const status = await vipService.checkVipStatus(userId);

                if (!status.isVip) {
                    await event.reply([makeText(`👑 VIP状态\n\n当前未激活VIP\n\n💡 使用"vip兑换 <卡密>"激活VIP`)]);
                    return;
                }

                if (status.isPermanent) {
                    await event.reply([makeText(`👑 VIP状态\n\n状态: ✅ 永久VIP（管理员）\n\n🎁 特权：\n  - 转账免手续费\n  - 购买/抢牛马免花费\n  - 开地/种地/雇佣保镖免消耗\n  - 无冷却限制`)]);
                    return;
                }

                const days = Math.floor(status.remaining / 24);
                const hours = status.remaining % 24;

                await event.reply([makeText(`👑 VIP状态\n\n状态: ✅ 已激活\n⏰ 剩余: ${days}天 ${hours}小时\n\n🎁 特权：\n  - 转账免手续费\n  - 专属福利`)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 查询失败：${error.message}`)]);
            }
        }
    }));

    // ========== 红包系统 ==========

    // 发红包命令
    ctx.command(createCommand({
        name: '发红包',
        description: '发送红包',
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
                const userName = event.sender.userName || '匿名';
                const scopeKey = event.channelType === 'group' ? event.channelId! : userId;

                const amount = Number(args[0]);
                const count = Number(args[1]);

                if (isNaN(amount) || isNaN(count) || amount <= 0 || count <= 0) {
                    await event.reply([makeText('❌ 用法：发红包 <总金额> <份数>')]);
                    return;
                }

                const isAdmin = await playerService.isAdmin(userId);

                const result = await redPacketService.sendRedPacket(
                    userId,
                    userName,
                    amount,
                    count,
                    scopeKey,
                    isAdmin
                );

                let message = `✅ 红包已发出！\n\n`;
                message += `🧧 红包ID: ${result.packetId}\n`;
                message += `💰 总金额: ${amount}\n`;
                message += `📦 份数: ${count}\n`;

                if (result.fee > 0) {
                    message += `💳 手续费: ${result.fee}\n`;
                }

                message += `💵 剩余余额: ${result.newBalance}\n\n`;
                message += `💡 使用"抢红包 ${result.packetId}"抢红包`;

                await event.reply([makeText(message)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 发红包失败：${error.message}`)]);
            }
        }
    }));

    // 抢红包命令
    ctx.command(createCommand({
        name: '抢红包',
        aliases: ['抢', 'grab'],
        description: '抢红包',
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
                const userName = event.sender.userName || '匿名';
                const packetId = args[0];
                const scopeKey = event.channelType === 'group' ? event.channelId! : userId;

                if (!packetId) {
                    await event.reply([makeText('❌ 请输入红包ID')]);
                    return;
                }

                const result = await redPacketService.grabRedPacket(userId, userName, packetId, scopeKey);

                let message = `✅ 抢红包成功！\n\n`;
                message += `💰 金额: ${result.amount}\n`;
                message += `💵 当前余额: ${result.newBalance}\n`;
                message += `📦 剩余: ${result.remaining} 个\n`;

                if (result.lucky) {
                    message += `\n🎉 恭喜！你是手气最佳！`;
                }

                await event.reply([makeText(message)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 抢红包失败：${error.message}`)]);
            }
        }
    }));

    // ========== 排行榜系统 ==========

    // 身价排行榜
    ctx.command(createCommand({
        name: '身价排行',
        aliases: ['worth'],
        description: '查看身价排行榜',
        handler: async (event: MessageEvent) => {
            try {
                const userId = event.sender.userId;
                const player = await playerService.getPlayer(userId);

                if (player?.commandBanned) {
                    await event.reply([makeText('❌ 你的命令权限已被禁用')]);
                    return;
                }
                const ranking = await rankingService.getWorthRanking(10);

                if (ranking.length === 0) {
                    await event.reply([makeText('排行榜暂无数据')]);
                    return;
                }

                let message = '💎 身价排行榜\n\n';

                for (const item of ranking) {
                    const medal = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : '  ';
                    message += `${medal} ${item.rank}. ${item.player.nickname}\n`;
                    message += `      身价: ${item.value}\n\n`;
                }

                await event.reply([makeText(message)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 查询失败：${error.message}`)]);
            }
        }
    }));

    // 资产排行榜
    ctx.command(createCommand({
        name: '资金排行',
        aliases: ['asset'],
        description: '查看资产排行榜',
        handler: async (event: MessageEvent) => {
            try {
                const userId = event.sender.userId;
                const player = await playerService.getPlayer(userId);

                if (player?.commandBanned) {
                    await event.reply([makeText('❌ 你的命令权限已被禁用')]);
                    return;
                }
                const ranking = await rankingService.getAssetRanking(10);

                if (ranking.length === 0) {
                    await event.reply([makeText('排行榜暂无数据')]);
                    return;
                }

                let message = '💰 资产排行榜（余额+存款）\n\n';

                for (const item of ranking) {
                    const medal = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : '  ';
                    message += `${medal} ${item.rank}. ${item.player.nickname}\n`;
                    message += `      资产: ${item.value}\n\n`;
                }

                await event.reply([makeText(message)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 查询失败：${error.message}`)]);
            }
        }
    }));

    // 牛马排行榜
    ctx.command(createCommand({
        name: '牛马排行',
        aliases: ['slaves'],
        description: '查看牛马数量排行榜',
        handler: async (event: MessageEvent) => {
            try {
                const userId = event.sender.userId;
                const player = await playerService.getPlayer(userId);

                if (player?.commandBanned) {
                    await event.reply([makeText('❌ 你的命令权限已被禁用')]);
                    return;
                }
                const ranking = await rankingService.getSlaveCountRanking(10);

                if (ranking.length === 0) {
                    await event.reply([makeText('排行榜暂无数据')]);
                    return;
                }

                let message = '🐂 牛马排行榜\n\n';

                for (const item of ranking) {
                    const medal = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : '  ';
                    message += `${medal} ${item.rank}. ${item.player.nickname}\n`;
                    message += `      牛马数: ${item.value} 个\n\n`;
                }

                await event.reply([makeText(message)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 查询失败：${error.message}`)]);
            }
        }
    }));
}
