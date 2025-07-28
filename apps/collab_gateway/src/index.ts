import http from 'http';
import express from 'express';
import { Server as WebSocketServer } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';
import { connectionsTotal, register } from './metrics';
import { createClient } from 'redis';

const PORT = Number(process.env.PORT) || 1234;
const ALLOWED = new Set(
  (process.env.ALLOWED_ORIGINS || 'localhost:3000,localhost:5173').split(',')
);

function corsMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const origin = req.headers.origin;
  if (!origin) {
    return next();
  }
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return res.status(403).end();
  }
  if (!ALLOWED.has(host)) {
    return res.status(403).end();
  }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  next();
}

export function createApp(): express.Express {
  const app = express();
  app.use(corsMiddleware);
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/metrics', async (_req, res) => {
    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
  });
  return app;
}

export function createServer(): http.Server {
  const app = createApp();
  const server = http.createServer(app);
  const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379/0' });
  redis.connect().catch(() => undefined);
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const match = url.pathname.match(/^\/yjs\/(\w+)/);
    const token = match ? match[1] : null;
    if (!token) {
      socket.destroy();
      return;
    }
    const exists = await redis.hGet('collatex:projects', token);
    if (!exists) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      setupWSConnection(ws, req);
      connectionsTotal.labels(token).inc();
    });
  });
  return server;
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`Collab Gateway listening on ${PORT}`);
  });
}
