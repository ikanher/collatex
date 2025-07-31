import { DEBUG } from './config';

export function logDebug(...args: unknown[]): void {
  if (DEBUG) {
    console.log('[debug]', ...args);
  }
}
