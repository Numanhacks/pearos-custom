const { contextBridge, ipcRenderer } = require('electron');

// Expune API-uri sigure pentru desktop
contextBridge.exposeInMainWorld('electronAPI', {
  getDesktopFiles: () => ipcRenderer.invoke('get-desktop-files'),
  getFileIcon: (filePath, iconName) => ipcRenderer.invoke('get-file-icon', filePath, iconName),
  convertIcnsToPng: (icnsPath) => ipcRenderer.invoke('convert-icns-to-png', icnsPath),
  executeDesktopFile: (filePath) => ipcRenderer.invoke('execute-desktop-file', filePath),
  executeAppBundle: (execPath) => ipcRenderer.invoke('execute-app-bundle', execPath),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  renameFile: (filePath, newName) => ipcRenderer.invoke('rename-file', filePath, newName),
  getCurrentWallpaper: () => ipcRenderer.invoke('get-current-wallpaper'),
  selectWallpaperFile: () => ipcRenderer.invoke('select-wallpaper-file'),
  getAccent: () => ipcRenderer.invoke('get-accent'),
  createFolder: (folderName) => ipcRenderer.invoke('create-folder', folderName),
  minimizeAllWindows: () => ipcRenderer.invoke('minimize-all-windows'),
  setIgnoreMouseEvents: (ignore, forward) => ipcRenderer.invoke('set-ignore-mouse-events', ignore, forward),
  startDrag: (filePath) => ipcRenderer.send('ondragstart', filePath),
  moveFileToDesktop: (sourcePath, destPath, x, y) => ipcRenderer.invoke('move-file-to-desktop', sourcePath, destPath, x, y),
  clipboardCopy: (filePaths) => ipcRenderer.invoke('clipboard-copy', filePaths),
  clipboardCut: (filePaths) => ipcRenderer.invoke('clipboard-cut', filePaths),
  clipboardPaste: () => ipcRenderer.invoke('clipboard-paste'),
  clipboardGet: () => ipcRenderer.invoke('clipboard-get'),
  getDesktopDirectory: () => ipcRenderer.invoke('get-desktop-directory'),
  copyFile: (sourcePath, destPath) => ipcRenderer.invoke('copy-file', sourcePath, destPath),
  compressFiles: (filePaths, zipPath) => ipcRenderer.invoke('compress-files', filePaths, zipPath),
  makeAlias: (sourcePath, aliasPath) => ipcRenderer.invoke('make-alias', sourcePath, aliasPath),
  deletePermanent: (filePaths) => ipcRenderer.invoke('delete-permanent', filePaths),
  deleteToTrash: (filePaths) => ipcRenderer.invoke('delete-to-trash', filePaths),
  onClipboardCopy: (callback) => {
    ipcRenderer.on('clipboard-copy', (event, ...args) => callback(...args));
  },
  onClipboardPaste: (callback) => {
    ipcRenderer.on('clipboard-paste', (event, ...args) => callback(...args));
  },
  onClipboardCut: (callback) => {
    ipcRenderer.on('clipboard-cut', (event, ...args) => callback(...args));
  },
  onDeletePermanent: (callback) => {
    ipcRenderer.on('delete-permanent', (event, ...args) => callback(...args));
  },
  onDeleteToTrash: (callback) => {
    ipcRenderer.on('delete-to-trash', (event, ...args) => callback(...args));
  },
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('set-always-on-top', flag)
});

