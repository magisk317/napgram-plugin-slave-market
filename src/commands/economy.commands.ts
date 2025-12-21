/**
 * 经济命令 - 打工、抢劫、转账
 */

import { createCommand, makeText } from '@napgram/sdk';
import type { PluginContext, MessageEvent } from '@napgram/sdk';
import type { SlaveMarketConfig } from '../config';
import { WorkService, PlayerService, CooldownService, TransactionService, type RobStrategy } from '../services';

export function registerEconomyCommands(
    ctx: PluginContext,
    config: SlaveMarketConfig,
    services: {
        playerService: PlayerService;
        workService: WorkService;
        cooldownService: CooldownService;
        transactionService: TransactionService;
    }
) {
    const { playerService, workService, cooldownService, transactionService } = services;

    // 打工命令
    ctx.command(createCommand({
        name: '打工',
        aliases: ['work'],
        description: '打工赚钱',
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

                if (player.jailEndTime && Number(player.jailEndTime) > Date.now()) {
                    const remaining = Math.ceil((Number(player.jailEndTime) - Date.now()) / 60000);
                    await event.reply([makeText(`🚔 你还在监狱中，剩余 ${remaining} 分钟\n\n💡 使用"踩缝纫机"进行监狱打工`)]);
                    return;
                }

                // 检查冷却
                const isAdmin = await playerService.isAdmin(userId);
                if (!isAdmin) {
                    await cooldownService.ensureReady(userId, '打工');
                }

                // 执行打工
                const result = await workService.work(userId);

                // 更新冷却
                await cooldownService.updateCooldown(userId, '打工');

                let message = `💼 打工完成！\n\n💰 收入：${result.income}`;

                if (result.ownerShare > 0 && result.ownerName) {
                    message += `\n👔 主人分成：${result.ownerShare} (给 ${result.ownerName})`;
                }

                message += `\n💵 当前余额：${result.newBalance}`;

                await event.reply([makeText(message)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 打工失败：${error.message}`)]);
            }
        }
    }));

    // 监狱打工命令
    ctx.command(createCommand({
        name: '监狱打工',
        aliases: ['踩缝纫机'],
        description: '在监狱里踩缝纫机赚取收入',
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

                if (!player.jailEndTime || Number(player.jailEndTime) <= Date.now()) {
                    await event.reply([makeText('🚔 你还没有入狱，无法踩缝纫机')]);
                    return;
                }

                const isAdmin = await playerService.isAdmin(userId);
                if (!isAdmin) {
                    await cooldownService.ensureReady(userId, '打工');
                }

                const result = await workService.work(userId);

                await cooldownService.updateCooldown(userId, '打工');

                await playerService.updatePlayer(userId, {
                    jailWorkIncome: (player.jailWorkIncome || 0) + result.income,
                });

                const remaining = Math.ceil((Number(player.jailEndTime) - Date.now()) / 60000);
                await event.reply([makeText(`🔨 监狱打工完成！\n\n💰 收入：${result.income}\n💵 当前余额：${result.newBalance}\n⏰ 剩余刑期：${remaining} 分钟`)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 监狱打工失败：${error.message}`)]);
            }
        }
    }));

    // 抢劫命令
    ctx.command(createCommand({
        name: '抢劫',
        aliases: ['rob'],
        description: '抢劫其他玩家（策略：稳健/平衡/激进）',
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

                // 检查是否在监狱
                if (player.jailEndTime && Number(player.jailEndTime) > Date.now()) {
                    const remaining = Math.ceil((Number(player.jailEndTime) - Date.now()) / 60000);
                    await event.reply([makeText(`❌ 你还在监狱中，剩余 ${remaining} 分钟`)]);
                    return;
                }

                // 检查冷却
                const isAdmin = await playerService.isAdmin(userId);
                if (!isAdmin) {
                    await cooldownService.ensureReady(userId, '抢劫');
                }

                // 解析目标用户：从 @ 提及中获取
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

                // 解析策略
                let robStrategy: RobStrategy = '平衡';
                const strategy = args[1];
                if (strategy) {
                    const s = strategy.trim();
                    if (s === '稳健' || s === '激进') {
                        robStrategy = s;
                    }
                }

                // 执行抢劫
                const result = await workService.rob(userId, targetId, robStrategy);

                // 更新冷却
                await cooldownService.updateCooldown(userId, '抢劫');

                if (result.success) {
                    await event.reply([makeText(`✅ 抢劫成功！\n\n💰 抢得：${result.amount}\n💵 当前余额：${result.newBalance}\n🎯 目标余额：${result.targetBalance}\n\n策略：${robStrategy}`)]);
                } else {
                    await event.reply([makeText(`❌ 抢劫失败！\n\n💸 罚款：${result.penalty}\n⏰ 入狱时间：${result.jailTime} 分钟\n💵 剩余余额：${result.newBalance}\n\n💡 提示：入狱期间可以"踩缝纫机"赚钱`)]);
                }
            } catch (error: any) {
                await event.reply([makeText(`❌ 抢劫失败：${error.message}`)]);
            }
        }
    }));

    // 转账命令
    ctx.command(createCommand({
        name: '转账',
        aliases: ['transfer'],
        description: '转账给其他玩家',
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

                // 检查冷却
                const isAdmin = await playerService.isAdmin(userId);
                if (!isAdmin) {
                    await cooldownService.ensureReady(userId, '转账');
                }

                // 解析目标用户：从 @ 提及中获取
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

                // 解析金额
                const amount = Number(args[1] || args[0]);
                if (isNaN(amount) || amount <= 0) {
                    await event.reply([makeText('❌ 请输入有效的转账金额')]);
                    return;
                }

                // 检查是否为管理员/VIP
                const isVip = await playerService.isVip(userId);
                const transferFree = isAdmin || isVip;

                // 执行转账
                const result = await workService.transfer(userId, targetId, amount, transferFree);

                // 更新冷却
                await cooldownService.updateCooldown(userId, '转账');

                let message = `✅ 转账成功！\n\n💸 转账金额：${result.actualAmount}\n👤 接收人：${targetPlayer.nickname}`;

                if (result.fee > 0) {
                    message += `\n💳 手续费：${result.fee} (${(config.转账手续费 * 100).toFixed(1)}%)`;
                } else if (isAdmin) {
                    message += `\n👑 管理员免手续费`;
                } else if (isVip) {
                    message += `\n👑 VIP免手续费`;
                } else {
                    message += `\n👑 免手续费`;
                }

                message += `\n💰 当前余额：${result.newBalance}`;

                await event.reply([makeText(message)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 转账失败：${error.message}`)]);
            }
        }
    }));
}
