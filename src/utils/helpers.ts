/**
 * 工具函数
 */

/**
 * 格式化数字（添加千分位）
 */
export function formatNumber(num: number): string {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 格式化时间差
 */
export function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        const remainingHours = hours % 24;
        return remainingHours > 0 ? `${days}天${remainingHours}小时` : `${days}天`;
    }

    if (hours > 0) {
        const remainingMinutes = minutes % 60;
        return remainingMinutes > 0 ? `${hours}小时${remainingMinutes}分钟` : `${hours}小时`;
    }

    if (minutes > 0) {
        const remainingSeconds = seconds % 60;
        return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`;
    }

    return `${seconds}秒`;
}

/**
 * 格式化日期
 */
export function formatDate(timestamp: number | bigint): string {
    const date = new Date(Number(timestamp));
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * 生成随机字符串
 */
export function randomString(length: number, charset: string = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'): string {
    let result = '';
    for (let i = 0; i < length; i++) {
        result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
}

/**
 * 计算百分比
 */
export function percentage(value: number, total: number, decimals: number = 1): string {
    if (total === 0) return '0%';
    return ((value / total) * 100).toFixed(decimals) + '%';
}

/**
 * 随机整数（包含min和max）
 */
export function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 检查是否在时间范围内
 */
export function isWithinTimeRange(timestamp: number | bigint, rangeMs: number): boolean {
    const now = Date.now();
    const time = Number(timestamp);
    return now - time <= rangeMs;
}

/**
 * 安全的除法（避免除零）
 */
export function safeDivide(numerator: number, denominator: number, defaultValue: number = 0): number {
    return denominator === 0 ? defaultValue : numerator / denominator;
}

/**
 * 限制数值范围
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}
