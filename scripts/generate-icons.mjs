import sharp from "sharp";
import fs from "fs";

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const bg = "#0a0b0f";

function svgIcon(size) {
  const r = size * 0.18;
  const pad = size * 0.16;
  const inner = size - pad * 2;
  // Lightning bolt path scaled to inner box
  const bx = pad, by = pad;
  // bolt path normalized (0..100) then scaled
  const pts = [
    [55, 5], [22, 55], [45, 55], [38, 95], [78, 40], [52, 40], [60, 5]
  ];
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${bx + (p[0] / 100) * inner},${by + (p[1] / 100) * inner}`).join(" ") + " Z";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#3b82f6"/>
        <stop offset="100%" stop-color="#8b5cf6"/>
      </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${bg}"/>
    <rect x="${size*0.08}" y="${size*0.08}" width="${size*0.84}" height="${size*0.84}" rx="${r*0.85}" ry="${r*0.85}" fill="url(#g)"/>
    <path d="${path}" fill="#ffffff"/>
  </svg>`;
}

for (const s of sizes) {
  await sharp(Buffer.from(svgIcon(s))).png().toFile(`public/icons/icon-${s}.png`);
}
await sharp(Buffer.from(svgIcon(180))).png().toFile(`public/icons/apple-touch-icon.png`);
await sharp(Buffer.from(svgIcon(32))).png().toFile(`/tmp/favicon-32.png`);
// favicon.ico - sharp can't write ico, use png as fallback (browsers accept) but better: write a 32x32 png named .ico
fs.copyFileSync("/tmp/favicon-32.png", "public/favicon.ico");
fs.writeFileSync("public/favicon.svg", svgIcon(64));

// Splash screens
const splashes = [[390,844],[428,926],[375,812]];
for (const [w,h] of splashes) {
  const iconSize = 192;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" fill="${bg}"/>
    <text x="${w/2}" y="${h/2 + 140}" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="32" font-weight="700" fill="#ffffff" text-anchor="middle">EdgeHunter</text>
    <text x="${w/2}" y="${h/2 + 175}" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="16" fill="#9ca3af" text-anchor="middle">Prediction Market Intelligence</text>
  </svg>`;
  const iconPng = await sharp(Buffer.from(svgIcon(iconSize))).png().toBuffer();
  await sharp(Buffer.from(svg))
    .composite([{ input: iconPng, top: Math.round(h/2 - iconSize - 20), left: Math.round((w - iconSize)/2) }])
    .png()
    .toFile(`public/icons/splash-${w}x${h}.png`);
}
console.log("done");
