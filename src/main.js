import { stage, layer, bg, transformer, videos, state, selectNode } from "./state.js";
import { addImage, addVideo, addText, addSticker, editText, deleteSelected, contentNode } from "./layers.js";
import { exportMp4, exportPng, exportStill, updateExportButton } from "./export.js";
import { FONTS, ensureFont, ensureAllFonts, fontStyleFor } from "./fonts.js";
import { getLayout, setLayout } from "./layout.js";
import { getMusic, initMusic } from "./music.js";

const deleteBtn = document.getElementById("delete");
const fontSelect = document.getElementById("font");

function isTextNode(node) {
  return node && node.className === "Text" && !node.getAttr("sticker");
}

document.querySelectorAll('input[name="layout"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    if (radio.checked && !setLayout(radio.value)) {
      document.querySelector(`input[name="layout"][value="${getLayout()}"]`).checked = true;
    }
  });
});

document.getElementById("img-input").addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  if (file) addImage(file);
  event.target.value = "";
});

document.getElementById("video-input").addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  if (file) addVideo(file);
  event.target.value = "";
});

document.getElementById("add-text").addEventListener("click", addText);
document.getElementById("stickers").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-emoji]");
  if (button) addSticker(button.dataset.emoji);
});
deleteBtn.addEventListener("click", deleteSelected);
document.getElementById("export").addEventListener("click", () => {
  if (videos.size) exportMp4();
  else if (getMusic()) exportStill();
  else exportPng();
});

initMusic({ onChange: updateExportButton });

document.getElementById("colors").addEventListener("click", (event) => {
  const button = event.target.closest(".swatch");
  if (!button) return;
  state.textColor = button.dataset.color;
  document.querySelectorAll(".swatch").forEach((swatch) => {
    swatch.classList.toggle("active", swatch === button);
  });
  const selected = transformer.nodes()[0];
  if (isTextNode(selected)) {
    selected.fill(state.textColor);
    layer.batchDraw();
  }
});

FONTS.forEach(({ family }) => {
  const option = new Option(family, family);
  option.style.fontFamily = `"${family}"`;
  fontSelect.add(option);
});
fontSelect.value = state.fontFamily;

fontSelect.addEventListener("change", async () => {
  const family = fontSelect.value;
  const target = transformer.nodes()[0];
  state.fontFamily = family;
  await ensureFont(family);
  if (isTextNode(target)) {
    target.setAttrs({ fontFamily: family, fontStyle: fontStyleFor(family) });
    layer.batchDraw();
  }
});

// A <select> does not fire "change" when its current value is re-picked, so keep it in step
// with the text layer being selected.
function syncFontPicker(node) {
  if (!isTextNode(node)) return;
  state.fontFamily = node.fontFamily();
  fontSelect.value = state.fontFamily;
}

ensureAllFonts();

stage.on("pointerdown", (event) => {
  if (event.target === stage || event.target === bg) selectNode(null);
});

stage.on("pointerclick", (event) => {
  const node = contentNode(event.target);
  if (node) selectNode(node);
  syncFontPicker(node);
});

stage.on("dragstart", (event) => {
  const node = contentNode(event.target);
  if (node) selectNode(node);
  syncFontPicker(node);
});

stage.on("pointerdblclick", (event) => {
  editText(event.target);
});

window.addEventListener("keydown", (event) => {
  const typing = document.activeElement && ["TEXTAREA", "INPUT"].includes(document.activeElement.tagName);
  if (typing) return;
  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    deleteSelected();
  }
});
