import {
    FastifyInstance,
    FastifyRequest,
    FastifyReply,
} from 'fastify';
import roomRoutes from './room.router';

export default async (
    fastify: FastifyInstance
) => {
    fastify.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
        await reply.view('home');
    });

    await fastify.register(roomRoutes, { prefix: '/room' });
};
