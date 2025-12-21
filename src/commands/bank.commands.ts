/**
 * 银行命令 - 存款、取款、利息、贷款等
 */

import { createCommand, makeText } from '@napgram/sdk';
import type { PluginContext, MessageEvent } from '@napgram/sdk';
import type { SlaveMarketConfig } from '../config';
import { BankService, PlayerService, CooldownService, TransactionService } from '../services';

export function registerBankCommands(
    ctx: PluginContext,
    config: SlaveMarketConfig,
    services: {
        playerService: PlayerService;
        bankService: BankService;
        cooldownService: CooldownService;
        transactionService: TransactionService;
    }
) {
    const { playerService, bankService, cooldownService, transactionService } = services;

    // 存款命令
    ctx.command(createCommand({
        name: '存款',
        description: '将余额存入银行',
        handler: async (event: MessageEvent, args: string[]) => {
            try {
                const userId = event.sender.userId;
                const player = await playerService.getPlayer(userId);

                if (!player) {
                    await event.reply([makeText('❌ 你还未注册，输入"注册"开始游戏')]);
                    return;
                }

                if (player.commandBanned) {
                    await event.reply([makeText('❌ 你的命令权限已被禁用')]);
                    return;
                }

                const amount = Number(args[0]);
                if (isNaN(amount) || amount <= 0) {
                    await event.reply([makeText('❌ 请输入有效的存款金额')]);
                    return;
                }

                const result = await bankService.deposit(userId, amount);

                await event.reply([makeText(`✅ 存款成功！\n\n💰 存款金额：${amount}\n🏦 当前存款：${result.newDeposit}\n💵 剩余余额：${result.newBalance}\n\n💡 提示：存款会产生利息，每小时 ${(config.存款利率 * 100).toFixed(1)}%`)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 存款失败：${error.message}`)]);
            }
        }
    }));

    // 取款命令
    ctx.command(createCommand({
        name: '取款',
        description: '从银行取出存款',
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

                const amount = Number(args[0]);
                if (isNaN(amount) || amount <= 0) {
                    await event.reply([makeText('❌ 请输入有效的取款金额')]);
                    return;
                }

                const result = await bankService.withdraw(userId, amount);

                await event.reply([makeText(`✅ 取款成功！\n\n💸 取款金额：${amount}\n🏦 剩余存款：${result.newDeposit}\n💰 当前余额：${result.newBalance}`)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 取款失败：${error.message}`)]);
            }
        }
    }));

    // 银行信息命令
    ctx.command(createCommand({
        name: '银行信息',
        aliases: ['银行'],
        description: '查看银行账户信息',
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

                const interest = bankService.calculateInterest(player);
                const loanLimit = bankService.calculateLoanLimit(player);
                const loanInterest = bankService.calculateLoanInterest(player);

                let info = `🏦 银行信息\n\n💰 存款：${player.deposit} / ${player.depositLimit}\n⭐ 信用等级：${player.creditLevel}\n💵 利率：${(config.存款利率 * 100).toFixed(1)}% / 小时`;

                if (interest > 0) {
                    info += `\n💎 可领取利息：${interest}`;
                }

                info += `\n\n💳 贷款信息：\n   当前贷款：${player.loanBalance}\n   可用额度：${loanLimit - player.loanBalance}\n   总额度：${loanLimit}`;

                if (loanInterest > 0) {
                    info += `\n   待付利息：${loanInterest}`;
                }

                const upgradeCost = Math.floor(1000 * Math.pow(2, player.creditLevel - 1));
                const nextLimit = Math.floor(config.初始存款上限 * Math.pow(2, player.creditLevel));
                info += `\n\n📈 升级信用：\n   下一级存款上限：${nextLimit}\n   升级费用：${upgradeCost}`;

                await event.reply([makeText(info)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 查询失败：${error.message}`)]);
            }
        }
    }));

    // 领取利息命令
    ctx.command(createCommand({
        name: '领取利息',
        description: '领取存款产生的利息',
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

                const result = await bankService.claimInterest(userId);

                await event.reply([makeText(`✅ 领取成功！\n\n💎 利息：${result.interest}\n⏰ 累计时长：${result.hours} 小时\n💰 当前余额：${result.newBalance}`)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 领取失败：${error.message}`)]);
            }
        }
    }));

    // 升级信用命令
    ctx.command(createCommand({
        name: '升级信用',
        description: '提升信用等级，扩大存款上限',
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

                const result = await bankService.upgradeCredit(userId);

                await event.reply([makeText(`✅ 升级成功！\n\n⭐ 新等级：${result.newLevel}\n🏦 存款上限：${result.newLimit}\n💸 消耗：${result.cost} 金币`)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 升级失败：${error.message}`)]);
            }
        }
    }));

    // 贷款命令
    ctx.command(createCommand({
        name: '贷款',
        description: '申请贷款',
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

                await bankService.accrueLoanInterest(userId);

                const amount = Number(args[0]);
                if (isNaN(amount) || amount <= 0) {
                    await event.reply([makeText('❌ 请输入有效的贷款金额')]);
                    return;
                }

                const result = await bankService.applyLoan(userId, amount);

                await event.reply([makeText(`✅ 贷款成功！\n\n💳 贷款金额：${amount}\n💰 当前余额：${result.newBalance}\n⚠️ 贷款总额：${result.newLoanBalance}\n\n💡 提示：贷款利息为 ${(config.贷款系统.利率 * 100).toFixed(1)}% / 小时，请及时还款！`)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 贷款失败：${error.message}`)]);
            }
        }
    }));

    // 还款命令
    ctx.command(createCommand({
        name: '还款',
        description: '偿还贷款',
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

                await bankService.accrueLoanInterest(userId);

                const amount = Number(args[0]);
                if (isNaN(amount) || amount <= 0) {
                    await event.reply([makeText('❌ 请输入有效的还款金额')]);
                    return;
                }

                const result = await bankService.repayLoan(userId, amount);

                await event.reply([makeText(`✅ 还款成功！\n\n💸 还款金额：${amount}\n💳 剩余贷款：${result.newLoanBalance} \n💰 当前余额：${ result.newBalance } `)]);
            } catch (error: any) {
                await event.reply([makeText(`❌ 还款失败：${ error.message } `)]);
            }
        }
    }));
}
