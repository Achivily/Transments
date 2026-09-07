'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

const validProgressHandler = (handler) => typeof handler === 'function';

contextBridge.exposeInMainWorld('transments', {
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  pickImages: () => ipcRenderer.invoke('dialog:pickImages'),
  scanFolder: (folderPath, formatFilter, recursive) => ipcRenderer.invoke('scan:folder', folderPath, formatFilter, recursive),
  resolveDroppedPaths: (paths, formatFilter, recursive) => ipcRenderer.invoke('files:resolveDropped', paths, formatFilter, recursive),
  resolveDroppedFiles: (files, formatFilter, recursive) => {
    const paths = Array.from(files || [])
      .map((file) => webUtils.getPathForFile(file) || file.path)
      .filter(Boolean);
    return ipcRenderer.invoke('files:resolveDropped', paths, formatFilter, recursive);
  },
  startConversion: (payload) => ipcRenderer.invoke('convert:start', payload),
  cancelConversion: () => ipcRenderer.invoke('convert:cancel'),
  openPath: (targetPath) => ipcRenderer.invoke('shell:openPath', targetPath),
  onConversionProgress: (handler) => {
    if (!validProgressHandler(handler)) return () => {};
    const listener = (_event, info) => handler(info);
    ipcRenderer.on('convert:progress', listener);
    return () => ipcRenderer.removeListener('convert:progress', listener);
  }
});
