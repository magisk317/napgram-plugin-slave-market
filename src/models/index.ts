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

const DEFAULT_SCHEMA = 'slave_market';

let prisma: PrismaClientType | null = null;
let pool: Pool | null = null;

function applySchemaToUrl(connectionString: string, schema: string): string {
    if (!schema) {
        return connectionString;
    }

    try {
        const url = new URL(connectionString);
        const params = url.searchParams;
        if (!params.has('schema')) {
            params.set('schema', schema);
        }
        if (!params.has('options')) {
            params.set('options', `-c search_path=${schema}`);
        }
        url.search = params.toString();
        return url.toString();
    } catch {
        const hasSchema = /[?&]schema=/.test(connectionString);
        const hasOptions = /[?&]options=/.test(connectionString);
        let next = connectionString;
        if (!hasSchema) {
            const separator = next.includes('?') ? '&' : '?';
            next = `${next}${separator}schema=${encodeURIComponent(schema)}`;
        }
        if (!hasOptions) {
            const separator = next.includes('?') ? '&' : '?';
            next = `${next}${separator}options=${encodeURIComponent(`-c search_path=${schema}`)}`;
        }
        return next;
    }
}

export function initializeDatabase(ctx: PluginContext): PrismaClientType {
    if (!prisma) {
        const schema = (process.env.SLAVE_MARKET_DB_SCHEMA || DEFAULT_SCHEMA).trim();
        const baseUrl = process.env.SLAVE_MARKET_DATABASE_URL || process.env.DATABASE_URL;
        if (!baseUrl) {
            throw new Error('SLAVE_MARKET_DATABASE_URL or DATABASE_URL is not set');
        }

        const connectionString = applySchemaToUrl(baseUrl, schema);

        pool = new Pool({ connectionString });
        const adapter = new PrismaPg(pool);

        prisma = new PrismaClient({
            adapter,
            log: ctx.config.调试日志 ? ['query', 'error', 'warn'] : ['error'],
        });

        ctx.logger.info(`[slave-market] Database initialized (schema: ${schema || 'public'})`);
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
