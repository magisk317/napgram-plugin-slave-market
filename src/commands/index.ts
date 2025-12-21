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

    // 注册各模块命令
    registerBaseCommands(ctx, config, services);
    registerBankCommands(ctx, config, services);
    registerEconomyCommands(ctx, config, services);
    registerMarketAndFarmCommands(ctx, config, services);
    registerSocialCommands(ctx, config, services);
    registerAdminCommands(ctx, config, services);

    ctx.logger.info('[slave-market] All commands registered');
}
