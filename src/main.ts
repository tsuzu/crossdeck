import { app, BrowserWindow, session, ipcMain, Session } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;
const profiles: Map<string, Session> = new Map();

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

// Setup session permissions - deny all to avoid warnings
function setupSessionPermissions(profileSession: Session) {
  profileSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(false);
  });
}

// Initialize default profiles
function initializeProfiles() {
  const defaultProfiles = ['Profile 1', 'Profile 2', 'Profile 3'];

  defaultProfiles.forEach(profileName => {
    const partition = `persist:${profileName.toLowerCase().replace(/\s+/g, '-')}`;
    const profileSession = session.fromPartition(partition);
    setupSessionPermissions(profileSession);
    profiles.set(profileName, profileSession);
  });
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
