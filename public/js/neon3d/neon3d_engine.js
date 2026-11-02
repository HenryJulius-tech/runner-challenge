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
  let camera = null;
  let composer = null;
  let worldData = null;
  let playerRig = null;

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

  // Estadísticas de partida
  let lives = 3;
  let score = 0;
  let coinsCount = 0;
  let inv = 0;
  let slow = 0;
  let shake = 0;
  let boost = 0;
  let camX = 0;

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

    // Configurar Bloom si están disponibles los shaders
    if (typeof THREE.EffectComposer !== 'undefined' && typeof THREE.UnrealBloomPass !== 'undefined') {
      composer = new THREE.EffectComposer(renderer);
      composer.addPass(new THREE.RenderPass(scene, camera));
      composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), isTouch ? 0.85 : 1.1, 0.55, 0.12));
    }

    _loadLevelWorld(currentLevelNum);
    playerRig = Neon3DPlayer.create(scene);

    resize();
    window.addEventListener('resize', resize);
    _bindControls();
  }

  function resize() {
    if (!renderer || !canvas) return;
    const w = canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || canvas.parentElement?.clientHeight || window.innerHeight;
    if (w === 0 || h === 0) return;

    renderer.setSize(w, h, false);
    if (composer) composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
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

  function spawnCoinsPattern(startDist, type = 'LINE') {
    const count = 4;
    const spacing = 3.2;
    const laneX = (Math.random() * 2 - 1) * 2.8;

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
    const x = (Math.random() * 2 - 1) * 3.0;
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

  function buildLevel(num = 1) {
    _loadLevelWorld(num);
    clearEntities();

    const finish = finishDistance;
    const minGap = levelData?.minObstacleGap || 12.0;

    // 1. Spawner de Monedas (cada 35m)
    for (let d = 30; d < finish - 35; d += 32) {
      const isArc = Math.random() > 0.5;
      spawnCoinsPattern(d, isArc ? 'ARC' : 'LINE');
    }

    // 2. Spawner de Power-Ups (cada 120m)
    const puTypes = ['SHIELD', 'MAGNET', 'TURBO', 'DOUBLE_JUMP'];
    let puIdx = 0;
    for (let d = 80; d < finish - 60; d += 110 + Math.random() * 30) {
      spawnPowerUp(d, puTypes[puIdx % puTypes.length]);
      puIdx++;
    }

    // 3. Spawner de Obstáculos balanceados con separación segura
    for (let d = 45; d < finish - 30; d += minGap + Math.random() * 8) {
      const r = Math.random();
      if (r < 0.28) {
        addBar(d, (Math.random() * 2 - 1) * 2.7, false);
      } else if (r < 0.52) {
        addPillar(d, (Math.random() * 2 - 1) * 3.4);
      } else if (r < 0.76) {
        // Láser elevado: esquivar deslizándose (Slide)
        addLaser(d, 0);
      } else {
        // Dron patrullero volador
        addDrone(d, (Math.random() * 2 - 1) * 3.0);
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

  /**
   * Inicia la carrera en el nivel especificado
   */
  function start(levelNum = 1) {
    buildLevel(levelNum);
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

    state = 'play';
    clock.start();

    if (hudCallbacks?.onToast) hudCallbacks.onToast(`¡NIVEL ${levelNum} - YA!`, '#2ff3ff');
    _updateHud();

    if (!rafId) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function togglePause() {
    if (state === 'play') {
      state = 'paused';
      if (hudCallbacks?.onPause) hudCallbacks.onPause(true);
    } else if (state === 'paused') {
      state = 'play';
      clock.getDelta(); // Descartar tiempo acumulado durante pausa
      if (hudCallbacks?.onPause) hudCallbacks.onPause(false);
    }
  }

  function end(win) {
    state = win ? 'win' : 'lose';
    if (hudCallbacks?.onEnd) {
      hudCallbacks.onEnd(win, {
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
      doubleJumpActive: doubleJumpTimer > 0
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
        end(true);
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

    // Luces y fondo
    worldData.playerLight.position.set(px, py + 2.5, pz - 1);
    worldData.sun.position.set(0, 52, pz - 330);
    worldData.stars.position.set(0, 0, pz);

    // Cámara cinética con seguimiento dinámico y sacudida de pantalla
    camX += (px * 0.7 - camX) * Math.min(1, dt * 5);
    const isPortrait = camera.aspect < 0.8;
    const sx = (Math.random() - 0.5) * shake * 0.5;
    const sy = (Math.random() - 0.5) * shake * 0.5;

    camera.position.set(camX + sx, (isPortrait ? 4.5 : 3.7) + py * 0.3 + sy, pz + (isPortrait ? 10.5 : 8));
    camera.lookAt(camX * 0.6 + px * 0.3, 1.6, pz - 9);

    const targetFov = (isPortrait ? 78 : 62) + Math.min(speed, 26) * 0.6;
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();

    // Renderizar fotograma
    if (state !== 'idle') {
      if (composer) composer.render();
      else renderer.render(scene, camera);
    }
  }

  function stop() {
    state = 'idle';
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
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
