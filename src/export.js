import {
  DISPLAY_W, EXPORT_W, EXPORT_H, FPS,
  stage, layer, transformer, videos, redraw, state, fitStage, selectNode,
} from "./state.js";
import { ensureAllFonts } from "./fonts.js";
import { getMusic, hasMusic, musicValid } from "./music.js";

export function updateExportButton() {
  const exportBtn = document.getElementById("export");
  exportBtn.textContent = videos.size || hasMusic() ? "Export MP4" : "Export PNG";
  exportBtn.disabled = hasMusic() && !musicValid();
}

function setBusy(text) {
  const busy = document.getElementById("busy");
  busy.textContent = text || "";
  busy.classList.toggle("show", Boolean(text));
}

function recordCanvas(canvas, entries, duration) {
  const stream = canvas.captureStream(FPS);
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
    ? "video/webm;codecs=vp8,opus"
    : "video/webm";
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  });
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  const stopped = new Promise((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });
  recorder.start(200);
  const started = performance.now();
  const progress = setInterval(() => {
    const percent = Math.min(99, Math.round(((performance.now() - started) / (duration * 1000)) * 100));
    setBusy(`Đang ghép chữ và sticker… ${percent}%`);
  }, 200);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      clearInterval(progress);
      entries.forEach((entry) => entry.video.pause());
      if (recorder.state !== "inactive") recorder.stop();
    }, duration * 1000 + 150);
    stopped.then((blob) => {
      clearTimeout(timer);
      clearInterval(progress);
      resolve(blob);
    }, (error) => {
      clearTimeout(timer);
      clearInterval(progress);
      reject(error);
    });
  });
}

async function uploadSource(blob) {
  const response = await fetch("/api/source", { method: "POST", body: blob });
  if (!response.ok) throw new Error(await response.text());
  return (await response.text()).trim();
}

// Uploads the music file and returns the audio query params (empty when no valid music is set).
// The segment is clamped to the output length here so the server only has to validate ranges.
async function musicParams(outputDuration) {
  const music = getMusic();
  if (!music) return {};
  return {
    audio: await uploadSource(music.file),
    audioStart: String(music.start),
    audioDuration: String(Math.min(music.end - music.start, outputDuration)),
  };
}

function canvasPng(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Không tạo được lớp ảnh.")), "image/png");
  });
}

async function captureStaticLayers(videoNode, above) {
  const nodes = layer.getChildren();
  const videoIndex = nodes.indexOf(videoNode);
  const visibility = nodes.map((node) => node.visible());
  try {
    nodes.forEach((node, index) => {
      node.visible(visibility[index] && node !== transformer &&
        (above ? index > videoIndex : index < videoIndex));
    });
    layer.draw();
    return await canvasPng(layer.getNativeCanvasElement());
  } finally {
    nodes.forEach((node, index) => node.visible(visibility[index]));
    layer.draw();
  }
}

function canFastExport(node) {
  return node && Math.abs(node.rotation() % 360) < 0.001 &&
    node.scaleX() > 0 && node.scaleY() > 0 &&
    node.offsetX() === 0 && node.offsetY() === 0;
}

function enterExportSize() {
  Konva.pixelRatio = 1;
  stage.width(EXPORT_W);
  stage.height(EXPORT_H);
  stage.scale({ x: EXPORT_W / DISPLAY_W, y: EXPORT_W / DISPLAY_W });
  layer.draw();
}

async function saveMp4(response) {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Không render được video.");
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = "story.mp4";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

function reportRenderError(error) {
  const message = error && error.message ? error.message : "Không render được video.";
  alert(message.includes("Failed to fetch")
    ? "Không gọi được trình render. Hãy chạy node server.mjs trong thư mục story-editor."
    : message);
}

async function renderFast(videoNode, file, duration) {
  const below = await captureStaticLayers(videoNode, false);
  const above = await captureStaticLayers(videoNode, true);
  const [videoId, belowId, aboveId, music] = await Promise.all([
    uploadSource(file), uploadSource(below), uploadSource(above), musicParams(duration),
  ]);
  const ratio = EXPORT_W / DISPLAY_W;
  const params = new URLSearchParams({
    video: videoId,
    below: belowId,
    above: aboveId,
    x: String(Math.round(videoNode.x() * ratio)),
    y: String(Math.round(videoNode.y() * ratio)),
    width: String(Math.max(1, Math.round(videoNode.width() * videoNode.scaleX() * ratio))),
    height: String(Math.max(1, Math.round(videoNode.height() * videoNode.scaleY() * ratio))),
    duration: String(duration),
    ...music,
  });
  setBusy("Đang xuất story.mp4…");
  return fetch(`/api/render-fast?${params}`, { method: "POST" });
}

async function renderRecorded(entries, duration) {
  const recording = recordCanvas(layer.getNativeCanvasElement(), entries, duration);
  const musicUpload = musicParams(duration);
  musicUpload.catch(() => {});
  entries.forEach((entry) => entry.video.play().catch(() => {}));
  const webm = await recording;
  setBusy("Đang xuất story.mp4…");
  const params = new URLSearchParams(await musicUpload);
  return fetch(`/api/render?${params}`, { method: "POST", body: webm });
}

export async function exportMp4() {
  await ensureAllFonts();
  const exportBtn = document.getElementById("export");
  const entries = [...videos.values()];
  const duration = Math.max(...entries.map((entry) => entry.video.duration || 0));
  if (!Number.isFinite(duration) || duration <= 0) {
    alert("Video chưa sẵn sàng để render.");
    return;
  }

  const selected = transformer.nodes();
  const playback = entries.map((entry) => ({
    video: entry.video,
    loop: entry.video.loop,
    muted: entry.video.muted,
    time: entry.video.currentTime,
  }));
  const previousRatio = Konva.pixelRatio;

  transformer.nodes([]);
  state.exporting = true;
  exportBtn.disabled = true;
  if (!redraw.isRunning()) redraw.start();

  try {
    setBusy("Đang chuẩn bị video…");
    enterExportSize();
    entries.forEach((entry) => {
      entry.video.pause();
      entry.video.loop = false;
      entry.video.muted = true;
      entry.video.currentTime = 0;
    });
    const videoNode = videos.size === 1 ? videos.keys().next().value : null;
    const response = canFastExport(videoNode)
      ? await renderFast(videoNode, entries[0].file, duration)
      : await renderRecorded(entries, duration);
    await saveMp4(response);
  } catch (error) {
    reportRenderError(error);
  } finally {
    Konva.pixelRatio = previousRatio;
    state.exporting = false;
    playback.forEach((item) => {
      item.video.loop = item.loop;
      item.video.muted = item.muted;
      item.video.currentTime = item.time;
    });
    fitStage();
    entries.forEach((entry) => entry.video.play().catch(() => {}));
    if (selected[0]) selectNode(selected[0]);
    updateExportButton();
    setBusy("");
  }
}

// No video, music set: one full-size frame of the canvas, looped for the length of the selection.
export async function exportStill() {
  await ensureAllFonts();
  const music = getMusic();
  if (!music) return;
  const exportBtn = document.getElementById("export");
  const duration = music.end - music.start;
  const selected = transformer.nodes();
  const previousRatio = Konva.pixelRatio;

  transformer.nodes([]);
  state.exporting = true;
  exportBtn.disabled = true;

  try {
    setBusy("Đang chuẩn bị ảnh…");
    enterExportSize();
    const frame = await canvasPng(layer.getNativeCanvasElement());
    const [frameId, audio] = await Promise.all([uploadSource(frame), musicParams(duration)]);
    setBusy("Đang xuất story.mp4…");
    const params = new URLSearchParams({ frame: frameId, duration: String(duration), ...audio });
    await saveMp4(await fetch(`/api/render-still?${params}`, { method: "POST" }));
  } catch (error) {
    reportRenderError(error);
  } finally {
    Konva.pixelRatio = previousRatio;
    state.exporting = false;
    fitStage();
    if (selected[0]) selectNode(selected[0]);
    updateExportButton();
    setBusy("");
  }
}

export async function exportPng() {
  await ensureAllFonts();
  const selected = transformer.nodes();
  transformer.nodes([]);
  layer.draw();
  const url = stage.toDataURL({
    pixelRatio: EXPORT_W / stage.width(),
    mimeType: "image/png",
  });
  transformer.nodes(selected);
  layer.batchDraw();
  const link = document.createElement("a");
  link.href = url;
  link.download = "story.png";
  link.click();
}
