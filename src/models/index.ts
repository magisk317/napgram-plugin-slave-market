/**
 * 数据库模型初始化
 */

import type { PluginContext } from '@napgram/sdk';
import type { PrismaClient as PrismaClientType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('../prisma-client') as {
    PrismaClient: new (...args: any[]) => PrismaClientType;
};

let prisma: PrismaClientType | null = null;
let pool: Pool | null = null;

export function initializeDatabase(ctx: PluginContext): PrismaClientType {
    if (!prisma) {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error('DATABASE_URL is not set');
        }

        pool = new Pool({ connectionString });
        const adapter = new PrismaPg(pool);

        prisma = new PrismaClient({
            adapter,
            log: ctx.config.调试日志 ? ['query', 'error', 'warn'] : ['error'],
        });

        ctx.logger.info('[slave-market] Database initialized');
    }

    return prisma;
}

export function getDatabase(): PrismaClientType {
    if (!prisma) {
        throw new Error('Database not initialized. Call initializeDatabase first.');
    }
    return prisma;
}

export async function closeDatabase() {
    if (prisma) {
        await prisma.$disconnect();
        prisma = null;
    }

    if (pool) {
        await pool.end();
        pool = null;
    }
}

// 导出 Prisma 类型
export type {
    SlaveMarketPlayer,
    SlaveMarketTransaction,
    SlaveMarketFarmLand,
    SlaveMarketAppearance,
    SlaveMarketRedPacket,
    SlaveMarketRedPacketGrab,
    SlaveMarketVipCard,
    SlaveMarketSystem,
    SlaveMarketAdmin,
} from '@prisma/client';
