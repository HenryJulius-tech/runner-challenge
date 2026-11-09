/**
 * neon3d_engine.js — Motor Principal de Juego 3D Neon Run
 * 
 * Fusión completa de mecánicas 2D y motor 3D Three.js + UnrealBloomPass:
 *  - Soporte de los 20 Niveles (distancias, velocidades, gaps y paletas dinámicas)
 *  - Controles y físicas 3D completas:
 *     * Movimiento lateral por carriles (A / D o Flechas)
 *     * Salto y Doble Salto acrobático en el aire (Espacio)
 *     * Agacharse / Deslizarse en suelo (S / Flecha Abajo) para pasar bajo láseres
 *     * Caída Rápida en Picada (Fast-Fall Slam) al pulsar abajo en el aire
 *     * Sprint / Dash con cooldown y estela de velocidad (Shift o botón Dash)
 *     * Lanzamiento de Disco Destructor de obstáculos (F / E / botón Disco)
 *  - 4 Power-Ups del juego 2D adaptados a 3D:
 *     1. 🛡️ ESCUDO: Absorbe impacto sin perder vidas
 *     2. 🧲 IMÁN: Atrae magnéticamente las monedas en un radio tridimensional
 *     3. ⚡ HIPER-TURBO: +50% velocidad, invulnerabilidad y destrucción de obstáculos al choque
 *     4. 🦘 DOBLE SALTO: Salto acrobático en el aire
 *  - Monedas doradas 3D en formaciones lineales y arcos de salto (+50 pts)
 *  - Obstáculos variados: Barras de suelo, Pilares, Láseres elevados y Drones flotantes
 *  - Sincronización con AudioManager, ScoreManager y progresión de niveles
 */

const Neon3DEngine = (() => {
  const HALF = 4.4;
  const CY = 0x2ff3ff;
  const MG = 0xff2bd6;

  let canvas = null;
  let renderer = null;
  let scene = null;
  let camera = null;       // Cámara del jugador local
  let cameraRival = null;  // Cámara del rival (split-screen online)
  let composer = null;
  let worldData = null;
  let playerRig = null;

  // Split-screen: overlay DOM para la barra divisora y etiquetas
  let splitDividerEl = null;
  let splitLabel1El = null;
  let splitLabel2El = null;
  let isSplitScreen = false;

  // Nivel actual
  let currentLevelNum = 1;
  let levelData = null;
  let finishDistance = 700;

  // Estado del juego
  let state = 'idle'; // 'idle' | 'play' | 'paused' | 'win' | 'lose'
  let px = 0;
  let py = 0;
  let vy = 0;
  let vx = 0;
  let dist = 0;
  let speed = 14;
  let phase = 0;
  let grounded = true;
  let isDucking = false;
  let isFastFalling = false;
  let jumpBuf = 0;
  let landT = 0;
  let time = 0;

  // ── Sincronización Online Multiplayer ─────────────────────────────────────
  let isOnline = false;
  let currentRaceId = null;
  let localPlayerId = null;
  let myCustomColor = '#00F0FF';
  let rivalName = 'Rival';
  let rivalColor = '#FF007F';
  let rivalRig = null;
  let rivalNameplate = null;
  let rivalPx = 0;
  let rivalPy = 0;
  let rivalDist = 0;
  let rivalSpeed = 14;
  let rivalPhase = 0;
  let rivalGrounded = true;
  let rivalIsDucking = false;
  let rivalIsTurbo = false;
  let rivalShield = false;
  let rivalLives = 3;
  let rivalScore = 0;
  let rivalCoins = 0;
  let rivalHasFinished = false;
  let rivalIsWinner = false;
  let remoteTargetDist = 0;
  let remoteTargetPx = 0;
  let remoteTargetPy = 0;
  let remoteTargetSpeed = 14;
  let remoteTargetAt = 0;
  let hasReportedFinish = false;
  let raceFinished = false;
  let raceResult = null;
  let officialRaceState = null;
  let officialLocalX = 0;
  let officialRemoteX = 0;
  let officialGoalWorldX = null;

  // PRNG Determinista con Mulberry32
  let rngState = 12345;
  function rng() {
    let t = (rngState += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Estadísticas de partida
  let lives = 3;
  let score = 0;
  let coinsCount = 0;
  let inv = 0;
  let slow = 0;
  let shake = 0;
  let boost = 0;
  let camX = 0;
  let rivalCamX = 0; // Cámara del rival (suavizada para split-screen)

  // Cooldowns y temporizadores de habilidades
  let cdDisc = 0;
  let dashTimer = 0;
  let dashCooldown = 0;

  // Power-Ups activos
  let shieldActive = false;
  let magnetTimer = 0;
  let turboTimer = 0;
  let doubleJumpTimer = 0;
  let canDoubleJump = false;

  // Entidades activas
  let obstacles = [];
  let coins = [];
  let powers = [];
  let parts = [];
  let discs = [];

  // Entrada de controles
  const keys = {};
  const touchState = { l: false, r: false, duck: false };

  // Callbacks de UI y eventos
  let hudCallbacks = null;

  // Clock
  const clock = new THREE.Clock();
  let rafId = null;

  // Geometrías y materiales compartidos
  const darkM = new THREE.MeshStandardMaterial({ color: 0x1b1140, roughness: 0.4, metalness: 0.6 });
  const glowM = new THREE.MeshBasicMaterial({ color: MG });
  const glowC = new THREE.MeshBasicMaterial({ color: CY });
  const pillarG = new THREE.CylinderGeometry(0.6, 0.7, 3.6, 14);
  const ringG = new THREE.TorusGeometry(0.72, 0.07, 8, 24);
  const partG = new THREE.BoxGeometry(0.14, 0.14, 0.14);

  function box(w, h, d, m) {
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  }

  /**
   * Inicializa Three.js, el compositor de post-procesado Bloom y la escena
   */
  function init(targetCanvas, callbacks = {}) {
    canvas = targetCanvas;
    hudCallbacks = callbacks;

    const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: !isTouch,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2));

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(65, 1, 0.1, 500);
    cameraRival = new THREE.PerspectiveCamera(65, 1, 0.1, 500);

    // En split-screen, el EffectComposer no se usa (renderizamos con setViewport).
    // Solo inicializamos bloom si hay shaders disponibles; en split-screen se desactiva.
    if (typeof THREE.EffectComposer !== 'undefined' && typeof THREE.UnrealBloomPass !== 'undefined') {
      composer = new THREE.EffectComposer(renderer);
      composer.addPass(new THREE.RenderPass(scene, camera));
      composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), isTouch ? 0.85 : 1.1, 0.55, 0.12));
    }

    // Crear elementos DOM del divisor split-screen (ocultos por defecto)
    _createSplitDivider();

    _createSplitDivider();

    _loadLevelWorld(currentLevelNum);
    playerRig = Neon3DPlayer.create(scene);

    resize();
    window.addEventListener('resize', resize);
    _bindControls();
  }

  function resize() {
    if (!renderer || !canvas) return;
    // Siempre usar las dimensiones reales de la ventana para el canvas de juego
    // (canvas.clientWidth puede ser 0 si la pantalla está oculta con opacity:0)
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w === 0 || h === 0) return;

    renderer.setSize(w, h, false);

    if (isSplitScreen) {
      // Split: cada mitad tiene su propio aspect ratio
      const halfH = Math.floor(h / 2);
      const aspect = w / halfH;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      cameraRival.aspect = aspect;
      cameraRival.updateProjectionMatrix();
      // En split-screen no usamos el composer (scissor test incompatible con bloom)
    } else {
      if (composer) composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  function _createSplitDivider() {
    // Crear la barra divisora central del split-screen (oculta hasta modo online)
    if (splitDividerEl) return; // Ya existe
    const wrap = document.getElementById('screen-game-3d');
    if (!wrap) return;

    splitDividerEl = document.createElement('div');
    splitDividerEl.id = 'split-divider-3d';
    splitDividerEl.style.cssText = [
      'position:absolute', 'left:0', 'right:0', 'top:50%',
      'transform:translateY(-50%)', 'height:4px',
      'background:linear-gradient(90deg,#ff2bd6,#2ff3ff,#ff2bd6)',
      'box-shadow:0 0 14px #2ff3ff,0 0 28px #ff2bd6',
      'z-index:60', 'pointer-events:none', 'display:none'
    ].join(';');

    splitLabel1El = document.createElement('div');
    splitLabel1El.id = 'split-label-p1';
    splitLabel1El.style.cssText = [
      'position:absolute', 'left:8px', 'top:calc(50% - 36px)',
      'z-index:61', 'pointer-events:none', 'display:none',
      'font-family:var(--font-game,Orbitron,monospace)', 'font-size:11px',
      'font-weight:900', 'letter-spacing:1.5px', 'color:#2ff3ff',
      'text-shadow:0 0 8px #2ff3ff', 'background:rgba(0,0,0,0.55)',
      'padding:3px 10px', 'border-radius:20px',
      'border:1px solid rgba(47,243,255,0.5)'
    ].join(';');

    splitLabel2El = document.createElement('div');
    splitLabel2El.id = 'split-label-p2';
    splitLabel2El.style.cssText = [
      'position:absolute', 'left:8px', 'top:calc(50% + 10px)',
      'z-index:61', 'pointer-events:none', 'display:none',
      'font-family:var(--font-game,Orbitron,monospace)', 'font-size:11px',
      'font-weight:900', 'letter-spacing:1.5px', 'color:#ff2bd6',
      'text-shadow:0 0 8px #ff2bd6', 'background:rgba(0,0,0,0.55)',
      'padding:3px 10px', 'border-radius:20px',
      'border:1px solid rgba(255,43,214,0.5)'
    ].join(';');

    wrap.appendChild(splitDividerEl);
    wrap.appendChild(splitLabel1El);
    wrap.appendChild(splitLabel2El);
  }

  function _showSplitDivider(localName, localColor, rivalNameStr, rivalColorStr) {
    if (!splitDividerEl) return;
    splitDividerEl.style.display = 'block';
    if (splitLabel1El) {
      splitLabel1El.textContent = `▲ TÚ: ${localName}`;
      splitLabel1El.style.color = localColor || '#2ff3ff';
      splitLabel1El.style.textShadow = `0 0 8px ${localColor || '#2ff3ff'}`;
      splitLabel1El.style.borderColor = `${localColor || '#2ff3ff'}66`;
      splitLabel1El.style.display = 'block';
    }
    if (splitLabel2El) {
      splitLabel2El.textContent = `▼ ${rivalNameStr}`;
      splitLabel2El.style.color = rivalColorStr || '#ff2bd6';
      splitLabel2El.style.textShadow = `0 0 8px ${rivalColorStr || '#ff2bd6'}`;
      splitLabel2El.style.borderColor = `${rivalColorStr || '#ff2bd6'}66`;
      splitLabel2El.style.display = 'block';
    }
  }

  function _hideSplitDivider() {
    if (splitDividerEl) splitDividerEl.style.display = 'none';
    if (splitLabel1El) splitLabel1El.style.display = 'none';
    if (splitLabel2El) splitLabel2El.style.display = 'none';
  }

  function _updateCameraForPlayer(cam, playerPx, playerPy, playerPz, camXTarget, shake, dt, playerSpeed) {
    const isPortrait = cam.aspect < 0.8;
    const sx = (Math.random() - 0.5) * shake * 0.5;
    const sy = (Math.random() - 0.5) * shake * 0.5;
    cam.position.set(camXTarget + sx, (isPortrait ? 4.5 : 3.7) + playerPy * 0.3 + sy, playerPz + (isPortrait ? 10.5 : 8));
    cam.lookAt(camXTarget * 0.6 + playerPx * 0.3, 1.6, playerPz - 9);
    const targetFov = (isPortrait ? 78 : 62) + Math.min(playerSpeed || 14, 26) * 0.6;
    cam.fov += (targetFov - cam.fov) * Math.min(1, dt * 3);
    cam.updateProjectionMatrix();
  }

  function _renderSplitScreen(dt) {
    const w = renderer.domElement.width;
    const h = renderer.domElement.height;
    const halfH = Math.floor(h / 2);

    renderer.setScissorTest(true);

    // ── Mitad SUPERIOR: Jugador local ────────────────────────────────────────
    renderer.setViewport(0, halfH, w, halfH);
    renderer.setScissor(0, halfH, w, halfH);
    renderer.render(scene, camera);

    // ── Mitad INFERIOR: Rival (desde su cámara) ──────────────────────────────
    renderer.setViewport(0, 0, w, halfH);
    renderer.setScissor(0, 0, w, halfH);
    renderer.render(scene, cameraRival);

    renderer.setScissorTest(false);
    // Restaurar viewport completo
    renderer.setViewport(0, 0, w, h);
  }

  function _loadLevelWorld(num) {
    currentLevelNum = num;
    levelData = Neon3DLevels.getLevelData(num);
    finishDistance = levelData.finishDistance;

    // Si ya existía un mundo anterior, limpiarlo
    if (worldData?.envGroup) {
      scene.remove(worldData.envGroup);
    }

    worldData = Neon3DWorld.build({
      scene,
      finishDistance: levelData.finishDistance,
      palette: levelData.palette
    });
  }

  function _bindControls() {
    window.addEventListener('keydown', e => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        if (state === 'play') e.preventDefault();
      }
      if (e.repeat) return;
      keys[e.code] = true;

      if (e.code === 'Space') {
        if (state === 'play') handleJump();
      }
      if ((e.code === 'KeyF' || e.code === 'KeyE') && state === 'play') {
        throwDisc();
      }
      if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyX') && state === 'play') {
        dash();
      }
      if ((e.code === 'Escape' || e.code === 'KeyP') && (state === 'play' || state === 'paused')) {
        togglePause();
      }
    });

    window.addEventListener('keyup', e => {
      keys[e.code] = false;
    });
  }

  function setTouchInput(key, isPressed) {
    if (key === 'l') touchState.l = isPressed;
    if (key === 'r') touchState.r = isPressed;
    if (key === 'duck') touchState.duck = isPressed;
    if (key === 'jump' && isPressed && state === 'play') handleJump();
    if (key === 'disc' && isPressed && state === 'play') throwDisc();
    if (key === 'dash' && isPressed && state === 'play') dash();
  }

  /**
   * Salto y Doble Salto en 3D
   */
  function handleJump() {
    if (state !== 'play') return;

    if (grounded && !isDucking) {
      // Salto normal desde suelo
      vy = levelData?.jumpForce || 12.5;
      grounded = false;
      canDoubleJump = true;
      if (typeof AudioManager !== 'undefined') AudioManager.play('jump');
    } else if (!grounded && doubleJumpTimer > 0 && canDoubleJump) {
      // Doble salto acrobático en el aire
      vy = (levelData?.jumpForce || 12.5) * 0.95;
      canDoubleJump = false;
      isFastFalling = false;
      burst(px, py + 0.5, -dist, 0x00FF88, 14);
      if (typeof AudioManager !== 'undefined') AudioManager.play('doubleJump');
      if (hudCallbacks?.onToast) hudCallbacks.onToast('¡DOBLE SALTO!', '#00FF88');
    }
  }

  /**
   * Sprint / Dash rápido con estela
   */
  function dash() {
    if (state !== 'play' || dashTimer > 0 || dashCooldown > 0) return;
    dashTimer = 0.28;
    dashCooldown = 1.4;
    burst(px, py + 1.0, -dist, levelData?.palette?.neonMain || CY, 10);
    if (typeof AudioManager !== 'undefined') AudioManager.play('whoosh');
    if (hudCallbacks?.onToast) hudCallbacks.onToast('¡DASH!', '#2ff3ff');
  }

  /**
   * Lanzamiento de disco destructor de obstáculos
   */
  function throwDisc() {
    if (cdDisc > 0 || state !== 'play') return;
    cdDisc = 1.6;
    const discMesh = Neon3DPlayer.createDiscMesh(playerRig.suit, levelData?.palette?.neonMain || CY);
    discMesh.position.set(px, py + 1.1, -dist - 0.8);
    scene.add(discMesh);
    discs.push({ m: discMesh, z0: -dist, hit: 0 });
    burst(px, py + 1.1, -dist, CY, 6);

    if (typeof AudioManager !== 'undefined') AudioManager.play('jump');
    if (hudCallbacks?.onToast) hudCallbacks.onToast('¡DISCO!', '#2ff3ff');
  }

  // ═════════════════════════════════════════════════════════════════════════
  // GENERACIÓN DE ENTIDADES (NIVELES Y OBSTÁCULOS DETERMINISTAS)
  // ═════════════════════════════════════════════════════════════════════════

  function addBar(d, x, wide) {
    const g = new THREE.Group();
    const w = wide ? 6 : 3.4;
    const b = box(w, 1, 0.6, darkM);
    b.position.y = 0.5;
    g.add(b);

    const t = box(w + 0.04, 0.14, 0.66, glowM);
    t.position.y = 1;
    g.add(t);

    for (const s of [-1, 1]) {
      const v = box(0.1, 1, 0.66, glowM);
      v.position.set((s * w) / 2, 0.5, 0);
      g.add(v);
    }
    g.position.set(x, 0, -d);
    scene.add(g);
    obstacles.push({ mesh: g, x, z: -d, hw: w / 2, hd: 0.4, h: 1.0, minH: 0, dying: 0 });
  }

  function addPillar(d, x) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(pillarG, darkM);
    m.position.y = 1.8;
    g.add(m);

    for (const y of [0.5, 1.8, 3.1]) {
      const r = new THREE.Mesh(ringG, glowM);
      r.rotation.x = Math.PI / 2;
      r.position.y = y;
      g.add(r);
    }
    g.position.set(x, 0, -d);
    scene.add(g);
    obstacles.push({ mesh: g, x, z: -d, hw: 0.7, hd: 0.7, h: 3.6, minH: 0, dying: 0 });
  }

  function addLaser(d, x) {
    const laserObj = Neon3DWorld.createLaserObstacle(x, d, 6.2);
    scene.add(laserObj.mesh);
    obstacles.push(laserObj);
  }

  function addDrone(d, x) {
    const droneObj = Neon3DWorld.createDroneObstacle(x, d);
    scene.add(droneObj.mesh);
    obstacles.push(droneObj);
  }

  function _createNameplateSprite(name, color = '#FF007F') {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(8, 4, 28, 0.82)';
    if (ctx.roundRect) ctx.roundRect(4, 4, 248, 56, 14);
    else ctx.rect(4, 4, 248, 56);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.stroke();

    ctx.font = 'bold 24px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.fillText(name.slice(0, 14), 128, 32);

    const texture = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.4, 0.6, 1);
    return sprite;
  }

  function spawnCoinsPattern(startDist, type = 'LINE') {
    const count = 4;
    const spacing = 3.2;
    const laneX = (rng() * 2 - 1) * 2.8;

    for (let i = 0; i < count; i++) {
      const d = startDist + i * spacing;
      let y = 0.6;
      if (type === 'ARC') {
        const mid = (count - 1) / 2;
        const diff = i - mid;
        y = 2.2 - diff * diff * 0.35;
      }

      const coinMesh = Neon3DWorld.createCoinMesh();
      coinMesh.position.set(laneX, y, -d);
      scene.add(coinMesh);
      coins.push({
        mesh: coinMesh,
        x: laneX,
        y: y,
        z: -d,
        got: false
      });
    }
  }

  function spawnPowerUp(d, type) {
    const x = (rng() * 2 - 1) * 3.0;
    const puMesh = Neon3DWorld.createPowerUpMesh(type);
    puMesh.position.set(x, 1.4, -d);
    scene.add(puMesh);
    powers.push({
      mesh: puMesh,
      type: type,
      x: x,
      z: -d,
      got: false
    });
  }

  function clearEntities() {
    for (const o of obstacles) scene.remove(o.mesh);
    obstacles = [];

    for (const c of coins) scene.remove(c.mesh);
    coins = [];

    for (const p of powers) scene.remove(p.mesh);
    powers = [];

    for (const d of discs) scene.remove(d.m);
    discs = [];

    for (const p of parts) scene.remove(p.m);
    parts = [];
  }

  function buildLevel(num = 1, seed = null) {
    _loadLevelWorld(num);
    clearEntities();

    rngState = (seed !== null && seed !== undefined) ? (Number(seed) || 12345) : (num * 1000 + 42);

    const finish = finishDistance;
    const minGap = levelData?.minObstacleGap || 12.0;

    // 1. Spawner de Monedas (cada 35m)
    for (let d = 30; d < finish - 35; d += 32) {
      const isArc = rng() > 0.5;
      spawnCoinsPattern(d, isArc ? 'ARC' : 'LINE');
    }

    // 2. Spawner de Power-Ups (cada 120m)
    const puTypes = ['SHIELD', 'MAGNET', 'TURBO', 'DOUBLE_JUMP'];
    let puIdx = 0;
    for (let d = 80; d < finish - 60; d += 110 + rng() * 30) {
      spawnPowerUp(d, puTypes[puIdx % puTypes.length]);
      puIdx++;
    }

    // 3. Spawner de Obstáculos balanceados con separación segura
    for (let d = 45; d < finish - 30; d += minGap + rng() * 8) {
      const r = rng();
      if (r < 0.28) {
        addBar(d, (rng() * 2 - 1) * 2.7, false);
      } else if (r < 0.52) {
        addPillar(d, (rng() * 2 - 1) * 3.4);
      } else if (r < 0.76) {
        // Láser elevado: esquivar deslizándose (Slide)
        addLaser(d, 0);
      } else {
        // Dron patrullero volador
        addDrone(d, (rng() * 2 - 1) * 3.0);
      }
    }
  }

  function burst(x, y, z, col, n) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(partG, new THREE.MeshBasicMaterial({ color: col, transparent: true }));
      m.position.set(x, y, z);
      scene.add(m);
      parts.push({
        m,
        v: new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 6 + 2, (Math.random() - 0.5) * 8),
        l: 1
      });
    }
  }

  function _playerEntryIsLocal(entry) {
    if (!entry) return false;
    if (localPlayerId && entry.playerId) return entry.playerId === localPlayerId;
    if (typeof Network !== 'undefined' && Network.playerSlot !== null && Network.playerSlot !== undefined) {
      return entry.slot === Network.playerSlot;
    }
    return false;
  }

  function _applyRaceSnapshot(snapshot) {
    officialRaceState = snapshot;
    if (snapshot.goalWorldX !== undefined) {
      officialGoalWorldX = Number(snapshot.goalWorldX) || finishDistance;
    }
    const list = Array.isArray(snapshot.players) ? snapshot.players : [];
    const localEntry = list.find(_playerEntryIsLocal) || null;
    const remoteEntry = list.find(entry => entry !== localEntry) || null;

    if (localEntry) {
      officialLocalX = Number(localEntry.worldX) || 0;
      if (localEntry.isAlive === false && lives > 0) {
        lives = 0;
        _updateHud();
        end(false);
      }
    }

    if (remoteEntry) {
      officialRemoteX = Number(remoteEntry.worldX) || 0;
      remoteTargetDist = officialRemoteX;
      remoteTargetPx = Number(remoteEntry.px) || 0;
      remoteTargetPy = Number(remoteEntry.y) || 0;
      remoteTargetSpeed = Number(remoteEntry.speed) || speed;
      // Usar Date.now() local como referencia del "cuándo llegó el paquete"
      // para que el dead reckoning sea relativo al reloj local (sin drift de servidor)
      remoteTargetAt = Date.now();
      rivalLives = Number(remoteEntry.lives) || 0;
      rivalScore = Number(remoteEntry.score) || 0;
      rivalCoins = Number(remoteEntry.coins) || 0;
      rivalShield = !!remoteEntry.shield;
      rivalIsTurbo = (Number(remoteEntry.turboTimer) > 0);
      rivalIsDucking = !!remoteEntry.isDucking;
      rivalHasFinished = !!remoteEntry.hasFinished;
      rivalIsWinner = !!remoteEntry.isWinner;
    }
  }

  function _handleRaceFinished(data) {
    if (raceFinished) return;
    raceFinished = true;
    raceResult = data;
    const isWinner = data.winnerId === localPlayerId;
    state = isWinner ? 'win' : 'lose';

    const myResult = data.results?.find(_playerEntryIsLocal) || {
      name: (typeof ScoreManager !== 'undefined' ? ScoreManager.getPlayerName() : 'Tú') || 'Host',
      color: myCustomColor || '#00F0FF',
      score: Math.floor(score + dist * 10),
      coins: coinsCount,
      time: time.toFixed(1),
      isWinner: isWinner
    };
    const oppResult = data.results?.find(r => !_playerEntryIsLocal(r)) || {
      name: rivalName,
      color: rivalColor,
      score: rivalScore,
      coins: rivalCoins,
      time: rivalHasFinished ? time.toFixed(1) : '--',
      isWinner: !isWinner && !!data.winnerId
    };

    if (hudCallbacks?.onEnd) {
      hudCallbacks.onEnd(isWinner, {
        isOnline: true,
        level: currentLevelNum,
        winnerId: data.winnerId,
        winnerName: data.winnerName,
        reason: data.reason,
        myResult,
        oppResult,
        time: time.toFixed(1),
        lives: Math.max(0, lives),
        coins: coinsCount,
        score: Math.floor(score + dist * 10 + (isWinner ? 500 : 200))
      });
    }

    if (typeof AudioManager !== 'undefined') {
      AudioManager.play(isWinner ? 'goal' : 'hit');
    }
  }

  /**
   * Inicia la carrera en el nivel especificado (soporta opciones para Multiplayer Online)
   */
  function start(levelNum = 1, options = {}) {
    isOnline = !!options.isOnline;
    currentRaceId = options.raceId || null;
    localPlayerId = (typeof Network !== 'undefined' && Network.playerId) ? Network.playerId : null;
    myCustomColor = options.myColor || '#00F0FF';
    rivalName = options.rivalName || 'Rival';
    rivalColor = options.rivalColor || '#FF007F';
    const matchSeed = (options.seed !== undefined && options.seed !== null) ? options.seed : (levelNum * 1000 + 42);

    hasReportedFinish = false;
    raceFinished = false;
    raceResult = null;
    officialRaceState = null;
    officialLocalX = 0;
    officialRemoteX = 0;
    officialGoalWorldX = null;

    rivalPx = 0;
    rivalPy = 0;
    rivalDist = 0;
    rivalCamX = 0;
    rivalSpeed = 14;
    rivalPhase = 0;
    rivalGrounded = true;
    rivalIsDucking = false;
    rivalIsTurbo = false;
    rivalShield = false;
    rivalLives = 3;
    rivalScore = 0;
    rivalCoins = 0;
    rivalHasFinished = false;
    rivalIsWinner = false;
    remoteTargetDist = 0;
    remoteTargetPx = 0;
    remoteTargetPy = 0;
    remoteTargetSpeed = 14;
    remoteTargetAt = 0;

    buildLevel(levelNum, matchSeed);
    px = py = vy = vx = dist = time = 0;
    score = 0;
    coinsCount = 0;
    inv = slow = shake = jumpBuf = landT = 0;
    cdDisc = dashTimer = dashCooldown = 0;
    speed = levelData?.baseSpeed || 14.0;
    lives = 3;
    grounded = true;
    isDucking = false;
    isFastFalling = false;

    // Reset de Power-Ups
    shieldActive = false;
    magnetTimer = 0;
    turboTimer = 0;
    doubleJumpTimer = 0;
    canDoubleJump = false;

    // Recrear Corredor Local con su color personalizado
    if (playerRig?.root) {
      scene.remove(playerRig.root);
      if (playerRig.shieldM) scene.remove(playerRig.shieldM);
      if (playerRig.shieldS) scene.remove(playerRig.shieldS);
      playerRig = null;
    }
    const localColorHex = myCustomColor ? parseInt(myCustomColor.replace('#', '0x'), 16) : (levelData?.palette?.neonMain || CY);
    playerRig = Neon3DPlayer.create(scene, { glowColor: localColorHex });

    // En multijugador online, crear el corredor rival y su letrero de neón
    if (rivalRig?.root) {
      scene.remove(rivalRig.root);
      if (rivalRig.shieldM) scene.remove(rivalRig.shieldM);
      if (rivalRig.shieldS) scene.remove(rivalRig.shieldS);
      rivalRig = null;
    }
    if (rivalNameplate) {
      scene.remove(rivalNameplate);
      rivalNameplate = null;
    }

    if (isOnline) {
      const rivalColorHex = rivalColor ? parseInt(rivalColor.replace('#', '0x'), 16) : MG;
      rivalRig = Neon3DPlayer.create(scene, { glowColor: rivalColorHex });
      rivalNameplate = _createNameplateSprite(rivalName, rivalColor);
      scene.add(rivalNameplate);

      // ── Activar Split-Screen ─────────────────────────────────────────────
      isSplitScreen = true;
      _createSplitDivider();
      const localDisplayName = (typeof Network !== 'undefined' && Network.playerName)
        ? Network.playerName
        : (typeof ScoreManager !== 'undefined' ? ScoreManager.getPlayerName() : 'TÚ');
      _showSplitDivider(localDisplayName || 'TÚ', myCustomColor, rivalName, rivalColor);
      resize(); // Recalcular aspect ratios para ambas cámaras

      if (typeof Network !== 'undefined') {
        Network.onRaceState = (snapshot) => {
          if (!snapshot || snapshot.raceId !== currentRaceId) return;
          if (officialRaceState && snapshot.tick <= officialRaceState.tick) return;
          _applyRaceSnapshot(snapshot);
        };

        Network.onPlayerGoalReached = (data) => {
          if (!data || (data.raceId !== undefined && data.raceId !== currentRaceId)) return;
          const isLocal = _playerEntryIsLocal(data);
          if (!isLocal) {
            rivalHasFinished = true;
            if (hudCallbacks?.onToast) hudCallbacks.onToast(`🏁 ¡${rivalName} cruzó la meta!`, rivalColor);
          }
        };

        Network.onRaceFinished = (data) => {
          if (!data || data.raceId !== currentRaceId) return;
          _handleRaceFinished(data);
        };

        Network.onOpponentDisconnected = () => {
          if (state === 'play' && !raceFinished) {
            if (hudCallbacks?.onToast) hudCallbacks.onToast('⚠️ Tu rival se desconectó. Esperando reconexión...', '#FFD700');
          }
        };

        Network.onOpponentReconnected = () => {
          if (state === 'play' && !raceFinished) {
            if (hudCallbacks?.onToast) hudCallbacks.onToast('✅ Tu rival se reconectó a la carrera.', '#00FF88');
          }
        };
      }
    }

    state = 'play';
    clock.start();

    if (hudCallbacks?.onToast) {
      const toastMsg = isOnline 
        ? `¡CARRERA 3D ONLINE! VS ${rivalName.toUpperCase()}` 
        : `¡NIVEL ${levelNum} - YA!`;
      hudCallbacks.onToast(toastMsg, myCustomColor || '#2ff3ff');
    }
    _updateHud();

    if (!rafId) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function togglePause() {
    if (state === 'play') {
      if (isOnline) {
        // En partida online, el juego continúa en vivo pero se muestra el menú de pausa
        if (hudCallbacks?.onPause) hudCallbacks.onPause(true, true);
        return;
      }
      state = 'paused';
      if (hudCallbacks?.onPause) hudCallbacks.onPause(true, false);
    } else if (state === 'paused') {
      state = 'play';
      clock.getDelta(); // Descartar tiempo acumulado durante pausa
      if (hudCallbacks?.onPause) hudCallbacks.onPause(false, false);
    }
  }

  function end(win) {
    if (isOnline) {
      // En online, la finalización oficial es dictada por el servidor
      state = win ? 'win' : 'lose';
      if (hudCallbacks?.onEnd) {
        hudCallbacks.onEnd(win, {
          isOnline: true,
          level: currentLevelNum,
          time: time.toFixed(1),
          lives: Math.max(0, lives),
          coins: coinsCount,
          score: Math.floor(score + dist * 10)
        });
      }
      if (typeof AudioManager !== 'undefined') {
        AudioManager.play(win ? 'goal' : 'hit');
      }
      return;
    }

    state = win ? 'win' : 'lose';
    if (hudCallbacks?.onEnd) {
      hudCallbacks.onEnd(win, {
        isOnline: false,
        level: currentLevelNum,
        time: time.toFixed(1),
        lives: Math.max(0, lives),
        coins: coinsCount,
        score: Math.floor(score + dist * 10 + lives * 200)
      });
    }
    if (typeof AudioManager !== 'undefined') {
      AudioManager.play(win ? 'goal' : 'hit');
    }
  }

  function _updateHud() {
    if (!hudCallbacks?.onHudUpdate) return;
    const diffM = Math.round(dist - rivalDist);
    const isFirst = dist >= rivalDist;

    hudCallbacks.onHudUpdate({
      level: currentLevelNum,
      levelName: levelData?.name || `Nivel ${currentLevelNum}`,
      lives: Math.max(0, lives),
      progress: Math.min(100, (dist / finishDistance) * 100),
      time: time.toFixed(1),
      score: Math.floor(score + dist * 10),
      coins: coinsCount,
      canDisc: cdDisc <= 0,
      canDash: dashCooldown <= 0,
      shieldActive: shieldActive,
      magnetActive: magnetTimer > 0,
      turboActive: turboTimer > 0,
      doubleJumpActive: doubleJumpTimer > 0,
      // Datos Online
      isOnline: isOnline,
      isFirst: isFirst,
      distGap: diffM,
      playerProgress: Math.min(100, (dist / finishDistance) * 100),
      rivalProgress: Math.min(100, (rivalDist / finishDistance) * 100),
      rivalName: rivalName,
      rivalColor: rivalColor,
      rivalLives: rivalLives,
      rivalScore: rivalScore
    });
  }

  /**
   * Bucle principal de físicas, colisiones y renderizado
   */
  function tick() {
    rafId = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    if (state === 'play') {
      // 1. Inputs de movimiento
      const L = keys.KeyA || keys.ArrowLeft || touchState.l;
      const R = keys.KeyD || keys.ArrowRight || touchState.r;
      const F = keys.KeyW || keys.ArrowUp;
      const Bk = keys.KeyS || keys.ArrowDown || touchState.duck;

      // Agacharse en el suelo y Caída Rápida (Fast-Fall) en el aire
      isDucking = Boolean(Bk && grounded);
      if (Bk && !grounded) {
        if (!isFastFalling) {
          vy = -26.0; // Descenso instantáneo
          isFastFalling = true;
          if (typeof AudioManager !== 'undefined') AudioManager.play('whoosh');
        }
      } else if (!Bk) {
        isFastFalling = false;
      }

      // Boost de aceleración
      boost = F ? 1 : 0;
      const isTurbo = turboTimer > 0;
      const baseTargetSpeed = levelData?.baseSpeed || 14.0;
      const turboBoost = isTurbo ? 1.55 : (1.0 + boost * 0.35 + (dashTimer > 0 ? 0.7 : 0));
      const targetSpeed = baseTargetSpeed * turboBoost * (slow > 0 ? 0.5 : 1);
      speed += (targetSpeed - speed) * Math.min(1, dt * 5);

      // Movimiento lateral (clamped al ancho de pista)
      vx += (((R ? 1 : 0) - (L ? 1 : 0)) * 10 - vx) * Math.min(1, dt * 9);
      px = Math.max(-HALF, Math.min(HALF, px + vx * dt));

      dist += speed * dt;
      time += dt;

      // ── Enviar estado a la red (Modo Online 3D) ──────────────────────────
      if (isOnline && typeof Network !== 'undefined') {
        Network.sendState({
          raceId: currentRaceId,
          level: currentLevelNum,
          worldX: dist,
          px: px,
          y: py,
          vy: vy,
          speed: speed,
          isDucking: isDucking,
          hasFinished: (dist >= finishDistance),
          turboTimer: turboTimer,
          dashTimer: dashTimer,
          shield: shieldActive,
          score: Math.floor(score + dist * 10),
          coins: coinsCount,
          lives: Math.max(0, lives),
          isAlive: (lives > 0),
          elapsedMs: Math.max(0, time * 1000),
          clientTs: Date.now()     // timestamp local para dead reckoning preciso en el receptor
        });
      }

      // Físicas de Salto y Gravedad
      const grav = levelData?.gravity || 36.0;
      if (!grounded) {
        vy -= grav * dt;
        py += vy * dt;
        if (py <= 0) {
          py = 0;
          vy = 0;
          grounded = true;
          isFastFalling = false;
          landT = 1;
        }
      }

      landT = Math.max(0, landT - dt * 7);
      phase += dt * (8 + speed * 0.2);

      // Enfriamiento de habilidades
      cdDisc = Math.max(0, cdDisc - dt);
      dashTimer = Math.max(0, dashTimer - dt);
      dashCooldown = Math.max(0, dashCooldown - dt);
      inv = Math.max(0, inv - dt);
      slow = Math.max(0, slow - dt);
      shake = Math.max(0, shake - dt * 2);

      // Temporizadores de Power-Ups
      magnetTimer = Math.max(0, magnetTimer - dt);
      turboTimer = Math.max(0, turboTimer - dt);
      doubleJumpTimer = Math.max(0, doubleJumpTimer - dt);

      // ── Discos lanzados ──────────────────────────────────────────────────
      for (let i = discs.length - 1; i >= 0; i--) {
        const d = discs[i];
        const z0 = d.m.position.z;
        d.m.position.z -= 75 * dt;
        d.m.rotation.y += dt * 30;

        for (const o of obstacles) {
          if (o.dying || !o.mesh.visible) continue;
          if (o.z <= z0 + 1 && o.z >= d.m.position.z - 1 && Math.abs(o.x - d.m.position.x) < o.hw + 0.6) {
            o.dying = 0.01;
            d.hit++;
            shake = Math.max(shake, 0.3);
            score += 100;
            burst(o.x, 1, o.z, CY, 14);
            if (hudCallbacks?.onToast) hudCallbacks.onToast('¡DESTRUIDO! +100', '#2ff3ff');
          }
        }
        if (d.m.position.z < d.z0 - 60 || d.hit >= 2) {
          scene.remove(d.m);
          discs.splice(i, 1);
        }
      }

      const pz = -dist;

      // ── Colisión con Monedas y Atracción Magnética ────────────────────────
      const magnetRadius = magnetTimer > 0 ? 6.5 : 1.2;
      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i];
        if (c.got) continue;

        c.mesh.rotation.y += dt * 4;

        // Atracción magnética
        const dx = px - c.mesh.position.x;
        const dy = (py + 0.6) - c.mesh.position.y;
        const dz = pz - c.mesh.position.z;
        const distToPlayer = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (magnetTimer > 0 && distToPlayer < magnetRadius) {
          c.mesh.position.x += dx * dt * 8;
          c.mesh.position.y += dy * dt * 8;
          c.mesh.position.z += dz * dt * 8;
        }

        if (distToPlayer < 1.3) {
          c.got = true;
          c.mesh.visible = false;
          coinsCount++;
          score += 50;
          burst(c.mesh.position.x, c.mesh.position.y, c.mesh.position.z, 0xFFD700, 8);
          if (typeof AudioManager !== 'undefined') AudioManager.play('coin');
          if (hudCallbacks?.onToast) hudCallbacks.onToast('+50 🪙', '#ffd700');
        }
      }

      // ── Colisión con Power-Ups ───────────────────────────────────────────
      for (const p of powers) {
        if (p.got) continue;
        p.mesh.rotation.y += dt * 2.5;
        if (p.mesh.userData.ring) p.mesh.userData.ring.rotation.z += dt * 3;
        p.mesh.position.y = 1.4 + Math.sin(t * 3 + p.z) * 0.25;

        if (Math.abs(p.z - pz) < 1.2 && Math.abs(p.x - px) < 1.3 && py < 2.5) {
          p.got = true;
          p.mesh.visible = false;

          if (p.type === 'SHIELD') {
            shieldActive = true;
            burst(px, 1.2, pz, CY, 16);
            if (hudCallbacks?.onToast) hudCallbacks.onToast('🛡️ ESCUDO ACTIVADO', '#2ff3ff');
          } else if (p.type === 'MAGNET') {
            magnetTimer = 8.0;
            burst(px, 1.2, pz, 0xFFD700, 16);
            if (hudCallbacks?.onToast) hudCallbacks.onToast('🧲 IMÁN ACTIVADO (8s)', '#ffd700');
          } else if (p.type === 'TURBO') {
            turboTimer = 4.5;
            burst(px, 1.2, pz, 0xFF3366, 20);
            if (hudCallbacks?.onToast) hudCallbacks.onToast('⚡ HIPER-TURBO (4.5s)', '#ff3366');
          } else if (p.type === 'DOUBLE_JUMP') {
            doubleJumpTimer = 10.0;
            canDoubleJump = true;
            burst(px, 1.2, pz, 0x00FF88, 16);
            if (hudCallbacks?.onToast) hudCallbacks.onToast('🦘 DOBLE SALTO (10s)', '#00ff88');
          }

          if (typeof AudioManager !== 'undefined') AudioManager.play('powerup');
        }
      }

      // ── Colisiones con Obstáculos ─────────────────────────────────────────
      for (const o of obstacles) {
        if (o.dying) {
          o.dying += dt * 3;
          o.mesh.position.y += dt * 8;
          o.mesh.rotation.z += dt * 8;
          o.mesh.scale.setScalar(Math.max(0.01, 1 - o.dying * 0.5));
          if (o.dying > 2) o.mesh.visible = false;
          continue;
        }

        // Animación de drones voladores
        if (o.isDrone) {
          o.phase += dt * 3;
          o.mesh.position.y = 1.8 + Math.sin(o.phase) * 0.45;
          if (o.mesh.userData.rotor) o.mesh.userData.rotor.rotation.y += dt * 25;
        }

        const inZ = Math.abs(o.z - pz) < (o.hd + 0.35);
        const inX = Math.abs(o.x - px) < (o.hw + 0.35);

        // Comprobación de altura según agachado / salto
        let hitY = false;
        if (o.isLaser) {
          // Láser elevado: si estás agachado en el suelo, la altura es menor a 0.7m y pasas a salvo
          hitY = !(isDucking && grounded);
        } else if (o.isDrone) {
          // Dron flotante: golpea a media altura, se esquiva agachándose o saltando alto
          const droneY = o.mesh.position.y;
          hitY = Math.abs(py + 0.8 - droneY) < 0.8 && !isDucking;
        } else {
          // Barras y Pilares en el suelo
          hitY = py < (o.h - 0.1);
        }

        if (inZ && inX && hitY) {
          // 1. Modo Hiper-Turbo: destruye todo a su paso
          if (isTurbo) {
            o.dying = 0.01;
            shake = 0.45;
            score += 100;
            burst(o.x, 1, o.z, 0xFF3366, 16);
            if (hudCallbacks?.onToast) hudCallbacks.onToast('⚡ ¡OBSTÁCULO DEMOLIDO! +100', '#ff3366');
            if (typeof AudioManager !== 'undefined') AudioManager.play('hit');
          }
          // 2. Escudo Cibernético: absorbe el impacto
          else if (shieldActive) {
            shieldActive = false;
            o.dying = 0.01;
            shake = 0.4;
            burst(o.x, 1, o.z, CY, 16);
            if (hudCallbacks?.onToast) hudCallbacks.onToast('🛡️ ¡ESCUDO ABSORBIÓ IMPACTO!', '#2ff3ff');
            if (typeof AudioManager !== 'undefined') AudioManager.play('shield');
          }
          // 3. Impacto directo: daño y pérdida de vida
          else if (inv <= 0) {
            lives--;
            inv = 1.6;
            slow = 0.9;
            shake = 0.8;
            burst(px, 1, pz, MG, 16);
            if (hudCallbacks?.onToast) hudCallbacks.onToast('¡IMPACTO!', '#ff2bd6');
            if (typeof AudioManager !== 'undefined') AudioManager.play('hit');
            if (lives <= 0) {
              _updateHud();
              end(false);
            }
          }
        }
      }

      // Llegada a la meta
      if (dist >= finishDistance) {
        if (isOnline) {
          if (!hasReportedFinish && typeof Network !== 'undefined') {
            hasReportedFinish = true;
            Network.sendPlayerFinished({
              raceId: currentRaceId,
              elapsedMs: time * 1000,
              time: Math.round(time),
              worldX: dist,
              score: Math.floor(score + dist * 10),
              coins: coinsCount
            });
          }
        } else {
          end(true);
        }
      }
      _updateHud();

    } else if (state === 'win') {
      speed *= Math.pow(0.02, dt);
      dist += speed * dt;
      if (grounded && speed < 3) {
        vy = 7;
        grounded = false;
      }
      if (!grounded) {
        vy -= 30 * dt;
        py += vy * dt;
        if (py <= 0) {
          py = 0;
          vy = 0;
          grounded = true;
        }
      }
      vx *= 0.9;
      px += vx * dt;
    }

    const pz = -dist;

    // Actualizar partículas activas
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.l -= dt * 1.4;
      q.v.y -= 18 * dt;
      q.m.position.addScaledVector(q.v, dt);
      q.m.rotation.x += dt * 6;
      q.m.material.opacity = Math.max(0, q.l);
      if (q.l <= 0) {
        scene.remove(q.m);
        q.m.material.dispose();
        parts.splice(i, 1);
      }
    }

    // Animar y posicionar modelo del corredor
    playerRig.root.position.set(px, py, pz);
    Neon3DPlayer.animate(playerRig, dt, grounded, speed, phase, boost, state === 'win' && speed < 6, {
      isDucking,
      isFastFalling,
      isTurbo: turboTimer > 0,
      hasMagnet: magnetTimer > 0
    });

    playerRig.torso.position.y = 1.05 + (grounded && !isDucking ? Math.abs(Math.sin(phase)) * 0.07 : 0);
    playerRig.root.scale.y = 1 - 0.1 * landT;
    Neon3DPlayer.damp(playerRig.root, 'z', -vx * 0.03, dt, 10);
    Neon3DPlayer.damp(playerRig.root, 'y', -vx * 0.045 + (state === 'win' ? Math.sin(t * 2) * 0.3 : 0), dt, 10);

    // Parpadeo en invulnerabilidad
    playerRig.root.visible = !(inv > 0 && Math.floor(t * 14) % 2 === 0);

    // Escudo visual
    playerRig.shieldM.visible = playerRig.shieldS.visible = shieldActive;
    if (shieldActive) {
      playerRig.shieldM.position.set(px, py + 1.1, pz);
      playerRig.shieldS.position.copy(playerRig.shieldM.position);
      playerRig.shieldM.rotation.y += dt * 2;
      playerRig.shieldM.rotation.x += dt;
    }

    // ── Actualizar e interpolar corredor Rival en la pista 3D ────────────────
    if (isOnline && rivalRig) {
      if (officialRaceState) {
        // Dead reckoning correcto: cuántos segundos pasaron desde el último paquete
        // (máx 300 ms para evitar que el rival "salte" demasiado lejos si hay desconexión breve)
        const elapsedSec = Math.min(0.3, (Date.now() - remoteTargetAt) / 1000);
        const predictedDist = remoteTargetDist + remoteTargetSpeed * elapsedSec;
        const targetDist = Math.max(0, Math.min(finishDistance, predictedDist));

        // Blend suave — más rápido cuando hay brecha grande, más lento al estar cerca
        const dDist = targetDist - rivalDist;
        const blendDist = Math.abs(dDist) > 80
          ? 1.0                                      // Teletransporte inmediato si hay desfase grave (>80 m)
          : 1 - Math.exp(-8 * dt);                  // Suavizado exponencial normal
        rivalDist += dDist * blendDist;

        const blendPos = 1 - Math.exp(-10 * dt);
        rivalPx += (remoteTargetPx - rivalPx) * blendPos;
        rivalPy += (remoteTargetPy - rivalPy) * blendPos;
        rivalGrounded = rivalPy <= 0.08;
        if (rivalGrounded) rivalPy = 0;
        rivalPhase += dt * (8 + remoteTargetSpeed * 0.2);

        rivalRig.root.position.set(rivalPx, rivalPy, -rivalDist);
        Neon3DPlayer.animate(rivalRig, dt, rivalGrounded, remoteTargetSpeed, rivalPhase, 0, rivalHasFinished, {
          isDucking: rivalIsDucking,
          isFastFalling: false,
          isTurbo: rivalIsTurbo,
          hasMagnet: false
        });

        rivalRig.torso.position.y = 1.05 + (rivalGrounded && !rivalIsDucking ? Math.abs(Math.sin(rivalPhase)) * 0.07 : 0);
        rivalRig.shieldM.visible = rivalRig.shieldS.visible = rivalShield;
        if (rivalShield) {
          rivalRig.shieldM.position.set(rivalPx, rivalPy + 1.1, -rivalDist);
          rivalRig.shieldS.position.copy(rivalRig.shieldM.position);
          rivalRig.shieldM.rotation.y += dt * 2;
        }
        rivalRig.flameL.visible = rivalRig.flameR.visible = rivalIsTurbo;

        if (rivalNameplate) {
          rivalNameplate.position.set(rivalPx, rivalPy + 2.4, -rivalDist);
        }
      } else {
        // En espera de los primeros paquetes: colocar rival en línea de salida
        rivalRig.root.position.set(rivalPx, rivalPy, -rivalDist);
        if (rivalNameplate) rivalNameplate.position.set(rivalPx, rivalPy + 2.4, -rivalDist);
      }
    }

    // Luces y fondo
    worldData.playerLight.position.set(px, py + 2.5, pz - 1);
    worldData.sun.position.set(0, 52, pz - 330);
    worldData.stars.position.set(0, 0, pz);

    // Cámara cinética con seguimiento dinámico y sacudida de pantalla
    camX += (px * 0.7 - camX) * Math.min(1, dt * 5);
    _updateCameraForPlayer(camera, px, py, pz, camX, shake, dt);

    // ── Split-Screen: cámara del rival (suavizada) ──────────────────────────
    if (isSplitScreen && rivalRig) {
      rivalCamX += (rivalPx * 0.7 - rivalCamX) * Math.min(1, dt * 5);
      _updateCameraForPlayer(cameraRival, rivalPx, rivalPy, -rivalDist, rivalCamX, 0, dt);
    }

    // Renderizar fotograma
    if (state !== 'idle') {
      if (isSplitScreen) {
        _renderSplitScreen(dt);
      } else if (composer) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
    }
  }

  function stop() {
    state = 'idle';
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (rivalRig?.root) {
      scene.remove(rivalRig.root);
      if (rivalRig.shieldM) scene.remove(rivalRig.shieldM);
      if (rivalRig.shieldS) scene.remove(rivalRig.shieldS);
      rivalRig = null;
    }
    if (rivalNameplate) {
      scene.remove(rivalNameplate);
      rivalNameplate = null;
    }
    // Desactivar split-screen
    isSplitScreen = false;
    _hideSplitDivider();
    isOnline = false;
    currentRaceId = null;
    officialRaceState = null;
  }

  return {
    init,
    start,
    stop,
    togglePause,
    resize,
    setTouchInput,
    throwDisc,
    dash,
    get state() { return state; },
    get currentLevel() { return currentLevelNum; }
  };
})();
