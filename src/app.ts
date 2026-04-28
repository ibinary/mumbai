import FastifyStatic from '@fastify/static';
import FastifyView from '@fastify/view';
import ws from '@fastify/websocket';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import ejs from 'ejs';
import { fastify } from 'fastify';
import path from 'path';
import * as dotenv from 'dotenv';

import routes from './routes';
import handleWS from './utils/handleWebsocket';
import startCron from './utils/cron';
import { ExpressPeerServer } from 'peer';
import express from 'express';
import http from 'http';

dotenv.config();

// PeerJS runs as a separate signaling server. We bind it to localhost so the
// only way to reach it is through our reverse proxy (which terminates TLS
// and forwards /mumbai/* here). Two upgrade-listener WebSocket servers
// can't coexist on the same HTTP server without stomping on each other,
// so keeping PeerJS separate is actually the only reliable option.
const PEER_PATH = process.env.PEER_PATH || '/mumbai';
const PEER_PORT = Number(process.env.PEER_PORT) || 9000;
const PEER_HOST = process.env.PEER_HOST || '127.0.0.1';

(async () => {
  try {
    startCron();

    const server = fastify({
      logger: {
        level: process.env.LOG_LEVEL || 'warn',
        redact: {
          paths: [
            'req.headers.cookie',
            'req.headers.authorization',
            'req.query.k',
            'req.query.t',
            'req.query.peerId',
            'req.body.token',
          ],
          remove: true,
        },
      },
      disableRequestLogging: true,
      trustProxy: true,
    });

    await server.register(fastifyCookie, {
    });

    // PeerJS and the chat WebSocket now live on the same origin as the page,
    // so 'self' covers both http(s) and ws(s) upgrades without needing to
    // allow arbitrary remote hosts. media-src 'blob:' is needed for video
    // playback via srcObject on some browsers.
    const isProd = process.env.NODE_ENV === 'production';
    const connectSrc = ["'self'"];

    await server.register(fastifyHelmet, {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'font-src': ["'self'", 'data:'],
          'img-src': ["'self'", 'data:', 'blob:'],
          'media-src': ["'self'", 'blob:'],
          'connect-src': connectSrc,
          'frame-ancestors': ["'none'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"],
          'object-src': ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-origin' },
      referrerPolicy: { policy: 'no-referrer' },
      // HSTS only makes sense under TLS; skip it in dev.
      strictTransportSecurity: isProd
        ? { maxAge: 63072000, includeSubDomains: true, preload: true }
        : false,
    });

    await server.register(fastifyRateLimit, {
      global: false,
    });

    // Standalone PeerJS signaling on its own HTTP server bound to localhost.
    // We keep it separate from the Fastify server because multiple upgrade
    // listeners on the same HTTP server fight over every WebSocket handshake.
    // nginx terminates TLS and proxies PEER_PATH here.
    const peerApp = express();
    const peerHttp = http.createServer(peerApp);
    const peerServer = ExpressPeerServer(peerHttp, {
      path: '/',
      proxied: /^(1|true|yes|on)$/i.test((process.env.TRUST_PROXY || 'true').trim()),
      allow_discovery: false,
    });
    peerApp.use(PEER_PATH, peerServer);
    peerHttp.listen(PEER_PORT, PEER_HOST, () => {
      server.log.info(
        { port: PEER_PORT, host: PEER_HOST, path: PEER_PATH },
        'peer server listening'
      );
    });

    await server.register(FastifyStatic, {
      root: path.resolve('./public'),
      // Never serve the raw ejs templates.
      extensions: [],
    });

    await server.register(FastifyView, {
      engine: { ejs },
      root: 'public',
    });

    await server.register(routes);

    await server.register(ws, {
      options: {
        maxPayload: 16 * 1024,
      },
    });
    await server.register(async function (fastify) {
      fastify.get('/ws', { websocket: true }, handleWS(server.log));
    });

    await server.listen({
      port: Number(process.env.PORT) || 3001,
      host: process.env.HOST || '::',
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
