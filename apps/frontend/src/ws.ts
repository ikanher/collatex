import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { WS_URL } from './config';
import { logDebug } from './debug';

export function connectWs(doc: Y.Doc, token: string, url: string = WS_URL) {
  logDebug('connectWs', `${url}/${token}`);
  const provider = new WebsocketProvider(url, token, doc);
  provider.on('connection-close', (event: CloseEvent) => {
    if (event.code === 1008) {
      provider.shouldConnect = false;
    }
  });
  return provider;
}
