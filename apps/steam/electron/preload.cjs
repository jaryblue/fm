const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronBridge', {
  isDesktop: true,
  loadSaveSync: (slotId) => ipcRenderer.sendSync('fm:load-save-sync', slotId),
  writeSave: (slotId, data) => ipcRenderer.send('fm:write-save', slotId, data),
  deleteSave: (slotId) => ipcRenderer.send('fm:delete-save', slotId),
  loadSettingsSync: () => ipcRenderer.sendSync('fm:load-settings-sync'),
  saveSettings: (data) => ipcRenderer.send('fm:save-settings', data),
  isFullscreenSync: () => ipcRenderer.sendSync('fm:is-fullscreen-sync'),
  toggleFullscreen: () => ipcRenderer.send('fm:toggle-fullscreen'),
  quitApp: () => ipcRenderer.send('fm:quit-app'),
  otaGet: () => ipcRenderer.invoke('fm:ota-get'),
  otaSave: (hash, code) => ipcRenderer.invoke('fm:ota-save', hash, code),
  otaClear: () => ipcRenderer.invoke('fm:ota-clear'),
  getOtaStatus: () => ipcRenderer.invoke('fm:ota-status'),
  restartApp: () => ipcRenderer.send('fm:restart-app'),
});
