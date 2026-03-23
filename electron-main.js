const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const { startServer, stopServer, PORT } = require('./audit-server');

let mainWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1200,
    minHeight: 760,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupAutoUpdates() {
  if (!app.isPackaged) {
    return;
  }

  const updateUrl = process.env.AUTO_UPDATE_URL;
  if (!updateUrl) {
    console.log('AUTO_UPDATE_URL not set. Skipping update checks.');
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: updateUrl
  });

  autoUpdater.on('error', (err) => {
    console.error(`Auto-update error: ${err.message}`);
  });

  autoUpdater.on('update-downloaded', async () => {
    const result = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update Ready',
      message: 'A new version was downloaded and is ready to install.'
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.checkForUpdates().catch((err) => {
    console.error(`Failed to check updates: ${err.message}`);
  });
}

async function bootstrap() {
  try {
    const reportDir = path.join(app.getPath('userData'), 'a11y-reports');
    fs.mkdirSync(reportDir, { recursive: true });
    process.env.A11Y_REPORT_DIR = reportDir;

    await startServer();
    createMainWindow();
    setupAutoUpdates();
  } catch (err) {
    dialog.showErrorBox(
      'A11y Conductor Startup Error',
      `Unable to start the local dashboard server on port ${PORT}.\n\n${err.message}`
    );
    app.quit();
  }
}

app.whenReady().then(bootstrap);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

app.on('window-all-closed', async () => {
  try {
    await stopServer();
  } finally {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }
});

app.on('before-quit', async () => {
  await stopServer();
});
