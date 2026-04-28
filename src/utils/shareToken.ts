import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

// A process-local secret for signing share tokens. Rotates on every restart
// -- that's fine because tokens are meant to be short-lived anyway, and any
// still-open share link would just need a new copy after a restart.
const SHARE_SECRET = randomBytes(32);

// Passing null creates a link without token-level expiry; the room still has
// to exist for the link to work.
const DEFAULT_TTL_MS = null;

function hmac(parts: string[]): Buffer {
    return createHmac('sha256', SHARE_SECRET).update(parts.join('|')).digest();
}

export function createShareToken(roomId: string, ttlMs: number | null = DEFAULT_TTL_MS): string {
    const nonce = randomBytes(12).toString('base64url');
    const exp = ttlMs === null ? '' : (Date.now() + ttlMs).toString();
    const sig = hmac([roomId, nonce, exp]).toString('base64url');
    return `${nonce}.${exp}.${sig}`;
}

export function verifyShareToken(roomId: string, token: string | undefined): boolean {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [nonce, exp, sig] = parts;

    if (exp !== '') {
        const expNum = Number(exp);
        if (!Number.isFinite(expNum) || Date.now() > expNum) return false;
    }

    const expected = hmac([roomId, nonce, exp]);
    let presented: Buffer;
    try {
        presented = Buffer.from(sig, 'base64url');
    } catch {
        return false;
    }
    if (presented.length !== expected.length) return false;
    try {
        return timingSafeEqual(presented, expected);
    } catch {
        return false;
    }
}
