import { collectDefaultMetrics, Counter, Registry } from 'prom-client';

export const register = new Registry();
collectDefaultMetrics({ register });

export const connectionsTotal = new Counter({
  name: 'collatex_ws_connections_total',
  help: 'Total websocket connections',
  labelNames: ['project_token'],
  registers: [register],
});
