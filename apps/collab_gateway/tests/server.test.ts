import request from 'supertest';
import { createApp } from '../src/index';
import { register } from '../src/metrics';
import { AddressInfo } from 'net';
import http from 'http';
import { beforeEach, afterEach, describe, it, expect } from 'vitest';

let server: http.Server;
let baseURL: string;

describe('gateway server', () => {
  beforeEach(async () => {
    process.env.ALLOWED_ORIGINS = 'localhost:3000';
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseURL = `http://localhost:${address.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    register.resetMetrics();
  });

  it('GET /healthz', async () => {
    const res = await request(baseURL).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('CORS preflight allowed', async () => {
    const res = await request(baseURL)
      .options('/healthz')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.status).toBe(204);
  });

  it('CORS preflight denied', async () => {
    const res = await request(baseURL)
      .options('/healthz')
      .set('Origin', 'http://evil.com')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.status).toBe(403);
  });
});
