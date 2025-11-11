import { contextBridge, ipcRenderer } from 'electron';

interface ProfileData {
  id: string;
  name: string;
  homepage: string;
}

contextBridge.exposeInMainWorld('electronAPI', {
  getProfiles: () => ipcRenderer.invoke('get-profiles'),
  createProfile: (profileName: string, homepage: string) => ipcRenderer.invoke('create-profile', profileName, homepage),
  deleteProfile: (profileName: string) => ipcRenderer.invoke('delete-profile', profileName),
  updateProfile: (profileName: string, updates: { name?: string; homepage?: string }) =>
    ipcRenderer.invoke('update-profile', profileName, updates),
  renameProfile: (oldName: string, newName: string) => ipcRenderer.invoke('rename-profile', oldName, newName),
  getProfileHomepage: (profileName: string) => ipcRenderer.invoke('get-profile-homepage', profileName),
  getPartition: (profileName: string) => ipcRenderer.invoke('get-partition', profileName),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  onSwitchTabShortcut: (callback: (tabNumber: number) => void) => {
    ipcRenderer.on('switch-tab-shortcut', (_event, tabNumber: number) => {
      callback(tabNumber);
    });
  },
  onZoomReset: (callback: () => void) => {
    ipcRenderer.on('zoom-reset', () => {
      callback();
    });
  },
  onZoomIn: (callback: () => void) => {
    ipcRenderer.on('zoom-in', () => {
      callback();
    });
  },
  onZoomOut: (callback: () => void) => {
    ipcRenderer.on('zoom-out', () => {
      callback();
    });
  }
});
