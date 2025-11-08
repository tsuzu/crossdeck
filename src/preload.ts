import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getProfiles: () => ipcRenderer.invoke('get-profiles'),
  createProfile: (profileName: string) => ipcRenderer.invoke('create-profile', profileName),
  deleteProfile: (profileName: string) => ipcRenderer.invoke('delete-profile', profileName),
  getPartition: (profileName: string) => ipcRenderer.invoke('get-partition', profileName)
});
