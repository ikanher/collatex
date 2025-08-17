export interface BusyTexHandle {
  worker: Worker;
}

let handlePromise: Promise<BusyTexHandle> | null = null;

export async function initBusyTeX(): Promise<BusyTexHandle> {
  if (handlePromise) return handlePromise;
  handlePromise = new Promise((resolve, reject) => {
    try {
      const worker = new Worker('/vendor/busytex/busytex_worker.js');
      const paths = {
        busytex_pipeline_js: '/vendor/busytex/busytex_pipeline.js',
        busytex_wasm: '/vendor/busytex/busytex.wasm',
        texlive_basic: '/vendor/busytex/texlive-basic.js',
        texlive_ubuntu_latex_extra: '/vendor/busytex/ubuntu-texlive-latex-extra.js',
        texlive_ubuntu_latex_recommended: '/vendor/busytex/ubuntu-texlive-latex-recommended.js',
        texlive_ubuntu_science: '/vendor/busytex/ubuntu-texlive-science.js',
        preload_data_packages_js: [
          '/vendor/busytex/texlive-basic.js',
        ],
        data_packages_js: [
          '/vendor/busytex/texlive-basic.js',
          '/vendor/busytex/ubuntu-texlive-latex-extra.js',
          '/vendor/busytex/ubuntu-texlive-latex-recommended.js',
          '/vendor/busytex/ubuntu-texlive-science.js',
        ],
        texmf_local: ['./texmf', './.texmf'],
      } as const;
      const onError = (err: any) => {
        reject({ stage: 'init', message: String(err) });
      };
      worker.addEventListener('error', onError);
      worker.addEventListener('message', function onMessage(ev: MessageEvent<any>) {
        // init phase responds with no pdf
        if (ev.data && !('pdf' in ev.data)) {
          worker.removeEventListener('error', onError);
          worker.removeEventListener('message', onMessage);
          resolve({ worker });
        }
      });
      worker.postMessage(paths as any);
    } catch (err) {
      reject({ stage: 'init', message: String(err) });
    }
  });
  return handlePromise;
}

export async function compileToPdf(
  tex: string,
  opts?: { engine?: 'pdftex' | 'xetex'; timeoutMs?: number }
): Promise<Blob> {
  const { worker } = await initBusyTeX();
  const engine = opts?.engine ?? 'xetex';
  const timeoutMs = opts?.timeoutMs ?? 60000;
  const id = Math.random().toString(36).slice(2);
  const logs: string[] = [];

  return new Promise<Blob>((resolve, reject) => {
    const timer = setTimeout(() => {
      worker.terminate();
      reject({ stage: 'compile', message: 'timeout' });
    }, timeoutMs);

    const onMessage = (ev: MessageEvent<any>) => {
      const data = ev.data;
      if (data?.log) logs.push(String(data.log));
      if (data?.print) logs.push(String(data.print));
      if (data?.id !== id) return;
      if (data?.pdf) {
        clearTimeout(timer);
        worker.removeEventListener('message', onMessage);
        resolve(new Blob([data.pdf], { type: 'application/pdf' }));
      }
      if (data?.error) {
        clearTimeout(timer);
        worker.removeEventListener('message', onMessage);
        reject({ stage: 'compile', message: data.error, log: logs.join('\n') });
      }
    };
    worker.addEventListener('message', onMessage);

    worker.postMessage({
      id,
      files: [{ path: 'main.tex', contents: tex }],
      main_tex_path: 'main.tex',
      driver: engine === 'xetex' ? 'xetex_bibtex8_dvipdfmx' : 'pdftex_bibtex8',
      verbose: 'silent',
      data_packages_js: undefined,
      bibtex: false,
    });
  });
}
