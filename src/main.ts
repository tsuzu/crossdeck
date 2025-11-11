import { app, BrowserWindow, session, ipcMain, Session, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;
const profiles: Map<string, Session> = new Map();

function getProfilesFilePath(): string {
  return path.join(app.getPath('userData'), 'profiles.json');
}

function saveProfilesToFile() {
  const profileNames = Array.from(profiles.keys());
  const filePath = getProfilesFilePath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(profileNames, null, 2));
  } catch (err) {
    console.error('Failed to save profiles:', err);
  }
}

function loadProfilesFromFile(): string[] {
  const filePath = getProfilesFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load profiles:', err);
  }
  // Return default profiles if file doesn't exist or error occurs
  return ['Profile 1', 'Profile 2', 'Profile 3'];
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

  savedProfiles.forEach(profileName => {
    const partition = `persist:${profileName.toLowerCase().replace(/\s+/g, '-')}`;
    const profileSession = session.fromPartition(partition);
    setupSessionPermissions(profileSession);
    profiles.set(profileName, profileSession);
  });

  // Save to file in case this is the first run
  saveProfilesToFile();
}

// IPC Handlers
ipcMain.handle('get-profiles', () => {
  return Array.from(profiles.keys());
});

ipcMain.handle('create-profile', (event, profileName: string) => {
  if (profiles.has(profileName)) {
    return { success: false, error: 'Profile already exists' };
  }

  const partition = `persist:${profileName.toLowerCase().replace(/\s+/g, '-')}`;
  const profileSession = session.fromPartition(partition);
  setupSessionPermissions(profileSession);
  profiles.set(profileName, profileSession);

  saveProfilesToFile();

  return { success: true };
});

ipcMain.handle('delete-profile', async (event, profileName: string) => {
  if (!profiles.has(profileName)) {
    return { success: false, error: 'Profile not found' };
  }

  const profileSession = profiles.get(profileName);
  if (profileSession) {
    await profileSession.clearStorageData();
  }
  profiles.delete(profileName);

  saveProfilesToFile();

  return { success: true };
});

ipcMain.handle('rename-profile', (event, oldName: string, newName: string) => {
  if (!profiles.has(oldName)) {
    return { success: false, error: 'Profile not found' };
  }

  if (profiles.has(newName)) {
    return { success: false, error: 'Profile with new name already exists' };
  }

  // Get the old session
  const oldSession = profiles.get(oldName);

  // Remove old profile from map
  profiles.delete(oldName);

  // Create new session with new name
  const newPartition = `persist:${newName.toLowerCase().replace(/\s+/g, '-')}`;
  const newSession = session.fromPartition(newPartition);
  setupSessionPermissions(newSession);

  // Add new profile to map
  profiles.set(newName, newSession);

  saveProfilesToFile();

  // Note: The old session data will remain in the old partition
  // You may want to copy data from old partition to new one if needed
  // For now, this creates a fresh session with the new name

  return { success: true };
});

ipcMain.handle('get-partition', (event, profileName: string) => {
  return `persist:${profileName.toLowerCase().replace(/\s+/g, '-')}`;
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
