#!/usr/bin/env node
/**
 * Generate EdgeHunter PWA crosshair icons at all required sizes.
 *
 * Usage:  node scripts/generate-icons.js
 *
 * Requires the `canvas` package:
 *   npm i -D canvas
 *
 * Output: public/icons/icon-{size}.png + apple-touch-icon.png
 */
const fs = require("fs");
const path = require("path");
const { createCanvas } = require("canvas");

const SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512];
const OUT = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(OUT, { recursive: true });

const BLUE = "#3b82f6";
const PURPLE = "#8b5cf6";
const LIGHT_BLUE = "#60a5fa";
const BG = "#0a0b0f";
const WHITE = "#e8eaf0";

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function render(size) {
  const SCALE = 4;
  const S = size * SCALE;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext("2d");
  const s = (v) => (v * S) / 100;

  // Rounded square background
  roundedRect(ctx, 0, 0, S, S, S * 0.18);
  ctx.fillStyle = BG;
  ctx.fill();

  const cx = S / 2;
  const cy = S / 2;

  // Diagonal blue → purple gradient for the rings
  const grad = ctx.createLinearGradient(0, 0, S, S);
  grad.addColorStop(0, BLUE);
  grad.addColorStop(1, PURPLE);

  // Outer ring r=32
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = grad;
  ctx.lineWidth = Math.max(2, s(1.5));
  ctx.beginPath();
  ctx.arc(cx, cy, s(32), 0, Math.PI * 2);
  ctx.stroke();

  // Inner ring r=22
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = Math.max(2, s(1));
  ctx.beginPath();
  ctx.arc(cx, cy, s(22), 0, Math.PI * 2);
  ctx.stroke();

  // Subtle blue fill inside r=22
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = BLUE;
  ctx.beginPath();
  ctx.arc(cx, cy, s(22), 0, Math.PI * 2);
  ctx.fill();

  // Crosshair lines
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = LIGHT_BLUE;
  ctx.lineWidth = Math.max(2, s(1.5));
  ctx.lineCap = "round";
  const lines = [
    [8, 50, 26, 50],
    [74, 50, 92, 50],
    [50, 8, 50, 26],
    [50, 74, 50, 92],
  ];
  for (const [x1, y1, x2, y2] of lines) {
    ctx.beginPath();
    ctx.moveTo(s(x1), s(y1));
    ctx.lineTo(s(x2), s(y2));
    ctx.stroke();
  }

  // Tick marks
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = Math.max(2, s(2));
  const ticks = [
    [50, 16, 50, 20],
    [50, 80, 50, 84],
    [16, 50, 20, 50],
    [80, 50, 84, 50],
  ];
  for (const [x1, y1, x2, y2] of ticks) {
    ctx.beginPath();
    ctx.moveTo(s(x1), s(y1));
    ctx.lineTo(s(x2), s(y2));
    ctx.stroke();
  }

  // Center dots
  ctx.globalAlpha = 1;
  ctx.fillStyle = BLUE;
  ctx.beginPath();
  ctx.arc(cx, cy, s(5), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.arc(cx, cy, s(2.5), 0, Math.PI * 2);
  ctx.fill();

  // Downscale for crispness
  const out = createCanvas(size, size);
  out.getContext("2d").drawImage(canvas, 0, 0, size, size);
  return out;
}

for (const sz of SIZES) {
  const c = render(sz);
  const file = path.join(OUT, `icon-${sz}.png`);
  fs.writeFileSync(file, c.toBuffer("image/png"));
  console.log(`wrote ${file}`);
}

const apple = render(180);
const appleFile = path.join(OUT, "apple-touch-icon.png");
fs.writeFileSync(appleFile, apple.toBuffer("image/png"));
console.log(`wrote ${appleFile}`);