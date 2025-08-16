import http from 'http';

const pdfBytes = new Uint8Array([37,80,68,70,45,49,46,52,10,37,0,0,0]); // minimal "%PDF" header

export function startSwiftlatexServer(statuses: number[] = [200]) {
  let reqs = 0;
  const server = http.createServer((req, res) => {
    const status = statuses[reqs] ?? statuses[statuses.length - 1];
    reqs++;
    if (status === 200) {
      res.writeHead(200, { 'Content-Type': 'application/pdf', 'x-tex-log': 'log' });
      res.end(Buffer.from(pdfBytes));
    } else {
      res.writeHead(status, { 'Content-Type': 'text/plain' });
      res.end('err');
    }
  });
  return new Promise<{ url: string; close: () => Promise<void>; requests: () => number }>((resolve) => {
    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}`,
        requests: () => reqs,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}
