'use strict';

const { app, BrowserWindow } = require('electron');
const fs = require('fs/promises');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const args = parseArgs(process.argv.slice(2));
const language = args.lang === 'zh' || args.lang === 'zh-CN' ? 'zh-CN' : 'en';
const previewPath = path.join(projectRoot, args.output || 'preview/main.png');

async function capturePreview() {
  await fs.mkdir(path.dirname(previewPath), { recursive: true });

  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
    backgroundColor: '#edf3f8',
    webPreferences: {
      preload: path.join(projectRoot, 'src', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  await window.loadFile(path.join(projectRoot, 'src', 'renderer', 'index.html'), {
    query: { lang: language }
  });
  await window.webContents.insertCSS(`
    *,
    *::before,
    *::after {
      animation: none !important;
      transition: none !important;
    }

    .app-shell,
    .empty-state,
    .file-row {
      opacity: 1 !important;
      transform: none !important;
    }
  `);
  await new Promise((resolve) => setTimeout(resolve, 250));

  const image = await window.webContents.capturePage();
  await fs.writeFile(previewPath, image.toPNG());
  window.destroy();
  app.quit();
}

app.whenReady().then(capturePreview).catch((err) => {
  console.error(err);
  app.exit(1);
});

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith('--lang=')) {
      parsed.lang = arg.slice('--lang='.length);
    } else if (arg === '--lang') {
      parsed.lang = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--output=')) {
      parsed.output = arg.slice('--output='.length);
    } else if (arg === '--output') {
      parsed.output = argv[index + 1];
      index += 1;
    }
  }
  return parsed;
}
