import request from 'supertest';
import { createServer } from '../src/index';
import { connectionsTotal, register } from '../src/metrics';
import WebSocket from 'ws';
import { AddressInfo } from 'net';

let server: ReturnType<typeof createServer>;
let baseURL: string;

beforeEach((done) => {
  process.env.ALLOWED_ORIGINS = 'localhost:3000';
  server = createServer();
  server.listen(0, () => {
    const address = server.address() as AddressInfo;
    baseURL = `http://localhost:${address.port}`;
    done();
  });
});

afterEach((done) => {
  server.close(done);
  register.resetMetrics();
  connectionsTotal.reset();
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

test('WebSocket increments metric', async () => {
  const wsUrl = baseURL.replace('http', 'ws');
  await new Promise((resolve) => {
    const ws = new WebSocket(wsUrl);
    ws.on('open', () => ws.close());
    ws.on('close', resolve);
  });
  const res = await request(baseURL).get('/metrics');
  expect(res.text).toContain('collatex_ws_connections_total 1');
});
