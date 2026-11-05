const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nexus', {
  min: () => ipcRenderer.send('win:min'),
  toggle: () => ipcRenderer.send('win:toggle'),
  close: () => ipcRenderer.send('win:close'),
  onState: cb => ipcRenderer.on('win:state', (_, full) => cb(full))
});
