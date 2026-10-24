// Genera los íconos de la extensión (una llama) sin dependencias: node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('../public/icons/', import.meta.url);
const SIZES = [16, 32, 48, 128];
const SS = 4; // supersampling por eje, para bordes suaves

// Gota: círculo + triángulo tangente a él (coordenadas en 0..1, y hacia abajo).
function inDrop(x, y, cx, cy, r, topY) {
  if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) return true;
  const d = cy - topY;
  const baseY = cy - (r * r) / d;
  if (y < topY || y > baseY) return false;
  const half = ((y - topY) / (baseY - topY)) * r * Math.sqrt(1 - (r / d) ** 2);
  return Math.abs(x - cx) <= half;
}

function pixel(x, y) {
  if (inDrop(x, y, 0.5, 0.64, 0.33, 0.04)) {
    if (inDrop(x, y, 0.5, 0.74, 0.15, 0.46)) return [255, 243, 214];
    const t = Math.min(1, Math.max(0, (y - 0.04) / 0.93)); // amarillo arriba, naranja abajo
    return [255, Math.round(194 - t * 72), Math.round(51 - t * 25)];
  }
  return null;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const rows = [];
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 4); // byte de filtro 0 + RGBA
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = pixel((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size);
          if (c) { r += c[0]; g += c[1]; b += c[2]; hits++; }
        }
      }
      const o = 1 + px * 4;
      if (hits) {
        row[o] = Math.round(r / hits);
        row[o + 1] = Math.round(g / hits);
        row[o + 2] = Math.round(b / hits);
        row[o + 3] = Math.round((hits / (SS * SS)) * 255);
      }
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8 bits por canal
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
for (const s of SIZES) writeFileSync(new URL(`icon${s}.png`, OUT), png(s));
console.log(`Íconos generados en public/icons: ${SIZES.join(', ')} px`);
