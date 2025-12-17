const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');
const { ClassicLevel } = require('classic-level');

// Initialize store for profiles
const store = new Store({
    name: 'fivem-launcher-config',
    defaults: {
        profiles: [],
        activeProfile: null,
        fivemPath: null,
        lastServer: null,
        lastPureMode: 0,
        knownGameBuilds: ['2612', '2699', '2802', '2944', '3095'] // Common builds
    }
});

let mainWindow;
let fivemProcessCheckInterval = null;

// Auto-updater configuration
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 650,
        minWidth: 800,
        minHeight: 600,
        frame: false,
        transparent: true,
        resizable: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        icon: path.join(__dirname, 'assets', 'icon.ico')
    });

    mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

    // Open DevTools in development
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }
}

app.whenReady().then(() => {
    createWindow();

    // Check for updates on startup
    autoUpdater.checkForUpdates().catch(err => {
        console.log('Update check failed:', err.message);
    });

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

// ==================== Window Controls ====================
ipcMain.on('window-minimize', () => {
    mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});

ipcMain.on('window-close', () => {
    mainWindow.close();
});

// ==================== FiveM Path Detection ====================
ipcMain.handle('detect-fivem-path', async () => {
    const possiblePaths = [
        path.join(process.env.LOCALAPPDATA, 'FiveM', 'FiveM.exe'),
        path.join(process.env.PROGRAMFILES, 'FiveM', 'FiveM.exe'),
        path.join(process.env['PROGRAMFILES(X86)'], 'FiveM', 'FiveM.exe'),
        path.join('C:', 'FiveM', 'FiveM.exe')
    ];

    for (const fivemPath of possiblePaths) {
        if (fs.existsSync(fivemPath)) {
            store.set('fivemPath', fivemPath);
            return { success: true, path: fivemPath };
        }
    }

    return { success: false, path: null };
});

ipcMain.handle('browse-fivem-path', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Select FiveM.exe',
        filters: [{ name: 'FiveM Executable', extensions: ['exe'] }],
        properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        if (selectedPath.toLowerCase().endsWith('fivem.exe')) {
            store.set('fivemPath', selectedPath);
            return { success: true, path: selectedPath };
        }
        return { success: false, error: 'Please select FiveM.exe' };
    }
    return { success: false, error: 'No file selected' };
});

ipcMain.handle('get-fivem-path', () => {
    return store.get('fivemPath');
});

// ==================== Game Build Management ====================
function getCitizenFXPath() {
    return path.join(process.env.LOCALAPPDATA, 'FiveM', 'FiveM.app', 'CitizenFX.ini');
}

function parseIniFile(content) {
    const result = {};
    let currentSection = '';

    content.split(/\r?\n/).forEach(line => {
        line = line.trim();
        if (line.startsWith('[') && line.endsWith(']')) {
            currentSection = line.slice(1, -1);
            result[currentSection] = {};
        } else if (line && !line.startsWith(';') && currentSection) {
            const [key, ...valueParts] = line.split('=');
            if (key) {
                result[currentSection][key.trim()] = valueParts.join('=').trim();
            }
        }
    });
    return result;
}

function writeIniFile(filePath, data) {
    let content = '';
    for (const section in data) {
        content += `[${section}]\n`;
        for (const key in data[section]) {
            content += `${key}=${data[section][key]}\n`;
        }
        content += '\n';
    }
    fs.writeFileSync(filePath, content, 'utf8');
}

ipcMain.handle('get-current-game-build', () => {
    try {
        const iniPath = getCitizenFXPath();
        if (!fs.existsSync(iniPath)) {
            return { success: false, build: null };
        }

        const content = fs.readFileSync(iniPath, 'utf8');
        const ini = parseIniFile(content);
        const savedBuild = ini.Game?.SavedBuildNumber;

        // Add to known builds if new
        if (savedBuild) {
            const builds = store.get('knownGameBuilds', []);
            if (!builds.includes(savedBuild)) {
                builds.push(savedBuild);
                builds.sort((a, b) => parseInt(a) - parseInt(b));
                store.set('knownGameBuilds', builds);
            }
        }

        return { success: true, build: savedBuild || null };
    } catch (error) {
        return { success: false, build: null, error: error.message };
    }
});

ipcMain.handle('get-known-game-builds', () => {
    return store.get('knownGameBuilds', []);
});

ipcMain.handle('add-game-build', (event, build) => {
    const builds = store.get('knownGameBuilds', []);
    if (!builds.includes(build)) {
        builds.push(build);
        builds.sort((a, b) => parseInt(a) - parseInt(b));
        store.set('knownGameBuilds', builds);
    }
    return builds;
});

ipcMain.handle('set-game-build', (event, build) => {
    try {
        const iniPath = getCitizenFXPath();
        let ini = {};

        if (fs.existsSync(iniPath)) {
            const content = fs.readFileSync(iniPath, 'utf8');
            ini = parseIniFile(content);
        }

        if (!ini.Game) ini.Game = {};
        ini.Game.SavedBuildNumber = build;

        writeIniFile(iniPath, ini);

        // Add to known builds
        const builds = store.get('knownGameBuilds', []);
        if (!builds.includes(build)) {
            builds.push(build);
            builds.sort((a, b) => parseInt(a) - parseInt(b));
            store.set('knownGameBuilds', builds);
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// ==================== Player Name (LevelDB) ====================
function getFiveMLocalStoragePath() {
    return path.join(process.env.LOCALAPPDATA, 'FiveM', 'FiveM.app', 'data', 'nui-storage', 'Local Storage', 'leveldb');
}

ipcMain.handle('get-fivem-player-name', async () => {
    try {
        const dbPath = getFiveMLocalStoragePath();

        if (!fs.existsSync(dbPath)) {
            return { success: false, error: 'FiveM storage not found' };
        }

        const db = new ClassicLevel(dbPath, {
            createIfMissing: false,
            keyEncoding: 'buffer',
            valueEncoding: 'buffer'
        });

        let playerName = null;

        // Iterate through all keys to find nickOverride
        for await (const [keyBuffer, valueBuffer] of db.iterator()) {
            const key = keyBuffer.toString('utf8');
            if (key.includes('nickOverride')) {
                // Value is buffer, extract printable characters
                const value = valueBuffer.toString('utf8');
                // Remove control characters and get the actual name
                playerName = value.replace(/[\x00-\x1F]/g, '').trim();
                console.log('Found player name key:', key);
                console.log('Found player name value:', playerName);
                break;
            }
        }

        await db.close();

        return { success: true, playerName };
    } catch (error) {
        console.error('Error reading player name:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('set-fivem-player-name', async (event, playerName) => {
    try {
        const dbPath = getFiveMLocalStoragePath();

        if (!fs.existsSync(dbPath)) {
            return { success: false, error: 'FiveM storage not found' };
        }

        const db = new ClassicLevel(dbPath, {
            createIfMissing: false,
            keyEncoding: 'buffer',
            valueEncoding: 'buffer'
        });

        // Find the nickOverride key
        let foundKey = null;
        for await (const [keyBuffer] of db.iterator({ keys: true, values: false })) {
            const key = keyBuffer.toString('utf8');
            if (key.includes('nickOverride')) {
                foundKey = keyBuffer;
                console.log('Found existing key:', key);
                break;
            }
        }

        // Create value buffer with prefix byte
        const valueBuffer = Buffer.concat([
            Buffer.from([0x01]), // String type prefix
            Buffer.from(playerName, 'utf8')
        ]);

        if (foundKey) {
            // Update existing key
            await db.put(foundKey, valueBuffer);
            console.log('Updated player name to:', playerName);
        } else {
            // Create new key if not exists
            const newKey = Buffer.from('_https://nui-game-internal\x00\x01nickOverride', 'utf8');
            await db.put(newKey, valueBuffer);
            console.log('Created new player name:', playerName);
        }

        // Force compact to merge log into .ldb files
        await db.compactRange(null, null);
        console.log('Database compacted');

        await db.close();

        return { success: true };
    } catch (error) {
        console.error('Error setting player name:', error);
        return { success: false, error: error.message };
    }
});

// Launch FiveM without connecting (for testing)
ipcMain.handle('launch-fivem-test', async () => {
    const fivemPath = store.get('fivemPath');

    if (!fivemPath || !fs.existsSync(fivemPath)) {
        return { success: false, error: 'FiveM path not found. Please configure it first.' };
    }

    try {
        // Just launch FiveM directly without any URL
        spawn(fivemPath, [], { detached: true, stdio: 'ignore' }).unref();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('launch-fivem', async (event, { serverAddress, pureMode }) => {
    const fivemPath = store.get('fivemPath');

    if (!fivemPath || !fs.existsSync(fivemPath)) {
        return { success: false, error: 'FiveM path not found. Please configure it first.' };
    }

    try {
        // Save last used settings (only if defined)
        if (serverAddress) store.set('lastServer', serverAddress);
        if (pureMode !== undefined) store.set('lastPureMode', pureMode);

        if (serverAddress) {
            // Create a temporary .url shortcut file and launch it via explorer
            // This bypasses FiveM's security check by making it look like a user click
            // Use unique filename with timestamp to prevent detection
            const tempDir = app.getPath('temp');
            const uniqueId = Date.now();
            const urlFilePath = path.join(tempDir, `fivem_connect_${uniqueId}.url`);

            // Build connect URL with pure mode if specified
            let connectUrl = `fivem://connect/${serverAddress}`;
            if (pureMode !== undefined && pureMode !== null && pureMode > 0) {
                connectUrl += `?pure_${pureMode}`;
            }

            console.log('Launching FiveM with URL:', connectUrl, 'Pure Mode:', pureMode);

            // Create .url shortcut file content
            const urlFileContent = `[InternetShortcut]\r\nURL=${connectUrl}\r\n`;

            // Write the temp file
            fs.writeFileSync(urlFilePath, urlFileContent, 'utf8');

            // Open the .url file with explorer.exe (acts like double-clicking)
            return new Promise((resolve) => {
                exec(`explorer.exe "${urlFilePath}"`, (error) => {
                    // Clean up temp file after a short delay
                    setTimeout(() => {
                        try {
                            fs.unlinkSync(urlFilePath);
                        } catch (e) {
                            console.log('Could not delete temp file:', e.message);
                        }
                    }, 3000);

                    if (error && error.code !== 1) {
                        // explorer.exe often returns code 1 even on success
                        console.error('Launch failed:', error);
                        resolve({ success: false, error: error.message });
                    } else {
                        // Start monitoring FiveM process
                        startFiveMProcessMonitor();
                        resolve({ success: true });
                    }
                });
            });
        } else {
            // No server specified, just launch FiveM normally
            const fivemProcess = spawn(fivemPath, [], {
                detached: true,
                stdio: 'ignore'
            });
            fivemProcess.unref();
            startFiveMProcessMonitor();
            return { success: true };
        }
    } catch (error) {
        console.error('Launch error:', error);
        return { success: false, error: error.message };
    }
});

// ==================== FiveM Process Monitor ====================
function startFiveMProcessMonitor() {
    // Clear any existing interval
    if (fivemProcessCheckInterval) {
        clearInterval(fivemProcessCheckInterval);
    }

    // Wait a bit for FiveM to start
    setTimeout(() => {
        fivemProcessCheckInterval = setInterval(() => {
            checkFiveMRunning().then(running => {
                if (!running && mainWindow) {
                    // FiveM has exited
                    mainWindow.webContents.send('fivem-exited');

                    // Re-read the game build (might have changed)
                    try {
                        const iniPath = getCitizenFXPath();
                        if (fs.existsSync(iniPath)) {
                            const content = fs.readFileSync(iniPath, 'utf8');
                            const ini = parseIniFile(content);
                            const savedBuild = ini.Game?.SavedBuildNumber;
                            if (savedBuild) {
                                const builds = store.get('knownGameBuilds', []);
                                if (!builds.includes(savedBuild)) {
                                    builds.push(savedBuild);
                                    builds.sort((a, b) => parseInt(a) - parseInt(b));
                                    store.set('knownGameBuilds', builds);
                                    mainWindow.webContents.send('game-builds-updated', builds);
                                }
                            }
                        }
                    } catch (e) {
                        console.log('Error reading build after exit:', e.message);
                    }

                    clearInterval(fivemProcessCheckInterval);
                    fivemProcessCheckInterval = null;
                }
            });
        }, 5000); // Check every 5 seconds
    }, 10000); // Start checking after 10 seconds
}

function checkFiveMRunning() {
    return new Promise((resolve) => {
        exec('tasklist /FI "IMAGENAME eq FiveM.exe" /NH', (error, stdout) => {
            if (error) {
                resolve(false);
                return;
            }
            resolve(stdout.toLowerCase().includes('fivem.exe'));
        });
    });
}

ipcMain.handle('check-fivem-running', async () => {
    return await checkFiveMRunning();
});

// ==================== Server Status ====================
ipcMain.handle('check-server-status', async (event, serverAddress) => {
    const http = require('http');
    const https = require('https');

    try {
        // Check if it's a direct IP:Port format
        const isDirectIP = !serverAddress.includes('cfx.re/join/');

        if (isDirectIP) {
            // Query server directly using FiveM's info.json and players.json endpoints
            return new Promise((resolve) => {
                const [host, port] = serverAddress.split(':');
                const serverPort = port || '30120';

                // Try to get server info
                const infoUrl = `http://${host}:${serverPort}/info.json`;

                http.get(infoUrl, { timeout: 5000 }, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            const info = JSON.parse(data);

                            // Now get player count
                            const playersUrl = `http://${host}:${serverPort}/players.json`;
                            http.get(playersUrl, { timeout: 5000 }, (pRes) => {
                                let pData = '';
                                pRes.on('data', chunk => pData += chunk);
                                pRes.on('end', () => {
                                    try {
                                        const players = JSON.parse(pData);
                                        resolve({
                                            online: true,
                                            players: Array.isArray(players) ? players.length : 0,
                                            maxPlayers: info.vars?.sv_maxClients || info.vars?.sv_maxclients || 32,
                                            serverName: info.vars?.sv_projectName || info.vars?.sv_hostname || 'FiveM Server',
                                            gameVersion: info.vars?.sv_enforceGameBuild || info.version || 'Unknown'
                                        });
                                    } catch {
                                        resolve({
                                            online: true,
                                            players: 0,
                                            maxPlayers: info.vars?.sv_maxClients || 32,
                                            serverName: info.vars?.sv_projectName || 'FiveM Server',
                                            gameVersion: info.vars?.sv_enforceGameBuild || info.version || 'Unknown'
                                        });
                                    }
                                });
                            }).on('error', () => {
                                resolve({
                                    online: true,
                                    players: 0,
                                    maxPlayers: info.vars?.sv_maxClients || 32,
                                    serverName: info.vars?.sv_projectName || 'FiveM Server',
                                    gameVersion: info.vars?.sv_enforceGameBuild || info.version || 'Unknown'
                                });
                            });
                        } catch {
                            resolve({ online: false, players: 0, maxPlayers: 0 });
                        }
                    });
                }).on('error', () => {
                    resolve({ online: false, players: 0, maxPlayers: 0 });
                }).on('timeout', () => {
                    resolve({ online: false, players: 0, maxPlayers: 0 });
                });
            });
        } else {
            // cfx.re/join/xxx format - use FiveM API
            const serverCode = serverAddress.split('cfx.re/join/')[1];

            return new Promise((resolve) => {
                const url = `https://servers-frontend.fivem.net/api/servers/single/${serverCode}`;

                https.get(url, { timeout: 5000 }, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            const json = JSON.parse(data);
                            if (json.Data) {
                                resolve({
                                    online: true,
                                    players: json.Data.clients || 0,
                                    maxPlayers: json.Data.sv_maxclients || 0,
                                    serverName: json.Data.hostname || 'Unknown Server'
                                });
                            } else {
                                resolve({ online: false, players: 0, maxPlayers: 0 });
                            }
                        } catch {
                            resolve({ online: false, players: 0, maxPlayers: 0 });
                        }
                    });
                }).on('error', () => {
                    resolve({ online: false, players: 0, maxPlayers: 0 });
                }).on('timeout', () => {
                    resolve({ online: false, players: 0, maxPlayers: 0 });
                });
            });
        }
    } catch (error) {
        return { online: false, players: 0, maxPlayers: 0 };
    }
});

// ==================== Profile Management ====================
ipcMain.handle('get-profiles', () => {
    return store.get('profiles', []);
});

ipcMain.handle('save-profile', (event, profile) => {
    const profiles = store.get('profiles', []);
    const existingIndex = profiles.findIndex(p => p.id === profile.id);

    if (existingIndex >= 0) {
        profiles[existingIndex] = profile;
    } else {
        profile.id = Date.now().toString();
        profiles.push(profile);
    }

    store.set('profiles', profiles);
    return { success: true, profiles };
});

ipcMain.handle('delete-profile', (event, profileId) => {
    const profiles = store.get('profiles', []);
    const filtered = profiles.filter(p => p.id !== profileId);
    store.set('profiles', filtered);
    return { success: true, profiles: filtered };
});

ipcMain.handle('set-active-profile', (event, profileId) => {
    store.set('activeProfile', profileId);
    return { success: true };
});

ipcMain.handle('get-active-profile', () => {
    return store.get('activeProfile');
});

// ==================== Config Management ====================
// Get user data config path (writable)
function getServersConfigPath() {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'servers.json');
}

// Get default config path (bundled with app)
function getDefaultServersConfigPath() {
    // When packaged, use resources path; in dev, use __dirname
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'app.asar', 'config', 'servers.json');
    }
    return path.join(__dirname, 'config', 'servers.json');
}

ipcMain.handle('get-servers-config', () => {
    try {
        const userConfigPath = getServersConfigPath();

        // If user config exists, use it
        if (fs.existsSync(userConfigPath)) {
            const config = JSON.parse(fs.readFileSync(userConfigPath, 'utf-8'));
            return config;
        }

        // Otherwise, try to copy from default config
        const defaultConfigPath = getDefaultServersConfigPath();
        if (fs.existsSync(defaultConfigPath)) {
            const defaultConfig = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf-8'));
            // Save to user data for future use
            fs.writeFileSync(userConfigPath, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }

        // No config found, create empty one
        const emptyConfig = { servers: [], settings: {} };
        fs.writeFileSync(userConfigPath, JSON.stringify(emptyConfig, null, 2));
        return emptyConfig;
    } catch (error) {
        console.error('Error loading servers config:', error);
        return { servers: [], settings: {} };
    }
});

ipcMain.handle('save-servers-config', (event, config) => {
    try {
        const userConfigPath = getServersConfigPath();
        fs.writeFileSync(userConfigPath, JSON.stringify(config, null, 2));
        console.log('Saved servers config to:', userConfigPath);
        return { success: true };
    } catch (error) {
        console.error('Error saving servers config:', error);
        return { success: false, error: error.message };
    }
});

// ==================== Auto-Update ====================
ipcMain.handle('check-for-updates', async () => {
    try {
        const result = await autoUpdater.checkForUpdates();
        return { available: result?.updateInfo?.version !== app.getVersion() };
    } catch (error) {
        return { available: false, error: error.message };
    }
});

ipcMain.handle('download-update', async () => {
    try {
        await autoUpdater.downloadUpdate();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall();
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

// Auto-updater events
autoUpdater.on('update-available', (info) => {
    if (mainWindow) {
        mainWindow.webContents.send('update-available', info);
    }
});

autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) {
        mainWindow.webContents.send('update-downloaded', info);
    }
});

autoUpdater.on('download-progress', (progress) => {
    if (mainWindow) {
        mainWindow.webContents.send('update-progress', progress);
    }
});

// ==================== Update FiveM ====================
ipcMain.handle('update-fivem', async () => {
    const fivemPath = store.get('fivemPath');

    if (!fivemPath) {
        return { success: false, error: 'FiveM path not configured' };
    }

    try {
        // Open FiveM which will auto-check for updates
        const fivemProcess = spawn(fivemPath, [], {
            detached: true,
            stdio: 'ignore'
        });
        fivemProcess.unref();

        return { success: true, message: 'FiveM opened for update check' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// ==================== Utility ====================
ipcMain.handle('get-last-settings', () => {
    return {
        server: store.get('lastServer'),
        pureMode: store.get('lastPureMode', 0),
        playerName: store.get('lastPlayerName', '')
    };
});
