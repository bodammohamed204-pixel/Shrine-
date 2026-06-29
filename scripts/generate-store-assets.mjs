import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const storeDir = path.join(root, "store-assets");
const screenDir = path.join(storeDir, "screenshots", "phone");
const capacitorAssetDir = path.join(root, "assets");
const fontDir = path.join(root, "public", "fonts");
const appFontFamily = "Shrine App Font";
const appFontFiles = [
  { weight: 400, file: "noto-sans-arabic-400.ttf" },
  { weight: 500, file: "noto-sans-arabic-500.ttf" },
  { weight: 600, file: "noto-sans-arabic-600.ttf" },
  { weight: 700, file: "noto-sans-arabic-700.ttf" },
  { weight: 800, file: "noto-sans-arabic-800.ttf" },
  { weight: 900, file: "noto-sans-arabic-900.ttf" }
];

await fs.mkdir(storeDir, { recursive: true });
await fs.mkdir(screenDir, { recursive: true });
await fs.mkdir(capacitorAssetDir, { recursive: true });

function appIconSvg(size = 1024) {
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#2B9BE8"/>
        <stop offset="1" stop-color="#147BC5"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="34%" r="70%">
        <stop offset="0" stop-color="#ffffff" stop-opacity=".95"/>
        <stop offset=".45" stop-color="#E8F6FF" stop-opacity=".35"/>
        <stop offset="1" stop-color="#2B9BE8" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1024" height="1024" rx="220" fill="url(#bg)"/>
    <circle cx="512" cy="420" r="360" fill="url(#glow)"/>
    <path d="M512 178c-88 76-204 159-204 309 0 125 91 226 204 226s204-101 204-226c0-150-116-233-204-309Z" fill="#fff" opacity=".97"/>
    <circle cx="512" cy="412" r="102" fill="#2B9BE8"/>
    <path d="M346 750c34-98 111-150 166-150s132 52 166 150H346Z" fill="#EAF6FF"/>
    <path d="M358 786h308" stroke="#fff" stroke-width="42" stroke-linecap="round"/>
  </svg>`;
}

async function embeddedFontCss() {
  const fontFaces = await Promise.all(
    appFontFiles.map(async ({ weight, file }) => {
      const fontBuffer = await fs.readFile(path.join(fontDir, file));
      return `
      @font-face {
        font-family: "${appFontFamily}";
        font-style: normal;
        font-weight: ${weight};
        src: url(data:font/truetype;base64,${fontBuffer.toString("base64")}) format("truetype");
      }`;
    })
  );

  return `
      ${fontFaces.join("\n")}

      .feature-text {
        font-family: "${appFontFamily}", "Noto Sans Arabic", Arial, sans-serif;
      }`;
}

async function featureGraphicSvg() {
  const fontCss = await embeddedFontCss();

  return `
  <svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <style>${fontCss}</style>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#F9F4FC"/>
        <stop offset="1" stop-color="#DDF4FF"/>
      </linearGradient>
      <linearGradient id="phone" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#2B9BE8"/>
        <stop offset="1" stop-color="#147BC5"/>
      </linearGradient>
    </defs>
    <rect width="1024" height="500" fill="url(#bg)"/>
    <g opacity=".28" fill="#2B9BE8">
      <path d="M500 0h42v500h-42z" transform="rotate(22 512 250)"/>
      <path d="M500 0h42v500h-42z" transform="rotate(48 512 250)"/>
      <path d="M500 0h42v500h-42z" transform="rotate(-20 512 250)"/>
    </g>
    <rect x="664" y="58" width="210" height="384" rx="38" fill="#fff" stroke="#CDEAFB" stroke-width="4"/>
    <rect x="689" y="110" width="160" height="56" rx="12" fill="url(#phone)"/>
    <rect x="689" y="190" width="160" height="56" rx="12" fill="#F9F4FC" stroke="#2B9BE8" stroke-width="3"/>
    <rect x="689" y="270" width="160" height="56" rx="12" fill="#F9F4FC" stroke="#2B9BE8" stroke-width="3"/>
    <circle cx="769" cy="386" r="32" fill="url(#phone)"/>
    <text class="feature-text" x="92" y="196" font-size="82" font-weight="700" fill="#147BC5">Shrine</text>
    <text class="feature-text" x="96" y="268" font-size="34" font-weight="400" fill="#253040">Create, search, and preserve memorials</text>
    <text class="feature-text" x="96" y="326" font-size="28" font-weight="400" fill="#5D6875">Private account setup with WhatsApp OTP</text>
  </svg>`;
}

async function pngFromSvg(svg, output, width, height) {
  await sharp(Buffer.from(svg))
    .resize(width, height)
    .flatten({ background: "#ffffff" })
    .removeAlpha()
    .png()
    .toFile(output);
}

const featureGraphic = await featureGraphicSvg();

await pngFromSvg(appIconSvg(1024), path.join(storeDir, "app-icon-512.png"), 512, 512);
await pngFromSvg(appIconSvg(1024), path.join(storeDir, "app-store-icon-1024.png"), 1024, 1024);
await pngFromSvg(featureGraphic, path.join(storeDir, "feature-graphic-1024x500.png"), 1024, 500);
await pngFromSvg(appIconSvg(1024), path.join(capacitorAssetDir, "icon.png"), 1024, 1024);
await pngFromSvg(appIconSvg(1024), path.join(capacitorAssetDir, "icon-only.png"), 1024, 1024);
await pngFromSvg(featureGraphic, path.join(capacitorAssetDir, "splash.png"), 2732, 2732);

console.log(`Generated store assets in ${storeDir}`);
