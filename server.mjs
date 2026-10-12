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
const ffmpegPath = process.env.FFMPEG_PATH || require('ffmpeg-static');
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

function runFfmpeg(args) {
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

// audio, audioStart and audioDuration are all-or-none. The client has already clamped
// audioDuration to the output length, so this only checks ranges.
function readAudio(url) {
  const [id, start, duration] = ['audio', 'audioStart', 'audioDuration'].map((key) => url.searchParams.get(key));
  if (id === null && start === null && duration === null) return { ok: true, audio: null };
  const file = sources.get(id || '');
  const range = { start: Number(start), duration: Number(duration) };
  if (!id || !start || !duration || !file || !fs.existsSync(file) ||
      !Number.isFinite(range.start) || !Number.isFinite(range.duration) ||
      range.start < 0 || range.duration <= 0) {
    return { ok: false, audio: null };
  }
  return { ok: true, audio: { id, path: file, ...range } };
}

function audioInput(audio) {
  return ['-ss', String(audio.start), '-t', String(audio.duration), '-i', audio.path];
}

function encodeMp4(webmPath, outPath, audio) {
  const args = ['-y', '-i', webmPath];
  if (audio) args.push(...audioInput(audio));
  args.push('-map', '0:v:0');
  if (audio) args.push('-map', '1:a:0');
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p');
  if (audio) args.push('-c:a', 'aac', '-b:a', '160k');
  else args.push('-an');
  args.push('-movflags', '+faststart', outPath);
  return runFfmpeg(args);
}

function encodeFastMp4(videoPath, belowPath, abovePath, outPath, geometry, audio) {
  const { x, y, width, height, duration } = geometry;
  const filter = [
    `[0:v]setpts=PTS-STARTPTS,scale=${width}:${height}:flags=lanczos[clip]`,
    '[1:v]format=rgba[below]',
    `[below][clip]overlay=${x}:${y}:shortest=1[composed]`,
    '[composed][2:v]overlay=0:0:shortest=1,format=yuv420p[v]',
  ].join(';');
  const args = [
    '-y', '-i', videoPath,
    '-loop', '1', '-framerate', '30', '-i', belowPath,
    '-loop', '1', '-framerate', '30', '-i', abovePath,
  ];
  if (audio) args.push(...audioInput(audio));
  args.push('-filter_complex', filter, '-map', '[v]');
  if (audio) args.push('-map', '3:a:0');
  args.push('-t', String(duration), '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p');
  if (audio) args.push('-c:a', 'aac', '-b:a', '160k');
  else args.push('-an');
  args.push('-movflags', '+faststart', outPath);
  return runFfmpeg(args);
}

function encodeStillMp4(framePath, outPath, duration, audio) {
  return runFfmpeg([
    '-y', '-loop', '1', '-framerate', '30', '-i', framePath,
    ...audioInput(audio),
    '-map', '0:v:0', '-map', '1:a:0', '-t', String(duration), '-r', '30', '-vf', 'format=yuv420p',
    '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'stillimage', '-crf', '18',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', outPath,
  ]);
}

async function handleSource(req, res) {
  const id = crypto.randomBytes(8).toString('hex');
  const extension = req.headers['content-type'] === 'image/png' ? '.png' : '';
  const filePath = path.join(os.tmpdir(), `story-src-${id}${extension}`);
  await pipeline(req, fs.createWriteStream(filePath));
  sources.set(id, filePath);
  send(res, 200, id, { 'Content-Type': 'text/plain; charset=utf-8' });
}

function releaseSources(ids) {
  ids.forEach((id) => {
    const file = sources.get(id);
    if (file) fs.rm(file, { force: true }, () => {});
    sources.delete(id);
  });
}

// FFmpeg names the input it failed to open; report a bad music file in plain words, not as a log dump.
function renderFailure(error, audio) {
  if (audio && error.message.includes(`Error opening input file ${audio.path}`)) return 'Không đọc được file nhạc.';
  return error.message || 'Render thất bại.';
}

function streamMp4(res, outPath, cleanup) {
  // The client may have disconnected while FFmpeg was running; 'close' has already fired then.
  if (res.destroyed) {
    cleanup();
    return;
  }
  res.writeHead(200, {
    'Content-Type': 'video/mp4',
    'Content-Disposition': 'attachment; filename="story.mp4"',
  });
  fs.createReadStream(outPath).pipe(res);
  res.on('close', cleanup);
}

async function handleFastRender(req, res, url) {
  const ids = ['video', 'below', 'above'].map((key) => url.searchParams.get(key) || '');
  const paths = ids.map((id) => sources.get(id));
  const geometry = Object.fromEntries(['x', 'y', 'width', 'height', 'duration'].map((key) => [
    key, Number(url.searchParams.get(key)),
  ]));
  const { ok, audio } = readAudio(url);
  if (!ok || paths.some((file) => !file || !fs.existsSync(file)) ||
      Object.values(geometry).some((value) => !Number.isFinite(value)) ||
      geometry.width <= 0 || geometry.height <= 0 || geometry.duration <= 0) {
    send(res, 400, 'Invalid export inputs');
    return;
  }

  const outPath = path.join(os.tmpdir(), `story-out-${crypto.randomBytes(8).toString('hex')}.mp4`);
  const cleanup = () => {
    fs.rm(outPath, { force: true }, () => {});
    releaseSources(audio ? [...ids, audio.id] : ids);
  };
  try {
    await encodeFastMp4(paths[0], paths[1], paths[2], outPath, geometry, audio);
    streamMp4(res, outPath, cleanup);
  } catch (error) {
    console.error(error.message);
    cleanup();
    if (!res.headersSent) send(res, 500, renderFailure(error, audio));
  }
}

async function handleRender(req, res, url) {
  // Older clients upload the clip as `id` to borrow its audio; that audio is never used now,
  // but the upload is still released.
  const legacyId = url.searchParams.get('id') || '';
  const { ok, audio } = readAudio(url);
  if (!ok) {
    send(res, 400, 'Invalid export inputs');
    return;
  }
  const renderId = crypto.randomBytes(8).toString('hex');
  const webmPath = path.join(os.tmpdir(), `story-in-${renderId}.webm`);
  const outPath = path.join(os.tmpdir(), `story-out-${renderId}.mp4`);
  const cleanup = () => {
    fs.rm(outPath, { force: true }, () => {});
    fs.rm(webmPath, { force: true }, () => {});
    releaseSources(audio ? [legacyId, audio.id] : [legacyId]);
  };
  try {
    await pipeline(req, fs.createWriteStream(webmPath));
    await encodeMp4(webmPath, outPath, audio);
    streamMp4(res, outPath, cleanup);
  } catch (error) {
    console.error(error.message);
    cleanup();
    if (!res.headersSent) send(res, 500, renderFailure(error, audio));
  }
}

async function handleStillRender(req, res, url) {
  const frameId = url.searchParams.get('frame') || '';
  const framePath = sources.get(frameId);
  const duration = Number(url.searchParams.get('duration'));
  const { ok, audio } = readAudio(url);
  if (!ok || !audio || !framePath || !fs.existsSync(framePath) || !Number.isFinite(duration) || duration <= 0) {
    send(res, 400, 'Invalid export inputs');
    return;
  }

  const outPath = path.join(os.tmpdir(), `story-out-${crypto.randomBytes(8).toString('hex')}.mp4`);
  const cleanup = () => {
    fs.rm(outPath, { force: true }, () => {});
    releaseSources([frameId, audio.id]);
  };
  try {
    await encodeStillMp4(framePath, outPath, duration, audio);
    streamMp4(res, outPath, cleanup);
  } catch (error) {
    console.error(error.message);
    cleanup();
    if (!res.headersSent) send(res, 500, renderFailure(error, audio));
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
  if (req.method === 'POST' && url.pathname === '/api/render-fast') {
    handleFastRender(req, res, url).catch((error) => {
      if (!res.headersSent) send(res, 500, error.message);
    });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/render-still') {
    handleStillRender(req, res, url).catch((error) => {
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
