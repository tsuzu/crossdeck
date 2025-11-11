import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getProfiles: () => ipcRenderer.invoke('get-profiles'),
  createProfile: (profileName: string) => ipcRenderer.invoke('create-profile', profileName),
  deleteProfile: (profileName: string) => ipcRenderer.invoke('delete-profile', profileName),
  renameProfile: (oldName: string, newName: string) => ipcRenderer.invoke('rename-profile', oldName, newName),
  getPartition: (profileName: string) => ipcRenderer.invoke('get-partition', profileName),
  onSwitchTabShortcut: (callback: (tabNumber: number) => void) => {
    ipcRenderer.on('switch-tab-shortcut', (_event, tabNumber: number) => {
      callback(tabNumber);
    });
  }
});
