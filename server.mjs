import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ffmpegPath = require('ffmpeg-static');
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const sources = new Map();
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  const filePath = path.resolve(root, requested);
  if (!filePath.startsWith(root + path.sep) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    send(res, 404, 'Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

function probeAudio(file) {
  return new Promise((resolve) => {
    const probe = spawn(ffmpegPath, ['-hide_banner', '-i', file], { stdio: ['ignore', 'ignore', 'pipe'] });
    let text = '';
    probe.stderr.on('data', (chunk) => {
      text += chunk.toString();
    });
    probe.on('error', () => resolve(false));
    probe.on('close', () => resolve(/Audio:/.test(text)));
  });
}

function encodeMp4(webmPath, outPath, audioPath) {
  const args = ['-y', '-i', webmPath];
  if (audioPath) args.push('-i', audioPath);
  args.push('-map', '0:v:0');
  if (audioPath) args.push('-map', '1:a:0');
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p');
  if (audioPath) args.push('-c:a', 'aac', '-b:a', '160k', '-shortest');
  else args.push('-an');
  args.push('-movflags', '+faststart', outPath);

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const logs = [];
    ffmpeg.stderr.on('data', (chunk) => logs.push(chunk.toString()));
    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(logs.join('').slice(-1800) || `ffmpeg exited ${code}`));
    });
  });
}

async function handleSource(req, res) {
  const id = crypto.randomBytes(8).toString('hex');
  const filePath = path.join(os.tmpdir(), `story-src-${id}`);
  await pipeline(req, fs.createWriteStream(filePath));
  sources.set(id, filePath);
  send(res, 200, id, { 'Content-Type': 'text/plain; charset=utf-8' });
}

async function handleRender(req, res, url) {
  const sourceId = url.searchParams.get('id') || '';
  const sourcePath = sources.get(sourceId);
  const renderId = crypto.randomBytes(8).toString('hex');
  const webmPath = path.join(os.tmpdir(), `story-in-${renderId}.webm`);
  const outPath = path.join(os.tmpdir(), `story-out-${renderId}.mp4`);
  try {
    await pipeline(req, fs.createWriteStream(webmPath));
    const audioPath = sourcePath && fs.existsSync(sourcePath) && await probeAudio(sourcePath) ? sourcePath : null;
    await encodeMp4(webmPath, outPath, audioPath);
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Disposition': 'attachment; filename="story.mp4"',
    });
    fs.createReadStream(outPath).pipe(res);
    res.on('close', () => {
      fs.rm(outPath, { force: true }, () => {});
      fs.rm(webmPath, { force: true }, () => {});
      if (sourcePath) fs.rm(sourcePath, { force: true }, () => {});
      sources.delete(sourceId);
    });
  } catch (error) {
    console.error(error.message);
    fs.rm(outPath, { force: true }, () => {});
    fs.rm(webmPath, { force: true }, () => {});
    if (sourcePath) fs.rm(sourcePath, { force: true }, () => {});
    sources.delete(sourceId);
    if (!res.headersSent) send(res, 500, error.message || 'Render thất bại.');
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  console.log(req.method, url.pathname);
  if (req.method === 'POST' && url.pathname === '/api/source') {
    handleSource(req, res).catch((error) => {
      if (!res.headersSent) send(res, 500, error.message);
    });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/render') {
    handleRender(req, res, url).catch((error) => {
      if (!res.headersSent) send(res, 500, error.message);
    });
    return;
  }
  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }
  send(res, 405, 'Method not allowed');
});

server.listen(port, () => {
  console.log(`Story Editor: http://127.0.0.1:${port}`);
});
