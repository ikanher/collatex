import http from 'http';
import express from 'express';
import { Server as WebSocketServer } from 'ws';
// The utils module ships only JavaScript, so we import the file directly
// and rely on our local declaration for types.
// y-websocket exposes the utils subpath explicitly. Importing without the file
// extension ensures Node can resolve it via the package export map.
import { setupWSConnection } from 'y-websocket/bin/utils';
import { connectionsTotal, register } from './metrics';
import { createClient } from 'redis';
import crypto from 'crypto';

type ProjectMeta = { locked: '0' | '1'; ownerKey: string; lastActivityAt: string };
const projectKey = (token: string) => `collatex:project:${token}`;

async function getProject(
  redis: ReturnType<typeof createClient>,
  token: string,
): Promise<ProjectMeta | null> {
  const res = await redis.hGetAll(projectKey(token));
  if (!res || Object.keys(res).length === 0) return null;
  // default sane values
  return {
    locked: (res.locked as '0' | '1') ?? '0',
    ownerKey: res.ownerKey ?? '',
    lastActivityAt: res.lastActivityAt ?? String(Date.now()),
  };
}

async function setProject(
  redis: ReturnType<typeof createClient>,
  token: string,
  meta: Partial<ProjectMeta>,
) {
  await redis.hSet(projectKey(token), meta as Record<string, string>);
}

function nowMs() {
  return Date.now();
}

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
  app.use(express.json());
  app.use(corsMiddleware);

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/metrics', async (_req, res) => {
    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  // CREATE project (no-auth): returns { token, ownerKey }
  app.post('/projects', async (_req, res) => {
    const token = crypto.randomBytes(8).toString('base64url');
    const ownerKey = crypto.randomBytes(24).toString('base64url');
    const meta: ProjectMeta = {
      locked: '0',
      ownerKey,
      lastActivityAt: String(nowMs()),
    };
    const redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379/0',
    });
    await redis.connect();
    await setProject(redis, token, meta);
    await redis.hSet('collatex:projects', token, '1');
    await redis.quit();
    res.json({ token, ownerKey });
  });

  // GET project state (no secrets)
  app.get('/projects/:token', async (req, res) => {
    const redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379/0',
    });
    await redis.connect();
    const meta = await getProject(redis, req.params.token);
    await redis.quit();
    if (!meta) return res.status(404).json({ error: 'not_found' });
    const { locked, lastActivityAt } = meta;
    res.json({
      token: req.params.token,
      locked: locked === '1',
      lastActivityAt: Number(lastActivityAt),
    });
  });

  // LOCK (requires ownerKey)
  app.post('/projects/:token/lock', async (req, res) => {
    const { ownerKey } = req.body ?? {};
    const redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379/0',
    });
    await redis.connect();
    const meta = await getProject(redis, req.params.token);
    if (!meta) {
      await redis.quit();
      return res.status(404).json({ error: 'not_found' });
    }
    if (ownerKey !== meta.ownerKey) {
      await redis.quit();
      return res.status(403).json({ error: 'forbidden' });
    }
    await setProject(redis, req.params.token, { locked: '1' });
    await redis.quit();
    res.json({ ok: true });
  });

  // UNLOCK (requires ownerKey)
  app.post('/projects/:token/unlock', async (req, res) => {
    const { ownerKey } = req.body ?? {};
    const redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379/0',
    });
    await redis.connect();
    const meta = await getProject(redis, req.params.token);
    if (!meta) {
      await redis.quit();
      return res.status(404).json({ error: 'not_found' });
    }
    if (ownerKey !== meta.ownerKey) {
      await redis.quit();
      return res.status(403).json({ error: 'forbidden' });
    }
    await setProject(redis, req.params.token, { locked: '0' });
    await redis.quit();
    res.json({ ok: true });
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
    const match = url.pathname.match(/^\/yjs\/([\w-]+)/);
    const token = match ? match[1] : null;
    if (!token) {
      socket.destroy();
      return;
    }
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      const exists = await redis.hGet('collatex:projects', token);
      if (!exists) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }
    }
    // Touch activity on upgrade
    await setProject(redis, token, { lastActivityAt: String(nowMs()) });
    wss.handleUpgrade(req, socket, head, (ws) => {
      // Touch activity on any message
      ws.on('message', async () => {
        await setProject(redis, token, { lastActivityAt: String(nowMs()) });
      });
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
