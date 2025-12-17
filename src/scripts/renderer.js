// ==================== DOM Elements ====================
const elements = {
    // Window controls
    btnMinimize: document.getElementById('btn-minimize'),
    btnMaximize: document.getElementById('btn-maximize'),
    btnClose: document.getElementById('btn-close'),

    // Navigation
    navTabs: document.querySelectorAll('.nav-tab'),
    tabContents: document.querySelectorAll('.tab-content'),

    // Sidebar
    statusDot: document.getElementById('status-dot'),
    statusLabel: document.getElementById('status-label'),
    serverName: document.getElementById('server-name'),
    playerCount: document.getElementById('player-count'),
    gameBuildSelect: document.getElementById('game-build-select'),
    requiredBuild: document.getElementById('required-build'),
    pureModeSelect: document.getElementById('pure-mode-select'),
    btnLaunch: document.getElementById('btn-launch'),
    btnGameSettings: document.getElementById('btn-game-settings'),
    appVersion: document.getElementById('app-version'),
    updateBadge: document.getElementById('update-badge'),

    // Hero
    heroTitle: document.querySelector('.hero-title'),
    heroSubtitle: document.querySelector('.hero-subtitle'),

    // Servers Tab
    serversList: document.getElementById('servers-list'),
    btnAddServerModal: document.getElementById('btn-add-server-modal'),

    // Settings Tab
    fivemPathDisplay: document.getElementById('fivem-path-display'),
    btnBrowsePath: document.getElementById('btn-browse-path'),
    btnDetectPath: document.getElementById('btn-detect-path'),
    fivemPlayerName: document.getElementById('fivem-player-name'),
    btnApplyPlayerName: document.getElementById('btn-apply-player-name'),
    btnTestFiveM: document.getElementById('btn-test-fivem'),
    profileSelect: document.getElementById('profile-select'),
    profileName: document.getElementById('profile-name'),
    btnCopyProfile: document.getElementById('btn-copy-profile'),
    btnSaveProfile: document.getElementById('btn-save-profile'),
    btnDeleteProfile: document.getElementById('btn-delete-profile'),
    btnCheckUpdate: document.getElementById('btn-check-update'),
    btnUpdateFiveM: document.getElementById('btn-update-fivem'),

    // Add Server Modal
    addServerModal: document.getElementById('add-server-modal'),
    btnCloseAddServer: document.getElementById('btn-close-add-server'),
    btnCancelAddServer: document.getElementById('btn-cancel-add-server'),
    btnConfirmAddServer: document.getElementById('btn-confirm-add-server'),
    newServerName: document.getElementById('new-server-name'),
    newServerAddress: document.getElementById('new-server-address'),

    // Toast
    toastContainer: document.getElementById('toast-container')
};

// ==================== State ====================
let serversConfig = { servers: [], settings: {} };
let profiles = [];
let selectedServer = null;
let serverStatusInterval = null;
let isConnected = false;
let serverRequiredBuild = null;

// ==================== Initialize ====================
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
});

async function initializeApp() {
    // Set app version
    const version = await window.electronAPI.getAppVersion();
    elements.appVersion.textContent = `Version ${version}`;

    // Initialize
    initWindowControls();
    initNavigation();
    await loadFiveMPath();
    await loadGameBuilds();
    await loadFiveMPlayerName();
    await loadServersConfig();
    await loadProfiles();
    await loadLastSettings();

    setupEventListeners();
    startServerStatusCheck();
    setupUpdateListeners();
    setupFiveMExitListener();
}

// ==================== Window Controls ====================
function initWindowControls() {
    elements.btnMinimize.addEventListener('click', () => window.electronAPI.minimizeWindow());
    elements.btnMaximize.addEventListener('click', () => window.electronAPI.maximizeWindow());
    elements.btnClose.addEventListener('click', () => window.electronAPI.closeWindow());
}

// ==================== Navigation ====================
function initNavigation() {
    elements.navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;

            // Update active tab
            elements.navTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Update active content
            elements.tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `tab-${tabName}`) {
                    content.classList.add('active');
                }
            });
        });
    });
}

// ==================== FiveM Path ====================
async function loadFiveMPath() {
    let path = await window.electronAPI.getFiveMPath();

    if (!path) {
        const result = await window.electronAPI.detectFiveMPath();
        if (result.success) path = result.path;
    }

    if (path) {
        elements.fivemPathDisplay.value = path;
    } else {
        elements.fivemPathDisplay.value = 'Not configured';
    }
}

async function browseFiveMPath() {
    const result = await window.electronAPI.browseFiveMPath();
    if (result.success) {
        elements.fivemPathDisplay.value = result.path;
        showToast('FiveM path saved!', 'success');
    } else if (result.error) {
        showToast(result.error, 'error');
    }
}

async function detectFiveMPath() {
    const result = await window.electronAPI.detectFiveMPath();
    if (result.success) {
        elements.fivemPathDisplay.value = result.path;
        showToast('FiveM detected!', 'success');
    } else {
        showToast('FiveM not found', 'error');
    }
}

// ==================== Game Builds ====================
async function loadGameBuilds() {
    // Load known builds
    const knownBuilds = await window.electronAPI.getKnownGameBuilds();

    // Load current build from CitizenFX.ini
    const currentBuildResult = await window.electronAPI.getCurrentGameBuild();
    const currentBuild = currentBuildResult.success ? currentBuildResult.build : null;

    // Populate dropdown
    populateGameBuildDropdown(knownBuilds, currentBuild);
}

function populateGameBuildDropdown(builds, currentBuild) {
    elements.gameBuildSelect.innerHTML = '';

    if (builds.length === 0) {
        elements.gameBuildSelect.innerHTML = '<option value="">No builds available</option>';
        return;
    }

    builds.forEach(build => {
        const option = document.createElement('option');
        option.value = build;
        option.textContent = `Build ${build}`;
        if (build === currentBuild) {
            option.selected = true;
        }
        elements.gameBuildSelect.appendChild(option);
    });

    // If no current build matches, select the first one
    if (!currentBuild || !builds.includes(currentBuild)) {
        elements.gameBuildSelect.value = builds[builds.length - 1]; // Select latest
    }
}

async function onGameBuildChange() {
    const selectedBuild = elements.gameBuildSelect.value;
    if (!selectedBuild) return;

    const result = await window.electronAPI.setGameBuild(selectedBuild);
    if (result.success) {
        showToast(`Game Build set to ${selectedBuild}`, 'success');
    } else {
        showToast('Failed to set game build: ' + result.error, 'error');
    }
}

// ==================== FiveM Player Name ====================
async function loadFiveMPlayerName() {
    try {
        const result = await window.electronAPI.getFiveMPlayerName();
        if (result.success && result.playerName) {
            elements.fivemPlayerName.value = result.playerName;
            elements.fivemPlayerName.placeholder = 'Player Name';
        } else {
            elements.fivemPlayerName.value = '';
            elements.fivemPlayerName.placeholder = 'ไม่พบชื่อผู้เล่น (เปิด FiveM ก่อนอย่างน้อย 1 ครั้ง)';
        }
    } catch (error) {
        console.error('Error loading player name:', error);
        elements.fivemPlayerName.value = '';
        elements.fivemPlayerName.placeholder = 'Error loading player name';
    }
}

async function applyPlayerName() {
    const playerName = elements.fivemPlayerName.value.trim();
    if (!playerName) {
        showToast('กรุณาใส่ชื่อผู้เล่น', 'error');
        return;
    }

    // Check if FiveM is running
    const isRunning = await window.electronAPI.checkFiveMRunning();
    if (isRunning) {
        showToast('กรุณาปิด FiveM ก่อนเปลี่ยนชื่อ', 'error');
        return;
    }

    elements.btnApplyPlayerName.disabled = true;
    elements.btnApplyPlayerName.textContent = 'Applying...';

    try {
        const result = await window.electronAPI.setFiveMPlayerName(playerName);
        if (result.success) {
            showToast(`Player Name เปลี่ยนเป็น "${playerName}" แล้ว!`, 'success');
        } else {
            showToast('Error: ' + result.error, 'error');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }

    elements.btnApplyPlayerName.disabled = false;
    elements.btnApplyPlayerName.textContent = 'Apply';
}

async function testFiveM() {
    const result = await window.electronAPI.launchFiveMTest();
    if (result.success) {
        showToast('กำลังเปิด FiveM เพื่อทดสอบ...', 'success');
    } else {
        showToast('Error: ' + result.error, 'error');
    }
}

function setupFiveMExitListener() {
    window.electronAPI.onFiveMExited(() => {
        console.log('FiveM exited');
        isConnected = false;

        // Update status display
        if (selectedServer) {
            checkServerStatus(selectedServer);
        }

        // Reload game builds in case a new version was downloaded
        loadGameBuilds();

        showToast('FiveM ปิดแล้ว', 'info');
    });

    window.electronAPI.onGameBuildsUpdated((builds) => {
        console.log('Game builds updated:', builds);
        const currentBuild = elements.gameBuildSelect.value;
        populateGameBuildDropdown(builds, currentBuild);
        showToast('พบ Game Build ใหม่!', 'success');
    });
}

// ==================== Servers ====================
async function loadServersConfig() {
    serversConfig = await window.electronAPI.getServersConfig();
    renderServersList();

    // Select first server by default
    if (serversConfig.servers.length > 0 && !selectedServer) {
        selectServer(serversConfig.servers[0]);
    }
}

function renderServersList() {
    elements.serversList.innerHTML = '';

    serversConfig.servers.forEach(server => {
        const div = document.createElement('div');
        div.className = `server-item${selectedServer?.id === server.id ? ' selected' : ''}`;
        div.innerHTML = `
            <div class="server-item-status" id="status-${server.id}"></div>
            <div class="server-item-info">
                <div class="server-item-name">${server.name}</div>
                <div class="server-item-address">${server.address}</div>
            </div>
            <div class="server-item-players" id="players-${server.id}">-/-</div>
            <div class="server-item-settings">
                ${server.savedGameBuild ? `<span class="server-build">B${server.savedGameBuild}</span>` : ''}
                ${server.savedPureMode !== undefined ? `<span class="server-pure">P${server.savedPureMode}</span>` : ''}
            </div>
            <div class="server-item-actions">
                <button class="btn btn-danger btn-sm" onclick="deleteServer('${server.id}')">🗑️</button>
            </div>
        `;
        div.addEventListener('click', (e) => {
            if (!e.target.closest('.btn')) {
                selectServer(server);
            }
        });
        elements.serversList.appendChild(div);
    });
}

function selectServer(server) {
    selectedServer = server;

    // Update UI
    elements.serverName.textContent = server.name;
    elements.heroTitle.textContent = server.name.toUpperCase();
    elements.heroSubtitle.textContent = server.description || 'FiveM Server';

    // Auto-apply saved settings for this server
    if (server.savedGameBuild) {
        elements.gameBuildSelect.value = server.savedGameBuild;
        // Also set in CitizenFX.ini
        window.electronAPI.setGameBuild(server.savedGameBuild);
    }
    if (server.savedPureMode !== undefined) {
        elements.pureModeSelect.value = server.savedPureMode;
    }

    // Update selection in list
    document.querySelectorAll('.server-item').forEach(item => {
        item.classList.remove('selected');
    });
    const selectedItem = document.querySelector(`.server-item-name`);
    if (selectedItem) {
        const parent = Array.from(document.querySelectorAll('.server-item')).find(
            item => item.querySelector('.server-item-name')?.textContent === server.name
        );
        if (parent) parent.classList.add('selected');
    }

    // Check server status
    checkServerStatus(server);
}

async function checkServerStatus(server) {
    if (!server) return;

    // Update sidebar status
    elements.statusDot.className = 'status-indicator';
    elements.statusLabel.textContent = 'CHECKING...';

    const status = await window.electronAPI.checkServerStatus(server.address);

    if (status.online) {
        elements.statusDot.classList.add('online');

        // Show connected status if user is connected to this server
        if (isConnected) {
            elements.statusLabel.textContent = 'CONNECTED';
        } else {
            elements.statusLabel.textContent = 'ONLINE';
        }

        elements.playerCount.textContent = `${status.players}/${status.maxPlayers}`;

        // Update server required build indicator
        if (status.gameVersion) {
            serverRequiredBuild = status.gameVersion;
            elements.requiredBuild.textContent = `(Server: ${status.gameVersion})`;
        } else {
            elements.requiredBuild.textContent = '';
        }

        // Update servers list item
        const statusEl = document.getElementById(`status-${server.id}`);
        const playersEl = document.getElementById(`players-${server.id}`);
        if (statusEl) statusEl.classList.add('online');
        if (playersEl) playersEl.textContent = `${status.players}/${status.maxPlayers}`;
    } else {
        elements.statusLabel.textContent = 'OFFLINE';
        elements.playerCount.textContent = '0/0';
        elements.requiredBuild.textContent = '';
    }
}

function startServerStatusCheck() {
    // Check immediately
    if (selectedServer) checkServerStatus(selectedServer);

    // Set interval
    serverStatusInterval = setInterval(() => {
        if (selectedServer) checkServerStatus(selectedServer);
    }, 30000);
}

async function saveServerSettings(serverId, gameBuild, pureMode) {
    // Find the server in config
    const serverIndex = serversConfig.servers.findIndex(s => s.id === serverId);
    if (serverIndex === -1) return;

    // Update saved settings
    serversConfig.servers[serverIndex].savedGameBuild = gameBuild;
    serversConfig.servers[serverIndex].savedPureMode = pureMode;

    // Also update selectedServer reference
    if (selectedServer && selectedServer.id === serverId) {
        selectedServer.savedGameBuild = gameBuild;
        selectedServer.savedPureMode = pureMode;
    }

    // Save to file
    await window.electronAPI.saveServersConfig(serversConfig);

    // Refresh server list UI
    renderServersList();

    console.log(`Saved settings for ${serverId}: Build ${gameBuild}, Pure ${pureMode}`);
}

async function addServer() {
    const name = elements.newServerName.value.trim();
    const address = elements.newServerAddress.value.trim();

    if (!name || !address) {
        showToast('Please fill all fields', 'error');
        return;
    }

    const newServer = {
        id: `server_${Date.now()}`,
        name,
        address,
        description: '',
        maxPlayers: 100
    };

    serversConfig.servers.push(newServer);
    await window.electronAPI.saveServersConfig(serversConfig);

    elements.newServerName.value = '';
    elements.newServerAddress.value = '';
    hideModal(elements.addServerModal);

    await loadServersConfig();
    showToast('Server added!', 'success');
}

window.deleteServer = async function (serverId) {
    serversConfig.servers = serversConfig.servers.filter(s => s.id !== serverId);
    await window.electronAPI.saveServersConfig(serversConfig);

    if (selectedServer?.id === serverId) {
        selectedServer = serversConfig.servers[0] || null;
        if (selectedServer) selectServer(selectedServer);
    }

    renderServersList();
    showToast('Server removed', 'success');
};

// ==================== Profiles ====================
async function loadProfiles() {
    profiles = await window.electronAPI.getProfiles();

    elements.profileSelect.innerHTML = '<option value="">-- New Profile --</option>';
    profiles.forEach(profile => {
        const option = document.createElement('option');
        option.value = profile.id;
        option.textContent = profile.name;
        elements.profileSelect.appendChild(option);
    });

    const activeProfileId = await window.electronAPI.getActiveProfile();
    if (activeProfileId) {
        elements.profileSelect.value = activeProfileId;
        applyProfile(activeProfileId);
    }
}

function applyProfile(profileId) {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) {
        console.log('Profile not found:', profileId);
        return;
    }

    console.log('Applying profile:', profile);

    // Set the profile name in input (for copying)
    elements.profileName.value = profile.name;

    // Set pure mode
    if (profile.pureMode !== undefined) {
        elements.pureModeSelect.value = profile.pureMode;
        console.log('Set pure mode to:', profile.pureMode);
    }

    // Select the server if saved in profile
    if (profile.serverAddress) {
        const server = serversConfig.servers.find(s => s.address === profile.serverAddress);
        if (server) {
            selectServer(server);
            console.log('Selected server:', server.name);
        }
    }

    // Set this as active profile
    window.electronAPI.setActiveProfile(profileId);

    showToast(`Profile "${profile.name}" applied! กด 📋 เพื่อคัดลอกชื่อ`, 'success');
}

async function saveProfile() {
    const name = elements.profileName.value.trim();
    if (!name) {
        showToast('Enter profile name', 'error');
        return;
    }

    const profile = {
        id: elements.profileSelect.value || undefined,
        name,
        serverAddress: selectedServer?.address,
        pureMode: parseInt(elements.pureModeSelect.value)
    };

    const result = await window.electronAPI.saveProfile(profile);
    if (result.success) {
        await loadProfiles();
        showToast('Profile saved!', 'success');
    }
}

async function deleteProfile() {
    const profileId = elements.profileSelect.value;
    if (!profileId) {
        showToast('Select a profile', 'error');
        return;
    }

    await window.electronAPI.deleteProfile(profileId);
    elements.profileSelect.value = '';
    elements.profileName.value = '';
    await loadProfiles();
    showToast('Profile deleted', 'success');
}

async function loadLastSettings() {
    const settings = await window.electronAPI.getLastSettings();
    if (settings.pureMode !== undefined) {
        elements.pureModeSelect.value = settings.pureMode;
    }
}

// ==================== Launch ====================
async function launchFiveM() {
    if (!selectedServer) {
        showToast('Select a server first', 'error');
        return;
    }

    const pureMode = parseInt(elements.pureModeSelect.value);
    const gameBuild = elements.gameBuildSelect.value;

    elements.btnLaunch.disabled = true;
    elements.btnLaunch.querySelector('.play-text').textContent = 'LAUNCHING...';

    const result = await window.electronAPI.launchFiveM({
        serverAddress: selectedServer.address,
        pureMode
    });

    if (result.success) {
        showToast('FiveM is launching!', 'success');
        // Mark as connected after successful launch
        isConnected = true;

        // Save current settings to this server
        await saveServerSettings(selectedServer.id, gameBuild, pureMode);

        // Update status to show connected
        setTimeout(() => {
            if (selectedServer) checkServerStatus(selectedServer);
        }, 2000);
    } else {
        showToast('Launch failed: ' + result.error, 'error');
    }

    setTimeout(() => {
        elements.btnLaunch.disabled = false;
        elements.btnLaunch.querySelector('.play-text').textContent = 'PLAY';
    }, 3000);
}

// ==================== Updates ====================
function setupUpdateListeners() {
    window.electronAPI.onUpdateAvailable((info) => {
        elements.updateBadge.style.display = 'flex';
        showToast(`Update ${info.version} available!`, 'info');
    });

    window.electronAPI.onUpdateDownloaded((info) => {
        showToast('Update downloaded. Restart to install.', 'success');
    });
}

async function checkForUpdates() {
    showToast('Checking for updates...', 'info');
    const result = await window.electronAPI.checkForUpdates();
    if (!result.available) {
        showToast('Launcher is up to date', 'success');
    }
}

async function updateFiveM() {
    showToast('Opening FiveM for update...', 'info');
    await window.electronAPI.updateFiveM();
}

// ==================== Copy Profile Name ====================
function copyProfileName() {
    const name = elements.profileName.value.trim();
    if (!name) {
        showToast('กรุณากรอกชื่อ Profile ก่อน', 'error');
        return;
    }

    navigator.clipboard.writeText(name).then(() => {
        showToast(`คัดลอก "${name}" แล้ว! ไปวางใน FiveM Settings → Player Name`, 'success');
    }).catch(() => {
        showToast('ไม่สามารถคัดลอกได้', 'error');
    });
}

// ==================== Modals ====================
function showModal(modal) {
    modal.classList.add('active');
}

function hideModal(modal) {
    modal.classList.remove('active');
}

// ==================== Toast ====================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ==================== Event Listeners ====================
function setupEventListeners() {
    // Settings tab
    elements.btnBrowsePath.addEventListener('click', browseFiveMPath);
    elements.btnDetectPath.addEventListener('click', detectFiveMPath);
    elements.btnApplyPlayerName.addEventListener('click', applyPlayerName);
    elements.btnTestFiveM.addEventListener('click', testFiveM);
    elements.btnCopyProfile.addEventListener('click', copyProfileName);
    elements.btnSaveProfile.addEventListener('click', saveProfile);
    elements.btnDeleteProfile.addEventListener('click', deleteProfile);
    elements.btnCheckUpdate.addEventListener('click', checkForUpdates);
    elements.btnUpdateFiveM.addEventListener('click', updateFiveM);

    elements.profileSelect.addEventListener('change', () => {
        const id = elements.profileSelect.value;
        if (id) applyProfile(id);
        else elements.profileName.value = '';
    });

    // Game Build
    elements.gameBuildSelect.addEventListener('change', onGameBuildChange);

    // Launch
    elements.btnLaunch.addEventListener('click', launchFiveM);
    elements.btnGameSettings.addEventListener('click', () => {
        document.querySelector('.nav-tab[data-tab="settings"]').click();
    });

    // Add Server Modal
    elements.btnAddServerModal.addEventListener('click', () => showModal(elements.addServerModal));
    elements.btnCloseAddServer.addEventListener('click', () => hideModal(elements.addServerModal));
    elements.btnCancelAddServer.addEventListener('click', () => hideModal(elements.addServerModal));
    elements.btnConfirmAddServer.addEventListener('click', addServer);

    elements.addServerModal.addEventListener('click', (e) => {
        if (e.target === elements.addServerModal) hideModal(elements.addServerModal);
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideModal(elements.addServerModal);
        }
        if (e.key === 'Enter' && !elements.addServerModal.classList.contains('active')) {
            if (document.activeElement.tagName !== 'INPUT') {
                launchFiveM();
            }
        }
    });
}
