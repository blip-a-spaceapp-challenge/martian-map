import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('missionStore', {
  load: () => ipcRenderer.invoke('mission:load'),
  save: (mission: unknown) => ipcRenderer.invoke('mission:save', mission),
})