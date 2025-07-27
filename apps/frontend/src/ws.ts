import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { WS_URL } from './config';

export function connectWs(doc: Y.Doc, url: string = WS_URL) {
  return new WebsocketProvider(url, 'main', doc);
}
