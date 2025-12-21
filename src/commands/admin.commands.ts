/**
 * 管理员命令
 */

import { createCommand, makeText } from '@napgram/sdk';
import type { PluginContext, MessageEvent } from '@napgram/sdk';
import type { SlaveMarketConfig } from '../config';
import { PlayerService, AdminService } from '../services';

export function registerAdminCommands(
    ctx: PluginContext,
    config: SlaveMarketConfig,
    services: {
        playerService: PlayerService;
        adminService: AdminService;
    }
) {
    const { playerService, adminService } = services;

    // 添加管理员命令
    ctx.command(createCommand({
        name: '添加管理员',
        description: '添加管理员（仅管理员）',
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
                    await event.reply([makeText('❌ 只有管理员可以执行此操作')]);
                    return;
                }

                const atSegments = event.message.segments.filter(s => s.type === 'at');
                const targetId = atSegments[0]?.data.userId || args[0];
                if (!targetId) {
                    await event.reply([makeText('❌ 请@要添加的用户')]);
                    return;
                }

                const targetPlayer = await playerService.getPlayer(targetId);
                if (!targetPlayer) {
                    await event.reply([makeText('❌ 目标玩家不存在')]);
                    return;
                }

                await adminService.addAdmin(userId, targetId, targetPlayer.nickname);

                await event.reply([makeText(`✅ 已添加 ${targetPlayer.nickname} 为管理员`)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 操作失败：${error.message}`)]);
            }
        }
    }));

    // 移除管理员命令
    ctx.command(createCommand({
        name: '移除管理员',
        description: '移除管理员（仅管理员）',
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
                    await event.reply([makeText('❌ 只有管理员可以执行此操作')]);
                    return;
                }

                const atSegments = event.message.segments.filter(s => s.type === 'at');
                const targetId = atSegments[0]?.data.userId || args[0];
                if (!targetId) {
                    await event.reply([makeText('❌ 请@要移除的用户')]);
                    return;
                }

                const targetPlayer = await playerService.getPlayer(targetId);
                if (!targetPlayer) {
                    await event.reply([makeText('❌ 目标玩家不存在')]);
                    return;
                }

                await adminService.removeAdmin(targetId);

                await event.reply([makeText(`✅ 已移除 ${targetPlayer.nickname} 的管理员权限`)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 操作失败：${error.message}`)]);
            }
        }
    }));

    // 系统统计命令
    ctx.command(createCommand({
        name: '系统统计',
        aliases: ['stats'],
        description: '查看系统统计（仅管理员）',
        handler: async (event: MessageEvent) => {
            try {
                const userId = event.sender.userId;
                const player = await playerService.getPlayer(userId);

                if (player?.commandBanned) {
                    await event.reply([makeText('❌ 你的命令权限已被禁用')]);
                    return;
                }
                const isAdmin = await playerService.isAdmin(userId);

                if (!isAdmin) {
                    await event.reply([makeText('❌ 只有管理员可以执行此操作')]);
                    return;
                }

                const stats = await adminService.getSystemStats();

                await event.reply([makeText(`📊 系统统计\n\n👥 总玩家数: ${stats.totalPlayers}\n📝 总交易数: ${stats.totalTransactions}\n💰 总余额: ${stats.totalBalance}\n🏦 总存款: ${stats.totalDeposit}\n👑 当前VIP: ${stats.activeVips}\n⚡ 24h活跃: ${stats.activePlayers24h}\n\n💎 总资产: ${stats.totalBalance + stats.totalDeposit}`)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 查询失败：${error.message}`)]);
            }
        }
    }));

    // 重置游戏命令
    ctx.command(createCommand({
        name: '重置游戏',
        description: '清空所有游戏数据（仅管理员）',
        handler: async (event: MessageEvent) => {
            try {
                const userId = event.sender.userId;
                const player = await playerService.getPlayer(userId);

                if (player?.commandBanned) {
                    await event.reply([makeText('❌ 你的命令权限已被禁用')]);
                    return;
                }
                const isAdmin = await playerService.isAdmin(userId);

                if (!isAdmin) {
                    await event.reply([makeText('❌ 只有管理员可以执行此操作')]);
                    return;
                }

                const result = await adminService.resetGame();

                await event.reply([makeText(`✅ 游戏数据已重置！\n\n删除数据：\n  玩家: ${result.players}\n  管理员: ${result.admins}\n  交易: ${result.transactions}\n  地块: ${result.farmLands}\n  装扮: ${result.appearances}\n  红包: ${result.redPackets}\n  红包领取: ${result.redPacketGrabs}\n  VIP卡密: ${result.vipCards}\n  系统配置: ${result.systemConfigs}\n\n⚠️ 所有游戏数据已清空！`)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 重置失败：${error.message}`)]);
            }
        }
    }));

    // 清理过期数据命令
    ctx.command(createCommand({
        name: '清理数据',
        description: '清理过期数据（仅管理员）',
        handler: async (event: MessageEvent) => {
            try {
                const userId = event.sender.userId;
                const player = await playerService.getPlayer(userId);

                if (player?.commandBanned) {
                    await event.reply([makeText('❌ 你的命令权限已被禁用')]);
                    return;
                }
                const isAdmin = await playerService.isAdmin(userId);

                if (!isAdmin) {
                    await event.reply([makeText('❌ 只有管理员可以执行此操作')]);
                    return;
                }

                const result = await adminService.cleanupExpiredData();

                await event.reply([makeText(`✅ 清理完成！\n\n清理数据：\n  过期红包: ${result.redPackets}\n  已用卡密: ${result.vipCards}`)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 清理失败：${error.message}`)]);
            }
        }
    }));

    // 给钱命令
    ctx.command(createCommand({
        name: '给钱',
        description: '给玩家加钱（仅管理员）',
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
                    await event.reply([makeText('❌ 只有管理员可以执行此操作')]);
                    return;
                }

                const atSegments = event.message.segments.filter(s => s.type === 'at');
                const targetId = atSegments[0]?.data.userId || args[0];
                if (!targetId) {
                    await event.reply([makeText('❌ 请@目标用户')]);
                    return;
                }

                const targetPlayer = await playerService.getPlayer(targetId);
                if (!targetPlayer) {
                    await event.reply([makeText('❌ 目标玩家不存在')]);
                    return;
                }

                const amount = Number(args[1] || args[0]);
                if (isNaN(amount)) {
                    await event.reply([makeText('❌ 请输入有效的金额')]);
                    return;
                }

                const newBalance = await adminService.giveBalance(targetId, amount);

                await event.reply([makeText(`✅ 已给 ${targetPlayer.nickname} 加钱\n\n💰 金额: ${amount}\n💵 新余额: ${newBalance}`)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 操作失败：${error.message}`)]);
            }
        }
    }));

    // 禁用玩家命令
    ctx.command(createCommand({
        name: '禁用玩家',
        description: '禁用玩家命令（仅管理员）',
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
                    await event.reply([makeText('❌ 只有管理员可以执行此操作')]);
                    return;
                }

                const atSegments = event.message.segments.filter(s => s.type === 'at');
                const targetId = atSegments[0]?.data.userId || args[0];
                if (!targetId) {
                    await event.reply([makeText('❌ 请@目标用户')]);
                    return;
                }

                const targetPlayer = await playerService.getPlayer(targetId);
                if (!targetPlayer) {
                    await event.reply([makeText('❌ 目标玩家不存在')]);
                    return;
                }

                await adminService.togglePlayerBan(targetId, true);

                await event.reply([makeText(`✅ 已禁用 ${targetPlayer.nickname} 的命令权限`)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 操作失败：${error.message}`)]);
            }
        }
    }));

    // 解禁玩家命令
    ctx.command(createCommand({
        name: '解禁玩家',
        description: '解禁玩家命令（仅管理员）',
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
                    await event.reply([makeText('❌ 只有管理员可以执行此操作')]);
                    return;
                }

                const atSegments = event.message.segments.filter(s => s.type === 'at');
                const targetId = atSegments[0]?.data.userId || args[0];
                if (!targetId) {
                    await event.reply([makeText('❌ 请@目标用户')]);
                    return;
                }

                const targetPlayer = await playerService.getPlayer(targetId);
                if (!targetPlayer) {
                    await event.reply([makeText('❌ 目标玩家不存在')]);
                    return;
                }

                await adminService.togglePlayerBan(targetId, false);

                await event.reply([makeText(`✅ 已解禁 ${targetPlayer.nickname} 的命令权限`)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 操作失败：${error.message}`)]);
            }
        }
    }));
}
