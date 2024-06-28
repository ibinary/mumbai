import FastifyStatic from '@fastify/static';
import FastifyView from '@fastify/view';
import ws from '@fastify/websocket';
import ejs from 'ejs';
import { fastify } from 'fastify';
import path from 'path';
import routes from './routes';
import handleWS from './utils/handleWebsocket';
import * as dotenv from 'dotenv';
import startCron from './utils/cron';
import https from 'https';
import { PeerServer } from 'peer';
import http from 'http';
import { exec } from 'child_process';
import fastifyCors from '@fastify/cors';
import fs from 'fs';
import forge from 'node-forge';

dotenv.config();

// Function to get public IPv6 address using curl
const getPublicIPv6 = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec('curl -s https://v6.ident.me', (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        reject(error);
        return;
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
        reject(new Error(stderr));
        return;
      }
      resolve(stdout.trim());
    });
  });
};

dotenv.config();

const getOrCreateSSL = () => {
  const keyPath = process.env.SSL_KEY_PATH || 'server-key.pem'; // Default path if undefined
  const certPath = process.env.SSL_CERT_PATH || 'server-cert.pem'; // Default path if undefined

  // Check if both key and cert files exist
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return {
      key: fs.readFileSync(keyPath, 'utf8'),
      cert: fs.readFileSync(certPath, 'utf8')
    };
  } else {
    // Generate a new self-signed certificate
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
    const attrs = [
      { name: 'commonName', value: 'localhost' },
      { name: 'countryName', value: 'US' },
      { shortName: 'ST', value: 'Virginia' },
      { name: 'localityName', value: 'Blacksburg' },
      { name: 'organizationName', value: 'Test' },
      { shortName: 'OU', value: 'Test' }
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey);

    const pemKey = forge.pki.privateKeyToPem(keys.privateKey);
    const pemCert = forge.pki.certificateToPem(cert);

    // Write to files for future use
    fs.writeFileSync(keyPath, pemKey, 'utf8');
    fs.writeFileSync(certPath, pemCert, 'utf8');

    return { key: pemKey, cert: pemCert };
  }
};

(async () => {
  try {
    startCron();

    const { key, cert } = getOrCreateSSL();

    const server = fastify({
      logger: true,
      https: { key, cert }
    });

    // Register CORS plugin globally
    server.register(fastifyCors, {
      origin: "*",  // Adjust based on your requirements
      methods: ["GET", "POST"]
    });

    // Initialize PeerServer with dynamic SSL configuration
    const peerServer = PeerServer({
      port: 9000,
      path: '/mumbai',
      proxied: true,
      ssl: {
        key: key,
        cert: cert
      },
      allow_discovery: true
    });

    // Serve static files
    await server.register(FastifyStatic, {
      root: path.resolve('./public'),
    });

    const publicIPv6 = await getPublicIPv6();
    // Setup view engine
    server.register(FastifyView, {
      engine: {
        ejs,
      },
      root: 'public',
    });

    // Register routes
    server.register(routes);

    // Setup WebSocket
    server.register(ws);
    server.register(async function (fastify) {
      fastify.get('/ws', { websocket: true }, handleWS(server.log));
    });

    // Define the /get-server-ip endpoint
    server.get('/get-server-ip', async (request, reply) => {
      try {
        const ipv6 = await getPublicIPv6();
        reply.send({ ipv6 });
      } catch (error) {
        reply.status(500).send({ error: 'Failed to retrieve IPv6 address' });
      }
    });

    // Listen on the retrieved IPv6 address
    await server.listen(Number(process.env.PORT) || 3001, publicIPv6, (err, address) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
