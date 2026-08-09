# @waypointnull/auto-update

Tiny `electron-updater` wiring for the family desktop apps (UsagiAI, Akumu, Tsuki).

Pure Electron-main glue, zero runtime dependencies of its own. It makes an app check for
updates shortly after launch, auto-download in the background, and hand a "restart now?"
decision back to the app once the new version is on disk.

## Install

```bash
npm install @waypointnull/auto-update electron-updater
```

`electron-updater` is a peer dependency; declare it in your app's `dependencies` too so
electron-builder packages it and generates `app-update.yml` from your `publish` config.

## Usage

```js
const { app, dialog } = require('electron');
const { setupAutoUpdate, quitAndInstall } = require('@waypointnull/auto-update');

setupAutoUpdate({
  onUpdateDownloaded: (info) => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update ready',
      message: `Version ${info.version} downloaded`,
      buttons: ['Restart now', 'Later']
    }).then(({ response }) => {
      if (response === 0) quitAndInstall();
    });
  },
  onError: (error) => console.log('auto-update:', error.message)
});
```

- In dev (unpackaged) everything stays inert — `setupAutoUpdate` returns `null`.
- On start it debounces the first `checkForUpdates()` past window creation (default 4 s,
  override with `delayMs`).
- `autoDownload` and `autoInstallOnAppQuit` default to `true`; the app only decides
  whether to restart now.

## License

WaypointNull Community License v1.0
