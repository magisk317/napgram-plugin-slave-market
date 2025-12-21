/**
 * TypeScript 类型定义
 */

export interface Player {
    id: number;
    userId: string;
    plainUserId?: string;
    nickname: string;
    balance: number;
    deposit: number;
    worth: number;
    creditLevel: number;
    loanBalance: number;
    ownerId?: string;
    ownedTime?: number;
    vipEndTime?: number;
    registerTime: number;
    lastWorkTime?: number;
    lastRobTime?: number;
    lastTransferTime?: number;
    lastBuyTime?: number;
    isAdmin: boolean;
    commandBanned: boolean;
}

export interface Transaction {
    id: number;
    userId: string;
    type: TransactionType;
    amount: number;
    balance: number;
    description?: string;
    createdAt: Date;
}

export type TransactionType =
    | 'work'           // 打工
    | 'rob'            // 抢劫
    | 'transfer'       // 转账
    | 'buy_player'     // 购买玩家
    | 'release'        // 放生
    | 'ransom'         // 赎身
    | 'deposit'        // 存款
    | 'withdraw'       // 取款
    | 'interest'       // 利息
    | 'loan'           // 贷款
    | 'repay'          // 还款
    | 'plant'          // 种地
    | 'harvest'        // 收获
    | 'buy_land'       // 购买地块
    | 'hire_guard'     // 雇佣保镖
    | 'red_packet'     // 红包
    | 'system';        // 系统

export interface FarmLand {
    id: number;
    userId: string;
    plotIndex: number;
    cropType?: string;
    plantTime?: number;
    harvestTime?: number;
}

export interface Crop {
    name: string;
    emoji: string;
    price: number;
    growTime: number;  // 成长时间（毫秒）
    baseYield: number;
    yieldRange: [number, number];
}

export interface Bodyguard {
    name: string;
    price: number;
    duration: number;  // 保护时长（毫秒）
    defense: number;   // 防御成功率 (0-1)
}

export interface CooldownRecord {
    userId: string;
    action: string;
    expireTime: number;
}
