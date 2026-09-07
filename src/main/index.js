'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { ConversionService } = require('./converter-service');

const isDev = !app.isPackaged;
let mainWindow = null;
let conversionService = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 860,
    minHeight: 560,
    backgroundColor: '#17212b',
    title: 'Transments',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  if (isDev && process.env.OPEN_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  conversionService = new ConversionService();
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function registerIpc() {
  ipcMain.handle('dialog:pickFolder', async () => {
    const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  });

  ipcMain.handle('dialog:pickImages', async () => {
    const r = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['png','jpg','jpeg','webp','tif','tiff','avif','gif','bmp','heic','heif'] }]
    });
    if (r.canceled) return [];
    return Promise.all(r.filePaths.map(async (filePath) => {
      const stat = await conversionService.fileStat(filePath);
      return { path: filePath, name: path.basename(filePath), size: stat.size };
    }));
  });

  ipcMain.handle('scan:folder', async (_e, folderPath, formatFilter, recursive) => {
    return conversionService.scanFolder(folderPath, formatFilter, recursive);
  });

  ipcMain.handle('files:resolveDropped', async (_e, inputPaths, formatFilter, recursive) => {
    return conversionService.resolvePaths(inputPaths, formatFilter, recursive);
  });

  ipcMain.handle('convert:start', async (_e, payload) => {
    return conversionService.start(payload);
  });

  ipcMain.handle('convert:cancel', () => conversionService.cancel());

  ipcMain.handle('shell:openPath', async (_e, targetPath) => {
    if (!targetPath) return { ok: false, error: 'No path selected' };
    const error = await shell.openPath(targetPath);
    return error ? { ok: false, error } : { ok: true };
  });

  conversionService.on('progress', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('convert:progress', info);
    }
  });
}
