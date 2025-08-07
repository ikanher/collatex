import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { WS_URL } from './config';
import { logDebug } from './debug';

export function connectWs(doc: Y.Doc, token: string, url: string = WS_URL) {
  logDebug('connectWs', `${url}/${token}`);
  return new WebsocketProvider(url, token, doc);
}
