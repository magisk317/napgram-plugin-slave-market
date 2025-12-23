const recentRegistrations = new Map<string, number>();
const TTL_MS = 10000;

export function markRecentRegistration(userId: string) {
    recentRegistrations.set(userId, Date.now());
    if (recentRegistrations.size > 1000) {
        const now = Date.now();
        for (const [id, ts] of recentRegistrations) {
            if (now - ts > TTL_MS) {
                recentRegistrations.delete(id);
            }
        }
    }
}

export function consumeRecentRegistration(userId: string): boolean {
    const ts = recentRegistrations.get(userId);
    if (!ts) {
        return false;
    }
    if (Date.now() - ts > TTL_MS) {
        recentRegistrations.delete(userId);
        return false;
    }
    recentRegistrations.delete(userId);
    return true;
}
