#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');

const FILES = [
  'busytex_pipeline.js',
  'busytex_worker.js',
  'busytex.wasm',
  'busytex.js',
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
const tagCacheFile = path.join(destDir, '.busytex-tag');

function httpHeadOrGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'HEAD' }, res => resolve(res));
    req.on('error', reject);
    req.end();
  }).catch(() => new Promise((resolve, reject) => {
    https.get(url, res => resolve(res)).on('error', reject);
  }));
}

async function resolveLatestTag() {
  await fs.promises.mkdir(destDir, { recursive: true });
  if (!fresh && fs.existsSync(tagCacheFile)) {
    const cached = fs.readFileSync(tagCacheFile, 'utf8').trim();
    if (cached) return cached;
  }
  // GitHub latest redirect points to /tag/<TAG>
  const res = await httpHeadOrGet('https://github.com/busytex/busytex/releases/latest');
  const location = res.headers.location || res.headers.Location;
  if (!location) {
    throw new Error('Could not resolve latest release tag (no redirect Location header)');
  }
  const m = location.match(/\/tag\/(.+)$/);
  if (!m) throw new Error(`Unexpected redirect Location: ${location}`);
  const tag = m[1];
  fs.writeFileSync(tagCacheFile, tag, 'utf8');
  return tag;
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
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
    }).on('error', reject);
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
  try {
    await fs.promises.mkdir(destDir, { recursive: true });
    const tag = await resolveLatestTag();
    const fetched = [];
    for (const name of FILES) {
      const dest = path.join(destDir, name);
      if (!fresh && fs.existsSync(dest) && fs.statSync(dest).size > 0) {
        continue;
      }
      const url = `https://github.com/busytex/busytex/releases/download/${tag}/${name}`;
      try {
        await fetchWithRetry(url, dest, 3);
        console.log(`fetched ${name}`);
        fetched.push(name);
      } catch (err) {
        console.error(`failed ${name}: ${err.message}`);
        if (offlineOk) {
          console.log('offline-ok: skipping BusyTeX asset fetch (using any existing local assets)');
          console.log(`BusyTeX tag (cached): ${tag}`);
          return;
        }
        process.exitCode = 1;
        return;
      }
    }
    console.log(`BusyTeX tag: ${tag}`);
    console.log(`BusyTeX assets present: ${FILES.length}, fetched now: ${fetched.length}`);
  } catch (e) {
    console.error(e.message || String(e));
    if (offlineOk) process.exit(0);
    process.exit(1);
  }
}
main();
