# @waypointnull/auto-update

Message-only `electron-updater` wiring for the family desktop apps (UsagiAI, Akumu, Tsuki).

This package owns the *update machinery* and nothing else: it checks for updates, downloads
only on explicit consent, and talks to the front-end over IPC. It ships **no UI** — each app
renders its own dialogs (shadcn `AlertDialog` on the Vue client).

Pure Electron-main glue, zero runtime dependencies of its own.

## Install

```bash
npm install @waypointnull/auto-update electron-updater
```

`electron-updater` is a peer dependency; declare it in your app's `dependencies` too so
electron-builder packages it and generates `app-update.yml` from your `publish` config.

## Message contract

| Direction | Channel             | Payload            | Meaning                         |
| --------- | ------------------- | ------------------ | ------------------------------- |
| main→ui   | `update:available`  | `{ version }`      | a newer version exists          |
| main→ui   | `update:downloaded` | `{ version }`      | the new version is on disk      |
| ui→main   | `update:respond`    | `"download"` \| `"restart"` \| `"later"` | the user's choice |

- Nothing downloads until the front-end replies `"download"` (`autoDownload: false`).
- `"restart"` quits and installs. `"later"` does nothing (a completed download installs on quit).
- On start it silently checks after a debounce (default 4 s, override `delayMs`).

## Main-process wiring

```js
const { setupAutoUpdate } = require('@waypointnull/auto-update');

setupAutoUpdate({
  onError: (error) => console.log('auto-update:', error.message)
});
```

In dev (unpackaged) everything stays inert — `setupAutoUpdate` returns `null`.

## Preload bridge (standalone window only)

The renderer is sandboxed (`contextIsolation`, no `nodeIntegration`), so expose a tiny bridge:

```js
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('updateBridge', {
  onUpdateAvailable: (cb) => ipcRenderer.on('update:available', (_e, info) => cb(info)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update:downloaded', (_e, info) => cb(info)),
  respond: (choice) => ipcRenderer.send('update:respond', choice)
});
```

## Front-end

Render your own dialogs. Guard on the bridge so hub mode (no Electron) never shows them:

```js
if (window.updateBridge) {
  window.updateBridge.onUpdateAvailable((info) => showDownloadDialog(info));
  window.updateBridge.onUpdateDownloaded((info) => showRestartDialog(info));
  // buttons call window.updateBridge.respond('download' | 'restart' | 'later')
}
```

## License

WaypointNull Community License v1.0
