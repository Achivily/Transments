'use strict';

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');
const _sharp = require('sharp');

let elheifReady = null;
let elheifModule = null;

// Accepts a file path, or the { raw, width, height } wrapper produced by readInput()
function sharp(input, opts = {}) {
  if (input && input.raw) {
    return _sharp(input.raw, { ...opts, raw: { width: input.width, height: input.height, channels: 4 } });
  }
  return _sharp(input, opts);
}

const SUPPORTED_INPUT = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff',
  '.avif', '.gif', '.bmp', '.heic', '.heif'
]);

const OUTPUT_FORMATS = ['png', 'jpeg', 'webp', 'tiff', 'avif', 'gif', 'bmp', 'heic'];

// sharp's lossless encoders; heic handled separately
const SHARP_FORMATS = new Set(['png', 'jpeg', 'webp', 'tiff', 'avif', 'gif']);

const FORMAT_EXT = {
  png: '.png',
  jpeg: '.jpg',
  webp: '.webp',
  tiff: '.tiff',
  avif: '.avif',
  gif: '.gif',
  bmp: '.bmp',
  heic: '.heic'
};

class ConversionService extends EventEmitter {
  constructor() {
    super();
    this.cancelled = false;
    this.running = false;
  }

  async fileStat(filePath) {
    return fs.stat(filePath);
  }

  async scanFolder(folderPath, formatFilter, recursive = false, rootPath = folderPath) {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const files = [];
    for (const e of entries) {
      const full = path.join(folderPath, e.name);
      if (e.isDirectory() && recursive) {
        files.push(...await this.scanFolder(full, formatFilter, true, rootPath));
        continue;
      }
      if (!e.isFile()) continue;
      const ext = path.extname(e.name).toLowerCase();
      if (!SUPPORTED_INPUT.has(ext)) continue;
      if (!formatMatches(ext, formatFilter)) continue;
      files.push({
        path: full,
        name: e.name,
        relativePath: path.relative(rootPath, full),
        size: (await fs.stat(full)).size
      });
    }
    files.sort((a, b) => a.relativePath.localeCompare(b.relativePath, undefined, { numeric: true }));
    return files;
  }

  async resolvePaths(inputPaths, formatFilter, recursive = false) {
    const files = [];
    const seen = new Set();
    for (const inputPath of inputPaths || []) {
      if (!inputPath || seen.has(inputPath.toLowerCase())) continue;
      let stat;
      try {
        stat = await fs.stat(inputPath);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        const scanned = await this.scanFolder(inputPath, formatFilter, recursive);
        for (const file of scanned) {
          const key = file.path.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          files.push(file);
        }
        continue;
      }
      if (!stat.isFile()) continue;
      const ext = path.extname(inputPath).toLowerCase();
      if (!SUPPORTED_INPUT.has(ext) || !formatMatches(ext, formatFilter)) continue;
      seen.add(inputPath.toLowerCase());
      files.push({
        path: inputPath,
        name: path.basename(inputPath),
        size: stat.size
      });
    }
    files.sort((a, b) => (a.relativePath || a.name).localeCompare(b.relativePath || b.name, undefined, { numeric: true }));
    return files;
  }

  cancel() {
    if (this.running) this.cancelled = true;
    return this.cancelled;
  }

  async start({ files, outputFormat, outputDir, lossless = true, overwrite = false }) {
    if (this.running) return { ok: false, error: 'A conversion is already running' };
    if (!files || !files.length) return { ok: false, error: 'No input files' };
    if (!outputDir) return { ok: false, error: 'No output folder' };
    if (!OUTPUT_FORMATS.includes(outputFormat)) return { ok: false, error: `Unsupported output format: ${outputFormat}` };

    this.running = true;
    this.cancelled = false;
    const results = [];
    try {
      await fs.mkdir(outputDir, { recursive: true });
      const concurrency = Math.max(1, Math.min(4, os.cpus().length - 1));
      let index = 0;
      const workers = Array.from({ length: concurrency }, async () => {
        while (index < files.length) {
          if (this.cancelled) return;
          const i = index++;
          const file = files[i];
          const res = await this.convertOne(file, outputFormat, outputDir, lossless, overwrite);
          results.push(res);
          this.emit('progress', {
            index: i, total: files.length, file: file.name, path: file.path,
            status: res.ok ? 'done' : 'error', message: res.error || null
          });
        }
      });
      await Promise.all(workers);
      const done = results.filter(r => r.ok).length;
      return { ok: true, cancelled: this.cancelled, total: files.length, succeeded: done, failed: results.length - done, results };
    } catch (err) {
      return { ok: false, error: err.message };
    } finally {
      this.running = false;
    }
  }

  async convertOne(file, outputFormat, outputDir, lossless, overwrite) {
    const base = path.basename(file.path, path.extname(file.path));
    const relativeDir = file.relativePath ? path.dirname(file.relativePath) : '';
    const finalDir = relativeDir && relativeDir !== '.' ? path.join(outputDir, relativeDir) : outputDir;
    const outPath = path.join(finalDir, base + FORMAT_EXT[outputFormat]);
    try {
      await fs.mkdir(finalDir, { recursive: true });
      if (fsSync.existsSync(outPath) && !overwrite) {
        return { ok: false, file: file.name, error: 'Target exists (overwrite off)' };
      }
      if (outputFormat === 'heic') {
        await convertToHeic(file.path, outPath, lossless);
      } else if (outputFormat === 'bmp') {
        await convertToBmp(file.path, outPath);
      } else {
        const input = await readInput(file.path);
        let img = sharp(input, { unlimited: true });
        const meta = await img.metadata();
        // Animated GIF input: keep first frame only for static formats
        img = img.toFormat(outputFormat, encodeOptions(outputFormat, lossless));
        if (meta.pages > 1 && outputFormat === 'webp') {
          img = sharp(input, { pages: -1 }).toFormat('webp', { ...encodeOptions('webp', lossless), animated: true });
        }
        await img.toFile(outPath);
      }
      return { ok: true, file: file.name, output: outPath };
    } catch (err) {
      return { ok: false, file: file.name, error: err.message };
    }
  }
}

function encodeOptions(fmt, lossless) {
  switch (fmt) {
    case 'jpeg': return { quality: 100, chromaSubsampling: '4:4:4', mozjpeg: true };
    case 'webp': return lossless ? { lossless: true } : { quality: 90 };
    case 'avif': return lossless ? { lossless: true } : { quality: 80 };
    case 'gif': return { dither: 0 };
    case 'tiff': return { compression: 'lzw' };
    default: return {};
  }
}

function formatMatches(ext, formatFilter) {
  if (!formatFilter || formatFilter === 'auto') return true;
  if (formatFilter === '.jpg') return ext === '.jpg' || ext === '.jpeg';
  if (formatFilter === '.tif') return ext === '.tif' || ext === '.tiff';
  if (formatFilter === '.heic') return ext === '.heic' || ext === '.heif';
  return ext === formatFilter;
}

// HEIC sources are not decodable by stock sharp; decode raw RGBA, then let sharp encode.
async function readInput(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.heic' || ext === '.heif') {
    const { default: heicDecode } = await import('heic-decode');
    const buf = await fs.readFile(filePath);
    const data = await heicDecode({ buffer: buf });
    return { raw: data.data, width: data.width, height: data.height };
  }
  return filePath;
}

async function convertToHeic(inPath, outPath, lossless) {
  const input = await readInput(inPath);
  let rgba, width, height;
  if (input && input.raw) {
    ({ raw: rgba, width, height } = input);
  } else {
    const m = await sharp(input, { unlimited: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    rgba = m.data;
    width = m.info.width;
    height = m.info.height;
  }

  const encoder = await getElheif();
  const encoded = encoder.jsEncodeImage(new Uint8Array(rgba), width, height);
  if (encoded.err) throw new Error(`HEIC encode failed: ${encoded.err}`);
  await fs.writeFile(outPath, Buffer.from(encoded.data));
}

async function getElheif() {
  if (elheifModule) return elheifModule;
  if (!elheifReady) {
    elheifReady = (async () => {
      await import('elheif/pkg/elheif-wasm.js');
      const initElheif = globalThis.__init__ELHEIF_MODULE;
      if (typeof initElheif !== 'function') {
        throw new Error('HEIC encoder did not expose an initializer');
      }
      const moduleApi = {};
      await new Promise((resolve) => {
        moduleApi.onRuntimeInitialized = resolve;
        initElheif(moduleApi);
      });
      elheifModule = moduleApi;
      return elheifModule;
    })();
  }
  return elheifReady;
}

async function convertToBmp(inPath, outPath) {
  const input = await readInput(inPath);
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const headerSize = 54;
  const rowStride = Math.ceil((info.width * 3) / 4) * 4;
  const pixelSize = rowStride * info.height;
  const fileSize = headerSize + pixelSize;
  const out = Buffer.alloc(fileSize);

  out.write('BM', 0, 2, 'ascii');
  out.writeUInt32LE(fileSize, 2);
  out.writeUInt32LE(headerSize, 10);
  out.writeUInt32LE(40, 14);
  out.writeInt32LE(info.width, 18);
  out.writeInt32LE(info.height, 22);
  out.writeUInt16LE(1, 26);
  out.writeUInt16LE(24, 28);
  out.writeUInt32LE(pixelSize, 34);

  for (let y = 0; y < info.height; y += 1) {
    const srcY = info.height - 1 - y;
    for (let x = 0; x < info.width; x += 1) {
      const src = (srcY * info.width + x) * info.channels;
      const dst = headerSize + y * rowStride + x * 3;
      out[dst] = data[src + 2];
      out[dst + 1] = data[src + 1];
      out[dst + 2] = data[src];
    }
  }

  await fs.writeFile(outPath, out);
}

module.exports = { ConversionService, OUTPUT_FORMATS, SUPPORTED_INPUT, formatMatches };
