import { FastifyReply } from 'fastify';
import { FastifyInstance, FastifyPluginOptions, FastifyRequest } from 'fastify';
import Rooms from '../utils/rooms';
import WSMessage from '../utils/wsMessage'; // Added import for WSMessage

type MyRequest = FastifyRequest<{
    Params: { id: string };
    Querystring: {
        name: string;
        k: string; //secret key
    };
}>;

export default function roomRoutes(
    fastify: FastifyInstance,
    opts: FastifyPluginOptions,
    done: (err?: Error | undefined) => void
) {
    fastify.post('/:id', (req: MyRequest, reply: FastifyReply) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        reply.send(Rooms.getInstance().new(req.params.id));
    });

    fastify.get('/:id', (req: MyRequest, reply: FastifyReply) => {
        const secretKey = req.query.k;
        const thisRoom = Rooms.getInstance().get(req.params.id);
        if (!thisRoom || thisRoom.getSecretKey() !== secretKey) {
            return reply.redirect('/');
        }
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        reply.view('call', { roomId: req.params.id });
    });

    fastify.delete('/delete/:id', async (req: MyRequest, reply: FastifyReply) => {
        const roomId = req.params.id;
        try {
            const room = Rooms.getInstance().get(roomId);
            if (room) {
                // Notify all members to forcefully close the call
                room.boardcast(new WSMessage('force_close', {}));
                // Delete the room
                Rooms.getInstance().delete(roomId);
            }
            reply.send({ success: true, message: 'Room deleted successfully' });
        } catch (error) {
            reply.code(500).send({ success: false, message: 'Failed to delete the room' });
        }
    });

    done();
}
