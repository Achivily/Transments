'use strict';

const assert = require('assert');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const sharp = require('sharp');
const { ConversionService } = require('../src/main/converter-service');

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function run() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'transments-'));
  const inputDir = path.join(root, 'input');
  const nestedDir = path.join(inputDir, 'nested');
  const outputDir = path.join(root, 'output');
  await fs.mkdir(nestedDir, { recursive: true });

  await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 4,
      background: { r: 42, g: 171, b: 238, alpha: 1 }
    }
  }).png().toFile(path.join(inputDir, 'sample.png'));

  await sharp({
    create: {
      width: 4,
      height: 4,
      channels: 4,
      background: { r: 51, g: 182, b: 121, alpha: 1 }
    }
  }).png().toFile(path.join(nestedDir, 'nested.png'));

  const service = new ConversionService();
  const shallow = await service.scanFolder(inputDir, '.png');
  assert.strictEqual(shallow.length, 1);
  assert.strictEqual(shallow[0].name, 'sample.png');

  const recursive = await service.scanFolder(inputDir, '.png', true);
  assert.strictEqual(recursive.length, 2);

  const resolvedDrop = await service.resolvePaths([inputDir, path.join(inputDir, 'sample.png')], '.png', true);
  assert.strictEqual(resolvedDrop.length, 2);
  assert.deepStrictEqual(resolvedDrop.map((file) => file.name).sort(), ['nested.png', 'sample.png']);

  for (const format of ['png', 'jpeg', 'webp', 'tiff', 'avif', 'gif', 'bmp', 'heic']) {
    const formatOutputDir = path.join(outputDir, format);
    const result = await service.start({
      files: shallow,
      outputFormat: format,
      outputDir: formatOutputDir,
      lossless: true,
      overwrite: false
    });

    assert.strictEqual(result.ok, true, format);
    assert.strictEqual(result.succeeded, 1, format);
    const ext = format === 'jpeg' ? 'jpg' : format === 'tiff' ? 'tiff' : format;
    assert.strictEqual(await exists(path.join(formatOutputDir, `sample.${ext}`)), true, format);
  }

  await fs.rm(root, { recursive: true, force: true });
}

run().then(() => {
  console.log('converter tests passed');
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
