#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');

const TAG = 'v2025.01.19';
const FILES = [
  'busytex_pipeline.js',
  'busytex_worker.js',
  'busytex.wasm',
  'texlive-basic.js',
  'texlive-basic.data',
  'ubuntu-texlive-latex-extra.js',
  'ubuntu-texlive-latex-extra.data',
  'ubuntu-texlive-latex-recommended.js',
  'ubuntu-texlive-latex-recommended.data',
  'ubuntu-texlive-science.js',
  'ubuntu-texlive-science.data',
];

const destDir = path.join(__dirname, '..', 'apps', 'frontend', 'public', 'vendor', 'busytex');
const fresh = process.argv.includes('--fresh');
const offlineOk = process.argv.includes('--offline-ok');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https
      .get(url, res => {
        if (res.statusCode !== 200) {
          reject(new Error(`GET ${url} failed: ${res.statusCode}`));
          res.resume();
          return;
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => {
          file.close(err => {
            if (err) return reject(err);
            fs.stat(dest, (err2, stats) => {
              if (err2) return reject(err2);
              if (stats.size === 0) return reject(new Error(`${dest} empty`));
              resolve();
            });
          });
        });
      })
      .on('error', reject);
  });
}

async function fetchWithRetry(url, dest, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await download(url, dest);
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * 2 ** (attempt - 1)));
    }
  }
}

async function main() {
  await fs.promises.mkdir(destDir, { recursive: true });
  const fetched = [];
  for (const name of FILES) {
    const dest = path.join(destDir, name);
    if (!fresh && fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      continue;
    }
    const url = `https://github.com/busytex/busytex/releases/download/${TAG}/${name}`;
    try {
      await fetchWithRetry(url, dest, 3);
      console.log(`fetched ${name}`);
      fetched.push(name);
    } catch (err) {
      console.error(`failed ${name}: ${err.message}`);
      if (offlineOk) {
        console.log('offline-ok: skipping BusyTeX asset fetch');
        return;
      }
      process.exitCode = 1;
      return;
    }
  }
  console.log(`BusyTeX assets present: ${FILES.length}, fetched: ${fetched.length}`);
}

main();
