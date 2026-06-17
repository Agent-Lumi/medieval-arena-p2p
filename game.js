/**
 * Medieval Arena P2P - Multiplayer Battle Game
 * Peer-to-peer multiplayer using WebRTC (PeerJS)
 */

// Game Configuration
const CONFIG = {
    CANVAS_WIDTH: 1000,
    CANVAS_HEIGHT: 600,
    PLAYER_SIZE: 32,
    PLAYER_SPEED: 4,
    ATTACK_COOLDOWN: 500, // ms
    ATTACK_RANGE: 60,
    ATTACK_DAMAGE: 25,
    MAX_HEALTH: 100,
    COLORS: ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'],
    PEER_HOST: '0.peerjs.com',
    PEER_PORT: 443,
    PEER_SECURE: true,
    PEER_CONFIG: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ]
    }
};

// Game State
const state = {
    screen: 'menu', // menu, lobby, game
    isHost: false,
    roomCode: null,
    myPeerId: null,
    players: new Map(), // id -> player data
    localPlayer: null,
    peer: null,
    connections: new Map(), // id -> data connection
    keys: {},
    lastAttackTime: 0,
    gameLoopId: null,
    camera: { x: 0, y: 0 },
    particles: [],
    chatMessages: []
};

// DOM Elements
const elements = {};

// Initialize DOM element references
document.addEventListener('DOMContentLoaded', () => {
    elements.menuScreen = document.getElementById('menu-screen');
    elements.lobbyScreen = document.getElementById('lobby-screen');
    elements.gameScreen = document.getElementById('game-screen');
    elements.canvas = document.getElementById('game-canvas');
    elements.ctx = elements.canvas.getContext('2d');
    elements.roomCodeInput = document.getElementById('room-code-input');
    elements.displayRoomCode = document.getElementById('display-room-code');
    elements.gameRoomCode = document.getElementById('game-room-code');
    elements.playersList = document.getElementById('connected-players');
    elements.playerCount = document.getElementById('player-count');
    elements.btnCreate = document.getElementById('btn-create');
    elements.btnJoin = document.getElementById('btn-join');
    elements.btnStart = document.getElementById('btn-start');
    elements.btnLeaveLobby = document.getElementById('btn-leave-lobby');
    elements.btnLeaveGame = document.getElementById('btn-leave-game');
    elements.btnCopyCode = document.getElementById('btn-copy-code');
    elements.healthFill = document.querySelector('.health-fill');
    elements.healthText = document.getElementById('health-text');
    elements.chatMessages = document.getElementById('chat-messages');
    elements.chatInput = document.getElementById('chat-input');
    elements.statusOverlay = document.getElementById('connection-status');
    elements.statusText = document.getElementById('status-text');

    // Set canvas size
    elements.canvas.width = CONFIG.CANVAS_WIDTH;
    elements.canvas.height = CONFIG.CANVAS_HEIGHT;

    // Event Listeners
    elements.btnCreate.addEventListener('click', createGame);
    elements.btnJoin.addEventListener('click', joinGame);
    elements.btnStart.addEventListener('click', startGame);
    elements.btnLeaveLobby.addEventListener('click', leaveLobby);
    elements.btnLeaveGame.addEventListener('click', leaveGame);
    elements.btnCopyCode.addEventListener('click', copyRoomCode);
    
    elements.roomCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinGame();
    });

    // Keyboard controls
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Chat
    elements.chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && elements.chatInput.value.trim()) {
            sendChatMessage(elements.chatInput.value.trim());
            elements.chatInput.value = '';
        }
    });

    // Prevent context menu on canvas
    elements.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Start render loop
    requestAnimationFrame(render);
});

// Generate a random room code
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Show status overlay
function showStatus(text) {
    elements.statusText.textContent = text;
    elements.statusOverlay.classList.add('active');
}

// Hide status overlay
function hideStatus() {
    elements.statusOverlay.classList.remove('active');
}

// Switch screens
function switchScreen(screenName) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenName + '-screen').classList.add('active');
    state.screen = screenName;
}

// Initialize PeerJS
function initPeer(peerId = null) {
    return new Promise((resolve, reject) => {
        const peerConfig = {
            host: CONFIG.PEER_HOST,
            port: CONFIG.PEER_PORT,
            secure: CONFIG.PEER_SECURE,
            config: CONFIG.PEER_CONFIG
        };
        
        if (peerId) peerConfig.id = peerId;

        const peer = new Peer(peerConfig);

        peer.on('open', (id) => {
            state.myPeerId = id;
            console.log('PeerJS connected, ID:', id);
            resolve(peer);
        });

        peer.on('error', (err) => {
            console.error('PeerJS error:', err);
            reject(err);
        });

        peer.on('connection', (conn) => {
            handleIncomingConnection(conn);
        });
    });
}

// Create a new game (become host)
async function createGame() {
    showStatus('Creating game...');
    
    try {
        state.isHost = true;
        state.roomCode = generateRoomCode();
        
        // Initialize peer with room code as ID
        state.peer = await initPeer(state.roomCode);
        
        // Create local player
        createLocalPlayer();
        
        // Update UI
        elements.displayRoomCode.textContent = state.roomCode;
        elements.gameRoomCode.textContent = state.roomCode;
        updatePlayersList();
        
        hideStatus();
        switchScreen('lobby');
        
        addSystemMessage('Game created! Share the room code with friends.');
        
    } catch (err) {
        console.error('Failed to create game:', err);
        showStatus('Failed to create game. Please try again.');
        setTimeout(hideStatus, 3000);
    }
}

// Join an existing game
async function joinGame() {
    const code = elements.roomCodeInput.value.trim().toUpperCase();
    
    if (!code || code.length !== 6) {
        alert('Please enter a valid 6-character room code');
        return;
    }
    
    showStatus('Connecting to game...');
    
    try {
        state.isHost = false;
        state.roomCode = code;
        
        // Initialize peer
        state.peer = await initPeer();
        
        // Connect to host
        const conn = state.peer.connect(code, {
            reliable: true,
            serialization: 'json'
        });
        
        conn.on('open', () => {
            console.log('Connected to host:', code);
            state.connections.set(code, conn);
            
            // Create local player
            createLocalPlayer();
            
            // Send join request
            sendToPeer(code, {
                type: 'player_join',
                data: {
                    id: state.myPeerId,
                    ...getPlayerData(state.localPlayer)
                }
            });
            
            // Update UI
            elements.displayRoomCode.textContent = state.roomCode;
            elements.gameRoomCode.textContent = state.roomCode;
            
            hideStatus();
            switchScreen('lobby');
            
            addSystemMessage('Joined game! Waiting for host to start...');
        });
        
        conn.on('data', (data) => {
            handlePeerData(code, data);
        });
        
        conn.on('close', () => {
            handlePeerDisconnect(code);
        });
        
        conn.on('error', (err) => {
            console.error('Connection error:', err);
            showStatus('Failed to connect. Check the room code and try again.');
            setTimeout(hideStatus, 3000);
        });
        
    } catch (err) {
        console.error('Failed to join game:', err);
        showStatus('Failed to join game. Please try again.');
        setTimeout(hideStatus, 3000);
    }
}

// Handle incoming peer connections
function handleIncomingConnection(conn) {
    console.log('Incoming connection from:', conn.peer);
    
    conn.on('open', () => {
        state.connections.set(conn.peer, conn);
        
        // Send current game state to new player
        if (state.isHost) {
            const playersData = Array.from(state.players.values()).map(p => getPlayerData(p));
            
            sendToPeer(conn.peer, {
                type: 'game_state',
                data: {
                    players: playersData,
                    hostId: state.myPeerId
                }
            });
        }
        
        updatePlayersList();
    });
    
    conn.on('data', (data) => {
        handlePeerData(conn.peer, data);
    });
    
    conn.on('close', () => {
        handlePeerDisconnect(conn.peer);
    });
    
    conn.on('error', (err) => {
        console.error('Connection error with', conn.peer, ':', err);
    });
}

// Handle data from peers
function handlePeerData(peerId, data) {
    switch (data.type) {
        case 'player_join':
            handlePlayerJoin(data.data);
            break;
        case 'player_update':
            handlePlayerUpdate(data.data);
            break;
        case 'player_attack':
            handlePlayerAttack(data.data);
            break;
        case 'player_damage':
            handlePlayerDamage(data.data);
            break;
        case 'game_state':
            handleGameState(data.data);
            break;
        case 'game_start':
            handleGameStart(data.data);
            break;
        case 'chat':
            handleChatMessage(data.data);
            break;
        case 'player_left':
            handlePlayerLeft(data.data);
            break;
    }
}

// Handle player join
function handlePlayerJoin(playerData) {
    const player = createPlayer(playerData.id, playerData);
    state.players.set(playerData.id, player);
    
    // Broadcast to all other players
    broadcastToPeers({
        type: 'player_join',
        data: playerData
    }, playerData.id);
    
    updatePlayersList();
    addSystemMessage(`Player ${playerData.name} joined!`);
}

// Handle player update (position, etc.)
function handlePlayerUpdate(playerData) {
    const player = state.players.get(playerData.id);
    if (player) {
        player.x = playerData.x;
        player.y = playerData.y;
        player.direction = playerData.direction;
        player.isAttacking = playerData.isAttacking;
        player.health = playerData.health;
        player.isDead = playerData.isDead;
    }
}

// Handle player attack
function handlePlayerAttack(attackData) {
    const attacker = state.players.get(attackData.attackerId);
    if (attacker) {
        attacker.isAttacking = true;
        attacker.attackTime = Date.now();
        
        // Check for hits on local player
        if (attackData.hitPlayerId === state.myPeerId && !state.localPlayer.isDead) {
            takeDamage(attackData.damage, attackData.attackerId);
        }
        
        // Spawn particles
        spawnAttackParticles(attacker.x, attacker.y, attacker.direction);
    }
}

// Handle player damage
function handlePlayerDamage(damageData) {
    const player = state.players.get(damageData.playerId);
    if (player) {
        player.health = damageData.health;
        if (damageData.health <= 0) {
            player.isDead = true;
        }
    }
}

// Handle game state (for joining players)
function handleGameState(stateData) {
    // Add existing players
    stateData.players.forEach(playerData => {
        if (playerData.id !== state.myPeerId && !state.players.has(playerData.id)) {
            state.players.set(playerData.id, createPlayer(playerData.id, playerData));
        }
    });
    
    updatePlayersList();
}

// Handle game start
function handleGameStart(startData) {
    switchScreen('game');
    startGameLoop();
    addSystemMessage('Game started! Fight!');
}

// Handle chat message
function handleChatMessage(chatData) {
    addChatMessage(chatData.playerName, chatData.message);
}

// Handle player left
function handlePlayerLeft(leftData) {
    const player = state.players.get(leftData.id);
    if (player) {
        addSystemMessage(`Player ${player.name} left the game.`);
        state.players.delete(leftData.id);
        updatePlayersList();
    }
}

// Handle peer disconnect
function handlePeerDisconnect(peerId) {
    state.connections.delete(peerId);
    
    const player = state.players.get(peerId);
    if (player) {
        addSystemMessage(`Player ${player.name} disconnected.`);
        state.players.delete(peerId);
        updatePlayersList();
    }
    
    if (state.screen === 'game') {
        // If host disconnects, end game
        if (peerId === state.roomCode) {
            addSystemMessage('Host disconnected. Game ended.');
            leaveGame();
        }
    }
}

// Create local player
function createLocalPlayer() {
    const colorIndex = Math.floor(Math.random() * CONFIG.COLORS.length);
    state.localPlayer = {
        id: state.myPeerId,
        name: `Knight_${state.myPeerId.substr(0, 4)}`,
        x: 100 + Math.random() * (CONFIG.CANVAS_WIDTH - 200),
        y: 100 + Math.random() * (CONFIG.CANVAS_HEIGHT - 200),
        color: CONFIG.COLORS[colorIndex],
        direction: 'down',
        isAttacking: false,
        attackTime: 0,
        health: CONFIG.MAX_HEALTH,
        maxHealth: CONFIG.MAX_HEALTH,
        isDead: false,
        kills: 0,
        deaths: 0
    };
    state.players.set(state.myPeerId, state.localPlayer);
}

// Create a player object
function createPlayer(id, data) {
    return {
        id: id,
        name: data.name || `Player_${id.substr(0, 4)}`,
        x: data.x || 100,
        y: data.y || 100,
        color: data.color || CONFIG.COLORS[0],
        direction: data.direction || 'down',
        isAttacking: false,
        attackTime: 0,
        health: data.health || CONFIG.MAX_HEALTH,
        maxHealth: CONFIG.MAX_HEALTH,
        isDead: false,
        kills: 0,
        deaths: 0
    };
}

// Get player data for network transmission
function getPlayerData(player) {
    return {
        id: player.id,
        name: player.name,
        x: player.x,
        y: player.y,
        color: player.color,
        direction: player.direction,
        isAttacking: player.isAttacking,
        health: player.health,
        isDead: player.isDead
    };
}

// Send data to a specific peer
function sendToPeer(peerId, data) {
    const conn = state.connections.get(peerId);
    if (conn && conn.open) {
        conn.send(data);
    }
}

// Broadcast data to all connected peers
function broadcastToPeers(data, excludeId = null) {
    state.connections.forEach((conn, peerId) => {
        if (peerId !== excludeId && conn.open) {
            conn.send(data);
        }
    });
}

// Update players list in lobby
function updatePlayersList() {
    const playerCount = state.players.size;
    const playersHtml = Array.from(state.players.values()).map(player => {
        const isHost = player.id === state.roomCode || (state.isHost && player.id === state.myPeerId);
        return `
            <li class="${isHost ? 'host' : ''}">
                ${player.name} ${player.id === state.myPeerId ? '(You)' : ''}
            </li>
        `;
    }).join('');
    
    elements.playersList.innerHTML = `
        <h3>Players (${playerCount}/4)</h3>
        <ul id="connected-players">${playersHtml}</ul>
    `;
    
    elements.playerCount.textContent = `${playerCount}/4`;
    
    // Only host can start the game
    if (state.isHost) {
        elements.btnStart.disabled = playerCount < 1;
    } else {
        elements.btnStart.style.display = 'none';
    }
}

// Start the game
function startGame() {
    if (!state.isHost) return;
    
    broadcastToPeers({
        type: 'game_start',
        data: { timestamp: Date.now() }
    });
    
    switchScreen('game');
    startGameLoop();
    addSystemMessage('Game started! Fight!');
}

// Leave lobby
function leaveLobby() {
    cleanup();
    switchScreen('menu');
}

// Leave game
function leaveGame() {
    broadcastToPeers({
        type: 'player_left',
        data: { id: state.myPeerId }
    });
    
    cleanup();
    switchScreen('menu');
}

// Cleanup resources
function cleanup() {
    // Stop game loop
    if (state.gameLoopId) {
        cancelAnimationFrame(state.gameLoopId);
        state.gameLoopId = null;
    }
    
    // Close all connections
    state.connections.forEach(conn => conn.close());
    state.connections.clear();
    
    // Destroy peer
    if (state.peer) {
        state.peer.destroy();
        state.peer = null;
    }
    
    // Clear game state
    state.players.clear();
    state.localPlayer = null;
    state.isHost = false;
    state.roomCode = null;
    state.particles = [];
    state.chatMessages = [];
    elements.chatMessages.innerHTML = '';
}

// Copy room code to clipboard
async function copyRoomCode() {
    try {
        await navigator.clipboard.writeText(state.roomCode);
        elements.btnCopyCode.textContent = 'Copied!';
        setTimeout(() => {
            elements.btnCopyCode.textContent = 'Copy';
        }, 2000);
    } catch (err) {
        console.error('Failed to copy:', err);
    }
}

// Handle keyboard input
function handleKeyDown(e) {
    state.keys[e.key.toLowerCase()] = true;
    
    // Chat activation
    if (e.key === 'Enter' && state.screen === 'game' && document.activeElement !== elements.chatInput) {
        e.preventDefault();
        elements.chatInput.focus();
    }
    
    // Attack
    if (e.code === 'Space' && state.screen === 'game') {
        e.preventDefault();
        performAttack();
    }
}

function handleKeyUp(e) {
    state.keys[e.key.toLowerCase()] = false;
}

// Game Loop
function startGameLoop() {
    let lastTime = performance.now();
    
    function loop(currentTime) {
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;
        
        update(deltaTime);
        state.gameLoopId = requestAnimationFrame(loop);
    }
    
    state.gameLoopId = requestAnimationFrame(loop);
}

// Update game state
function update(deltaTime) {
    if (!state.localPlayer || state.localPlayer.isDead) return;
    
    const player = state.localPlayer;
    let moved = false;
    
    // Movement
    let dx = 0;
    let dy = 0;
    
    if (state.keys['w'] || state.keys['arrowup']) dy -= 1;
    if (state.keys['s'] || state.keys['arrowdown']) dy += 1;
    if (state.keys['a'] || state.keys['arrowleft']) dx -= 1;
    if (state.keys['d'] || state.keys['arrowright']) dx += 1;
    
    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
        const length = Math.sqrt(dx * dx + dy * dy);
        dx /= length;
        dy /= length;
    }
    
    // Apply movement
    if (dx !== 0 || dy !== 0) {
        const newX = player.x + dx * CONFIG.PLAYER_SPEED;
        const newY = player.y + dy * CONFIG.PLAYER_SPEED;
        
        // Boundary check
        if (newX >= 0 && newX <= CONFIG.CANVAS_WIDTH - CONFIG.PLAYER_SIZE) {
            player.x = newX;
        }
        if (newY >= 0 && newY <= CONFIG.CANVAS_HEIGHT - CONFIG.PLAYER_SIZE) {
            player.y = newY;
        }
        
        // Update direction
        if (Math.abs(dx) > Math.abs(dy)) {
            player.direction = dx > 0 ? 'right' : 'left';
        } else {
            player.direction = dy > 0 ? 'down' : 'up';
        }
        
        moved = true;
    }
    
    // Reset attack animation
    if (player.isAttacking && Date.now() - player.attackTime > 200) {
        player.isAttacking = false;
    }
    
    // Broadcast update if moved or attacking
    if (moved || player.isAttacking) {
        broadcastToPeers({
            type: 'player_update',
            data: getPlayerData(player)
        });
    }
    
    // Update particles
    state.particles = state.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= deltaTime / 1000;
        return p.life > 0;
    });
    
    // Update health bar UI
    updateHealthUI();
}

// Perform attack
function performAttack() {
    if (!state.localPlayer || state.localPlayer.isDead) return;
    
    const now = Date.now();
    if (now - state.lastAttackTime < CONFIG.ATTACK_COOLDOWN) return;
    
    state.lastAttackTime = now;
    state.localPlayer.isAttacking = true;
    state.localPlayer.attackTime = now;
    
    // Calculate attack hitbox
    const player = state.localPlayer;
    let attackX = player.x + CONFIG.PLAYER_SIZE / 2;
    let attackY = player.y + CONFIG.PLAYER_SIZE / 2;
    
    switch (player.direction) {
        case 'up': attackY -= CONFIG.ATTACK_RANGE; break;
        case 'down': attackY += CONFIG.ATTACK_RANGE; break;
        case 'left': attackX -= CONFIG.ATTACK_RANGE; break;
        case 'right': attackX += CONFIG.ATTACK_RANGE; break;
    }
    
    // Check for hits
    const hitPlayers = [];
    state.players.forEach(target => {
        if (target.id !== player.id && !target.isDead) {
            const dx = target.x + CONFIG.PLAYER_SIZE / 2 - attackX;
            const dy = target.y + CONFIG.PLAYER_SIZE / 2 - attackY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < CONFIG.ATTACK_RANGE) {
                hitPlayers.push(target.id);
            }
        }
    });
    
    // Broadcast attack
    hitPlayers.forEach(targetId => {
        broadcastToPeers({
            type: 'player_attack',
            data: {
                attackerId: player.id,
                hitPlayerId: targetId,
                damage: CONFIG.ATTACK_DAMAGE
            }
        });
        
        // Send damage
        sendToPeer(targetId, {
            type: 'player_attack',
            data: {
                attackerId: player.id,
                hitPlayerId: targetId,
                damage: CONFIG.ATTACK_DAMAGE
            }
        });
    });
    
    // Spawn particles
    spawnAttackParticles(player.x, player.y, player.direction);
}

// Take damage
function takeDamage(damage, attackerId) {
    if (!state.localPlayer) return;
    
    state.localPlayer.health -= damage;
    
    if (state.localPlayer.health <= 0) {
        state.localPlayer.health = 0;
        state.localPlayer.isDead = true;
        state.localPlayer.deaths++;
        
        addSystemMessage('You were defeated!');
        
        // Respawn after 3 seconds
        setTimeout(() => {
            if (state.localPlayer) {
                state.localPlayer.health = CONFIG.MAX_HEALTH;
                state.localPlayer.isDead = false;
                state.localPlayer.x = 100 + Math.random() * (CONFIG.CANVAS_WIDTH - 200);
                state.localPlayer.y = 100 + Math.random() * (CONFIG.CANVAS_HEIGHT - 200);
                
                addSystemMessage('You have respawned!');
            }
        }, 3000);
    }
    
    // Broadcast health update
    broadcastToPeers({
        type: 'player_update',
        data: getPlayerData(state.localPlayer)
    });
}

// Spawn attack particles
function spawnAttackParticles(x, y, direction) {
    const particleCount = 5;
    for (let i = 0; i < particleCount; i++) {
        let vx = (Math.random() - 0.5) * 4;
        let vy = (Math.random() - 0.5) * 4;
        
        switch (direction) {
            case 'up': vy = -Math.abs(vy) - 2; break;
            case 'down': vy = Math.abs(vy) + 2; break;
            case 'left': vx = -Math.abs(vx) - 2; break;
            case 'right': vx = Math.abs(vx) + 2; break;
        }
        
        state.particles.push({
            x: x + CONFIG.PLAYER_SIZE / 2,
            y: y + CONFIG.PLAYER_SIZE / 2,
            vx: vx,
            vy: vy,
            life: 0.5,
            color: '#ffcc00',
            size: 3 + Math.random() * 4
        });
    }
}

// Update health bar UI
function updateHealthUI() {
    if (!state.localPlayer) return;
    
    const healthPercent = (state.localPlayer.health / state.localPlayer.maxHealth) * 100;
    elements.healthFill.style.width = `${healthPercent}%`;
    elements.healthText.textContent = `${Math.ceil(state.localPlayer.health)}/${state.localPlayer.maxHealth}`;
}

// Render the game
function render() {
    if (state.screen === 'game') {
        const ctx = elements.ctx;
        
        // Clear canvas
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
        
        // Draw grid
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 1;
        for (let x = 0; x < CONFIG.CANVAS_WIDTH; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, CONFIG.CANVAS_HEIGHT);
            ctx.stroke();
        }
        for (let y = 0; y < CONFIG.CANVAS_HEIGHT; y += 50) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(CONFIG.CANVAS_WIDTH, y);
            ctx.stroke();
        }
        
        // Draw decorative elements
        drawArenaDecorations(ctx);
        
        // Draw players
        state.players.forEach(player => {
            drawPlayer(ctx, player);
        });
        
        // Draw particles
        state.particles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life / 0.5;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        });
    }
    
    requestAnimationFrame(render);
}

// Draw arena decorations
function drawArenaDecorations(ctx) {
    // Draw some stone pillars
    ctx.fillStyle = '#3a3a3a';
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    
    // Corner pillars
    const pillars = [
        { x: 50, y: 50, w: 60, h: 60 },
        { x: CONFIG.CANVAS_WIDTH - 110, y: 50, w: 60, h: 60 },
        { x: 50, y: CONFIG.CANVAS_HEIGHT - 110, w: 60, h: 60 },
        { x: CONFIG.CANVAS_WIDTH - 110, y: CONFIG.CANVAS_HEIGHT - 110, w: 60, h: 60 }
    ];
    
    pillars.forEach(p => {
        // Shadow
        ctx.fillStyle = '#222';
        ctx.fillRect(p.x + 5, p.y + 5, p.w, p.h);
        
        // Pillar
        ctx.fillStyle = '#4a4a4a';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        
        // Border
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        
        // Detail
        ctx.fillStyle = '#5a5a5a';
        ctx.fillRect(p.x + 10, p.y + 10, p.w - 20, p.h - 20);
    });
}

// Draw a player
function drawPlayer(ctx, player) {
    const x = player.x;
    const y = player.y;
    const size = CONFIG.PLAYER_SIZE;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + size/2, y + size - 2, size/2, size/4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    if (player.isDead) {
        // Draw tombstone/skull for dead players
        ctx.fillStyle = '#666';
        ctx.fillRect(x + size/4, y, size/2, size * 0.7);
        ctx.fillStyle = '#444';
        ctx.fillRect(x + size/4 + 5, y + 10, 5, 5);
        ctx.fillRect(x + size/4 + 15, y + 10, 5, 5);
        ctx.beginPath();
        ctx.moveTo(x + size/4 + 8, y + 25);
        ctx.lineTo(x + size/4 + 17, y + 25);
        ctx.stroke();
        
        // Name
        ctx.fillStyle = '#888';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${player.name} (Dead)`, x + size/2, y - 5);
        return;
    }
    
    // Body
    ctx.fillStyle = player.color;
    ctx.fillRect(x + 4, y + 8, size - 8, size - 12);
    
    // Armor details
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4, y + 8, size - 8, size - 12);
    ctx.beginPath();
    ctx.moveTo(x + 4, y + size/2);
    ctx.lineTo(x + size - 4, y + size/2);
    ctx.stroke();
    
    // Helmet
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(x + 2, y, size - 4, 10);
    ctx.fillStyle = '#888';
    ctx.fillRect(x + 2, y + 8, size - 4, 3);
    
    // Eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 8, y + 3, 6, 4);
    ctx.fillRect(x + size - 14, y + 3, 6, 4);
    
    // Direction indicator (weapon)
    ctx.fillStyle = '#aaa';
    let weaponX = x + size/2 - 3;
    let weaponY = y + size/2 - 3;
    let weaponW = 6;
    let weaponH = 6;
    
    if (player.isAttacking) {
        // Extended weapon
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x + size/2, y + size/2);
        switch (player.direction) {
            case 'up': ctx.lineTo(x + size/2, y - 15); break;
            case 'down': ctx.lineTo(x + size/2, y + size + 15); break;
            case 'left': ctx.lineTo(x - 15, y + size/2); break;
            case 'right': ctx.lineTo(x + size + 15, y + size/2); break;
        }
        ctx.stroke();
        
        // Weapon tip glow
        ctx.fillStyle = '#ffcc00';
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        switch (player.direction) {
            case 'up': ctx.arc(x + size/2, y - 15, 8, 0, Math.PI * 2); break;
            case 'down': ctx.arc(x + size/2, y + size + 15, 8, 0, Math.PI * 2); break;
            case 'left': ctx.arc(x - 15, y + size/2, 8, 0, Math.PI * 2); break;
            case 'right': ctx.arc(x + size + 15, y + size/2, 8, 0, Math.PI * 2); break;
        }
        ctx.fill();
        ctx.globalAlpha = 1;
    } else {
        // Sheathed weapon
        switch (player.direction) {
            case 'up': weaponY = y + size - 8; break;
            case 'down': weaponY = y + 2; break;
            case 'left': weaponX = x + size - 8; break;
            case 'right': weaponX = x + 2; break;
        }
        ctx.fillRect(weaponX, weaponY, weaponW, weaponH);
    }
    
    // Health bar above player
    const healthPercent = player.health / player.maxHealth;
    ctx.fillStyle = '#333';
    ctx.fillRect(x, y - 12, size, 6);
    ctx.fillStyle = healthPercent > 0.5 ? '#2ecc71' : healthPercent > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(x + 1, y - 11, (size - 2) * healthPercent, 4);
    
    // Player name
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 3;
    ctx.fillText(player.name, x + size/2, y - 16);
    ctx.shadowBlur = 0;
    
    // Highlight local player
    if (player.id === state.myPeerId) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(x - 2, y - 2, size + 4, size + 4);
        ctx.setLineDash([]);
    }
}

// Send chat message
function sendChatMessage(message) {
    const chatData = {
        type: 'chat',
        data: {
            playerName: state.localPlayer?.name || 'Unknown',
            message: message
        }
    };
    
    broadcastToPeers(chatData);
    addChatMessage(state.localPlayer?.name || 'You', message, true);
}

// Add chat message to UI
function addChatMessage(name, message, isLocal = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message';
    msgDiv.innerHTML = `<span class="player-name">${name}:</span> ${escapeHtml(message)}`;
    elements.chatMessages.appendChild(msgDiv);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    
    // Limit chat history
    while (elements.chatMessages.children.length > 50) {
        elements.chatMessages.removeChild(elements.chatMessages.firstChild);
    }
}

// Add system message
function addSystemMessage(message) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message system';
    msgDiv.textContent = message;
    elements.chatMessages.appendChild(msgDiv);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Handle window close
window.addEventListener('beforeunload', () => {
    cleanup();
});