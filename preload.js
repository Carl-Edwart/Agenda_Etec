const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  getData:      ()      => ipcRenderer.invoke('get-data'),
  saveData:     (data)  => ipcRenderer.invoke('save-data', data),
  minimize:     ()      => ipcRenderer.invoke('minimize'),
  maximize:     ()      => ipcRenderer.invoke('maximize'),
  close:        ()      => ipcRenderer.invoke('close'),
  openExternal: (url)   => ipcRenderer.invoke('open-external', url)
})