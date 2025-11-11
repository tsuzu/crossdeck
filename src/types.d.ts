// Type definitions for the exposed API
export {};

interface ProfileData {
  id: string;
  name: string;
  homepage: string;
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
    };
  }
}
