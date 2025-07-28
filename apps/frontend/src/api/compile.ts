import api from './client';

export type CompileStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export async function startCompile(tex: string): Promise<string> {
  const res = await api.post('/compile', {
    projectId: 'demo',
    entryFile: 'main.tex',
    engine: 'tectonic',
    files: [{ path: 'main.tex', contentBase64: btoa(tex) }]
  });
  return res.data.jobId as string;
}

export async function fetchPdf(jobId: string): Promise<Blob> {
  const res = await api.get(`/pdf/${jobId}`, { responseType: 'blob' });
  return res.data as Blob;
}
