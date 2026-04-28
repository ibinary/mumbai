import {
    FastifyInstance,
    FastifyPluginOptions,
} from 'fastify';
import Rooms from '../utils/rooms';
import WSMessage from '../utils/wsMessage';
import { roomCookieName, verifyRoomCookie, setRoomCookie } from '../utils/roomAuth';
import { createShareToken, verifyShareToken } from '../utils/shareToken';

const ROOM_ID_PATTERN = '^[A-Za-z0-9_-]{1,32}$';
const roomIdSchema = { type: 'string', pattern: ROOM_ID_PATTERN } as const;
const DEFAULT_SHARE_TTL_MS = null;
const MAX_SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export default function roomRoutes(
    fastify: FastifyInstance,
    _opts: FastifyPluginOptions,
    done: (err?: Error | undefined) => void
) {
    // Create a room. Caller becomes the owner via an HttpOnly cookie containing
    // the secret key. Room id must match our strict regex so it can never
    // collide with route paths or leak into filenames.
    fastify.post<{
        Params: { id: string };
    }>(
        '/:id',
        {
            schema: {
                params: {
                    type: 'object',
                    required: ['id'],
                    properties: { id: roomIdSchema },
                },
            },
            config: {
                rateLimit: { max: 30, timeWindow: '1 minute' },
            },
        },
        async (req, reply) => {
            try {
                const room = Rooms.getInstance().new(req.params.id);
                setRoomCookie(reply, req.params.id, room.getSecretKey());
                return reply.send({
                    id: room.getId(),
                });
            } catch (err) {
                return reply
                    .code(409)
                    .send({ message: 'Room is already in use. Pick another name.' });
            }
        }
    );

    // Open a room page. The secret comes from the HttpOnly cookie. Shared links
    // can include a ?t= token; if valid, we exchange it for the room cookie and
    // redirect to the clean room URL.
    fastify.get<{
        Params: { id: string };
        Querystring: { t?: string };
    }>(
        '/:id',
        {
            schema: {
                params: {
                    type: 'object',
                    required: ['id'],
                    properties: { id: roomIdSchema },
                },
                querystring: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        t: { type: 'string', maxLength: 128 },
                    },
                },
            },
        },
        async (req, reply) => {
            const room = Rooms.getInstance().get(req.params.id);
            if (!room) return reply.redirect('/');

            const cookieSecret = req.cookies[roomCookieName(req.params.id)];
            const hasValid =
                cookieSecret !== undefined &&
                verifyRoomCookie(cookieSecret, room.getSecretKey());

            if (hasValid) {
                return reply.view('call', {
                    roomId: req.params.id,
                    peerPath: process.env.PEER_PATH || '/mumbai',
                });
            }

            if (verifyShareToken(req.params.id, req.query.t)) {
                setRoomCookie(reply, req.params.id, room.getSecretKey());
                return reply.redirect(`/room/${encodeURIComponent(req.params.id)}`);
            }

            return reply.view('share-join', { roomId: req.params.id });
        }
    );

    // Exchange a share token from the fallback join page.
    fastify.post<{
        Params: { id: string };
        Body: { token?: string };
    }>(
        '/:id/join-token',
        {
            schema: {
                params: {
                    type: 'object',
                    required: ['id'],
                    properties: { id: roomIdSchema },
                },
                body: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['token'],
                    properties: {
                        token: { type: 'string', maxLength: 128 },
                    },
                },
            },
            config: {
                rateLimit: { max: 60, timeWindow: '1 minute' },
            },
        },
        async (req, reply) => {
            const room = Rooms.getInstance().get(req.params.id);
            if (!room) return reply.code(404).send({ message: 'Not found' });

            if (!verifyShareToken(req.params.id, req.body?.token)) {
                return reply.code(403).send({ message: 'Forbidden' });
            }

            setRoomCookie(reply, req.params.id, room.getSecretKey());
            return reply.send({ success: true });
        }
    );

    // Mint a share token. Only the room owner (cookie holder) may call this.
    // No expiry is the default, but the owner can choose a token TTL.
    fastify.post<{
        Params: { id: string };
        Body: { expiresInMs?: number | null };
    }>(
        '/:id/share-token',
        {
            schema: {
                params: {
                    type: 'object',
                    required: ['id'],
                    properties: { id: roomIdSchema },
                },
                body: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        expiresInMs: {
                            anyOf: [
                                {
                                    type: 'integer',
                                    minimum: 60 * 1000,
                                    maximum: MAX_SHARE_TTL_MS,
                                },
                                { type: 'null' },
                            ],
                        },
                    },
                },
            },
            config: {
                rateLimit: { max: 30, timeWindow: '1 minute' },
            },
        },
        async (req, reply) => {
            const room = Rooms.getInstance().get(req.params.id);
            if (!room) return reply.code(404).send({ message: 'Not found' });

            const cookieSecret = req.cookies[roomCookieName(req.params.id)];
            if (
                cookieSecret === undefined ||
                !verifyRoomCookie(cookieSecret, room.getSecretKey())
            ) {
                return reply.code(403).send({ message: 'Forbidden' });
            }

            const requestedTtlMs = req.body?.expiresInMs;
            const ttlMs =
                requestedTtlMs === undefined
                    ? DEFAULT_SHARE_TTL_MS
                    : requestedTtlMs;
            const token = createShareToken(req.params.id, ttlMs);
            return reply.send({ token, expiresInMs: ttlMs });
        }
    );

    // Delete a room. Only the creator (holder of the cookie) may do this.
    fastify.delete<{ Params: { id: string } }>(
        '/delete/:id',
        {
            schema: {
                params: {
                    type: 'object',
                    required: ['id'],
                    properties: { id: roomIdSchema },
                },
            },
            config: {
                rateLimit: { max: 30, timeWindow: '1 minute' },
            },
        },
        async (req, reply) => {
            const room = Rooms.getInstance().get(req.params.id);
            if (!room) return reply.send({ success: true });

            const cookieSecret = req.cookies[roomCookieName(req.params.id)];
            if (
                cookieSecret === undefined ||
                !verifyRoomCookie(cookieSecret, room.getSecretKey())
            ) {
                return reply
                    .code(403)
                    .send({ success: false, message: 'Forbidden' });
            }

            try {
                room.broadcast(new WSMessage('force_close', {}));
                Rooms.getInstance().delete(req.params.id);
                reply
                    .clearCookie(roomCookieName(req.params.id), { path: '/' })
                    .send({ success: true });
            } catch {
                reply
                    .code(500)
                    .send({ success: false, message: 'Failed to delete the room' });
            }
        }
    );

    done();
}
