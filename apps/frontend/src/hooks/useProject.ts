import { useParams } from 'react-router-dom';
import { API_URL, WS_URL } from '../config';
import { logDebug } from '../debug';

export function useProject() {
  const { token } = useParams<{ token: string }>();
  const details = {
    token: token ?? '',
    api: API_URL,
    gatewayWS: `${WS_URL}/yjs`,
  } as const;
  logDebug('useProject', details);
  return details;
}
