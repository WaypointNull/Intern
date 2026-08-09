const IPC = {
  available: 'update:available',
  downloaded: 'update:downloaded',
  respond: 'update:respond'
};

// WORKAROUND: electron and electron-updater can only run inside a packaged Electron app; in dev
// they throw or misbehave. Every dependency is required lazily inside the try, so requiring this
// module (or calling setupAutoUpdate in an unpackaged run) is always safe and reports via onError.
function setupAutoUpdate(options = {}) {
  const {
    isEnabled = () => require('electron').app.isPackaged,
    checkOnStart = true,
    delayMs = 4000,
    channels = IPC,
    onError = null
  } = options;

  if (!isEnabled()) {
    return null;
  }

  try {
    const { ipcMain, webContents } = require('electron');
    const autoUpdater = require('electron-updater').autoUpdater;

    // Never download without the user's say-so; the front-end asks and replies over IPC.
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    function send(channel, payload) {
      for (const wc of webContents.getAllWebContents()) {
        if (wc.getType() === 'window') {
          wc.send(channel, payload);
        }
      }
    }

    autoUpdater.on('update-available', (info) => {
      send(channels.available, { version: info.version });
    });
    autoUpdater.on('update-downloaded', (info) => {
      send(channels.downloaded, { version: info.version });
    });
    autoUpdater.on('error', (error) => {
      if (onError) onError(error);
    });

    ipcMain.removeAllListeners(channels.respond);
    ipcMain.on(channels.respond, (_event, choice) => {
      if (choice === 'download') {
        autoUpdater.downloadUpdate().catch((error) => {
          if (onError) onError(error);
        });
      } else if (choice === 'restart') {
        autoUpdater.quitAndInstall();
      }
    });

    if (checkOnStart) {
      // Debounce past window creation so the first check never races the first paint.
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch((error) => {
          if (onError) onError(error);
        });
      }, delayMs);
    }

    return autoUpdater;
  } catch (error) {
    if (onError) onError(error);
    return null;
  }
}

function quitAndInstall() {
  const { autoUpdater } = require('electron-updater');
  autoUpdater.quitAndInstall();
}

module.exports = { setupAutoUpdate, quitAndInstall };
