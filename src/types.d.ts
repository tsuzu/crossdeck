// Type definitions for the exposed API
export {};

interface ProfileData {
  id: string;
  name: string;
  homepage: string;
}

interface UpdateStatus {
  type: 'checking' | 'available' | 'not-available' | 'error';
  message: string;
  version?: string;
  releaseNotes?: string;
  error?: string;
}

declare global {
  interface Window {
    electronAPI: {
      getProfiles: () => Promise<ProfileData[]>;
      createProfile: (profileName: string, homepage: string) => Promise<{ success: boolean; error?: string }>;
      deleteProfile: (profileName: string) => Promise<{ success: boolean; error?: string }>;
      updateProfile: (profileName: string, updates: { name?: string; homepage?: string }) =>
        Promise<{ success: boolean; error?: string; renamed?: boolean }>;
      renameProfile: (oldName: string, newName: string) => Promise<{ success: boolean; error?: string }>;
      getProfileHomepage: (profileName: string) => Promise<string>;
      getPartition: (profileName: string) => Promise<string>;
      openExternal: (url: string) => Promise<void>;
      onSwitchTabShortcut: (callback: (tabNumber: number) => void) => void;
      onZoomReset: (callback: () => void) => void;
      onZoomIn: (callback: () => void) => void;
      onZoomOut: (callback: () => void) => void;
      onReloadTab: (callback: () => void) => void;
      onToggleColumnFullscreen: (callback: () => void) => void;
      checkForUpdates: () => Promise<{ success: boolean; error?: string }>;
      getAppVersion: () => Promise<string>;
      onUpdateStatus: (callback: (status: UpdateStatus) => void) => void;
      onMenuCheckForUpdates: (callback: () => void) => void;
    };
  }
}
