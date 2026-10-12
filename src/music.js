let file = null;
let objectUrl = "";
let audio = null;
let duration = 0;
let range = { start: 0, end: 0 };
let notify = () => {};

const $ = (id) => document.getElementById(id);
const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export function hasMusic() {
  return Boolean(file);
}

export function musicValid() {
  const { start, end } = range;
  return Boolean(file) && duration > 0 && Number.isFinite(start) && Number.isFinite(end) &&
    start >= 0 && start < end && end <= duration;
}

export function getMusic() {
  return musicValid() ? { file, start: range.start, end: range.end } : null;
}

function writeInputs() {
  $("music-start").value = file && duration ? String(range.start) : "";
  $("music-end").value = file && duration ? String(range.end) : "";
}

function render() {
  const invalid = Boolean(file) && duration > 0 && !musicValid();
  $("music-panel").hidden = !file;
  $("music-name").textContent = file ? `${file.name} · ${duration ? formatTime(duration) : "…"}` : "";
  $("music-start").classList.toggle("invalid", invalid);
  $("music-end").classList.toggle("invalid", invalid);
  $("music-preview").disabled = !musicValid();
  $("music-preview").textContent = audio && !audio.paused ? "Dừng" : "Nghe thử";
  notify();
}

function release() {
  if (audio) audio.pause();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  audio = null;
  objectUrl = "";
  duration = 0;
  range = { start: 0, end: 0 };
}

function clearMusic() {
  release();
  file = null;
  $("music-input").value = "";
  writeInputs();
  render();
}

function rejectFile(message) {
  alert(message);
  clearMusic();
}

// Replacing a file revokes the old URL and resets the selection to the whole track.
function loadMusic(next) {
  release();
  file = next;
  objectUrl = URL.createObjectURL(next);
  const current = new Audio(objectUrl);
  audio = current;
  current.preload = "metadata";
  current.addEventListener("loadedmetadata", () => {
    if (audio !== current) return;
    if (!Number.isFinite(current.duration) || current.duration <= 0) {
      rejectFile("Không đọc được độ dài file nhạc.");
      return;
    }
    duration = current.duration;
    range = { start: 0, end: Math.floor(duration * 10) / 10 };
    writeInputs();
    render();
  });
  current.addEventListener("error", () => {
    if (audio === current) rejectFile("Không đọc được file nhạc.");
  });
  current.addEventListener("timeupdate", () => {
    if (audio === current && !current.paused && current.currentTime >= range.end) current.pause();
  });
  current.addEventListener("play", () => audio === current && render());
  current.addEventListener("pause", () => audio === current && render());
  render();
}

function togglePreview() {
  if (!audio || !musicValid()) return;
  if (!audio.paused) {
    audio.pause();
    return;
  }
  audio.currentTime = range.start;
  audio.play().catch(() => {});
}

function readInputs() {
  if (audio) audio.pause();
  range = { start: $("music-start").valueAsNumber, end: $("music-end").valueAsNumber };
  render();
}

export function initMusic({ onChange }) {
  notify = onChange;
  $("music-input").addEventListener("change", (event) => {
    const next = event.target.files && event.target.files[0];
    if (next) loadMusic(next);
    event.target.value = "";
  });
  $("music-start").addEventListener("input", readInputs);
  $("music-end").addEventListener("input", readInputs);
  $("music-preview").addEventListener("click", togglePreview);
  $("music-clear").addEventListener("click", clearMusic);
  render();
}
