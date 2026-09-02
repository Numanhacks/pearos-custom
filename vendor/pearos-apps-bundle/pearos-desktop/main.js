const { app, BrowserWindow, ipcMain, dialog, clipboard, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js')
    },
    frame: false,
    show: false,
    fullscreen: true
  });

  mainWindow.loadFile('index.html');

  // Gestionează drag-and-drop către aplicații externe
  mainWindow.webContents.on('dom-ready', () => {
    // Injectează cod pentru a gestiona drag-and-drop către aplicații externe
    mainWindow.webContents.executeJavaScript(`
      (function() {
        let dragFilePath = null;
        
        document.addEventListener('dragstart', function(e) {
          const iconElement = e.target.closest('.desktop-icon');
          if (iconElement) {
            dragFilePath = iconElement.getAttribute('data-file-path');
            if (dragFilePath) {
              // Setează dataTransfer pentru aplicații externe
              e.dataTransfer.effectAllowed = 'copy';
              e.dataTransfer.setData('text/uri-list', 'file://' + dragFilePath);
              e.dataTransfer.setData('text/plain', dragFilePath);
            }
          }
        }, true);
        
        document.addEventListener('dragend', function(e) {
          dragFilePath = null;
        });
      })();
    `);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Asigură-te că fereastra nu este always on top
    mainWindow.setAlwaysOnTop(false);
    
    // Setează tipul ferestrei ca "desktop" pentru a permite ferestrelor din sistem să rămână vizibile peste desktop
    if (mainWindow.setWindowType) {
      mainWindow.setWindowType('desktop');
    } else if (process.platform === 'linux') {
      // Alternativă pentru Linux: folosește xprop pentru a seta tipul ferestrei ca desktop
      // Așteaptă puțin pentru ca fereastra să fie complet creată
      setTimeout(() => {
        try {
          const windowId = mainWindow.getNativeWindowHandle();
          if (windowId && windowId.length >= 4) {
            // Pe Linux/X11, window ID-ul este primul uint32 din buffer
            const x11WindowId = windowId.readUInt32LE(0);
            // Setează tipul ferestrei ca desktop folosind xprop
            exec(`xprop -id ${x11WindowId} -f _NET_WM_WINDOW_TYPE 32a -set _NET_WM_WINDOW_TYPE _NET_WM_WINDOW_TYPE_DESKTOP 2>/dev/null || true`, () => {});
          }
        } catch (error) {
          console.error('Error setting window type to desktop:', error);
        }
      }, 500);
    }
  });


  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
    }
    if (input.key === 'F12') {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
    }
    // Handler pentru shortcut-uri Ctrl+C, Ctrl+V, Ctrl+X pentru clipboard
    if (input.control && !input.alt && !input.shift && !input.meta) {
      if (input.key.toLowerCase() === 'c') {
        event.preventDefault();
        console.log('[CLIPBOARD] Ctrl+C pressed - sending clipboard-copy event');
        mainWindow.webContents.send('clipboard-copy');
      } else if (input.key.toLowerCase() === 'v') {
        event.preventDefault();
        console.log('[CLIPBOARD] Ctrl+V pressed - sending clipboard-paste event');
        mainWindow.webContents.send('clipboard-paste');
      } else if (input.key.toLowerCase() === 'x') {
        event.preventDefault();
        console.log('[CLIPBOARD] Ctrl+X pressed - sending clipboard-cut event');
        mainWindow.webContents.send('clipboard-cut');
      }
    }
    
    // Handler pentru ștergere fișiere
    // Option + Command + Backspace - șterge definitiv
    if (input.alt && input.meta && !input.control && !input.shift && input.key === 'Backspace') {
      event.preventDefault();
      console.log('[DELETE] Option+Command+Backspace pressed - sending delete-permanent event');
      mainWindow.webContents.send('delete-permanent');
    }
    // Command + Backspace - mută în trash
    else if (input.meta && !input.alt && !input.control && !input.shift && input.key === 'Backspace') {
      event.preventDefault();
      console.log('[DELETE] Command+Backspace pressed - sending delete-to-trash event');
      mainWindow.webContents.send('delete-to-trash');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Funcție helper pentru obținerea directorului Desktop real
function getDesktopDirectory(callback) {
  // Încearcă să obțină directorul Desktop folosind xdg-user-dir
  exec('xdg-user-dir DESKTOP', (error, stdout) => {
    if (!error && stdout && stdout.trim()) {
      const desktopDir = stdout.trim();
      if (fs.existsSync(desktopDir)) {
        callback(desktopDir);
        return;
      }
    }
    
    // Fallback la ~/Desktop
    const fallbackDir = path.join(os.homedir(), 'Desktop');
    if (fs.existsSync(fallbackDir)) {
      callback(fallbackDir);
      return;
    }
    
    // Dacă niciunul nu există, folosește ~/Desktop oricum
    callback(fallbackDir);
  });
}

// Handler pentru citirea fișierelor din Desktop-ul real
ipcMain.handle('get-desktop-files', async () => {
  return new Promise((resolve, reject) => {
    getDesktopDirectory((desktopDir) => {
      // Verifică dacă directorul există
      if (!fs.existsSync(desktopDir)) {
        resolve({ files: [] });
        return;
      }
    
      fs.readdir(desktopDir, (error, files) => {
        if (error) {
          reject(new Error(`Eroare la citirea directorului Desktop: ${error.message}`));
          return;
        }
        
        const desktopFiles = [];
        let processed = 0;
        
        if (files.length === 0) {
          resolve({ files: [] });
          return;
        }
        
        // Filtrează fișierele ascunse (care încep cu .)
        const visibleFiles = files.filter(file => !file.startsWith('.'));
        
        if (visibleFiles.length === 0) {
          resolve({ files: [] });
          return;
        }
        
        visibleFiles.forEach(file => {
          const filePath = path.join(desktopDir, file);
          
          fs.stat(filePath, (statError, stats) => {
            if (statError) {
              processed++;
              if (processed === visibleFiles.length) {
                resolve({ files: desktopFiles });
              }
              return;
            }
            
            const fileInfo = {
              name: file,
              path: filePath,
              isDirectory: stats.isDirectory(),
              isFile: stats.isFile(),
              size: stats.size,
              modified: stats.mtime.toISOString()
            };
            
            // Dacă este un director .app, parsează Info.plist
            if (stats.isDirectory() && file.endsWith('.app')) {
              const infoPlistPath = path.join(filePath, 'Contents', 'Info.plist');
              const pearOSExecPath = path.join(filePath, 'Contents', 'PearOS');
              
              // Verifică dacă există executabilul PearOS
              if (fs.existsSync(pearOSExecPath)) {
                fileInfo.isAppBundle = true;
                fileInfo.execPath = pearOSExecPath;
              }
              
              if (fs.existsSync(infoPlistPath)) {
                try {
                  // Încearcă să citească ca text (pentru format XML)
                  let plistContent = null;
                  try {
                    plistContent = fs.readFileSync(infoPlistPath, 'utf8');
                  } catch (readError) {
                    // Dacă nu poate citi ca text, probabil este format binary
                    // Folosește plutil pentru conversie (dacă este disponibil)
                    try {
                      const { execSync } = require('child_process');
                      plistContent = execSync(`plutil -convert xml1 -o - "${infoPlistPath}"`, { encoding: 'utf8' });
                    } catch (plutilError) {
                      console.error(`Nu se poate converti Info.plist pentru ${filePath}:`, plutilError);
                    }
                  }
                  
                  if (plistContent) {
                    // Parsează Info.plist (format XML simplu)
                    // Caută CFBundleDisplayName mai întâi (are prioritate), apoi CFBundleName
                    const displayNameMatch = plistContent.match(/<key>CFBundleDisplayName<\/key>\s*<string>(.*?)<\/string>/is);
                    const nameMatch = plistContent.match(/<key>CFBundleName<\/key>\s*<string>(.*?)<\/string>/is);
                    const iconMatch = plistContent.match(/<key>CFBundleIconFile<\/key>\s*<string>(.*?)<\/string>/is);
                    
                    if (displayNameMatch) {
                      fileInfo.name = displayNameMatch[1].trim();
                    } else if (nameMatch) {
                      fileInfo.name = nameMatch[1].trim();
                    }
                    
                    // Găsește iconița în Contents/Resources/
                    const resourcesDir = path.join(filePath, 'Contents', 'Resources');
                    if (fs.existsSync(resourcesDir)) {
                      let iconFile = null;
                      const iconExtensions = ['.icns', '.png', '.svg', '.jpg', '.jpeg'];
                      
                      if (iconMatch) {
                        const iconName = iconMatch[1].trim();
                        // Verifică dacă iconița are deja o extensie
                        const hasExtension = iconExtensions.some(ext => iconName.toLowerCase().endsWith(ext));
                        
                        if (hasExtension) {
                          // Dacă are extensie, folosește numele exact
                          const iconPath = path.join(resourcesDir, iconName);
                          if (fs.existsSync(iconPath)) {
                            iconFile = iconPath;
                          }
                        } else {
                          // Dacă nu are extensie, încearcă cu toate extensiile
                          for (const ext of iconExtensions) {
                            const iconPath = path.join(resourcesDir, iconName + ext);
                            if (fs.existsSync(iconPath)) {
                              iconFile = iconPath;
                              break;
                            }
                          }
                        }
                      }
                      
                      // Dacă nu s-a găsit iconița specificată, caută AppIcon cu toate extensiile
                      if (!iconFile) {
                        const possibleIconNames = ['AppIcon', 'appicon', 'icon', 'Icon', 'APPICON'];
                        for (const iconName of possibleIconNames) {
                          for (const ext of iconExtensions) {
                            const iconPath = path.join(resourcesDir, iconName + ext);
                            if (fs.existsSync(iconPath)) {
                              iconFile = iconPath;
                              break;
                            }
                          }
                          if (iconFile) break;
                        }
                      }
                      
                      // Dacă încă nu s-a găsit, caută după numele aplicației (fără .app)
                      if (!iconFile && fileInfo.name) {
                        const appName = fileInfo.name.replace(/\s+/g, ''); // Elimină spații
                        for (const ext of iconExtensions) {
                          const iconPath = path.join(resourcesDir, appName + ext);
                          if (fs.existsSync(iconPath)) {
                            iconFile = iconPath;
                            break;
                          }
                        }
                      }
                      
                      // Dacă încă nu s-a găsit, caută orice fișier cu extensiile de iconiță în Resources
                      if (!iconFile) {
                        try {
                          const files = fs.readdirSync(resourcesDir);
                          for (const resourceFile of files) {
                            const resourcePath = path.join(resourcesDir, resourceFile);
                            const fileStats = fs.statSync(resourcePath);
                            if (fileStats.isFile()) {
                              const ext = path.extname(resourceFile).toLowerCase();
                              if (iconExtensions.includes(ext)) {
                                iconFile = resourcePath;
                                console.log(`[APP] Found icon file in Resources: ${resourceFile}`);
                                break;
                              }
                            }
                          }
                        } catch (readError) {
                          console.error(`[APP] Error reading Resources directory:`, readError);
                        }
                      }
                      
                      if (iconFile) {
                        fileInfo.icon = iconFile;
                        console.log(`[APP] Using icon for ${file}: ${iconFile}`);
                      } else {
                        console.log(`[APP] No icon found for ${file} in Resources directory`);
                      }
                    }
                  }
                } catch (error) {
                  console.error(`Eroare la parsarea Info.plist pentru ${filePath}:`, error);
                }
              }
            }
            
            // Dacă este un fișier .desktop, încearcă să citească informațiile
            if (file.endsWith('.desktop')) {
              fs.readFile(filePath, 'utf8', (readError, content) => {
                if (!readError && content) {
                  const nameMatch = content.match(/^Name=(.+)$/m);
                  const iconMatch = content.match(/^Icon=(.+)$/m);
                  const execMatch = content.match(/^Exec=(.+)$/m);
                  const typeMatch = content.match(/^Type=(.+)$/m);
                  const noDisplayMatch = content.match(/^NoDisplay=(.+)$/m);
                  
                  // Verifică dacă fișierul nu trebuie afișat
                  if (noDisplayMatch && noDisplayMatch[1].trim().toLowerCase() === 'true') {
                    processed++;
                    if (processed === visibleFiles.length) {
                      resolve({ files: desktopFiles });
                    }
                    return;
                  }
                  
                  fileInfo.name = nameMatch ? nameMatch[1].trim() : file.replace('.desktop', '');
                  fileInfo.icon = iconMatch ? iconMatch[1].trim() : null;
                  fileInfo.exec = execMatch ? execMatch[1].trim() : null;
                  fileInfo.type = typeMatch ? typeMatch[1].trim() : 'Application';
                  fileInfo.isDesktopFile = true;
                }
                
                desktopFiles.push(fileInfo);
                processed++;
                if (processed === visibleFiles.length) {
                  resolve({ files: desktopFiles });
                }
              });
            } else {
              desktopFiles.push(fileInfo);
              processed++;
              if (processed === visibleFiles.length) {
                resolve({ files: desktopFiles });
              }
            }
          });
        });
      });
    });
  });
});

// Funcție helper pentru căutarea iconurilor în temele din /usr/share/icons/
function findIconInThemes(iconName, sizes = [64, 48, 128, 256]) {
  const themes = ['breeze', 'Papirus', 'Adwaita', 'hicolor'];
  const extensions = ['.png', '.svg', '.xpm'];
  
  for (const theme of themes) {
    for (const size of sizes) {
      for (const ext of extensions) {
        // Caută în apps
        const appPath = path.join('/usr/share/icons', theme, `${size}x${size}`, 'apps', iconName + ext);
        if (fs.existsSync(appPath)) {
          return appPath;
        }
        // Caută în places (pentru folders)
        const placePath = path.join('/usr/share/icons', theme, `${size}x${size}`, 'places', iconName + ext);
        if (fs.existsSync(placePath)) {
          return placePath;
        }
        // Caută în mimetypes
        const mimePath = path.join('/usr/share/icons', theme, `${size}x${size}`, 'mimetypes', iconName + ext);
        if (fs.existsSync(mimePath)) {
          return mimePath;
        }
      }
    }
  }
  
  // Caută în /usr/share/pixmaps
  for (const ext of extensions) {
    const pixmapPath = path.join('/usr/share/pixmaps', iconName + ext);
    if (fs.existsSync(pixmapPath)) {
      return pixmapPath;
    }
  }
  
  // Caută în ~/.local/share/icons
  for (const ext of extensions) {
    const localPath = path.join(os.homedir(), '.local', 'share', 'icons', iconName + ext);
    if (fs.existsSync(localPath)) {
      return localPath;
    }
  }
  
  return null;
}

// Handler pentru conversia iconițelor .icns în PNG sau obținerea data URL
ipcMain.handle('convert-icns-to-png', async (event, icnsPath) => {
  console.log('[APP] convert-icns-to-png handler called with icnsPath:', icnsPath);
  if (!icnsPath || !fs.existsSync(icnsPath)) {
    return { success: false, error: 'Icon file does not exist' };
  }
  
  // Verifică dacă este deja PNG, SVG sau JPG
  const ext = path.extname(icnsPath).toLowerCase();
  if (['.png', '.svg', '.jpg', '.jpeg'].includes(ext)) {
    // Dacă este deja un format suportat, returnează direct
    return { success: true, iconPath: icnsPath };
  }
  
  // Pentru .icns, folosește nativeImage din Electron pentru a încărca și converti
  try {
    const image = nativeImage.createFromPath(icnsPath);
    if (!image.isEmpty()) {
      // Convertește în PNG și salvează temporar
      const pngBuffer = image.toPNG();
      const outputDir = path.join(os.tmpdir(), 'pearos-icons');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      const outputPath = path.join(outputDir, path.basename(icnsPath, '.icns') + '.png');
      fs.writeFileSync(outputPath, pngBuffer);
      console.log('[APP] Converted .icns to PNG using nativeImage:', outputPath);
      return { success: true, iconPath: outputPath };
    }
  } catch (nativeError) {
    console.error('[APP] Error using nativeImage:', nativeError);
  }
  
  // Fallback: încearcă să folosească icns2png sau convert
  return new Promise((resolve) => {
    // Încearcă să folosească icns2png dacă este disponibil
    exec(`which icns2png`, (whichError) => {
      if (!whichError) {
        // Folosește icns2png pentru a extrage prima imagine
        const outputDir = path.join(os.tmpdir(), 'pearos-icons');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        const outputPath = path.join(outputDir, path.basename(icnsPath, '.icns') + '.png');
        
        exec(`icns2png -o "${outputPath}" "${icnsPath}" 2>/dev/null`, (icnsError, stdout) => {
          if (!icnsError && fs.existsSync(outputPath)) {
            console.log('[APP] Converted .icns to PNG using icns2png:', outputPath);
            resolve({ success: true, iconPath: outputPath });
          } else {
            // Fallback: folosește convert (ImageMagick)
            tryConvert();
          }
        });
      } else {
        tryConvert();
      }
    });
    
    function tryConvert() {
      // Încearcă să folosească convert (ImageMagick)
      exec(`which convert`, (convertError) => {
        if (!convertError) {
          const outputDir = path.join(os.tmpdir(), 'pearos-icons');
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          const outputPath = path.join(outputDir, path.basename(icnsPath, '.icns') + '.png');
          
          // Extrage prima imagine din .icns (index 0)
          exec(`convert "${icnsPath}[0]" "${outputPath}" 2>/dev/null`, (imgError) => {
            if (!imgError && fs.existsSync(outputPath)) {
              console.log('[APP] Converted .icns to PNG using ImageMagick:', outputPath);
              resolve({ success: true, iconPath: outputPath });
            } else {
              // Dacă nu se poate converti, returnează calea originală
              console.log('[APP] Could not convert .icns, using original path');
              resolve({ success: true, iconPath: icnsPath });
            }
          });
        } else {
          // Dacă niciunul nu este disponibil, returnează calea originală
          console.log('[APP] No conversion tool available, using original path');
          resolve({ success: true, iconPath: icnsPath });
        }
      });
    }
  });
});

// Handler pentru obținerea iconiței unui fișier
ipcMain.handle('get-file-icon', async (event, filePath, iconName) => {
  return new Promise((resolve) => {
    // Dacă este specificat un nume de iconiță, îl folosim
    if (iconName) {
      const iconPath = findIconInThemes(iconName);
      if (iconPath) {
        resolve({ iconPath: iconPath });
        return;
      }
    }
    
    // Pentru fișiere .desktop, folosim iconița specificată
    if (filePath && filePath.endsWith('.desktop')) {
      fs.readFile(filePath, 'utf8', (error, content) => {
        if (!error && content) {
          const iconMatch = content.match(/^Icon=(.+)$/m);
          if (iconMatch) {
            const iconNameFromFile = iconMatch[1].trim();
            const iconPath = findIconInThemes(iconNameFromFile);
            if (iconPath) {
              resolve({ iconPath: iconPath });
              return;
            }
          }
        }
        resolve({ iconPath: null });
      });
    } else {
      resolve({ iconPath: null });
    }
  });
});

// Handler pentru executarea unui fișier .desktop
ipcMain.handle('execute-desktop-file', async (event, filePath) => {
  return new Promise((resolve, reject) => {
    if (!filePath.endsWith('.desktop')) {
      reject(new Error('Fișierul nu este un fișier .desktop'));
      return;
    }
    
    fs.readFile(filePath, 'utf8', (error, content) => {
      if (error) {
        reject(new Error(`Eroare la citirea fișierului: ${error.message}`));
        return;
      }
      
      const execMatch = content.match(/^Exec=(.+)$/m);
      if (!execMatch) {
        reject(new Error('Fișierul .desktop nu conține o comandă Exec'));
        return;
      }
      
      const execCommand = execMatch[1].trim();
      // Elimină parametrii %u, %f, etc.
      const cleanCommand = execCommand.split(' ')[0];
      
      exec(cleanCommand, (execError) => {
        if (execError) {
          reject(new Error(`Eroare la executare: ${execError.message}`));
          return;
        }
        resolve({ success: true });
      });
    });
  });
});

// Handler pentru executarea unui .app bundle
ipcMain.handle('execute-app-bundle', async (event, execPath) => {
  console.log('[APP] execute-app-bundle handler called with execPath:', execPath);
  return new Promise((resolve, reject) => {
    if (!execPath || !fs.existsSync(execPath)) {
      reject(new Error('Executabilul .app nu există'));
      return;
    }
    
    // Verifică dacă este un director sau un fișier
    fs.stat(execPath, (statError, stats) => {
      if (statError) {
        reject(new Error(`Eroare la citirea path-ului: ${statError.message}`));
        return;
      }
      
      let actualExecPath = execPath;
      
      if (stats.isDirectory()) {
        // Dacă este un director, caută executabilul în el
        console.log('[APP] PearOS is a directory, searching for executable inside');
        
        try {
          const files = fs.readdirSync(execPath);
          // Caută executabile comune
          const possibleExecutables = files.filter(file => {
            const filePath = path.join(execPath, file);
            try {
              const fileStats = fs.statSync(filePath);
              // Verifică dacă este un fișier (nu director) și nu are extensie sau are extensie comună pentru executabile
              return fileStats.isFile() && (
                !path.extname(file) || 
                ['.sh', '.bash', '.zsh', ''].includes(path.extname(file))
              );
            } catch {
              return false;
            }
          });
          
          if (possibleExecutables.length > 0) {
            // Folosește primul executabil găsit
            actualExecPath = path.join(execPath, possibleExecutables[0]);
            console.log('[APP] Found executable in PearOS directory:', actualExecPath);
          } else {
            reject(new Error('Nu s-a găsit niciun executabil în directorul PearOS'));
            return;
          }
        } catch (readError) {
          reject(new Error(`Eroare la citirea directorului PearOS: ${readError.message}`));
          return;
        }
      }
      
      // Verifică dacă este executabil
      fs.access(actualExecPath, fs.constants.X_OK, (accessError) => {
        if (accessError) {
          // Dacă nu este executabil, încearcă să-l facă executabil
          exec(`chmod +x "${actualExecPath}"`, (chmodError) => {
            if (chmodError) {
              console.error('[APP] Error making file executable:', chmodError);
            }
            // Continuă cu execuția oricum
            runAppBundle();
          });
        } else {
          runAppBundle();
        }
      });
      
      function runAppBundle() {
        // Rulează executabilul din directorul său
        const execDir = path.dirname(actualExecPath);
        const execName = path.basename(actualExecPath);
        
        console.log('[APP] Executing:', execName, 'from directory:', execDir);
        
        // Rulează executabilul din directorul său
        exec(`cd "${execDir}" && ./"${execName}"`, (execError) => {
          if (execError) {
            console.error('[APP] Error executing app bundle:', execError);
            reject(new Error(`Eroare la executare: ${execError.message}`));
            return;
          }
          console.log('[APP] App bundle executed successfully');
          resolve({ success: true });
        });
      }
    });
  });
});

// Handler pentru deschiderea unui fișier sau director cu aplicația default
ipcMain.handle('open-file', async (event, filePath) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      reject(new Error('Fișierul sau directorul nu există'));
      return;
    }
    
    // Folosește xdg-open pentru a deschide cu aplicația default
    exec(`xdg-open "${filePath}"`, (error) => {
      if (error) {
        reject(new Error(`Eroare la deschiderea fișierului: ${error.message}`));
        return;
      }
      resolve({ success: true });
    });
  });
});

// Handler pentru crearea unui folder nou pe desktop
ipcMain.handle('create-folder', async (event, folderName) => {
  return new Promise((resolve, reject) => {
    if (!folderName || folderName.trim() === '') {
      reject(new Error('Numele folderului nu poate fi gol'));
      return;
    }
    
    getDesktopDirectory((desktopDir) => {
      const folderPath = path.join(desktopDir, folderName.trim());
      
      // Verifică dacă există deja un folder cu acest nume
      if (fs.existsSync(folderPath)) {
        reject(new Error('Există deja un folder cu acest nume'));
        return;
      }
      
      // Creează folderul
      fs.mkdir(folderPath, { recursive: false }, (error) => {
        if (error) {
          reject(new Error(`Eroare la crearea folderului: ${error.message}`));
          return;
        }
        
        resolve({ success: true, path: folderPath });
      });
    });
  });
});

// Handler pentru obținerea accent color-ului din sistem
ipcMain.handle('get-accent', async () => {
  return new Promise((resolve, reject) => {
    // Caută fișierul accent în themeswitcher (pearos-settings)
    // Încearcă mai întâi în directorul pearos-settings-app (pentru development)
    const pearosSettingsDir = path.join(__dirname, '..', 'pearos-settings-app');
    const accentFileDev = path.join(pearosSettingsDir, 'themeswitcher', 'accent');
    
    // Apoi în .config (pentru instalare)
    const accentFileConfig = path.join(os.homedir(), '.config', 'pearos-settings', 'themeswitcher', 'accent');
    
    // Și în /usr/share/extras (pentru instalare sistem)
    const accentFileSystem = '/usr/share/extras/pearos-settings/themeswitcher/accent';
    
    let fileToRead = null;
    if (fs.existsSync(accentFileDev)) {
      fileToRead = accentFileDev;
    } else if (fs.existsSync(accentFileConfig)) {
      fileToRead = accentFileConfig;
    } else if (fs.existsSync(accentFileSystem)) {
      fileToRead = accentFileSystem;
    }
    
    if (!fileToRead) {
      // Default la blue dacă nu există fișierul
      console.log('Accent file not found, using default blue');
      resolve({ accent: 'blue' });
      return;
    }
    
    fs.readFile(fileToRead, 'utf8', (error, data) => {
      if (error) {
        console.error('Error reading accent file:', error);
        // Dacă nu poate citi, folosește default
        resolve({ accent: 'blue' });
        return;
      }
      
      const accent = data.trim();
      console.log('Loaded accent color:', accent);
      resolve({ accent: accent || 'blue' });
    });
  });
});

// Handler pentru obținerea wallpaper-ului actual din sistem
ipcMain.handle('get-current-wallpaper', async () => {
  return new Promise((resolve) => {
    exec('grep "Image=" ~/.config/plasma-org.kde.plasma.desktop-appletsrc 2>/dev/null | grep -v "Image=true" | sed \'s/.*Image=//\' | tail -n 1', (error, stdout) => {
      if (error || !stdout || !stdout.trim()) {
        resolve({ path: null, name: null });
        return;
      }
      
      let wallpaperPath = stdout.trim();
      // Elimină 'file://' dacă există
      if (wallpaperPath.startsWith('file://')) {
        wallpaperPath = wallpaperPath.substring(7);
      }
      
      const wallpaperName = wallpaperPath.split('/').pop();
      
      resolve({
        path: wallpaperPath,
        name: wallpaperName
      });
    });
  });
});

// Handler pentru selectarea unui fișier de wallpaper
ipcMain.handle('select-wallpaper-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selectează Wallpaper',
    filters: [
      { name: 'Imagini', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'] },
      { name: 'Toate fișierele', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { path: null, name: null };
  }

  const wallpaperPath = result.filePaths[0];
  const wallpaperName = wallpaperPath.split('/').pop();

  return {
    path: wallpaperPath,
    name: wallpaperName
  };
});

// Handler pentru redenumirea unui fișier
ipcMain.handle('rename-file', async (event, filePath, newName) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      reject(new Error('Fișierul sau directorul nu există'));
      return;
    }
    
    if (!newName || newName.trim() === '') {
      reject(new Error('Numele nu poate fi gol'));
      return;
    }
    
    const fileDir = path.dirname(filePath);
    const oldName = path.basename(filePath);
    const fileExt = path.extname(oldName);
    const newPath = path.join(fileDir, newName + (fileExt && !newName.endsWith(fileExt) ? fileExt : ''));
    
    // Verifică dacă există deja un fișier cu acest nume
    if (fs.existsSync(newPath) && newPath !== filePath) {
      reject(new Error('Există deja un fișier cu acest nume'));
      return;
    }
    
    fs.rename(filePath, newPath, (error) => {
      if (error) {
        reject(new Error(`Eroare la redenumire: ${error.message}`));
        return;
      }
      resolve({ success: true, newPath: newPath });
    });
  });
});

// Handler pentru start drag-and-drop către aplicații externe
ipcMain.on('ondragstart', (event, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) {
    return;
  }
  
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    // Folosește webContents.startDrag() pentru a permite drag-and-drop către aplicații externe
    win.webContents.startDrag({
      file: filePath,
      icon: null // Poți adăuga o iconiță personalizată aici dacă dorești
    });
  }
});

// Handler pentru mutarea fișierelor trase din alte aplicații în Desktop
ipcMain.handle('move-file-to-desktop', async (event, sourcePath, destPath, x, y) => {
  return new Promise((resolve, reject) => {
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      reject(new Error('Fișierul sursă nu există'));
      return;
    }
    
    getDesktopDirectory((desktopDir) => {
      const fileName = path.basename(sourcePath);
      let finalDestPath;
      
      if (destPath) {
        // Dacă este specificat un destPath, folosește-l
        finalDestPath = destPath;
      } else {
        // Altfel, mută fișierul în Desktop cu același nume
        finalDestPath = path.join(desktopDir, fileName);
        
        // Dacă există deja un fișier cu acest nume, adaugă un număr
        let counter = 1;
        let baseName = path.basename(fileName, path.extname(fileName));
        let ext = path.extname(fileName);
        while (fs.existsSync(finalDestPath)) {
          const newFileName = `${baseName} ${counter}${ext}`;
          finalDestPath = path.join(desktopDir, newFileName);
          counter++;
        }
      }
      
      // Mută sau copiază fișierul
      fs.stat(sourcePath, (statError, stats) => {
        if (statError) {
          reject(new Error(`Eroare la citirea fișierului: ${statError.message}`));
          return;
        }
        
        if (stats.isDirectory()) {
          // Pentru directoare, folosește exec pentru a muta cu mv
          exec(`mv "${sourcePath}" "${finalDestPath}"`, (error) => {
            if (error) {
              reject(new Error(`Eroare la mutarea directorului: ${error.message}`));
              return;
            }
            resolve({ success: true, path: finalDestPath, x: x, y: y });
          });
        } else {
          // Pentru fișiere, folosește fs.rename sau exec mv
          fs.rename(sourcePath, finalDestPath, (error) => {
            if (error) {
              // Dacă rename eșuează (de exemplu, pe volume diferite), încearcă copy + delete
              const readStream = fs.createReadStream(sourcePath);
              const writeStream = fs.createWriteStream(finalDestPath);
              
              readStream.pipe(writeStream);
              
              writeStream.on('finish', () => {
                fs.unlink(sourcePath, (unlinkError) => {
                  if (unlinkError) {
                    console.error('Eroare la ștergerea fișierului sursă:', unlinkError);
                  }
                  resolve({ success: true, path: finalDestPath, x: x, y: y });
                });
              });
              
              writeStream.on('error', (writeError) => {
                reject(new Error(`Eroare la copierea fișierului: ${writeError.message}`));
              });
              
              readStream.on('error', (readError) => {
                reject(new Error(`Eroare la citirea fișierului: ${readError.message}`));
              });
            } else {
              resolve({ success: true, path: finalDestPath, x: x, y: y });
            }
          });
        }
      });
    });
  });
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Handler pentru setarea ignore mouse events
ipcMain.handle('set-ignore-mouse-events', async (event, ignore, forward) => {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(ignore, { forward: forward || false });
  }
  return { success: true };
});

// Handler pentru setarea always on top
ipcMain.handle('set-always-on-top', async (event, flag) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(flag);
    console.log(`[WINDOW] setAlwaysOnTop(${flag})`);
  }
  return { success: true };
});

// Handler pentru clipboard operations
ipcMain.handle('clipboard-copy', async (event, filePaths) => {
  console.log('[CLIPBOARD] clipboard-copy handler called with filePaths:', filePaths);
  if (!filePaths || filePaths.length === 0) {
    console.log('[CLIPBOARD] No files selected for copy');
    return { success: false, error: 'No files selected' };
  }
  
  // Salvează căile fișierelor în clipboard-ul sistemului
  // Folosim formatul text/uri-list pentru compatibilitate cu aplicațiile externe (Nautilus, GNOME Files, etc.)
  const uriList = filePaths.map(filePath => `file://${filePath}`).join('\r\n');
  clipboard.writeText(uriList);
  console.log('[CLIPBOARD] Written to clipboard (uri-list):', uriList.substring(0, 100) + '...');
  
  // Salvează și ca text simplu pentru compatibilitate
  const fs = require('fs');
  const validPaths = filePaths.filter(p => fs.existsSync(p));
  if (validPaths.length > 0) {
    clipboard.writeText(validPaths.join('\n'));
    console.log('[CLIPBOARD] Written to clipboard (plain text):', validPaths.join('\n').substring(0, 100) + '...');
  }
  
  console.log('[CLIPBOARD] Copy operation completed successfully');
  return { success: true };
});

ipcMain.handle('clipboard-cut', async (event, filePaths) => {
  console.log('[CLIPBOARD] clipboard-cut handler called with filePaths:', filePaths);
  if (!filePaths || filePaths.length === 0) {
    console.log('[CLIPBOARD] No files selected for cut');
    return { success: false, error: 'No files selected' };
  }
  
  // Pentru cut, folosim același mecanism ca pentru copy
  // Formatul uri-list este standard pentru cut/copy în Linux
  const uriList = filePaths.map(filePath => `file://${filePath}`).join('\r\n');
  clipboard.writeText(uriList);
  console.log('[CLIPBOARD] Written to clipboard (uri-list):', uriList.substring(0, 100) + '...');
  
  // Salvează și ca text simplu
  const fs = require('fs');
  const validPaths = filePaths.filter(p => fs.existsSync(p));
  if (validPaths.length > 0) {
    clipboard.writeText(validPaths.join('\n'));
    console.log('[CLIPBOARD] Written to clipboard (plain text):', validPaths.join('\n').substring(0, 100) + '...');
  }
  
  // Marchează că este o operație de cut (folosind un format special pentru aplicația noastră)
  // Dar păstrăm și formatul standard pentru aplicațiile externe
  console.log('[CLIPBOARD] Cut operation completed successfully');
  return { success: true, isCut: true, filePaths: validPaths };
});

ipcMain.handle('clipboard-paste', async (event) => {
  console.log('[CLIPBOARD] clipboard-paste handler called');
  // Citește din clipboard-ul sistemului
  const clipboardText = clipboard.readText();
  
  if (!clipboardText) {
    console.log('[CLIPBOARD] Clipboard is empty');
    return { success: false, error: 'Clipboard is empty' };
  }
  
  console.log('[CLIPBOARD] Clipboard content (first 200 chars):', clipboardText.substring(0, 200));
  
  // Verifică dacă este un format de fișiere (uri-list sau căi simple)
  let filePaths = [];
  
  if (clipboardText.includes('file://')) {
    console.log('[CLIPBOARD] Detected uri-list format');
    // Format uri-list (standard pentru Linux)
    filePaths = clipboardText.split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.startsWith('file://'))
      .map(line => {
        // Elimină file:// și decodează URI-ul
        const path = line.replace(/^file:\/\//, '');
        try {
          return decodeURIComponent(path);
        } catch {
          return path;
        }
      })
      .filter(p => fs.existsSync(p));
  } else {
    console.log('[CLIPBOARD] Detected plain text format');
    // Format text simplu cu căi de fișiere
    const lines = clipboardText.split(/\r?\n/).map(line => line.trim()).filter(line => line);
    filePaths = lines.filter(line => fs.existsSync(line));
  }
  
  console.log('[CLIPBOARD] Extracted file paths:', filePaths);
  console.log('[CLIPBOARD] Paste operation result - success:', filePaths.length > 0, 'files:', filePaths.length);
  
  return { 
    success: filePaths.length > 0, 
    filePaths: filePaths.length > 0 ? filePaths : null
  };
});

ipcMain.handle('clipboard-get', async () => {
  const clipboardText = clipboard.readText();
  return { text: clipboardText };
});

// Handler pentru ștergerea definitivă a fișierelor
ipcMain.handle('delete-permanent', async (event, filePaths) => {
  console.log('[DELETE] delete-permanent handler called with filePaths:', filePaths);
  if (!filePaths || filePaths.length === 0) {
    console.log('[DELETE] No files selected for permanent deletion');
    return { success: false, error: 'No files selected' };
  }
  
  const results = [];
  const deletePromises = filePaths.map(filePath => {
    return new Promise((resolve) => {
      if (!fs.existsSync(filePath)) {
        console.log(`[DELETE] File does not exist: ${filePath}`);
        results.push({ path: filePath, success: false, error: 'File does not exist' });
        resolve();
        return;
      }
      
      // Șterge definitiv folosind rm -rf
      exec(`rm -rf "${filePath}"`, (error) => {
        if (error) {
          console.error(`[DELETE] Error deleting ${filePath}:`, error);
          results.push({ path: filePath, success: false, error: error.message });
        } else {
          console.log(`[DELETE] Successfully deleted permanently: ${filePath}`);
          results.push({ path: filePath, success: true });
        }
        resolve();
      });
    });
  });
  
  await Promise.all(deletePromises);
  return { success: true, results: results };
});

// Handler pentru mutarea fișierelor în trash
ipcMain.handle('delete-to-trash', async (event, filePaths) => {
  console.log('[DELETE] delete-to-trash handler called with filePaths:', filePaths);
  if (!filePaths || filePaths.length === 0) {
    console.log('[DELETE] No files selected for trash');
    return { success: false, error: 'No files selected' };
  }
  
  const results = [];
  const trashPromises = filePaths.map(filePath => {
    return new Promise((resolve) => {
      if (!fs.existsSync(filePath)) {
        console.log(`[DELETE] File does not exist: ${filePath}`);
        results.push({ path: filePath, success: false, error: 'File does not exist' });
        resolve();
        return;
      }
      
      // Încearcă să folosească gvfs-trash (GNOME) sau trash-put (trash-cli)
      exec(`gvfs-trash "${filePath}" 2>/dev/null || trash-put "${filePath}" 2>/dev/null`, (error, stdout, stderr) => {
        if (error) {
          // Dacă niciunul nu funcționează, mută manual în ~/.local/share/Trash/files/
          try {
            const trashDir = path.join(os.homedir(), '.local', 'share', 'Trash', 'files');
            const trashInfoDir = path.join(os.homedir(), '.local', 'share', 'Trash', 'info');
            
            // Creează directoarele trash dacă nu există
            if (!fs.existsSync(trashDir)) {
              fs.mkdirSync(trashDir, { recursive: true });
            }
            if (!fs.existsSync(trashInfoDir)) {
              fs.mkdirSync(trashInfoDir, { recursive: true });
            }
            
            const fileName = path.basename(filePath);
            let trashPath = path.join(trashDir, fileName);
            
            // Dacă există deja un fișier cu același nume, adaugă un timestamp
            if (fs.existsSync(trashPath)) {
              const timestamp = Date.now();
              const ext = path.extname(fileName);
              const name = path.basename(fileName, ext);
              trashPath = path.join(trashDir, `${name}_${timestamp}${ext}`);
            }
            
            // Mută fișierul în trash
            fs.renameSync(filePath, trashPath);
            
            // Creează fișierul .trashinfo
            const trashInfoPath = path.join(trashInfoDir, path.basename(trashPath) + '.trashinfo');
            const trashInfo = `[Trash Info]\nPath=${filePath}\nDeletionDate=${new Date().toISOString().split('T')[0]}T${new Date().toTimeString().split(' ')[0]}\n`;
            fs.writeFileSync(trashInfoPath, trashInfo);
            
            console.log(`[DELETE] Successfully moved to trash: ${filePath}`);
            results.push({ path: filePath, success: true });
          } catch (trashError) {
            console.error(`[DELETE] Error moving ${filePath} to trash:`, trashError);
            results.push({ path: filePath, success: false, error: trashError.message });
          }
        } else {
          console.log(`[DELETE] Successfully moved to trash: ${filePath}`);
          results.push({ path: filePath, success: true });
        }
        resolve();
      });
    });
  });
  
  await Promise.all(trashPromises);
  return { success: true, results: results };
});

// Handler pentru obținerea directorului Desktop
ipcMain.handle('get-desktop-directory', async () => {
  return new Promise((resolve) => {
    getDesktopDirectory((desktopDir) => {
      resolve({ desktopDir: desktopDir });
    });
  });
});

// Handler pentru comprimarea fișierelor într-un zip
ipcMain.handle('compress-files', async (event, filePaths, zipPath) => {
  console.log('[COMPRESS] compress-files handler called with filePaths:', filePaths, 'zipPath:', zipPath);
  if (!filePaths || filePaths.length === 0) {
    console.log('[COMPRESS] No files selected for compression');
    return { success: false, error: 'No files selected' };
  }
  
  if (!zipPath) {
    console.log('[COMPRESS] No zip path specified');
    return { success: false, error: 'No zip path specified' };
  }
  
  return new Promise((resolve, reject) => {
    // Verifică dacă fișierele există
    const validPaths = filePaths.filter(p => fs.existsSync(p));
    if (validPaths.length === 0) {
      reject(new Error('No valid files to compress'));
      return;
    }
    
    // Verifică dacă zip-ul există deja
    if (fs.existsSync(zipPath)) {
      reject(new Error('Zip file already exists'));
      return;
    }
    
    // Creează comanda zip
    // Folosim -r pentru recursive (pentru directoare)
    // -j elimină structura de directoare, dar vrem să păstrăm structura, deci nu folosim -j
    const zipDir = path.dirname(zipPath);
    const zipFileName = path.basename(zipPath);
    
    // Construiește comanda zip cu căi absolute
    const filesList = validPaths.map(p => {
      // Folosește calea absolută și escape-uiește caracterele speciale
      return `"${p}"`;
    }).join(' ');
    
    const zipCommand = `cd "${zipDir}" && zip -r "${zipFileName}" ${filesList}`;
    
    console.log('[COMPRESS] Executing zip command:', zipCommand);
    
    exec(zipCommand, { cwd: zipDir }, (error, stdout, stderr) => {
      if (error) {
        console.error('[COMPRESS] Error compressing files:', error);
        console.error('[COMPRESS] stderr:', stderr);
        reject(new Error(`Error compressing files: ${error.message}`));
        return;
      }
      
      // Verifică dacă fișierul zip a fost creat
      if (fs.existsSync(zipPath)) {
        console.log('[COMPRESS] Files successfully compressed to:', zipPath);
        resolve({ success: true, zipPath: zipPath });
      } else {
        console.error('[COMPRESS] Zip file was not created');
        reject(new Error('Zip file was not created'));
      }
    });
  });
});

// Handler pentru crearea unui alias (link simbolic)
ipcMain.handle('make-alias', async (event, sourcePath, aliasPath) => {
  console.log('[ALIAS] make-alias handler called with sourcePath:', sourcePath, 'aliasPath:', aliasPath);
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    console.log('[ALIAS] Source file does not exist');
    return { success: false, error: 'Source file does not exist' };
  }
  
  if (!aliasPath) {
    console.log('[ALIAS] No alias path specified');
    return { success: false, error: 'No alias path specified' };
  }
  
  return new Promise((resolve, reject) => {
    // Verifică dacă alias-ul există deja
    if (fs.existsSync(aliasPath)) {
      reject(new Error('Alias already exists'));
      return;
    }
    
    // Creează link-ul simbolic folosind calea absolută pentru sursă
    const absoluteSourcePath = path.resolve(sourcePath);
    const aliasDir = path.dirname(aliasPath);
    const aliasName = path.basename(aliasPath);
    
    // Creează link-ul simbolic
    // Folosim calea relativă dacă sunt în același director, altfel calea absolută
    let relativeSourcePath = absoluteSourcePath;
    try {
      const sourceDir = path.dirname(absoluteSourcePath);
      if (sourceDir === aliasDir) {
        // Dacă sunt în același director, folosește doar numele fișierului
        relativeSourcePath = path.basename(absoluteSourcePath);
      } else {
        // Calculează calea relativă
        relativeSourcePath = path.relative(aliasDir, absoluteSourcePath);
      }
    } catch (error) {
      // Dacă nu se poate calcula calea relativă, folosește calea absolută
      relativeSourcePath = absoluteSourcePath;
    }
    
    const lnCommand = `ln -s "${relativeSourcePath}" "${aliasPath}"`;
    
    console.log('[ALIAS] Executing ln command:', lnCommand);
    
    exec(lnCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('[ALIAS] Error creating alias:', error);
        console.error('[ALIAS] stderr:', stderr);
        reject(new Error(`Error creating alias: ${error.message}`));
        return;
      }
      
      // Verifică dacă link-ul a fost creat
      if (fs.existsSync(aliasPath)) {
        console.log('[ALIAS] Alias successfully created:', aliasPath);
        resolve({ success: true, aliasPath: aliasPath });
      } else {
        console.error('[ALIAS] Alias was not created');
        reject(new Error('Alias was not created'));
      }
    });
  });
});

// Handler pentru copierea unui fișier (nu mutarea)
ipcMain.handle('copy-file', async (event, sourcePath, destPath) => {
  return new Promise((resolve, reject) => {
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      reject(new Error('Fișierul sursă nu există'));
      return;
    }
    
    if (!destPath) {
      reject(new Error('Calea destinație nu este specificată'));
      return;
    }
    
    // Verifică dacă destinația există deja
    if (fs.existsSync(destPath)) {
      // Dacă există, adaugă un număr la sfârșit
      let counter = 1;
      const pathObj = path.parse(destPath);
      let newDestPath = destPath;
      while (fs.existsSync(newDestPath)) {
        const newName = `${pathObj.name} ${counter}${pathObj.ext}`;
        newDestPath = path.join(pathObj.dir, newName);
        counter++;
      }
      destPath = newDestPath;
    }
    
    // Copiază fișierul sau directorul
    fs.stat(sourcePath, (statError, stats) => {
      if (statError) {
        reject(new Error(`Eroare la citirea fișierului: ${statError.message}`));
        return;
      }
      
      if (stats.isDirectory()) {
        // Pentru directoare, folosește cp -r
        exec(`cp -r "${sourcePath}" "${destPath}"`, (error) => {
          if (error) {
            reject(new Error(`Eroare la copierea directorului: ${error.message}`));
            return;
          }
          resolve({ success: true, path: destPath });
        });
      } else {
        // Pentru fișiere, folosește fs.copyFile
        fs.copyFile(sourcePath, destPath, (error) => {
          if (error) {
            reject(new Error(`Eroare la copierea fișierului: ${error.message}`));
            return;
          }
          resolve({ success: true, path: destPath });
        });
      }
    });
  });
});

// Handler pentru minimizarea tuturor ferestrelor din sistem (exceptând fereastra desktop)
ipcMain.handle('minimize-all-windows', async () => {
  return new Promise((resolve) => {
    if (!mainWindow) {
      resolve({ success: true });
      return;
    }
    
    // Obține titlul ferestrei desktop pentru a o exclude
    const desktopTitle = mainWindow.getTitle();
    
    // Folosește wmctrl pentru a minimiza toate ferestrele, exceptând fereastra desktop
    exec('wmctrl -l', (error, stdout) => {
      if (error || !stdout) {
        // Fallback: încearcă să minimizeze doar ferestrele active
        exec('xdotool search --onlyvisible --class "" windowminimize 2>/dev/null || true', () => {
          resolve({ success: true });
        });
        return;
      }
      
      // Parsează lista de ferestre și minimizează toate, exceptând desktop
      const lines = stdout.trim().split('\n');
      let minimized = 0;
      
      lines.forEach(line => {
        const parts = line.split(/\s+/, 4);
        if (parts.length >= 4) {
          const windowId = parts[0];
          const title = parts.slice(3).join(' ');
          
          // Nu minimiza fereastra desktop
          if (!title.includes('pearos-desktop') && !title.includes('Electron')) {
            exec(`wmctrl -i -r ${windowId} -b add,hidden 2>/dev/null || wmctrl -i -r ${windowId} -b add,shaded 2>/dev/null || true`, () => {
              minimized++;
            });
          }
        }
      });
      
      // Asigură-te că fereastra desktop rămâne vizibilă și în față
      setTimeout(() => {
        if (mainWindow && !mainWindow.isVisible()) {
          mainWindow.show();
        }
        mainWindow.focus();
        resolve({ success: true });
      }, 100);
    });
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

