import { FastifyReply } from 'fastify';
import { timingSafeEqual } from 'crypto';

export function roomCookieName(roomId: string): string {
    // Cookie names can't contain certain characters; our roomIdSchema already
    // limits to [A-Za-z0-9_-] so this is safe as-is.
    return `mumbai_room_${roomId}`;
}

export function setRoomCookie(reply: FastifyReply, roomId: string, secret: string) {
    reply.setCookie(roomCookieName(roomId), secret, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60, // 1 hour; matches the outer cron cleanup window
    });
}

export function verifyRoomCookie(presented: string, expected: string): boolean {
    if (typeof presented !== 'string' || typeof expected !== 'string') return false;
    if (presented.length !== expected.length) return false;
    try {
        return timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
    } catch {
        return false;
    }
}
