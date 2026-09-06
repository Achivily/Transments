'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const validProgressHandler = (handler) => typeof handler === 'function';

contextBridge.exposeInMainWorld('transments', {
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  pickImages: () => ipcRenderer.invoke('dialog:pickImages'),
  scanFolder: (folderPath, formatFilter, recursive) => ipcRenderer.invoke('scan:folder', folderPath, formatFilter, recursive),
  startConversion: (payload) => ipcRenderer.invoke('convert:start', payload),
  cancelConversion: () => ipcRenderer.invoke('convert:cancel'),
  onConversionProgress: (handler) => {
    if (!validProgressHandler(handler)) return () => {};
    const listener = (_event, info) => handler(info);
    ipcRenderer.on('convert:progress', listener);
    return () => ipcRenderer.removeListener('convert:progress', listener);
  }
});
