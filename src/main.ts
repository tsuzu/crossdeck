import { app, BrowserWindow, session, ipcMain, Session, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

interface ProfileData {
  name: string;
  homepage: string;
}

let mainWindow: BrowserWindow | null = null;
const profiles: Map<string, { session: Session; homepage: string }> = new Map();

function getProfilesFilePath(): string {
  return path.join(app.getPath('userData'), 'profiles.json');
}

function saveProfilesToFile() {
  const profilesData: ProfileData[] = Array.from(profiles.entries()).map(([name, data]) => ({
    name,
    homepage: data.homepage
  }));
  const filePath = getProfilesFilePath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(profilesData, null, 2));
  } catch (err) {
    console.error('Failed to save profiles:', err);
  }
}

function loadProfilesFromFile(): ProfileData[] {
  const filePath = getProfilesFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Migration: Check if old format (string[])
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
        console.log('Migrating profiles from old format to new format');
        return parsed.map(name => ({
          name,
          homepage: 'https://x.com'
        }));
      }

      // New format (ProfileData[])
      return parsed as ProfileData[];
    }
  } catch (err) {
    console.error('Failed to load profiles:', err);
  }
  // Return default profiles if file doesn't exist or error occurs
  return [
    { name: 'Profile 1', homepage: 'https://x.com' },
    { name: 'Profile 2', homepage: 'https://x.com' },
    { name: 'Profile 3', homepage: 'https://x.com' }
  ];
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Setup keyboard shortcuts
  setupMenuShortcuts();

  // Explicitly deny all permission requests to avoid warnings
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(false);
  });

  // Handle webview permission requests - deny all
  mainWindow.webContents.on('did-attach-webview', (event, webviewWebContents) => {
    webviewWebContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
      callback(false);
    });
  });

  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Setup keyboard shortcuts using Menu accelerators
function setupMenuShortcuts() {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    // Mac app menu (only on macOS)
    ...(isMac ? [{
      role: 'appMenu' as const
    }] : []),

    // File menu
    { role: 'fileMenu' as const },

    // Edit menu
    { role: 'editMenu' as const },

    // View menu with custom shortcuts
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
        { type: 'separator' as const },
        // Add custom tab shortcuts (hidden but active)
        ...Array.from({ length: 9 }, (_, i) => i + 1).map(i => ({
          label: `Switch to Tab ${i}`,
          accelerator: isMac ? `Cmd+${i}` : `Ctrl+${i}`,
          visible: false,
          click: () => {
            mainWindow?.webContents.send('switch-tab-shortcut', i);
          }
        }))
      ]
    },

    // Window menu
    { role: 'windowMenu' as const }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Setup session permissions - deny all to avoid warnings
function setupSessionPermissions(profileSession: Session) {
  profileSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(false);
  });
}

// Initialize profiles from saved file
function initializeProfiles() {
  const savedProfiles = loadProfilesFromFile();

  savedProfiles.forEach(profile => {
    const partition = `persist:${profile.name.toLowerCase().replace(/\s+/g, '-')}`;
    const profileSession = session.fromPartition(partition);
    setupSessionPermissions(profileSession);
    profiles.set(profile.name, {
      session: profileSession,
      homepage: profile.homepage
    });
  });

  // Save to file in case this is the first run (triggers migration save if needed)
  saveProfilesToFile();
}

// IPC Handlers
ipcMain.handle('get-profiles', () => {
  return Array.from(profiles.entries()).map(([name, data]) => ({
    name,
    homepage: data.homepage
  }));
});

ipcMain.handle('create-profile', (event, profileName: string, homepage: string) => {
  if (profiles.has(profileName)) {
    return { success: false, error: 'Profile already exists' };
  }

  const partition = `persist:${profileName.toLowerCase().replace(/\s+/g, '-')}`;
  const profileSession = session.fromPartition(partition);
  setupSessionPermissions(profileSession);
  profiles.set(profileName, {
    session: profileSession,
    homepage: homepage || 'https://x.com'
  });

  saveProfilesToFile();

  return { success: true };
});

ipcMain.handle('delete-profile', async (event, profileName: string) => {
  if (!profiles.has(profileName)) {
    return { success: false, error: 'Profile not found' };
  }

  const profileData = profiles.get(profileName);
  if (profileData) {
    await profileData.session.clearStorageData();
  }
  profiles.delete(profileName);

  saveProfilesToFile();

  return { success: true };
});

ipcMain.handle('update-profile', (event, profileName: string, updates: { name?: string; homepage?: string }) => {
  if (!profiles.has(profileName)) {
    return { success: false, error: 'Profile not found' };
  }

  const profileData = profiles.get(profileName)!;
  const newName = updates.name || profileName;
  const newHomepage = updates.homepage !== undefined ? updates.homepage : profileData.homepage;

  // If renaming, check if new name already exists
  if (newName !== profileName && profiles.has(newName)) {
    return { success: false, error: 'Profile with new name already exists' };
  }

  // If only updating homepage (no rename)
  if (newName === profileName) {
    profileData.homepage = newHomepage;
    saveProfilesToFile();
    return { success: true, renamed: false };
  }

  // If renaming, create new session with new name
  profiles.delete(profileName);
  const newPartition = `persist:${newName.toLowerCase().replace(/\s+/g, '-')}`;
  const newSession = session.fromPartition(newPartition);
  setupSessionPermissions(newSession);
  profiles.set(newName, {
    session: newSession,
    homepage: newHomepage
  });

  saveProfilesToFile();
  return { success: true, renamed: true };
});

// Keep old handler for backward compatibility
ipcMain.handle('rename-profile', (event, oldName: string, newName: string) => {
  if (!profiles.has(oldName)) {
    return { success: false, error: 'Profile not found' };
  }

  if (profiles.has(newName)) {
    return { success: false, error: 'Profile with new name already exists' };
  }

  const profileData = profiles.get(oldName)!;
  profiles.delete(oldName);

  const newPartition = `persist:${newName.toLowerCase().replace(/\s+/g, '-')}`;
  const newSession = session.fromPartition(newPartition);
  setupSessionPermissions(newSession);
  profiles.set(newName, {
    session: newSession,
    homepage: profileData.homepage
  });

  saveProfilesToFile();
  return { success: true };
});

ipcMain.handle('get-partition', (event, profileName: string) => {
  return `persist:${profileName.toLowerCase().replace(/\s+/g, '-')}`;
});

ipcMain.handle('get-profile-homepage', (event, profileName: string) => {
  const profileData = profiles.get(profileName);
  return profileData ? profileData.homepage : 'https://x.com';
});

app.whenReady().then(() => {
  initializeProfiles();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
