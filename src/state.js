export const DISPLAY_W = 405;
export const DISPLAY_H = 720;
export const EXPORT_W = 1080;
export const EXPORT_H = 1920;
export const FPS = 30;

export const state = { exporting: false, textColor: "#ffffff", fontFamily: "Roboto" };

export const stage = new Konva.Stage({
  container: "container",
  width: DISPLAY_W,
  height: DISPLAY_H,
});

export function fitStage() {
  if (state.exporting) return;
  const maxH = Math.max(320, window.innerHeight - 48);
  const maxW = Math.max(220, window.innerWidth - 320);
  const scale = Math.min(maxW / DISPLAY_W, maxH / DISPLAY_H, 1);
  stage.width(DISPLAY_W * scale);
  stage.height(DISPLAY_H * scale);
  stage.scale({ x: scale, y: scale });
  stage.batchDraw();
}

fitStage();
window.addEventListener("resize", fitStage);

export const layer = new Konva.Layer();
stage.add(layer);

export const bg = new Konva.Rect({
  x: 0,
  y: 0,
  width: DISPLAY_W,
  height: DISPLAY_H,
  fill: "#000000",
  listening: true,
});
layer.add(bg);

export const transformer = new Konva.Transformer({
  rotateEnabled: true,
  enabledAnchors: ["top-left", "top-right", "bottom-left", "bottom-right"],
  borderStroke: "#ffffff",
  anchorFill: "#ffffff",
  anchorStroke: "#111111",
  anchorSize: 10,
  boundBoxFunc: (oldBox, newBox) => {
    if (newBox.width < 20 || newBox.height < 20) return oldBox;
    return newBox;
  },
});
layer.add(transformer);

export const videos = new Map();
const deleteBtn = document.getElementById("delete");

export const redraw = new Konva.Animation(() => {}, layer);

export function selectNode(node) {
  const isContent = node && node !== bg && node !== transformer && node.getParent() !== transformer;
  if (!isContent) {
    transformer.nodes([]);
    deleteBtn.disabled = true;
  } else {
    transformer.nodes([node]);
    node.moveToTop();
    transformer.moveToTop();
    deleteBtn.disabled = false;
  }
  layer.batchDraw();
}
