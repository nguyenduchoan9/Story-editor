import { DISPLAY_W, DISPLAY_H, layer, bg, videos, selectNode } from "./state.js";

const SLOT_H = DISPLAY_H / 2;
let mode = "free";

export function getLayout() {
  return mode;
}

function slots() {
  return layer.find(".slot");
}

// Slots sit directly above `bg`, so they stay below any video: captureStaticLayers() splits the
// layer's top-level children around the video node by index.
function createSlots() {
  [0, SLOT_H].forEach((clipY, index) => {
    const group = new Konva.Group({
      name: "slot",
      clipX: 0,
      clipY,
      clipWidth: DISPLAY_W,
      clipHeight: SLOT_H,
    });
    layer.add(group);
    group.zIndex(bg.zIndex() + 1 + index);
  });
}

function imageNodes() {
  return layer.find(".content").filter((node) => node.className === "Image" && !videos.has(node));
}

export function clearImages() {
  imageNodes().forEach((node) => {
    const objectUrl = node.getAttr("objectUrl");
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    node.destroy();
  });
}

// Returns false when the user cancels the "delete existing images" confirmation.
export function setLayout(next) {
  if (next === mode) return true;
  if (imageNodes().length && !confirm("Đổi bố cục sẽ xóa ảnh hiện tại. Tiếp tục?")) return false;
  clearImages();
  if (mode === "split") slots().forEach((group) => group.destroy());
  if (next === "split") createSlots();
  mode = next;
  selectNode(null);
  return true;
}

// Fills the first empty slot (top, then bottom), scaled to cover it. Returns false when both are taken.
export function placeInSlot(node, naturalW, naturalH) {
  const slot = slots().find((group) => group.getChildren().length === 0);
  if (!slot) return false;
  const scale = Math.max(DISPLAY_W / naturalW, SLOT_H / naturalH);
  const w = naturalW * scale;
  const h = naturalH * scale;
  node.setAttrs({
    width: w,
    height: h,
    x: (DISPLAY_W - w) / 2,
    y: slot.clipY() + (SLOT_H - h) / 2,
    draggable: true,
  });
  slot.add(node);
  return true;
}
