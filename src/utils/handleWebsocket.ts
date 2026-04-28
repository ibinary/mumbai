import { SocketStream } from '@fastify/websocket';
import { FastifyBaseLogger, FastifyRequest } from 'fastify';
import WSMessage from './wsMessage';
import Rooms from './rooms';
import { User } from './user';
import WsClients from './wsClients';
import { roomCookieName, verifyRoomCookie } from './roomAuth';

type MyRequest = FastifyRequest<{
    Querystring: { roomId?: string; peerId?: string };
}>;

const ROOM_ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
const PEER_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const NAME_MAX = 40;

// WebSocket close codes used by the client for UX:
//   4400 = bad request      (missing / malformed params)
//   4401 = unauthenticated  (no / wrong room secret)
//   4403 = room full
//   4404 = room not found
export default function handleWS(log: FastifyBaseLogger) {
    return function (connection: SocketStream, request: MyRequest) {
        const { peerId = '', roomId = '' } = request.query;

        if (!ROOM_ID_RE.test(roomId) || !PEER_ID_RE.test(peerId)) {
            connection.socket.close(4400);
            return;
        }
        let safeName = 'Guest';
        let joined = false;

        const room = Rooms.getInstance().get(roomId);
        if (!room) {
            connection.socket.close(4404);
            return;
        }

        const cookieSecret = (request as FastifyRequest).cookies?.[roomCookieName(roomId)];
        if (!cookieSecret || !verifyRoomCookie(cookieSecret, room.getSecretKey())) {
            connection.socket.close(4401);
            return;
        }

        const joinTimeout = setTimeout(() => {
            if (!joined) connection.socket.close(4400);
        }, 10_000);
        joinTimeout.unref();

        log.debug({ event: 'ws_open' });

        const joinRoom = (displayName: unknown) => {
            if (joined) return;

            const currentRoom = Rooms.getInstance().get(roomId);
            if (!currentRoom) {
                connection.socket.close(4404);
                return;
            }
            if (currentRoom.isFull()) {
                try {
                    connection.socket.send(JSON.stringify(new WSMessage('room_full', {})));
                } catch {
                    /* ignore */
                }
                connection.socket.close(4403);
                return;
            }

            safeName =
                typeof displayName === 'string' && displayName.trim()
                    ? displayName.trim().slice(0, NAME_MAX)
                    : 'Guest';
            const newUser = new User(peerId, safeName, connection.socket);
            WsClients.getInstance().add(peerId, newUser);
            const beforeUpdateRoomData = [...(currentRoom.getMemberWithoutSocket() || [])];
            Rooms.getInstance().add(roomId, newUser);
            joined = true;
            clearTimeout(joinTimeout);

            try {
                connection.socket.send(
                    JSON.stringify(new WSMessage('join_room', beforeUpdateRoomData))
                );
            } catch {
                /* ignore */
            }
        };

        connection.socket.on('message', (messageRaw) => {
            let parsed: { type?: string; message?: unknown } | null = null;
            try {
                parsed = JSON.parse(messageRaw.toString()) as { type?: string; message?: unknown };
            } catch {
                return;
            }
            if (!parsed || typeof parsed.type !== 'string') return;
            const { type, message } = parsed;

            const currentRoom = Rooms.getInstance().get(roomId);
            if (!currentRoom) return;

            switch (type) {
                case 'join_profile': {
                    joinRoom(message);
                    break;
                }
                case 'microphone': {
                    if (!joined) return;
                    const value = Boolean(message);
                    WsClients.getInstance().get(peerId)?.setMicrophone(value);
                    currentRoom.broadcast(
                        new WSMessage('microphone', { peerId, value })
                    );
                    break;
                }
                case 'camera': {
                    if (!joined) return;
                    const value = Boolean(message);
                    WsClients.getInstance().get(peerId)?.setCamera(value);
                    currentRoom.broadcast(new WSMessage('camera', { peerId, value }));
                    break;
                }
                case 'message': {
                    if (!joined) return;
                    const text =
                        typeof message === 'string' ? message.slice(0, 2000) : '';
                    if (!text) return;
                    currentRoom.broadcast(
                        new WSMessage('message', { peerId, value: text })
                    );
                    break;
                }
                case 'keep-alive': {
                    try {
                        connection.socket.send(
                            JSON.stringify(new WSMessage('pong', 'alive'))
                        );
                    } catch {
                        /* ignore */
                    }
                    break;
                }
                default:
                    return;
            }
        });

        connection.socket.on('close', () => {
            try {
                clearTimeout(joinTimeout);
                if (joined) {
                    const r = Rooms.getInstance().get(roomId);
                    r?.removeMember(peerId);
                    WsClients.getInstance().delete(peerId);
                    r?.broadcast(new WSMessage('disconnect', peerId));
                    if (r && r.getMemberCount() === 0) {
                        Rooms.getInstance().delete(roomId);
                    }
                }
            } catch {
                /* ignore */
            }
            log.debug({ event: 'ws_close' });
        });
    };
}
