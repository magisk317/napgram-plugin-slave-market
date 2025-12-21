/**
 * 基础命令 - 注册、个人信息、帮助等
 */

import { createCommand, makeText } from '@napgram/sdk';
import type { PluginContext, MessageEvent, CommandHandler } from '@napgram/sdk';
import type { SlaveMarketConfig } from '../config';
import { BankService, PlayerService, TransactionService } from '../services';

export function registerBaseCommands(
    ctx: PluginContext,
    config: SlaveMarketConfig,
    services: {
        playerService: PlayerService;
        bankService: BankService;
        transactionService: TransactionService;
    }
) {
    const { playerService, bankService, transactionService } = services;

    // 注册命令
    ctx.command(createCommand({
        name: '注册',
        description: '注册成为牛马玩家',
        handler: async (event: MessageEvent) => {
            try {
                const userId = event.sender.userId;
                const nickname = event.sender.userName || event.sender.userId;
                const groupId = event.channelType === 'group' ? event.channelId : undefined;

                const player = await playerService.getOrCreatePlayer(userId, nickname, groupId);

                if (player.commandBanned) {
                    await event.reply([makeText('❌ 你的命令权限已被禁用')]);
                    return;
                }

                if (player.registerTime && Date.now() - Number(player.registerTime) > 60000) {
                    await event.reply([makeText(`你已经注册过了！\n输入\"我的信息\"查看个人资料`)]);
                    return;
                }

                await event.reply([makeText(`🎉 注册成功！\n\n📝 你的信息：\n💰 余额：${player.balance}\n💎 身价：${player.worth}\n🏦 存款上限：${player.depositLimit}\n\n输入\"帮助\"查看所有命令`)]);
            } catch (error: any) {
                ctx.logger.error('[slave-market] Register error:', error);
                await event.reply([makeText(`❌ 注册失败：${error.message}`)]);
            }
        }
    }));

    // 我的信息命令
    ctx.command(createCommand({
        name: '我的信息',
        aliases: ['个人信息', 'profile'],
        description: '查看个人资料',
        handler: async (event: MessageEvent) => {
            try {
                const userId = event.sender.userId;
                const player = await playerService.getPlayer(userId);

                if (!player) {
                    await event.reply([makeText('❌ 你还未注册，输入\"注册\"开始游戏')]);
                    return;
                }

                if (player.commandBanned) {
                    await event.reply([makeText('❌ 你的命令权限已被禁用')]);
                    return;
                }

                await bankService.accrueLoanInterest(userId);
                const refreshedPlayer = await playerService.getPlayer(userId);

                if (!refreshedPlayer) {
                    await event.reply([makeText('❌ 你还未注册，输入\"注册\"开始游戏')]);
                    return;
                }

                const isVip = await playerService.isVip(userId);
                const isAdmin = await playerService.isAdmin(userId);
                const owner = await playerService.getOwner(userId);
                const slaves = await playerService.getSlaves(userId);
                const stats = await transactionService.getStatistics(userId);

                let info = `📊 个人信息\n\n👤 昵称：${refreshedPlayer.nickname}\n💰 余额：${refreshedPlayer.balance}\n💎 身价：${refreshedPlayer.worth}\n🏦 存款：${refreshedPlayer.deposit} / ${refreshedPlayer.depositLimit}\n⭐ 信用等级：${refreshedPlayer.creditLevel}`;

                if (refreshedPlayer.loanBalance > 0) {
                    info += `\n💳 贷款：${refreshedPlayer.loanBalance}`;
                }

                if (isVip) {
                    const remaining = refreshedPlayer.vipEndTime
                        ? Math.ceil((Number(refreshedPlayer.vipEndTime) - Date.now()) / 86400000)
                        : '永久';
                    info += `\n👑 VIP：${remaining === '永久' ? '永久' : `剩余${remaining}天`}`;
                }

                if (isAdmin) {
                    info += `\n🔧 管理员`;
                }

                if (owner) {
                    info += `\n\n👔 主人：${owner.nickname}`;
                }

                if (slaves.length > 0) {
                    info += `\n🐂 牛马数量：${slaves.length}`;
                    const topSlaves = slaves.slice(0, 3);
                    info += `\n   ${topSlaves.map(s => `${s.nickname}(${s.worth})`).join(', ')}`;
                }

                if (refreshedPlayer.bodyguardName && refreshedPlayer.bodyguardEndTime && Number(refreshedPlayer.bodyguardEndTime) > Date.now()) {
                    const remaining = Math.ceil((Number(refreshedPlayer.bodyguardEndTime) - Date.now()) / 60000);
                    info += `\n\n🛡️ 保镖：${refreshedPlayer.bodyguardName} (剩余${remaining}分钟)`;
                }

                info += `\n\n📈 统计：\n   累计收入：${stats.totalIncome}\n   累计支出：${stats.totalExpense}\n   交易次数：${stats.transactionCount}`;

                await event.reply([makeText(info)]);
            } catch (error: any) {
                ctx.logger.error('[slave-market] Profile error:', error);
                await event.reply([makeText(`❌ 查询失败：${error.message}`)]);
            }
        }
    }));

    // 帮助命令
    ctx.command(createCommand({
        name: '玩家帮助',
        aliases: ['帮助', 'help'],
        description: '查看游戏帮助',
        handler: async (event: MessageEvent) => {
            const userId = event.sender.userId;
            const player = await playerService.getPlayer(userId);

            if (player?.commandBanned) {
                await event.reply([makeText('❌ 你的命令权限已被禁用')]);
                return;
            }

            await event.reply([makeText(`🎮 大牛马时代 - 命令列表\n\n📝 基础命令：\n  注册 - 注册成为玩家\n  我的信息 - 查看个人资料\n  帮助 - 查看此帮助\n\n💰 经济命令：\n  打工 - 工作赚钱\n  监狱打工/踩缝纫机 - 服刑期间赚钱\n  抢劫 [@用户] [策略] - 抢劫其他玩家\n  存款 <金额> - 存入银行\n  取款 <金额> - 从银行取出\n  领取利息 - 领取存款利息\n  银行信息 - 查看银行账户\n  转账 [@用户] <金额> - 转账\n\n🐂 牛马市场：\n  牛马市场 - 查看可购买玩家\n  我的牛马 - 查看拥有的牛马\n  购买玩家 [@用户] - 购买玩家\n  放生 [@用户] - 解除雇佣关系\n  赎身 - 支付赎金获得自由\n\n🌾 种地系统：\n  开地 - 购买新地块\n  种地 [作物] [地块] - 种植作物\n  收获 - 收获成熟作物\n  地块状态 - 查看农场状态\n\n输入具体命令查看详细说明`)]);
        }
    }));

    // 重开命令
    ctx.command(createCommand({
        name: '重开',
        description: '清空数据重新开始',
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

                // 删除玩家数据（保留注册记录，重置数值）
                await playerService.updatePlayer(userId, {
                    balance: config.初始余额,
                    deposit: 0,
                    worth: config.初始身价,
                    creditLevel: 1,
                    depositLimit: config.初始存款上限,
                    loanBalance: 0,
                    ownerId: null,
                    vipEndTime: null,
                    lastWorkTime: null,
                    lastRobTime: null,
                    lastTransferTime: null,
                    lastBuyTime: null,
                });

                await event.reply([makeText(`✅ 重开成功！所有数据已重置\n\n💰 初始余额：${config.初始余额}\n💎 初始身价：${config.初始身价}`)]);
            } catch (error: any) {
                ctx.logger.error('[slave-market] Reset error:', error);
                await event.reply([makeText(`❌ 重开失败：${error.message}`)]);
            }
        }
    }));
}
