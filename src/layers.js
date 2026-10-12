import { DISPLAY_W, DISPLAY_H, stage, layer, transformer, videos, redraw, state, selectNode } from "./state.js";
import { updateExportButton } from "./export.js";
import { fontStyleFor } from "./fonts.js";
import { getLayout, placeInSlot } from "./layout.js";

function placeCentered(node, naturalW, naturalH) {
  const maxW = DISPLAY_W * 0.86;
  const maxH = DISPLAY_H * 0.86;
  const scale = Math.min(maxW / naturalW, maxH / naturalH, 1);
  const w = Math.max(20, naturalW * scale);
  const h = Math.max(20, naturalH * scale);
  node.setAttrs({
    width: w,
    height: h,
    x: (DISPLAY_W - w) / 2,
    y: (DISPLAY_H - h) / 2,
    draggable: true,
  });
}

export function addImage(file) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    const node = new Konva.Image({ image, draggable: true, name: "content" });
    const naturalW = image.naturalWidth || image.width;
    const naturalH = image.naturalHeight || image.height;
    node.setAttr("objectUrl", url);
    if (getLayout() === "split") {
      if (!placeInSlot(node, naturalW, naturalH)) {
        URL.revokeObjectURL(url);
        alert("Đã đủ 2 ảnh. Xóa một ảnh để thêm ảnh mới.");
        return;
      }
    } else {
      placeCentered(node, naturalW, naturalH);
      layer.add(node);
    }
    selectNode(node);
  };
  image.onerror = () => URL.revokeObjectURL(url);
  image.src = url;
}

export function addVideo(file) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "auto";
  video.style.display = "none";
  document.body.appendChild(video);

  video.onloadeddata = () => {
    const node = new Konva.Image({
      image: video,
      draggable: true,
      name: "content",
    });
    placeCentered(node, video.videoWidth || 9, video.videoHeight || 16);
    layer.add(node);
    videos.set(node, { video, url, file });
    video.play().catch(() => {});
    if (!redraw.isRunning()) redraw.start();
    selectNode(node);
    updateExportButton();
  };
  video.onerror = () => URL.revokeObjectURL(url);
  video.load();
}

export function addText() {
  const node = new Konva.Text({
    text: "Nhập chữ",
    fontSize: 42,
    fontStyle: fontStyleFor(state.fontFamily),
    fontFamily: state.fontFamily,
    fill: state.textColor,
    align: "center",
    draggable: true,
    name: "content",
    x: 28,
    y: DISPLAY_H / 2 - 28,
    width: DISPLAY_W - 56,
  });
  layer.add(node);
  selectNode(node);
}

export function addSticker(emoji) {
  const node = new Konva.Text({
    text: emoji,
    fontSize: 96,
    draggable: true,
    name: "content",
    x: DISPLAY_W / 2 - 48,
    y: DISPLAY_H / 2 - 56,
  });
  node.setAttr("sticker", true);
  layer.add(node);
  selectNode(node);
}

export function editText(node) {
  if (!node || node.className !== "Text" || node.getAttr("sticker")) return;
  const box = node.getClientRect();
  const stageBox = stage.container().getBoundingClientRect();
  const area = document.createElement("textarea");
  area.value = node.text();
  Object.assign(area.style, {
    position: "fixed",
    left: stageBox.left + box.x + "px",
    top: stageBox.top + box.y + "px",
    width: Math.max(80, box.width) + "px",
    height: Math.max(40, box.height) + "px",
    fontSize: Math.max(16, node.fontSize() * node.scaleY()) + "px",
    fontFamily: node.fontFamily(),
    fontWeight: node.fontStyle() === "bold" ? "700" : "400",
    color: node.fill(),
    textAlign: "center",
    background: "rgba(0,0,0,0.35)",
    border: "1px dashed #fff",
    borderRadius: "6px",
    outline: "none",
    resize: "none",
    zIndex: 20,
    padding: "4px",
  });
  document.body.appendChild(area);
  area.addEventListener("mousedown", (event) => event.stopPropagation());
  area.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      area.blur();
    }
    event.stopPropagation();
  });

  const close = () => {
    const next = area.value.trim();
    node.text(next || "Nhập chữ");
    area.remove();
    layer.batchDraw();
  };
  setTimeout(() => {
    area.focus();
    area.select();
    area.addEventListener("blur", close);
  }, 0);
}

export function deleteSelected() {
  const node = transformer.nodes()[0];
  if (!node) return;
  const tracked = videos.get(node);
  if (tracked) {
    tracked.video.pause();
    tracked.video.remove();
    tracked.video.src = "";
    URL.revokeObjectURL(tracked.url);
    videos.delete(node);
  }
  const objectUrl = node.getAttr("objectUrl");
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  node.destroy();
  selectNode(null);
  if (videos.size === 0 && redraw.isRunning()) redraw.stop();
  updateExportButton();
}

export function contentNode(target) {
  let node = target;
  while (node && node !== stage) {
    if (node === transformer) return null;
    if (node.name && node.name() === "content") return node;
    node = node.getParent();
  }
  return null;
}
