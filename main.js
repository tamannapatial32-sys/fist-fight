/**
 * Main Controller for "Fist Fight"
 * Glues Teachable Machine AI, Game Engine, Audio, and HUD UI together.
 */

let game = null;
let currentMode = 'WEBCAM'; // 'WEBCAM' | 'KEYBOARD'

// HUD DOM Elements
const elP1Health = document.getElementById('p1HealthBar');
const elCpuHealth = document.getElementById('cpuHealthBar');
const elP1Stamina = document.getElementById('p1StaminaBar');
const elP1Super = document.getElementById('p1SuperBar');
const elCpuSuper = document.getElementById('cpuSuperBar');
const elTimer = document.getElementById('roundTimer');
const elRoundText = document.getElementById('roundText');
const elScore = document.getElementById('scoreText');
const elCombo = document.getElementById('comboText');
const elP1Wins = document.getElementById('p1Wins');
const elCpuWins = document.getElementById('cpuWins');

// Model & Webcam DOM Elements
const webcamContainer = document.getElementById('webcam-container');
const labelContainer = document.getElementById('label-container');
const actionBadge = document.getElementById('detectedActionBadge');
const statusMsg = document.getElementById('statusMsg');
const startBtn = document.getElementById('startBtn');
const modelModal = document.getElementById('modelModal');

/**
 * Direct implementation of the user's requested snippet function:
 * async function init()
 */
async function init() {
    if (window.soundEngine) {
        window.soundEngine.init();
    }

    startBtn.disabled = true;
    startBtn.textContent = 'Loading...';
    statusMsg.textContent = 'Initializing Camera & Model...';

    const modelURLInput = document.getElementById('modelUrlInput');
    const customURL = (modelURLInput && modelURLInput.value.trim()) ? modelURLInput.value.trim() : './my_model/';

    try {
        // 1. Setup webcam canvas
        const webcamCanvas = await window.tmManager.setupWebcam(220, 220, true);
        webcamContainer.innerHTML = '';
        webcamContainer.appendChild(webcamCanvas);

        // 2. Load model
        const success = await window.tmManager.loadFromURL(customURL);

        if (!success) {
            statusMsg.innerHTML = `<span style="color:#ff3366;">Could not load from "${customURL}".</span> <button class="arcade-btn-small" onclick="openModelModal()">Configure Model</button>`;
            startBtn.disabled = false;
            startBtn.textContent = 'Retry Start';
            return;
        }

        // 3. Build label containers (as in user's snippet)
        labelContainer.innerHTML = '';
        const maxPredictions = window.tmManager.maxPredictions;
        for (let i = 0; i < maxPredictions; i++) {
            const row = document.createElement('div');
            row.className = 'prediction-row';
            row.innerHTML = `
                <div class="pred-label">${window.tmManager.classNames[i]}</div>
                <div class="pred-bar-bg"><div class="pred-bar-fill" id="pred-bar-${i}"></div></div>
                <div class="pred-val" id="pred-val-${i}">0%</div>
            `;
            labelContainer.appendChild(row);
        }

        // 4. Update dynamic mapping UI in modal
        updateMappingControls();

        // 5. Start prediction loop
        window.tmManager.startLoop();

        statusMsg.innerHTML = '<span style="color:#00f0ff;">Model Active! Throw punches or guard!</span>';
        startBtn.textContent = 'Restart Match';
        startBtn.disabled = false;

        // 6. Start the game match
        game.startMatch();

    } catch (err) {
        console.error("Initialization failed:", err);
        statusMsg.innerHTML = `<span style="color:#ff3366;">Error: ${err.message}. You can switch to Keyboard Demo Mode below.</span>`;
        startBtn.disabled = false;
        startBtn.textContent = 'Start';
    }
}

// Window load bootstrap
window.addEventListener('DOMContentLoaded', () => {
    // Initialize Canvas Game
    game = new FistFightGame('arenaCanvas');
    game.draw(); // draw initial idle frame

    // Wire TM manager callbacks
    window.tmManager.onStatusChange = (msg, isErr) => {
        statusMsg.innerHTML = isErr ? `<span style="color:#ff3366;">${msg}</span>` : `<span style="color:#00f0ff;">${msg}</span>`;
    };

    window.tmManager.onPredictionsUpdate = (predictions, topIndex) => {
        // Update prediction progress bars
        for (let i = 0; i < predictions.length; i++) {
            const bar = document.getElementById(`pred-bar-${i}`);
            const val = document.getElementById(`pred-val-${i}`);
            if (bar && val) {
                const pct = Math.round(predictions[i].probability * 100);
                bar.style.width = `${pct}%`;
                val.textContent = `${pct}%`;
                if (i === topIndex && predictions[i].probability >= window.tmManager.confidenceThreshold) {
                    bar.classList.add('top-active');
                } else {
                    bar.classList.remove('top-active');
                }
            }
        }
    };

    window.tmManager.onActionCallback = (action, confidence, labelName) => {
        updateActionBadge(action, labelName);

        if (action === 'PUNCH') {
            game.playerPunch();
        } else if (action === 'BLOCK') {
            game.playerBlock(true);
        } else {
            game.playerBlock(false);
        }
    };

    // Bind UI HUD Loop
    requestAnimationFrame(updateHUD);

    // Bind Keyboard shortcuts
    setupKeyboardControls();

    // Bind Modal & Settings
    setupSettingsModal();
});

// Update Action Badge HUD
function updateActionBadge(action, label) {
    if (!actionBadge) return;
    actionBadge.className = 'action-badge';

    if (action === 'PUNCH') {
        actionBadge.textContent = `👊 PUNCH (${label})`;
        actionBadge.classList.add('badge-punch');
    } else if (action === 'BLOCK') {
        actionBadge.textContent = `🛡️ BLOCK (${label})`;
        actionBadge.classList.add('badge-block');
    } else {
        actionBadge.textContent = `⏳ IDLE`;
        actionBadge.classList.add('badge-idle');
    }
}

// HUD Rendering Loop
function updateHUD() {
    if (game) {
        // Health
        const p1Pct = Math.max(0, (game.player.health / game.player.maxHealth) * 100);
        const cpuPct = Math.max(0, (game.cpu.health / game.cpu.maxHealth) * 100);
        elP1Health.style.width = `${p1Pct}%`;
        elCpuHealth.style.width = `${cpuPct}%`;

        // Health bar alert color
        elP1Health.style.backgroundColor = p1Pct < 30 ? '#ff0055' : (p1Pct < 60 ? '#ffe600' : '#00f0ff');
        elCpuHealth.style.backgroundColor = cpuPct < 30 ? '#ff0055' : (cpuPct < 60 ? '#ffe600' : '#ff0055');

        // Stamina
        const stamPct = Math.max(0, (game.player.stamina / game.player.maxStamina) * 100);
        elP1Stamina.style.width = `${stamPct}%`;

        // Super Meter
        elP1Super.style.width = `${game.player.superMeter}%`;
        if (game.player.superMeter >= 100) {
            elP1Super.classList.add('super-ready');
        } else {
            elP1Super.classList.remove('super-ready');
        }

        elCpuSuper.style.width = `${game.cpu.superMeter}%`;

        // Timer & Round
        elTimer.textContent = Math.ceil(game.roundTime);
        elRoundText.textContent = `ROUND ${game.round}`;

        // Score & Combos
        elScore.textContent = game.score;
        if (game.comboCount > 1) {
            elCombo.textContent = `${game.comboCount}x COMBO!`;
            elCombo.style.opacity = '1';
        } else {
            elCombo.style.opacity = '0';
        }

        // Wins (dots)
        elP1Wins.textContent = '★'.repeat(game.playerWins) + '☆'.repeat(2 - game.playerWins);
        elCpuWins.textContent = '★'.repeat(game.cpuWins) + '☆'.repeat(2 - game.cpuWins);
    }

    requestAnimationFrame(updateHUD);
}

// Keyboard / Demo Controls
function setupKeyboardControls() {
    window.addEventListener('keydown', (e) => {
        // Prevent scrolling on space / arrow down
        if (['Space', 'ArrowDown', 'ArrowUp'].includes(e.code)) {
            e.preventDefault();
        }

        // Unlock audio on first interaction
        if (window.soundEngine && !window.soundEngine.initialized) {
            window.soundEngine.init();
        }

        if (e.code === 'Space' || e.key.toLowerCase() === 'f') {
            updateActionBadge('PUNCH', 'Key F/Space');
            game.playerPunch();
        } else if (e.code === 'KeyB' || e.code === 'ArrowDown') {
            updateActionBadge('BLOCK', 'Key B/Down');
            game.playerBlock(true);
        } else if (e.code === 'KeyM') {
            toggleMuteAudio();
        } else if (e.code === 'Enter') {
            if (game.matchState === 'READY' || game.matchState === 'GAME_OVER') {
                game.startMatch();
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyB' || e.code === 'ArrowDown') {
            updateActionBadge('IDLE', 'Key Release');
            game.playerBlock(false);
        }
    });
}

// Audio mute toggle
function toggleMuteAudio() {
    if (window.soundEngine) {
        const isMuted = window.soundEngine.toggleMute();
        const muteBtn = document.getElementById('muteBtn');
        if (muteBtn) {
            muteBtn.textContent = isMuted ? '🔇 Unmute' : '🔊 Sound On';
        }
    }
}

// Settings Modal & File Uploaders
function openModelModal() {
    modelModal.classList.add('modal-open');
}

function closeModelModal() {
    modelModal.classList.remove('modal-open');
}

function setupSettingsModal() {
    const thresholdSlider = document.getElementById('thresholdSlider');
    const thresholdVal = document.getElementById('thresholdVal');
    if (thresholdSlider) {
        thresholdSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            window.tmManager.confidenceThreshold = val;
            if (thresholdVal) thresholdVal.textContent = `${Math.round(val * 100)}%`;
        });
    }

    const diffSelect = document.getElementById('difficultySelect');
    if (diffSelect) {
        diffSelect.addEventListener('change', (e) => {
            if (game) game.cpuDifficulty = e.target.value;
        });
    }

    // File Upload handler (loadFromFiles)
    const fileModel = document.getElementById('fileModel');
    const fileWeights = document.getElementById('fileWeights');
    const fileMetadata = document.getElementById('fileMetadata');
    const btnLoadUploads = document.getElementById('btnLoadUploads');

    if (btnLoadUploads) {
        btnLoadUploads.addEventListener('click', async () => {
            const mFile = fileModel.files[0];
            const wFile = fileWeights.files[0];
            const metaFile = fileMetadata.files[0];

            if (!mFile || !wFile || !metaFile) {
                alert('Please select all 3 files: model.json, weights.bin, and metadata.json!');
                return;
            }

            try {
                btnLoadUploads.disabled = true;
                btnLoadUploads.textContent = 'Loading files...';
                await window.tmManager.loadFromFiles(mFile, wFile, metaFile);
                btnLoadUploads.textContent = 'Loaded!';
                closeModelModal();
                if (!window.tmManager.isRunning) {
                    init();
                }
            } catch (err) {
                alert('Failed to load files: ' + err.message);
                btnLoadUploads.textContent = 'Load Uploaded Model';
            } finally {
                btnLoadUploads.disabled = false;
            }
        });
    }
}

// Generate dropdowns for custom mapping of each class
function updateMappingControls() {
    const container = document.getElementById('classMappingContainer');
    if (!container) return;

    container.innerHTML = '<h4>Class Gesture Mappings:</h4>';
    window.tmManager.classNames.forEach((name, idx) => {
        const div = document.createElement('div');
        div.className = 'mapping-row';
        const currentMapping = window.tmManager.mappings[idx] || 'IDLE';

        div.innerHTML = `
            <span>Class ${idx} ("<strong>${name}</strong>"):</span>
            <select data-class-idx="${idx}" class="arcade-select mapping-select">
                <option value="PUNCH" ${currentMapping === 'PUNCH' ? 'selected' : ''}>👊 Punch</option>
                <option value="BLOCK" ${currentMapping === 'BLOCK' ? 'selected' : ''}>🛡️ Block</option>
                <option value="IDLE" ${currentMapping === 'IDLE' ? 'selected' : ''}>⏳ Idle / Neutral</option>
            </select>
        `;
        container.appendChild(div);
    });

    document.querySelectorAll('.mapping-select').forEach((sel) => {
        sel.addEventListener('change', (e) => {
            const idx = parseInt(e.target.getAttribute('data-class-idx'));
            window.tmManager.setMapping(idx, e.target.value);
        });
    });
}

// Fallback: Start in Demo / Keyboard Mode directly
function startDemoMode() {
    if (window.soundEngine) window.soundEngine.init();
    closeModelModal();
    statusMsg.innerHTML = '<span style="color:#ffe600;">⌨️ KEYBOARD MODE ACTIVE: [Space/F] Punch | [B/Down] Block | [M] Mute</span>';
    startBtn.textContent = 'Restart Match';
    game.startMatch();
}
