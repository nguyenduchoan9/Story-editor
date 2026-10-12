import { layer } from "./state.js";

export const FONTS = [
  { family: "Roboto", style: "bold" },
  { family: "Montserrat", style: "bold" },
  { family: "Playfair Display", style: "bold" },
  { family: "Pacifico", style: "normal" },
  { family: "Oswald", style: "bold" },
];

// document.fonts.load() only fetches the unicode-range subsets that cover the text it is given
// (a single space by default, i.e. just the Latin subset), so hand it every Vietnamese letter.
const SAMPLE = "AaĂăÂâĐđÊêÔôƠơƯưÀàẢảÃãÁáẠạẰằẲẳẴẵẮắẶặẦầẨẩẪẫẤấẬậÈèẺẻẼẽÉéẸẹỀềỂểỄễẾếỆệÌìỈỉĨĩÍíỊịÒòỎỏÕõÓóỌọỒồỔổỖỗỐốỘộỜờỞởỠỡỚớỢợÙùỦủŨũÚúỤụỪừỬửỮữỨứỰựỲỳỶỷỸỹÝýỴỵ";

export function fontStyleFor(family) {
  const font = FONTS.find((item) => item.family === family);
  return font ? font.style : "bold";
}

// Konva measures text when its attributes change, so text created before its font finished
// loading kept the fallback metrics. Flip the family to force a re-measure with the real font.
function remeasureText() {
  layer.find("Text").forEach((node) => {
    if (node.getAttr("sticker")) return;
    const family = node.fontFamily();
    node.fontFamily("sans-serif");
    node.fontFamily(family);
  });
  layer.batchDraw();
}

async function loadFace(family) {
  const weight = fontStyleFor(family) === "bold" ? 700 : 400;
  try {
    await document.fonts.load(`${weight} 42px "${family}"`, SAMPLE);
  } catch {
    // Offline or blocked: canvas text falls back to a system font, as the PRD accepts.
  }
}

export async function ensureFont(family) {
  await loadFace(family);
  remeasureText();
}

export async function ensureAllFonts() {
  await Promise.all(FONTS.map(({ family }) => loadFace(family)));
  await document.fonts.ready;
  remeasureText();
}
