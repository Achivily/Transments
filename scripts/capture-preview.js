'use strict';

const { app, BrowserWindow } = require('electron');
const fs = require('fs/promises');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const previewDir = path.join(projectRoot, 'preview');
const previewPath = path.join(previewDir, 'main.png');

async function capturePreview() {
  await fs.mkdir(previewDir, { recursive: true });

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

  await window.loadFile(path.join(projectRoot, 'src', 'renderer', 'index.html'));
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
