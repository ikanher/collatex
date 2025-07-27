import axios from 'axios';
import { API_URL } from '../config';

export type CompileStatus = 'queued' | 'running' | 'done' | 'error' | 'limit';

export async function startCompile(tex: string): Promise<string> {
  const res = await axios.post(`${API_URL}/compile`, {
    projectId: 'demo',
    entryFile: 'main.tex',
    engine: 'tectonic',
    files: [{ path: 'main.tex', contentBase64: btoa(tex) }]
  });
  return res.data.jobId as string;
}

export async function pollJob(jobId: string): Promise<{ status: CompileStatus }> {
  const res = await axios.get(`${API_URL}/jobs/${jobId}`);
  return res.data as { status: CompileStatus };
}

export async function fetchPdf(jobId: string): Promise<Blob> {
  const res = await axios.get(`${API_URL}/pdf/${jobId}`, { responseType: 'blob' });
  return res.data as Blob;
}
