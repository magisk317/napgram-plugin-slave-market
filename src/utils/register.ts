import type { SlaveMarketConfig } from '../config';
import type { SlaveMarketPlayer } from '../models';

export function formatRegisterSuccess(player: SlaveMarketPlayer, config: SlaveMarketConfig): string {
    return `🎉 注册成功！\n\n📝 你的信息：\n💰 余额：${player.balance}\n💎 身价：${player.worth}\n🏦 存款上限：${player.depositLimit}\n\n输入"帮助"查看所有命令`;
}
