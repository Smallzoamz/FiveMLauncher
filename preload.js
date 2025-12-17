const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods for renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // Window controls
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),

    // FiveM Path
    detectFiveMPath: () => ipcRenderer.invoke('detect-fivem-path'),
    browseFiveMPath: () => ipcRenderer.invoke('browse-fivem-path'),
    getFiveMPath: () => ipcRenderer.invoke('get-fivem-path'),

    // Game Build
    getCurrentGameBuild: () => ipcRenderer.invoke('get-current-game-build'),
    getKnownGameBuilds: () => ipcRenderer.invoke('get-known-game-builds'),
    addGameBuild: (build) => ipcRenderer.invoke('add-game-build', build),
    setGameBuild: (build) => ipcRenderer.invoke('set-game-build', build),
    checkFiveMRunning: () => ipcRenderer.invoke('check-fivem-running'),

    // Player Name
    getFiveMPlayerName: () => ipcRenderer.invoke('get-fivem-player-name'),
    setFiveMPlayerName: (name) => ipcRenderer.invoke('set-fivem-player-name', name),

    // Launch
    launchFiveM: (options) => ipcRenderer.invoke('launch-fivem', options),
    launchFiveMTest: () => ipcRenderer.invoke('launch-fivem-test'),

    // Server Status
    checkServerStatus: (serverAddress) => ipcRenderer.invoke('check-server-status', serverAddress),

    // Profiles
    getProfiles: () => ipcRenderer.invoke('get-profiles'),
    saveProfile: (profile) => ipcRenderer.invoke('save-profile', profile),
    deleteProfile: (profileId) => ipcRenderer.invoke('delete-profile', profileId),
    setActiveProfile: (profileId) => ipcRenderer.invoke('set-active-profile', profileId),
    getActiveProfile: () => ipcRenderer.invoke('get-active-profile'),

    // Config
    getServersConfig: () => ipcRenderer.invoke('get-servers-config'),
    saveServersConfig: (config) => ipcRenderer.invoke('save-servers-config', config),

    // Updates
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    installUpdate: () => ipcRenderer.invoke('install-update'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    updateFiveM: () => ipcRenderer.invoke('update-fivem'),

    // Settings
    getLastSettings: () => ipcRenderer.invoke('get-last-settings'),

    // Event listeners
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, info) => callback(info)),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event, info) => callback(info)),
    onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (event, progress) => callback(progress)),
    onFiveMExited: (callback) => ipcRenderer.on('fivem-exited', () => callback()),
    onGameBuildsUpdated: (callback) => ipcRenderer.on('game-builds-updated', (event, builds) => callback(builds))
});
