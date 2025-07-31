import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { WS_URL } from './config';
import { logDebug } from './debug';

export function connectWs(doc: Y.Doc, url: string = WS_URL) {
  logDebug('connectWs', url);
  return new WebsocketProvider(url, 'main', doc);
}
