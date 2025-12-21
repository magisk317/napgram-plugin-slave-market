/**
 * 大牛马时代 - NapGram Plugin
 * 群聊经济养成游戏
 */

import { definePlugin } from '@napgram/sdk';
import type { PluginContext, MessageEvent } from '@napgram/sdk';
import { registerCommands } from './commands';
import { initializeDatabase, closeDatabase } from './models';
import { SlaveMarketConfig, defaultConfig } from './config';
import { PlayerService } from './services';

/**
 * 大牛马时代插件
 */
const plugin = definePlugin({
    id: 'slave-market',
    name: '大牛马时代',
    version: '1.0.0',
    author: 'NapGram Team',
    description: '群聊经济养成游戏插件',

    permissions: {
        instances: [0],
    },

    async install(ctx: PluginContext) {
        const config: SlaveMarketConfig = {
            ...defaultConfig,
            ...(ctx.config as Partial<SlaveMarketConfig>)
        };

        ctx.logger.info('[slave-market] Plugin activating...');

        // 初始化数据库
        initializeDatabase(ctx);

        // 注册命令
        registerCommands(ctx, config);

        // 创建玩家服务用于自动注册
        const playerService = new PlayerService(ctx, config);

        // 自动注册中间件
        ctx.on('message', async (event: MessageEvent) => {
            try {
                const userId = event.sender.userId;
                const nickname = event.sender.userName || event.sender.userId;
                const groupId = event.channelType === 'group' ? event.channelId : undefined;

                // 静默自动注册（不影响消息流）
                await playerService.getOrCreatePlayer(userId, nickname, groupId);
            } catch (error: any) {
                // 自动注册失败不影响其他功能
                ctx.logger.debug('[slave-market] Auto register failed:', error.message);
            }
        });

        // 注册卸载钩子
        ctx.onUnload(() => {
            ctx.logger.info('[slave-market] Plugin deactivating...');
            closeDatabase();
            ctx.logger.info('[slave-market] Plugin deactivated');
        });

        ctx.logger.info('[slave-market] Plugin activated successfully');
    }
});

export default plugin;
export { SlaveMarketConfig } from './config';
