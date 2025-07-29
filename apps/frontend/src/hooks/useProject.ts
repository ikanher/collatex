import { useParams } from 'react-router-dom';
import { API_URL, WS_URL } from '../config';

export function useProject() {
  const { token } = useParams<{ token: string }>();
  return {
    token: token ?? '',
    api: API_URL,
    gatewayWS: `${WS_URL}/yjs`,
  } as const;
}
