// THE WORLD — Sunday 22 November 2026.
// A one-day world-news front page, drawn entirely in code (Node 22, stdlib only).
// No network, no external images, no randomness: the same bytes every run.
//
// Layout (1024 x 1024, light newsprint):
//   masthead -> lead story (COP31) + Gulf block -> world-map strip (7 regions)
//   -> 12 drawn panels -> 38 dated briefs in two columns.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

const PAGE_W = 1024;
const PAGE_H = 1024;

// ---------------------------------------------------------------- palette
const PAPER = [246, 241, 229] as const;
const INK = [25, 23, 19] as const;
const SOFT_INK = [74, 70, 62] as const;
const RULE = [25, 23, 19] as const;
const RED = [168, 30, 30] as const;
const BLUE = [29, 78, 121] as const;
const TEAL = [15, 107, 92] as const;
const GOLD = [150, 110, 10] as const;
const PANEL_BG = [232, 228, 216] as const;
const MAP_SEA = [214, 226, 232] as const;
const MAP_LAND = [178, 190, 178] as const;
const SKY = [198, 216, 230] as const;
const SEA = [52, 110, 150] as const;
const WHITE = [255, 255, 255] as const;
const DARK_RED = [120, 18, 18] as const;

type RGB = readonly [number, number, number];

// ------------------------------------------------------- 5x7 bitmap font
// Each glyph is 7 rows of 5 bits, written as strings so the shapes stay
// readable in the source. Row 0 is the top. '1' paints, '0' leaves paper.
const GLYPHS: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  a: ['00000', '00000', '01110', '00001', '01111', '10001', '01111'],
  b: ['10000', '10000', '11110', '10001', '10001', '10001', '11110'],
  c: ['00000', '00000', '01110', '10000', '10000', '10001', '01110'],
  d: ['00001', '00001', '01111', '10001', '10001', '10001', '01111'],
  e: ['00000', '00000', '01110', '10001', '11111', '10000', '01110'],
  f: ['00110', '01000', '01000', '11110', '01000', '01000', '01000'],
  g: ['00000', '01111', '10001', '10001', '01111', '00001', '01110'],
  h: ['10000', '10000', '11110', '10001', '10001', '10001', '10001'],
  i: ['00100', '00000', '01100', '00100', '00100', '00100', '01110'],
  j: ['00010', '00000', '00110', '00010', '00010', '10010', '01100'],
  k: ['10000', '10000', '10010', '10100', '11000', '10100', '10010'],
  l: ['01100', '00100', '00100', '00100', '00100', '00100', '01110'],
  m: ['00000', '00000', '11010', '10101', '10101', '10101', '10101'],
  n: ['00000', '00000', '11110', '10001', '10001', '10001', '10001'],
  o: ['00000', '00000', '01110', '10001', '10001', '10001', '01110'],
  p: ['00000', '00000', '11110', '10001', '10001', '11110', '10000'],
  q: ['00000', '00000', '01111', '10001', '10001', '01111', '00001'],
  r: ['00000', '00000', '10110', '11001', '10000', '10000', '10000'],
  s: ['00000', '00000', '01111', '10000', '01110', '00001', '11110'],
  t: ['00100', '00100', '01110', '00100', '00100', '00100', '00011'],
  u: ['00000', '00000', '10001', '10001', '10001', '10011', '01101'],
  v: ['00000', '00000', '10001', '10001', '10001', '01010', '00100'],
  w: ['00000', '00000', '10001', '10001', '10101', '10101', '01010'],
  x: ['00000', '00000', '10001', '01010', '00100', '01010', '10001'],
  y: ['00000', '00000', '10001', '10001', '01111', '00001', '01110'],
  z: ['00000', '00000', '11111', '00010', '00100', '01000', '11111'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '00100', '01000'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '"': ['01010', '01010', '01010', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  '–': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  '—': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  $: ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '·': ['00000', '00000', '00000', '01100', '01100', '00000', '00000'],
  '#': ['01010', '01010', '11111', '01010', '11111', '01010', '01010'],
  '*': ['00000', '00100', '10101', '01110', '10101', '00100', '00000'],
  _: ['00000', '00000', '00000', '00000', '00000', '00000', '11111'],
  '@': ['01110', '10001', '10111', '10101', '10110', '10000', '01110'],
  '[': ['01110', '01000', '01000', '01000', '01000', '01000', '01110'],
  ']': ['01110', '00010', '00010', '00010', '00010', '00010', '01110'],
  '<': ['00010', '00100', '01000', '10000', '01000', '00100', '00010'],
  '>': ['01000', '00100', '00010', '00001', '00010', '00100', '01000'],
};

// ------------------------------------------------------------- framebuffer
const frame = new Uint8Array(PAGE_W * PAGE_H * 3);
for (let i = 0; i < PAGE_W * PAGE_H; i++) {
  frame[i * 3] = PAPER[0];
  frame[i * 3 + 1] = PAPER[1];
  frame[i * 3 + 2] = PAPER[2];
}

function dot(x: number, y: number, c: RGB): void {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= PAGE_W || yi >= PAGE_H) return;
  const o = (yi * PAGE_W + xi) * 3;
  frame[o] = c[0];
  frame[o + 1] = c[1];
  frame[o + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(PAGE_W, Math.round(x + w));
  const y1 = Math.min(PAGE_H, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const o = (yy * PAGE_W + xx) * 3;
      frame[o] = c[0];
      frame[o + 1] = c[1];
      frame[o + 2] = c[2];
    }
  }
}

function frameRect(x: number, y: number, w: number, h: number, c: RGB, t = 1): void {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}

function drawLine(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = Math.round(x0);
  let y = Math.round(y0);
  const tx = Math.round(x1);
  const ty = Math.round(y1);
  for (;;) {
    dot(x, y, c);
    if (x === tx && y === ty) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function thickLine(x0: number, y0: number, x1: number, y1: number, c: RGB, t: number): void {
  for (let d = -Math.floor(t / 2); d <= Math.floor(t / 2); d++) {
    drawLine(x0 + d, y0, x1 + d, y1, c);
    drawLine(x0, y0 + d, x1, y1 + d, c);
  }
}

function fillDisc(cx: number, cy: number, r: number, c: RGB): void {
  for (let yy = -r; yy <= r; yy++) {
    const half = Math.floor(Math.sqrt(r * r - yy * yy));
    for (let xx = -half; xx <= half; xx++) dot(cx + xx, cy + yy, c);
  }
}

function fillTriangle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: RGB): void {
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const maxY = Math.min(PAGE_H - 1, Math.ceil(Math.max(ay, by, cy)));
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    const edges = [
      [ax, ay, bx, by],
      [bx, by, cx, cy],
      [cx, cy, ax, ay],
    ];
    for (const [x1, y1, x2, y2] of edges) {
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    if (xs.length >= 2) {
      const xa = Math.min(...xs);
      const xb = Math.max(...xs);
      for (let x = Math.floor(xa); x <= Math.ceil(xb); x++) dot(x, y, c);
    }
  }
}

function fillPoly(pts: Array<[number, number]>, c: RGB): void {
  if (pts.length < 3) return;
  for (let i = 1; i < pts.length - 1; i++) {
    fillTriangle(pts[0][0], pts[0][1], pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c);
  }
}

// ------------------------------------------------------------------- text
function glyphWidth(scale: number): number {
  return 6 * scale;
}

function textWidth(s: string, scale: number): number {
  return s.length * glyphWidth(scale) - scale;
}

function drawText(s: string, x: number, y: number, scale: number, c: RGB): void {
  let cx = Math.round(x);
  const cy = Math.round(y);
  for (const ch of s) {
    const g = GLYPHS[ch] ?? GLYPHS[' '];
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let col = 0; col < 5; col++) {
        if (row[col] === '1') {
          fillRect(cx + col * scale, cy + r * scale, scale, scale, c);
        }
      }
    }
    cx += glyphWidth(scale);
  }
}

function drawCentred(s: string, cx: number, y: number, scale: number, c: RGB): void {
  drawText(s, cx - textWidth(s, scale) / 2, y, scale, c);
}

// Word-wrap: greedy, returns lines that fit maxW at the given scale.
function wrapLines(s: string, maxW: number, scale: number): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const trial = cur === '' ? w : cur + ' ' + w;
    if (textWidth(trial, scale) <= maxW) {
      cur = trial;
    } else {
      if (cur !== '') lines.push(cur);
      cur = w;
    }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

function drawWrapped(s: string, x: number, y: number, maxW: number, scale: number, c: RGB, lineH: number): number {
  const lines = wrapLines(s, maxW, scale);
  lines.forEach((ln, i) => drawText(ln, x, y + i * lineH, scale, c));
  return lines.length;
}

// -------------------------------------------------------------------- PNG
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(): Buffer {
  const raw = Buffer.alloc(PAGE_H * (1 + PAGE_W * 3));
  for (let y = 0; y < PAGE_H; y++) {
    raw[y * (1 + PAGE_W * 3)] = 0; // filter: none
    raw.set(frame.subarray(y * PAGE_W * 3, (y + 1) * PAGE_W * 3), y * (1 + PAGE_W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(PAGE_W, 0);
  ihdr.writeUInt32BE(PAGE_H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------ panel scenes
// Every scene is drawn with flat shapes only, inside its own box (x, y, w, h).

function sceneCopTable(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, SKY);
  fillDisc(x + w - 26, y + 18, 12, GOLD); // sun over Antalya
  fillRect(x, y + h - 26, w, 26, [196, 178, 150]); // hall floor
  fillRect(x + 14, y + h - 52, w - 28, 26, [122, 84, 52]); // table
  // three flags behind the table
  const flagCols: RGB[] = [RED, BLUE, TEAL];
  for (let i = 0; i < 3; i++) {
    const fx = x + 24 + i * 44;
    drawLine(fx, y + 12, fx, y + h - 52, INK);
    fillRect(fx, y + 12, 30, 18, flagCols[i]);
  }
  // delegates as simple heads + shoulders
  for (let i = 0; i < 5; i++) {
    const hx = x + 22 + i * 26;
    fillDisc(hx, y + h - 62, 6, [232, 196, 160]);
    fillRect(hx - 8, y + h - 56, 16, 6, INK);
  }
}

function sceneShipFire(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, SKY);
  fillDisc(x + w - 24, y + 16, 10, GOLD);
  // sea
  fillRect(x, y + h - 22, w, 22, SEA);
  for (let i = 0; i < 4; i++) {
    drawLine(x + 6 + i * 34, y + h - 12, x + 22 + i * 34, y + h - 12, WHITE);
  }
  // hull
  fillPoly(
    [
      [x + 12, y + h - 44],
      [x + w - 12, y + h - 44],
      [x + w - 26, y + h - 22],
      [x + 26, y + h - 22],
    ],
    DARK_RED,
  );
  fillRect(x + 30, y + h - 62, 46, 18, INK); // superstructure
  // flames
  fillTriangle(x + 40, y + h - 62, x + 52, y + 8, x + 64, y + h - 62, [232, 120, 20]);
  fillTriangle(x + 58, y + h - 62, x + 70, y + 20, x + 82, y + h - 62, [240, 180, 30]);
  fillDisc(x + 46, y + 6, 7, [90, 90, 90]); // smoke
  fillDisc(x + 62, y + 2, 6, [90, 90, 90]);
  // lifeboat
  fillRect(x + w - 52, y + h - 14, 26, 6, GOLD);
}

function sceneQuake(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, SKY);
  // Andes ridge
  fillPoly(
    [
      [x, y + h - 34],
      [x + 30, y + 6],
      [x + 58, y + h - 34],
    ],
    MAP_LAND,
  );
  fillPoly(
    [
      [x + 44, y + h - 34],
      [x + 84, y + 14],
      [x + 118, y + h - 34],
    ],
    [150, 164, 150],
  );
  fillRect(x, y + h - 34, w, 34, [196, 178, 150]); // ground
  // crack zigzag
  const crack: Array<[number, number]> = [
    [x + 78, y + h - 34],
    [x + 70, y + h - 24],
    [x + 84, y + h - 16],
    [x + 72, y + h - 6],
    [x + 80, y],
  ];
  for (let i = 0; i < crack.length - 1; i++) {
    thickLine(crack[i][0], crack[i][1], crack[i + 1][0], crack[i + 1][1], INK, 2);
  }
  // tilted building
  fillPoly(
    [
      [x + 14, y + h - 58],
      [x + 44, y + h - 66],
      [x + 48, y + h - 34],
      [x + 18, y + h - 34],
    ],
    [210, 196, 170],
  );
  fillRect(x + 22, y + h - 54, 6, 6, INK);
  fillRect(x + 32, y + h - 54, 6, 6, INK);
  // shock rings
  frameRect(x + 96, y + 8, 26, 26, RED, 2);
  drawText('M6.7', x + 98, y + 14, 1, RED);
}

function sceneMissiles(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [40, 44, 66]); // night sky
  fillDisc(x + w - 22, y + 14, 8, [230, 230, 210]); // moon
  // two missile trails
  thickLine(x + 10, y + 8, x + 60, y + h - 40, [240, 180, 60], 2);
  thickLine(x + 40, y + 4, x + 96, y + h - 44, [240, 180, 60], 2);
  fillDisc(x + 60, y + h - 40, 5, [255, 120, 20]);
  fillDisc(x + 96, y + h - 44, 5, [255, 120, 20]);
  // city blocks
  fillRect(x + 6, y + h - 34, 26, 34, [70, 74, 92]);
  fillRect(x + 38, y + h - 26, 30, 26, [70, 74, 92]);
  fillRect(x + 74, y + h - 40, 24, 40, [70, 74, 92]);
  fillRect(x + 104, y + h - 22, 30, 22, [70, 74, 92]);
  for (let i = 0; i < 5; i++) fillRect(x + 12 + i * 22, y + h - 28, 4, 4, GOLD);
  // explosion burst
  fillTriangle(x + 52, y + h - 52, x + 60, y + h - 66, x + 68, y + h - 52, [255, 200, 60]);
}

function sceneTanker(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, SKY);
  fillRect(x, y + h - 24, w, 24, SEA);
  fillRect(x + 16, y + h - 48, w - 32, 24, [60, 60, 60]); // tanker hull
  fillRect(x + w - 46, y + h - 66, 22, 18, [200, 200, 200]); // bridge
  fillTriangle(x + 46, y + h - 48, x + 58, y + 10, x + 70, y + h - 48, [232, 120, 20]);
  fillTriangle(x + 62, y + h - 48, x + 74, y + 22, x + 86, y + h - 48, [240, 180, 30]);
  fillDisc(x + 52, y + 8, 6, [90, 90, 90]);
  // naval mine
  fillDisc(x + 30, y + h - 14, 6, INK);
  drawLine(x + 24, y + h - 20, x + 36, y + h - 8, INK);
  drawLine(x + 24, y + h - 8, x + 36, y + h - 20, INK);
  drawLine(x + 112, y + h - 10, x + 128, y + h - 10, WHITE);
}

function sceneCapture(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [222, 206, 178]);
  // sheriff star badge
  fillDisc(x + w / 2, y + 34, 22, GOLD);
  fillDisc(x + w / 2, y + 34, 14, [240, 200, 80]);
  drawText('$5M', x + w / 2 - 9, y + 30, 1, INK);
  // bars
  for (let i = 0; i < 5; i++) fillRect(x + 14 + i * 26, y + h - 34, 5, 34, INK);
  fillRect(x + 10, y + h - 38, w - 20, 4, INK);
  // handcuffs
  fillDisc(x + 44, y + h - 52, 8, [120, 120, 130]);
  fillDisc(x + 44, y + h - 52, 4, PANEL_BG);
  fillDisc(x + 76, y + h - 52, 8, [120, 120, 130]);
  fillDisc(x + 76, y + h - 52, 4, PANEL_BG);
  drawLine(x + 52, y + h - 52, x + 68, y + h - 52, [120, 120, 130]);
}

function sceneMarkets(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, WHITE);
  // grid
  for (let i = 1; i < 4; i++) drawLine(x + 8, y + i * 20, x + w - 8, y + i * 20, [220, 220, 220]);
  // falling red line
  const pts: Array<[number, number]> = [
    [x + 10, y + 14],
    [x + 34, y + 22],
    [x + 52, y + 18],
    [x + 74, y + 40],
    [x + 96, y + 52],
    [x + 118, y + 66],
    [x + w - 12, y + h - 16],
  ];
  for (let i = 0; i < pts.length - 1; i++) thickLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], RED, 3);
  // arrow head
  fillTriangle(x + w - 12, y + h - 16, x + w - 24, y + h - 20, x + w - 16, y + h - 28, RED);
  drawText('-5.3%', x + 10, y + h - 22, 1, RED);
}

function sceneFbi(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [210, 214, 220]);
  // building
  fillRect(x + 34, y + 18, 62, h - 18, [120, 126, 138]);
  fillRect(x + 28, y + 12, 74, 8, INK);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) fillRect(x + 42 + c * 14, y + 28 + r * 16, 8, 10, [230, 230, 220]);
  }
  // padlock
  fillRect(x + w - 44, y + h - 40, 26, 22, GOLD);
  frameRect(x + w - 40, y + h - 52, 18, 14, INK, 3);
  fillDisc(x + w - 31, y + h - 29, 3, INK);
  // warning triangle
  fillTriangle(x + 12, y + h - 34, x + 26, y + h - 58, x + 40, y + h - 34, [240, 180, 30]);
  drawText('!', x + 23, y + h - 50, 2, INK);
}

function sceneSummit(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [214, 200, 168]); // sepia photo
  frameRect(x + 6, y + 6, w - 12, h - 12, WHITE, 4);
  // round table
  fillDisc(x + w / 2, y + h - 26, 44, [122, 84, 52]);
  fillDisc(x + w / 2, y + h - 26, 34, [150, 108, 66]);
  // three seated figures
  const cols: RGB[] = [INK, DARK_RED, BLUE];
  for (let i = 0; i < 3; i++) {
    const fx = x + 26 + i * 40;
    fillDisc(fx, y + 26, 9, [232, 196, 160]);
    fillRect(fx - 11, y + 36, 22, 20, cols[i]);
  }
  drawText('1945', x + 14, y + h - 20, 1, INK);
  drawText('2026', x + w - 34, y + h - 20, 1, INK);
}

function sceneStorm(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [90, 96, 110]);
  // storm cloud
  fillDisc(x + 44, y + 22, 18, [60, 62, 70]);
  fillDisc(x + 70, y + 18, 20, [60, 62, 70]);
  fillDisc(x + 96, y + 24, 16, [60, 62, 70]);
  // lightning
  fillPoly(
    [
      [x + 66, y + 34],
      [x + 58, y + 58],
      [x + 66, y + 58],
      [x + 56, y + 80],
      [x + 74, y + 52],
      [x + 66, y + 52],
      [x + 76, y + 34],
    ],
    GOLD,
  );
  // rain
  for (let i = 0; i < 6; i++) drawLine(x + 14 + i * 18, y + 44 + (i % 2) * 6, x + 10 + i * 18, y + 58 + (i % 2) * 6, [180, 200, 220]);
  // tilted houses
  fillPoly(
    [
      [x + 12, y + h - 30],
      [x + 30, y + h - 44],
      [x + 48, y + h - 30],
    ],
    DARK_RED,
  );
  fillRect(x + 16, y + h - 30, 28, 16, [210, 196, 170]);
  fillPoly(
    [
      [x + 76, y + h - 26],
      [x + 94, y + h - 40],
      [x + 112, y + h - 26],
    ],
    DARK_RED,
  );
  fillRect(x + 80, y + h - 26, 28, 12, [210, 196, 170]);
}

function sceneGaza(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [226, 214, 196]);
  // skyline with a cracked block
  fillRect(x + 10, y + h - 52, 24, 52, [120, 112, 100]);
  fillRect(x + 40, y + h - 66, 26, 66, [140, 130, 116]);
  fillRect(x + 72, y + h - 44, 22, 44, [120, 112, 100]);
  fillRect(x + 100, y + h - 58, 24, 58, [140, 130, 116]);
  // crack zigzag down the second block, drawn as two short segments
  thickLine(x + 46, y + h - 66, x + 52, y + h - 52, INK, 2);
  thickLine(x + 52, y + h - 52, x + 58, y + h - 40, INK, 2);
  // windows
  for (let i = 0; i < 4; i++) fillRect(x + 16 + i * 26, y + h - 44, 5, 5, GOLD);
  // dove
  fillDisc(x + 96, y + 18, 7, WHITE);
  fillTriangle(x + 100, y + 14, x + 116, y + 6, x + 108, y + 22, WHITE);
  fillTriangle(x + 92, y + 12, x + 100, y + 2, x + 102, y + 14, WHITE);
}

function sceneDelhi(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, SKY);
  // plane
  fillPoly(
    [
      [x + 18, y + 26],
      [x + 62, y + 26],
      [x + 74, y + 30],
      [x + 62, y + 34],
      [x + 18, y + 34],
    ],
    WHITE,
  );
  fillTriangle(x + 30, y + 26, x + 40, y + 14, x + 46, y + 26, WHITE);
  fillTriangle(x + 30, y + 34, x + 40, y + 46, x + 46, y + 34, WHITE);
  // two flags on poles
  drawLine(x + 30, y + 52, x + 30, y + h - 8, INK);
  fillRect(x + 30, y + 52, 30, 10, RED);
  fillRect(x + 30, y + 62, 30, 10, BLUE);
  drawLine(x + 84, y + 52, x + 84, y + h - 8, INK);
  fillRect(x + 84, y + 52, 30, 10, [220, 60, 40]);
  fillRect(x + 84, y + 62, 30, 10, WHITE);
  fillRect(x + 84, y + 72, 30, 10, TEAL);
  // handshake blocks
  fillRect(x + 46, y + h - 22, 36, 10, [232, 196, 160]);
}

// ------------------------------------------------------------ world map
function drawMapStrip(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, MAP_SEA);
  frameRect(x, y, w, h, INK, 1);
  // Simplified continents (stylised, not to scale).
  // North America
  fillPoly(
    [
      [x + 60, y + 14],
      [x + 150, y + 8],
      [x + 196, y + 18],
      [x + 180, y + 40],
      [x + 130, y + 52],
      [x + 92, y + 44],
      [x + 56, y + 30],
    ],
    MAP_LAND,
  );
  // South America
  fillPoly(
    [
      [x + 150, y + 56],
      [x + 196, y + 56],
      [x + 188, y + 88],
      [x + 168, y + 108],
      [x + 152, y + 84],
    ],
    MAP_LAND,
  );
  // Europe
  fillPoly(
    [
      [x + 420, y + 14],
      [x + 452, y + 8],
      [x + 476, y + 16],
      [x + 468, y + 32],
      [x + 440, y + 34],
      [x + 422, y + 24],
    ],
    MAP_LAND,
  );
  // Africa
  fillPoly(
    [
      [x + 420, y + 40],
      [x + 486, y + 40],
      [x + 478, y + 76],
      [x + 452, y + 96],
      [x + 430, y + 70],
    ],
    MAP_LAND,
  );
  // Asia
  fillPoly(
    [
      [x + 530, y + 8],
      [x + 640, y + 6],
      [x + 700, y + 20],
      [x + 690, y + 52],
      [x + 620, y + 62],
      [x + 565, y + 48],
      [x + 536, y + 30],
    ],
    MAP_LAND,
  );
  // Australia
  fillPoly(
    [
      [x + 740, y + 78],
      [x + 800, y + 74],
      [x + 812, y + 90],
      [x + 776, y + 100],
      [x + 744, y + 94],
    ],
    MAP_LAND,
  );
  // Region markers: [label, mx, my]
  const markers: Array<[string, number, number]> = [
    ['1', x + 500, y + 38], // Antalya / Turkey
    ['2', x + 566, y + 50], // Gulf / Bahrain
    ['3', x + 480, y + 24], // Ukraine
    ['4', x + 462, y + 10], // Gulf of Finland
    ['5', x + 168, y + 72], // Peru
    ['6', x + 96, y + 34], // Sinaloa, Mexico
    ['7', x + 776, y + 88], // Australia / Asia-Pacific
  ];
  for (const [n, mx, my] of markers) {
    fillDisc(mx, my, 9, RED);
    frameRect(mx - 9, my - 9, 18, 18, WHITE, 1);
    drawText(n, mx - 3, my - 4, 1, WHITE);
  }
}

// ------------------------------------------------------------ the stories
// Every brief carries a place and the date 22 NOV 2026. Facts only as
// reported; uncertain attribution is phrased as reported.
const BRIEFS: string[] = [
  'ANTALYA - COP31 in overtime; new package Sunday, fuel deadlock holds. 22 NOV',
  'BAHRAIN - Iran strikes US bases al-Riffa and Awali; no injuries. 22 NOV',
  'STRAIT OF HORMUZ - Tanker catches fire after hitting a naval mine. 22 NOV',
  'OMAN - Two tankers hit by unknown projectiles near Khasab. 22 NOV',
  'KRYVYI RIH - Missile double-tap kills 2, wounds 60-83; rescuers hit. 22 NOV',
  'GULF OF FINLAND - Ship Sparta II ablaze after drone hits; 16 crew safe. 22 NOV',
  'HELSINKI - Finland says Ukraine likely behind Sparta II attack. 22 NOV',
  'JUNIN, PERU - M6.7 quake in central Andes, felt in Lima; no deaths. 22 NOV',
  "GUASAVE, MEXICO - 'El Chapo Isidro' captured; 11 dead, 8 held. 22 NOV",
  'NEW YORK - S&P 500 falls 3.7%, Nasdaq 5.3% in AI sell-off. 22 NOV',
  'WASHINGTON - Nvidia down 14% amid SEC probe reports. 22 NOV',
  'TORONTO - TSX down 2.5% as markets slide. 22 NOV',
  'WASHINGTON - FBI probes breach of its crime database; USDA hit too. 22 NOV',
  "OTTAWA - Bell says 'agentic' AI hacker stole enterprise data 17 Nov. 22 NOV",
  'WASHINGTON - Pentagon memo curbs US military contact with Canada. 22 NOV',
  "WASHINGTON - Trump posts '1945, 2026' with himself, Xi and Putin. 22 NOV",
  'BRAZIL - Severe storm destroys thousands of homes, kills 3. 22 NOV',
  'GAZA CITY - At least 4 Palestinians killed in Israeli attacks. 22 NOV',
  'NEW DELHI - Nepal PM on state visit to India. 22 NOV',
  'LENINGRAD - Russia says 80 drones shot down overnight. 22 NOV',
  'LONDON - UK confirms cyber operations on Russia, China, Iran, N. Korea. 22 NOV',
  'ANTALYA - Nearly 200 nations at COP31; Australia presides. 22 NOV',
  'ROME - Starlings swirl over the capital as winter flocks gather. 22 NOV',
  'MONTREAL - Canada climate trial under way. 22 NOV',
  'CINCINNATI - Fiona the hippo in the spotlight. 22 NOV',
  "SYDNEY - Australia's Cummins in focus as summer sport builds. 22 NOV",
  'HONG KONG - Harbour city watches markets slide. 22 NOV',
  'RIYADH - Saudi defences intercept missile fire. 22 NOV',
  "SAN FRANCISCO - Anthropic model posts strong maths results. 22 NOV",
  'BRUSSELS - Europe weighs bigger military readiness. 22 NOV',
  'KYIV - Follow-up strikes hit rescuers in Kryvyi Rih. 22 NOV',
  'MANAMA - Air defences intercept further attacks over Bahrain. 22 NOV',
  'TEHRAN - Iran claims MQ-9 and MQ-1 drones downed near Hormuz. 22 NOV',
  'ANTALYA - Australia and Turkey hope for consensus on Sunday. 22 NOV',
  'LIMA - Minor damage and power disruption after quake. 22 NOV',
  'SINALOA - Four soldiers among 11 dead in capture operation. 22 NOV',
  "WASHINGTON - Trump: 'It's not good' on FBI breach. 22 NOV",
  'GULF - Oil flows watched after mine and projectile hits. 22 NOV',
];

// Panels: [scene, headline, subline]
const PANELS: Array<[(x: number, y: number, w: number, h: number) => void, string, string]> = [
  [sceneCopTable, 'COP31: DEAL IN SIGHT', 'Antalya - 22 NOV'],
  [sceneShipFire, 'SPARTA II ABLAZE', 'Gulf of Finland - 22 NOV'],
  [sceneQuake, 'M6.7 SHAKES PERU', 'Junin - Lima - 22 NOV'],
  [sceneMissiles, 'MISSILES HIT KRYVYI RIH', '2 killed - 22 NOV'],
  [sceneTanker, 'TANKER AFIRE IN GULF', 'Mine off Hormuz - 22 NOV'],
  [sceneCapture, "'EL CHAPO ISIDRO' HELD", 'Sinaloa, 11 dead - 22 NOV'],
  [sceneMarkets, 'AI SELLOFF HITS MARKETS', 'Nasdaq -5.3% - 22 NOV'],
  [sceneFbi, 'FBI PROBES DATA BREACH', 'Warrants hit - 22 NOV'],
  [sceneSummit, "TRUMP POSTS '1945, 2026'", 'Yalta 2.0 - 22 NOV'],
  [sceneStorm, 'STORM RAVAGES BRAZIL', 'Homes lost - 22 NOV'],
  [sceneGaza, 'GAZA: 4 KILLED', 'Gaza City - 22 NOV'],
  [sceneDelhi, 'NEPAL PM IN DELHI', 'State visit - 22 NOV'],
];

// ------------------------------------------------------------------ layout
const MX = 24; // page margin
const CW = PAGE_W - MX * 2; // 976 content width

function buildPage(): void {
  // ---- masthead
  drawText('THE WORLD', MX, 18, 6, INK);
  drawText('SUNDAY', 700, 16, 3, RED);
  drawText('22 NOVEMBER 2026', 700, 40, 3, INK);
  drawText('ONE DAY - EVERY REGION', 700, 64, 1, SOFT_INK);
  fillRect(MX, 88, CW, 3, RULE);
  drawText('THE DAY THE WORLD TURNED - 38 STORIES, 7 REGIONS, 12 PICTURES', MX, 96, 1, SOFT_INK);

  // ---- lead row: COP31 (left) + Gulf (right)
  const leadY = 116;
  const leadH = 148;
  const leftW = 600;
  const rightX = MX + leftW + 16;
  const rightW = CW - leftW - 16;
  // left block
  frameRect(MX, leadY, leftW, leadH, INK, 1);
  drawText('CLIMATE - ANTALYA, TURKEY', MX + 10, leadY + 8, 1, RED);
  drawText('COP31 IN OVERTIME', MX + 10, leadY + 24, 3, INK);
  drawText('AS NEW PACKAGE LANDS', MX + 10, leadY + 48, 3, INK);
  drawWrapped(
    'Talks run past the Friday deadline, deadlocked on fossil fuels. On Sunday a new text is announced; Australia and Turkey hope for consensus. Nearly 200 nations at the table. The US sent no official delegation.',
    MX + 10,
    leadY + 76,
    330,
    1,
    INK,
    10,
  );
  sceneCopTable(MX + 352, leadY + 76, 238, 64);
  // right block
  frameRect(rightX, leadY, rightW, leadH, INK, 1);
  drawText('GULF ON EDGE - BAHRAIN', rightX + 10, leadY + 8, 1, RED);
  drawText('IRAN STRIKES', rightX + 10, leadY + 24, 3, INK);
  drawText('US BASES', rightX + 10, leadY + 48, 3, INK);
  drawWrapped(
    'IRGC hits al-Riffa and Awali. Bahrain says a civilian facility caught fire, no injuries, and air defences stopped other attacks. Fourth attack in nine days.',
    rightX + 10,
    leadY + 76,
    rightW - 20,
    1,
    INK,
    10,
  );

  // ---- map strip
  const mapY = 276;
  drawText('WHERE THE DAY HAPPENED - SEVEN REGIONS', MX, mapY, 1, INK);
  drawText('1 ANTALYA  2 GULF  3 UKRAINE  4 FINLAND  5 PERU  6 MEXICO  7 AUSTRALIA', MX + 420, mapY, 1, SOFT_INK);
  drawMapStrip(MX, mapY + 14, CW, 96);

  // ---- 12 panels: 6 columns x 2 rows
  const panelY = 396;
  const panelW = 160;
  const panelH = 126;
  const gap = 8;
  PANELS.forEach(([scene, head, sub], i) => {
    const col = i % 6;
    const row = Math.floor(i / 6);
    const px = MX + col * (panelW + gap);
    const py = panelY + row * (panelH + gap);
    frameRect(px, py, panelW, panelH, INK, 1);
    scene(px + 1, py + 1, panelW - 2, 84);
    fillRect(px + 1, py + 85, panelW - 2, panelH - 86, PAPER);
    drawText(head, px + 5, py + 89, 1, INK);
    drawText(sub, px + 5, py + 101, 1, SOFT_INK);
  });

  // ---- briefs
  const briefY = 676;
  drawText(`THE DAY IN BRIEFS - ${BRIEFS.length} STORIES - 22 NOVEMBER 2026`, MX, briefY, 1, INK);
  fillRect(MX, briefY + 12, CW, 2, RULE);
  const colW = 476;
  const colGap = 24;
  const half = Math.ceil(BRIEFS.length / 2);
  BRIEFS.forEach((b, i) => {
    const col = i < half ? 0 : 1;
    const idx = col === 0 ? i : i - half;
    const bx = MX + col * (colW + colGap);
    const by = briefY + 20 + idx * 16;
    // one line each: every brief is written to fit colW at scale 1
    drawText(b, bx, by, 1, INK);
    fillRect(bx, by + 13, colW, 1, [214, 208, 194]);
  });
  // footer
  fillRect(MX, 1002, CW, 2, RULE);
  drawText('THE WORLD - SUNDAY 22 NOVEMBER 2026 - DRAWN IN CODE, NO PHOTOGRAPHS', MX, 1008, 1, SOFT_INK);
}

// -------------------------------------------------------------------- main
function main(): void {
  buildPage();
  const png = encodePng();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'entry.png');
  writeFileSync(outPath, png);
  chmodSync(outPath, 0o644);
  console.log(`wrote ${outPath} ${png.length} bytes ${PAGE_W}x${PAGE_H}`);
}

main();
