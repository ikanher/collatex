#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const { pipeline } = require('stream');

const files = [
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
const base = 'https://github.com/busytex/busytex/releases/latest/download/';
const fresh = process.argv.includes('--fresh');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode !== 200) {
        reject(new Error(`GET ${url} failed: ${res.statusCode}`));
        res.resume();
        return;
      }
      const file = fs.createWriteStream(dest);
      pipeline(res, file, err => {
        if (err) return reject(err);
        fs.stat(dest, (err2, stats) => {
          if (err2) return reject(err2);
          if (stats.size === 0) return reject(new Error(`${dest} empty`));
          resolve();
        });
      });
    }).on('error', reject);
  });
}

async function main() {
  await fs.promises.mkdir(destDir, { recursive: true });
  for (const name of files) {
    const dest = path.join(destDir, name);
    if (!fresh && fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      continue;
    }
    const url = base + name;
    try {
      await download(url, dest);
      console.log(`fetched ${name}`);
    } catch (err) {
      console.error(`failed ${name}:`, err.message);
      process.exitCode = 1;
      return;
    }
  }
}

main();
