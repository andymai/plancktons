#!/usr/bin/env node
// One-shot generator for raster icons + OG image. Reads public/favicon.svg
// and emits PNGs back into public/. Run via: npm run gen:icons
//
// Outputs:
//   public/apple-touch-icon.png     180x180  (iOS Safari add-to-home-screen)
//   public/icon-192.png             192x192  (Android Chrome home screen)
//   public/icon-512.png             512x512  (PWA install / Lighthouse)
//   public/icon-512-maskable.png    512x512  (Android adaptive icon, 20% safe-zone padding)
//   public/og-image.png             1200x630 (Open Graph / Twitter card / Slack unfurl)

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const repo = dirname(here);
const pub = join(repo, 'public');

const faviconSvg = readFileSync(join(pub, 'favicon.svg'));
const BG = '#15181c';

async function pngFromSvg(svgBuffer, size, outPath) {
  await sharp(svgBuffer, { density: 384 }).resize(size, size).png().toFile(outPath);
  console.log(`  wrote ${outPath}`);
}

async function maskablePngFromSvg(svgBuffer, size, outPath) {
  const innerFraction = 0.7;
  const inner = Math.round(size * innerFraction);
  const innerPng = await sharp(svgBuffer, { density: 384 }).resize(inner, inner).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: innerPng, gravity: 'center' }])
    .png()
    .toFile(outPath);
  console.log(`  wrote ${outPath}`);
}

function ogSvg() {
  const W = 1200;
  const H = 630;
  const markSize = 440;
  const markX = 90;
  const markY = (H - markSize) / 2;
  const textX = markX + markSize + 70;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <g transform="translate(${markX} ${markY}) scale(${markSize / 64})">
    <rect width="64" height="64" rx="10" fill="${BG}"/>
    <polygon points="12,44 44,52 50,28" fill="#d83a3a" fill-opacity="0.92"/>
    <polygon points="12,44 50,28 36,12" fill="#a02828" fill-opacity="0.85"/>
    <g stroke="#f5f5f0" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" fill="none">
      <line x1="12" y1="44" x2="44" y2="52"/>
      <line x1="44" y1="52" x2="50" y2="28"/>
      <line x1="50" y1="28" x2="12" y2="44"/>
      <line x1="12" y1="44" x2="36" y2="12"/>
      <line x1="44" y1="52" x2="36" y2="12"/>
      <line x1="50" y1="28" x2="36" y2="12"/>
    </g>
  </g>
  <g font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" fill="#f5f5f0">
    <text x="${textX}" y="280" font-size="96" font-weight="700" letter-spacing="-2">Plancktons</text>
    <text x="${textX}" y="340" font-size="34" font-weight="500" fill="#d83a3a">Hill T₁ orthoscheme study</text>
    <text x="${textX}" y="430" font-size="28" font-weight="400" fill="#b8bdc4">Random face-to-face aggregation,</text>
    <text x="${textX}" y="468" font-size="28" font-weight="400" fill="#b8bdc4">packing fractions, m³-reptile dissection.</text>
  </g>
</svg>`;
}

async function generateOg(outPath) {
  await sharp(Buffer.from(ogSvg()), { density: 384 }).resize(1200, 630).png().toFile(outPath);
  console.log(`  wrote ${outPath}`);
}

console.log('Generating icons from public/favicon.svg ...');
await pngFromSvg(faviconSvg, 180, join(pub, 'apple-touch-icon.png'));
await pngFromSvg(faviconSvg, 192, join(pub, 'icon-192.png'));
await pngFromSvg(faviconSvg, 512, join(pub, 'icon-512.png'));
await maskablePngFromSvg(faviconSvg, 512, join(pub, 'icon-512-maskable.png'));
await generateOg(join(pub, 'og-image.png'));
console.log('Done.');
