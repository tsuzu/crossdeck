// Type definitions for the exposed API
export {};

declare global {
  interface Window {
    electronAPI: {
      getProfiles: () => Promise<string[]>;
      createProfile: (profileName: string) => Promise<{ success: boolean; error?: string }>;
      deleteProfile: (profileName: string) => Promise<{ success: boolean; error?: string }>;
      renameProfile: (oldName: string, newName: string) => Promise<{ success: boolean; error?: string }>;
      getPartition: (profileName: string) => Promise<string>;
    };
  }
}
