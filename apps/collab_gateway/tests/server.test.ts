import request from 'supertest';
import { createServer } from '../src/index';
import { connectionsTotal, register } from '../src/metrics';
import WebSocket from 'ws';
import { AddressInfo } from 'net';
import { createClient } from 'redis';

let redis: ReturnType<typeof createClient>;

let server: ReturnType<typeof createServer>;
let baseURL: string;

beforeEach((done) => {
  process.env.ALLOWED_ORIGINS = 'localhost:3000';
  redis = createClient();
  redis.connect().catch(() => undefined);
  redis.hSet('collatex:projects', 't1', new Date().toISOString());
  server = createServer();
  server.listen(0, () => {
    const address = server.address() as AddressInfo;
    baseURL = `http://localhost:${address.port}`;
    done();
  });
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  register.resetMetrics();
  connectionsTotal.reset();
  await redis.quit();
});

test('GET /healthz', async () => {
  const res = await request(baseURL).get('/healthz');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: 'ok' });
});

test('CORS preflight allowed', async () => {
  const res = await request(baseURL)
    .options('/healthz')
    .set('Origin', 'http://localhost:3000')
    .set('Access-Control-Request-Method', 'GET');
  expect(res.status).toBe(204);
});

test('CORS preflight denied', async () => {
  const res = await request(baseURL)
    .options('/healthz')
    .set('Origin', 'http://evil.com')
    .set('Access-Control-Request-Method', 'GET');
  expect(res.status).toBe(403);
});

test('WebSocket increments metric with token', async () => {
  const wsUrl = baseURL.replace('http', 'ws') + '/yjs/t1';
  await new Promise((resolve) => {
    const ws = new WebSocket(wsUrl);
    ws.on('open', () => ws.close());
    ws.on('close', resolve);
  });
  const res = await request(baseURL).get('/metrics');
  expect(res.text).toContain('collatex_ws_connections_total{project_token="t1"} 1');
});

test('WebSocket accepts arbitrary token in dev', async () => {
  const wsUrl = baseURL.replace('http', 'ws') + '/yjs/bad';
  await new Promise((resolve) => {
    const ws = new WebSocket(wsUrl);
    ws.on('open', () => ws.close());
    ws.on('close', resolve);
  });
});

test('WebSocket accepts token with dash', async () => {
  const token = 't-1';
  await redis.hSet('collatex:projects', token, new Date().toISOString());
  const wsUrl = baseURL.replace('http', 'ws') + `/yjs/${token}`;
  await new Promise((resolve) => {
    const ws = new WebSocket(wsUrl);
    ws.on('open', () => ws.close());
    ws.on('close', resolve);
  });
});

test('owner can lock and unlock project', async () => {
  const createRes = await request(baseURL).post('/projects');
  expect(createRes.status).toBe(200);
  const { token, ownerKey } = createRes.body;
  const lockRes = await request(baseURL)
    .post(`/projects/${token}/lock`)
    .send({ ownerKey });
  expect(lockRes.status).toBe(200);
  const unlockRes = await request(baseURL)
    .post(`/projects/${token}/unlock`)
    .send({ ownerKey });
  expect(unlockRes.status).toBe(200);
});
