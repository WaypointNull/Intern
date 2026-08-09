// WORKAROUND: electron-updater can only run inside a packaged install; in dev it throws. All wiring
// stays inert until a real (packaged) run enables it, so requiring this module is always safe.
function setupAutoUpdate(options = {}) {
  const {
    isEnabled = () => require('electron').app.isPackaged,
    checkOnStart = true,
    delayMs = 4000,
    onUpdateAvailable = null,
    onUpdateDownloaded = null,
    onError = null,
    onCheckFailed = null
  } = options;

  if (!isEnabled()) {
    return null;
  }

  let autoUpdater;
  try {
    autoUpdater = require('electron-updater').autoUpdater;
  } catch (error) {
    if (onError) onError(error);
    return null;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    if (onUpdateAvailable) onUpdateAvailable(info);
  });
  autoUpdater.on('update-downloaded', (info) => {
    if (onUpdateDownloaded) onUpdateDownloaded(info);
  });
  autoUpdater.on('error', (error) => {
    if (onError) onError(error);
  });

  if (checkOnStart) {
    // Debounce past window creation so the first check never races the first paint.
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((error) => {
        if (onCheckFailed) onCheckFailed(error);
      });
    }, delayMs);
  }

  return autoUpdater;
}

function quitAndInstall() {
  const { autoUpdater } = require('electron-updater');
  autoUpdater.quitAndInstall();
}

module.exports = { setupAutoUpdate, quitAndInstall };
