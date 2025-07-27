import api from './client';

export type CompileStatus = 'queued' | 'running' | 'done' | 'error' | 'limit';

export async function startCompile(tex: string): Promise<string> {
  const res = await api.post('/compile', {
    projectId: 'demo',
    entryFile: 'main.tex',
    engine: 'tectonic',
    files: [{ path: 'main.tex', contentBase64: btoa(tex) }]
  });
  return res.data.jobId as string;
}

export async function pollJob(jobId: string): Promise<{ status: CompileStatus }> {
  const res = await api.get(`/jobs/${jobId}`);
  return res.data as { status: CompileStatus };
}

export async function fetchPdf(jobId: string): Promise<Blob> {
  const res = await api.get(`/pdf/${jobId}`, { responseType: 'blob' });
  return res.data as Blob;
}
