import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type);
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  name.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + data.length)), 8 + data.length);
  return chunk;
}

function mix(colors) {
  return Array.from({ length: 4 }, (_, channel) => Math.round(
    colors.reduce((sum, color) => sum + color[channel], 0) / colors.length,
  ));
}

export function createPngIcon(size) {
  const background = [34, 75, 60, 255];
  const bean = [244, 234, 213, 255];
  const seam = [156, 116, 82, 255];
  const samples = [-0.375, -0.125, 0.125, 0.375];
  const angle = 0.48;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const pixels = Buffer.alloc(size * (size * 4 + 1));

  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    pixels[row] = 0;
    for (let x = 0; x < size; x++) {
      const colors = [];
      for (const sampleY of samples) {
        for (const sampleX of samples) {
          const dx = ((x + 0.5 + sampleX) / size) * 2 - 1;
          const dy = ((y + 0.5 + sampleY) / size) * 2 - 1;
          const u = cosine * dx + sine * dy;
          const v = -sine * dx + cosine * dy;
          const inside = (u / 0.31) ** 2 + (v / 0.43) ** 2 <= 1;
          const onSeam = inside && Math.abs(u - 0.07 * Math.sin(v * 4.2)) < 0.025;
          colors.push(onSeam ? seam : inside ? bean : background);
        }
      }
      const color = mix(colors);
      const offset = row + 1 + x * 4;
      pixels.set(color, offset);
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const end = Buffer.alloc(0);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(pixels)),
    pngChunk('IEND', end),
  ]);
}

async function writeIcons() {
  const iconDirectory = path.join(projectRoot, 'pwa', 'icons');
  await mkdir(iconDirectory, { recursive: true });
  for (const size of [192, 512]) {
    await writeFile(path.join(iconDirectory, `icon-${size}.png`), createPngIcon(size));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await writeIcons();
}
