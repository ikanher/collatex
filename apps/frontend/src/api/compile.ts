import api from './client';

export type CompileStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export async function startCompile(token: string, tex: string): Promise<string> {
  const res = await api.post(`/compile?project=${token}`, { tex });
  const loc = res.headers['location'] as string;
  return loc.split('/').pop()?.split('?')[0] as string;
}

export async function fetchPdf(jobId: string, token: string): Promise<Blob> {
  const res = await api.get(`/pdf/${jobId}?project=${token}`, { responseType: 'blob' });
  return res.data as Blob;
}
