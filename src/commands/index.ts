/**
 * 命令注册中心
 */

import type { PluginContext } from '@napgram/sdk';
import type { SlaveMarketConfig } from '../config';
import {
    PlayerService,
    CooldownService,
    TransactionService,
    BankService,
    WorkService,
    MarketService,
    FarmService,
    BodyguardService,
    VipService,
    RedPacketService,
    RankingService,
    AdminService,
} from '../services';
import { registerBaseCommands } from './base.commands';
import { registerBankCommands } from './bank.commands';
import { registerEconomyCommands } from './economy.commands';
import { registerMarketAndFarmCommands } from './gameplay.commands';
import { registerSocialCommands } from './social.commands';
import { registerAdminCommands } from './admin.commands';
import { consumeRecentRegistration } from '../utils/registration-tracker';
import { formatRegisterSuccess } from '../utils/register';

export function registerCommands(ctx: PluginContext, config: SlaveMarketConfig) {
    // 初始化服务
    const playerService = new PlayerService(ctx, config);
    const cooldownService = new CooldownService(ctx, config);
    const transactionService = new TransactionService(ctx);
    const bankService = new BankService(ctx, config, transactionService);
    const workService = new WorkService(ctx, config, transactionService, playerService);
    const marketService = new MarketService(ctx, config, transactionService, playerService);
    const farmService = new FarmService(ctx, config, transactionService);
    const bodyguardService = new BodyguardService(ctx, config, transactionService);
    const vipService = new VipService(ctx, config, transactionService);
    const redPacketService = new RedPacketService(ctx, config, transactionService);
    const rankingService = new RankingService(ctx);
    const adminService = new AdminService(ctx, config);

    const services = {
        playerService,
        cooldownService,
        transactionService,
        bankService,
        workService,
        marketService,
        farmService,
        bodyguardService,
        vipService,
        redPacketService,
        rankingService,
        adminService,
    };

    const originalCommand = ctx.command.bind(ctx);
    (ctx as any).command = (commandConfig: any) => {
        const wrappedHandler = async (event: any, args: string[]) => {
            if (commandConfig.name !== '注册') {
                const userId = event.sender.userId;
                const nickname = event.sender.userName || event.sender.userId;
                const groupId = event.channelType === 'group' ? event.channelId : undefined;
                const { player, created } = await playerService.getOrCreatePlayerWithStatus(userId, nickname, groupId);
                const shouldNotify = created || consumeRecentRegistration(userId);
                if (shouldNotify) {
                    await event.reply(formatRegisterSuccess(player, config));
                }
            }
            await commandConfig.handler(event, args);
        };

        return originalCommand({
            ...commandConfig,
            handler: wrappedHandler,
        });
    };

    // 注册各模块命令
    registerBaseCommands(ctx, config, services);
    registerBankCommands(ctx, config, services);
    registerEconomyCommands(ctx, config, services);
    registerMarketAndFarmCommands(ctx, config, services);
    registerSocialCommands(ctx, config, services);
    registerAdminCommands(ctx, config, services);

    ctx.logger.info('[slave-market] All commands registered');
}
