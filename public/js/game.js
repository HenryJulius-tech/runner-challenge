/**
 * game.js — Motor de Juego de Runner Challenge: Neon Run
 * 
 * Responsabilidades:
 *  - Bucle principal requestAnimationFrame (60 FPS estables)
 *  - Modo Solo (Pantalla Completa) y Modo Multijugador (Pantalla Dividida / Split-Screen)
 *  - Soporte de Pantalla Dividida Horizontal (Arriba/Abajo) y Vertical (Izquierda/Derecha)
 *  - Cámaras independientes por jugador (seguimiento dedicado y sacudida de impacto aislada)
 *  - Pistas simétricas y justas (generación determinista de obstáculos y monedas con semilla)
 *  - Telemetría de carrera en tiempo real (posiciones 1º/2º, metros de ventaja, badge VS dinámico)
 *  - Mapeo de controles simultáneo en 1 PC:
 *      * Player 1: W / Espacio (Saltar), S (Agacharse), D / Shift (Dash)
 *      * Player 2: Flecha Arriba (Saltar), Flecha Abajo (Agacharse), Flecha Derecha (Dash)
 */

const Game = (() => {

  const STATE = {
    IDLE:           'idle',
    PLAYING:        'playing',
    PAUSED:         'paused',
    GAMEOVER:       'gameover',
    LEVEL_COMPLETE: 'levelcomplete',
    VICTORY:        'victory'
  };

  let state          = STATE.IDLE;
  let rafId          = null;
  let lastTime       = 0;
  let hitStopFrames  = 0; // Pausa temporal por hit-stop

  // Configuración de partida
  let currentLevel   = 1;
  let levelData      = null;
  let isMultiplayer  = false;
  let splitMode      = 'horizontal'; // 'horizontal' | 'vertical'
  let isOnline       = false;
  let networkSeed    = null;
  let networkOpponentState = null;

  // Componentes Viewport 1 (Player 1)
  let canvas1        = null;
  let renderer1      = null;
  let camera1        = null;
  let obstacles1     = null;
  let coinSystem1    = null;
  let powerUpSystem1 = null;

  // Componentes Viewport 2 (Player 2)
  let canvas2        = null;
  let renderer2      = null;
  let camera2        = null;
  let obstacles2     = null;
  let coinSystem2    = null;
  let powerUpSystem2 = null;

  // Jugadores y Estadísticas
  let players        = []; // [Player 1] o [Player 1, Player 2]
  let p1Stats        = { score: 0, coins: 0, time: 0, isWinner: false, isAlive: true };
  let p2Stats        = { score: 0, coins: 0, time: 0, isWinner: false, isAlive: true };
  let startTime      = 0;
  let goalWorldX     = 3000;
  let raceFinished   = false;
  let winnerChosen   = false;

  // Teclado
  const keys = {};

  /**
   * Inicializa el motor de juego y sus escuchadores de eventos
   */
  function init() {
    canvas1 = document.getElementById('canvas-p1');
    canvas2 = document.getElementById('canvas-p2');

    // Eventos de teclado
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);

    // Controles de botones de UI
    document.getElementById('btn-pause')?.addEventListener('click', pause);
    document.getElementById('btn-resume')?.addEventListener('click', resume);
    document.getElementById('btn-restart')?.addEventListener('click', () => {
      startLevel(currentLevel, isMultiplayer, players[0]?.name, players[1]?.name);
    });
    document.getElementById('btn-exit-game')?.addEventListener('click', () => {
      stopLoop();
      UI.showScreen('menu');
    });

    // Alternar modo de división (Horizontal / Vertical)
    document.getElementById('btn-toggle-split')?.addEventListener('click', toggleSplitMode);

    // Game Over
    document.getElementById('btn-go-retry')?.addEventListener('click', () => {
      UI.hideScreen('gameover');
      startLevel(currentLevel, isMultiplayer, players[0]?.name, players[1]?.name);
    });
    document.getElementById('btn-go-menu')?.addEventListener('click', () => {
      stopLoop();
      UI.showScreen('menu');
    });

    // Resultados
    document.getElementById('btn-res-next')?.addEventListener('click', onNextLevel);
    document.getElementById('btn-res-retry')?.addEventListener('click', () => {
      UI.hideScreen('results');
      startLevel(currentLevel, isMultiplayer, players[0]?.name, players[1]?.name);
    });
    document.getElementById('btn-res-menu')?.addEventListener('click', () => {
      stopLoop();
      UI.showScreen('menu');
    });

    // Victoria
    document.getElementById('btn-vic-menu')?.addEventListener('click', () => {
      stopLoop();
      UI.showScreen('menu');
    });

    // Controles Táctiles (Móviles)
    const bindTouch = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); keys[key] = true; });
      el.addEventListener('pointerup',   (e) => { e.preventDefault(); keys[key] = false; });
      el.addEventListener('pointerleave',(e) => { e.preventDefault(); keys[key] = false; });
    };
    bindTouch('btn-touch-jump', 'Space');
    bindTouch('btn-touch-duck', 'KeyS');
    bindTouch('btn-touch-dash', 'KeyD');

    // Redimensionamiento dinámico de viewports
    window.addEventListener('resize', onWindowResize);
  }

  /**
   * Manejador de redimensionamiento
   */
  function onWindowResize() {
    if (renderer1) {
      renderer1.resize();
      if (players[0]) players[0].groundY = renderer1.groundY;
    }
    if (isMultiplayer && renderer2) {
      renderer2.resize();
      if (players[1]) players[1].groundY = renderer2.groundY;
    }
  }

  /**
   * Alterna entre pantalla dividida horizontal y vertical
   */
  function toggleSplitMode() {
    setSplitMode(splitMode === 'horizontal' ? 'vertical' : 'horizontal');
  }

  function setSplitMode(mode) {
    splitMode = mode;
    const container = document.getElementById('viewports-container');
    if (container) {
      container.className = `viewports-container split-${splitMode}`;
    }
    setTimeout(onWindowResize, 50);
  }

  /**
   * Inicia un nivel en modo Solo o Multiplayer con Pantalla Dividida
   * @param {number} levelNum
   * @param {boolean} multiplayer
   * @param {string} p1Name
   * @param {string} p2Name
   */
  function startLevel(levelNum = 1, multiplayer = false, p1Name = 'Player 1', p2Name = 'Player 2', online = false, seed = null) {
    currentLevel  = levelNum;
    isMultiplayer = multiplayer;
    isOnline      = online;
    networkSeed   = seed;
    levelData     = LevelConfig.getLevelData(levelNum);
    raceFinished  = false;
    winnerChosen  = false;
    
    if (isOnline && typeof Network !== 'undefined') {
      Network.onOpponentState = (state) => {
        networkOpponentState = state;
      };
      Network.onOpponentDisconnected = () => {
        if (state === STATE.PLAYING && !raceFinished) {
          UI.showToast('⚠️ Tu rival se ha desconectado. ¡Victoria por abandono!', 'warning');
          winnerChosen = true;
          if (players[0]) {
            players[0].isWinner = true;
            p1Stats.isWinner = true;
            p1Stats.score += 500;
          }
          if (players[1]) {
            players[1].isAlive = false;
            p2Stats.isAlive = false;
          }
          raceFinished = true;
          setTimeout(() => {
            _onRaceComplete();
          }, 1200);
        }
      };
    }

    if (!levelData) {
      console.error('[Game] Error: Nivel no encontrado:', levelNum);
      return;
    }

    // Configurar elementos de Pantalla Dividida en el DOM
    const container   = document.getElementById('viewports-container');
    const viewportP2  = document.getElementById('viewport-p2');
    const splitDiv    = document.getElementById('split-divider');
    const btnSplit    = document.getElementById('btn-toggle-split');
    const p2Progress  = document.getElementById('progress-bar-fill-p2');
    const p2Icon      = document.getElementById('progress-icon-p2');

    if (container) {
      container.className = `viewports-container split-${splitMode}`;
    }

    if (multiplayer) {
      viewportP2?.classList.remove('hidden');
      splitDiv?.classList.remove('hidden');
      btnSplit?.classList.remove('hidden');
      p2Progress?.classList.remove('hidden');
      p2Icon?.classList.remove('hidden');
    } else {
      viewportP2?.classList.add('hidden');
      splitDiv?.classList.add('hidden');
      btnSplit?.classList.add('hidden');
      p2Progress?.classList.add('hidden');
      p2Icon?.classList.add('hidden');
    }

    // Inicializar Renderers para cada Viewport
    if (!renderer1) {
      renderer1 = new Renderer(canvas1, levelData);
    } else {
      renderer1.levelData = levelData;
      renderer1.resize();
    }

    if (multiplayer) {
      if (!renderer2) {
        renderer2 = new Renderer(canvas2, levelData);
      } else {
        renderer2.levelData = levelData;
        renderer2.resize();
      }
    }

    // Resetear Partículas Globales
    if (window.GlobalParticles) {
      window.GlobalParticles.clear();
    }

    // Inicializar Cámaras dedicadas para cada jugador
    if (!camera1) camera1 = new CameraController(canvas1);
    camera1.reset(0);

    if (multiplayer) {
      if (!camera2) camera2 = new CameraController(canvas2);
      camera2.reset(0);
    }

    // Meta del nivel
    goalWorldX = levelData.levelLength ?? 3200;

    // Generación determinista con semilla para pistas justas e idénticas
    const levelSeed = isOnline ? networkSeed : (levelNum * 1000 + 42);
    obstacles1     = new ObstacleSystem(levelData, levelSeed);
    coinSystem1    = new CoinSystem(levelData, levelSeed + 500);
    powerUpSystem1 = new PowerUpSystem(levelData, levelSeed + 250);

    if (multiplayer) {
      obstacles2     = new ObstacleSystem(levelData, levelSeed);
      coinSystem2    = new CoinSystem(levelData, levelSeed + 500);
      powerUpSystem2 = new PowerUpSystem(levelData, levelSeed + 250);
    }

    // Instanciar Corredores
    players = [];

    // Player 1 (Cyan)
    const p1 = new Player({
      worldX: 0,
      groundY: renderer1.groundY,
      color: '#00F0FF',
      name: p1Name || 'Player 1',
      levelData,
      playerIndex: 0
    });
    players.push(p1);

    // Player 2 (Magenta) — Sólo en modo Multijugador
    if (multiplayer) {
      const p2 = new Player({
        worldX: 0,
        groundY: renderer2.groundY,
        color: '#FF007F',
        name: p2Name || 'Player 2',
        levelData,
        playerIndex: 1
      });
      players.push(p2);
    }

    // Inicializar estadísticas de sesión
    startTime = performance.now();
    p1Stats   = { score: 0, coins: 0, time: 0, isWinner: false, isAlive: true };
    p2Stats   = { score: 0, coins: 0, time: 0, isWinner: false, isAlive: true };

    // Actualizar nombres en los badges de cada Viewport
    const p1NameEl = document.getElementById('vp-p1-name');
    const p2NameEl = document.getElementById('vp-p2-name');
    if (p1NameEl) p1NameEl.textContent = p1.name;
    if (p2NameEl) p2NameEl.textContent = players[1]?.name || 'Player 2';

    document.getElementById('hud-level-val').textContent = `NIVEL ${currentLevel}`;

    // Mostrar pantalla de juego
    UI.showScreen('game');

    // Iniciar Audio
    AudioManager.resume();
    AudioManager.startMusic();

    // Iniciar Bucle a 60 FPS
    state = STATE.PLAYING;
    if (rafId) cancelAnimationFrame(rafId);
    lastTime = performance.now();
    rafId = requestAnimationFrame(gameLoop);
  }

  function startLevelOnline(levelNum, multiplayer = true, isRoomHost = false, seed = 42) {
    const p1Name = isRoomHost ? 'Host (P1)' : 'Client (P2)';
    const p2Name = isRoomHost ? 'Client (P2)' : 'Host (P1)';
    startLevel(levelNum, multiplayer, p1Name, p2Name, true, seed);
  }

  /**
   * Bucle Principal a 60 FPS
   */
  function gameLoop(timestamp) {
    rafId = requestAnimationFrame(gameLoop);

    const delta = Math.min(timestamp - lastTime, 50);
    lastTime = timestamp;

    if (state === STATE.PLAYING) {
      if (hitStopFrames > 0) {
        hitStopFrames--;
      } else {
        update(delta);
      }
      draw();
    } else if (state === STATE.PAUSED) {
      draw();
    }
  }

  function stopLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    state = STATE.IDLE;
    AudioManager.stopMusic();
  }

  /**
   * Actualización física y lógica de la partida
   */
  function update(delta) {
    if (!levelData || players.length === 0) return;

    const scrollSpeed = levelData.scrollSpeed;
    const p1 = players[0];
    const p2 = players[1];

    // ── 1. Procesar Inputs P1 (W, S, D, ShiftLeft, Espacio) ─────────────────
    if (p1 && p1.isAlive) {
      const p1JumpPressed = keys['KeyW'] || keys['Space'];
      if (p1JumpPressed && !p1._jumpKeyHeld) {
        p1.jump();
      }
      p1._jumpKeyHeld = p1JumpPressed;

      p1.setDucking(Boolean(keys['KeyS']));
      if (keys['KeyD'] || keys['ShiftLeft']) {
        p1.dash();
      }
    }

    // ── 2. Procesar Inputs P2 (Flechas Direccionales o Red) ─────────────────
    if (isMultiplayer && p2) {
      if (isOnline) {
        if (networkOpponentState) {
          // Interpolación suave de coordenadas
          p2.worldX += (networkOpponentState.worldX - p2.worldX) * 0.35;
          p2.y += (networkOpponentState.y - p2.y) * 0.35;
          
          p2.vy = networkOpponentState.vy;
          p2.isDucking = networkOpponentState.isDucking;
          p2.hasFinished = networkOpponentState.hasFinished;
          
          // Sincronización de telemetría, vidas y estado
          if (networkOpponentState.lives !== undefined) p2.lives = networkOpponentState.lives;
          if (networkOpponentState.isAlive !== undefined) p2.isAlive = networkOpponentState.isAlive;
          if (networkOpponentState.score !== undefined) p2Stats.score = networkOpponentState.score;
          if (networkOpponentState.coins !== undefined) p2Stats.coins = networkOpponentState.coins;
          if (networkOpponentState.isWinner && !winnerChosen) {
            winnerChosen = true;
            p2.isWinner = true;
            p2Stats.isWinner = true;
          }
          
          // Power-ups sincronizados visualmente
          p2.turboTimer = networkOpponentState.turboTimer || 0;
          p2.shield = networkOpponentState.shield || false;
        }
      } else if (p2.isAlive) {
        const p2JumpPressed = keys['ArrowUp'];
        if (p2JumpPressed && !p2._jumpKeyHeld) {
          p2.jump();
        }
        p2._jumpKeyHeld = p2JumpPressed;

        p2.setDucking(Boolean(keys['ArrowDown']));
        if (keys['ArrowRight'] || keys['ShiftRight']) {
          p2.dash();
        }
      }
    }

    // ── 3. Actualizar Jugador 1 y su Viewport ────────────────────────────────
    if (p1) {
      p1.update(scrollSpeed);
      camera1.update(p1, canvas1.width);
      obstacles1.update(p1.worldX, renderer1.groundY, goalWorldX);
      coinSystem1.update(p1.worldX, renderer1.groundY, goalWorldX, p1);
      if (powerUpSystem1) powerUpSystem1.update(p1.worldX, renderer1.groundY, goalWorldX);
    }

    // ── 4. Actualizar Jugador 2 y su Viewport (Multijugador) ─────────────────
    if (isMultiplayer && p2) {
      if (!isOnline) {
        p2.update(scrollSpeed);
      }
      camera2.update(p2, canvas2.width);
      obstacles2.update(p2.worldX, renderer2.groundY, goalWorldX);
      coinSystem2.update(p2.worldX, renderer2.groundY, goalWorldX, p2);
      if (powerUpSystem2) powerUpSystem2.update(p2.worldX, renderer2.groundY, goalWorldX);
    }
    
    // ── Enviar estado de red P1 ──────────────────────────────────────────────
    if (isOnline && p1 && typeof Network !== 'undefined') {
      Network.sendState({
        worldX: p1.worldX,
        y: p1.y,
        vy: p1.vy,
        isDucking: p1.isDucking,
        hasFinished: p1.hasFinished,
        turboTimer: p1.turboTimer,
        shield: p1.shield,
        score: p1Stats.score,
        coins: p1Stats.coins,
        lives: p1.lives,
        isAlive: p1.isAlive,
        isWinner: p1Stats.isWinner
      });
    }

    // ── 5. Partículas Globales ──────────────────────────────────────────────
    if (window.GlobalParticles) {
      window.GlobalParticles.update();
    }

    // ── 6. Colisiones independientes por carril ─────────────────────────────
    _handleCollisions();

    // ── 7. Puntuación por avance ────────────────────────────────────────────
    if (p1.isAlive && !p1.hasFinished) {
      p1Stats.score += Math.floor(scrollSpeed * 0.1);
    }
    if (isMultiplayer && p2?.isAlive && !p2?.hasFinished) {
      p2Stats.score += Math.floor(scrollSpeed * 0.1);
    }

    // ── 8. Comprobar Llegada a la Meta ───────────────────────────────────────
    _checkGoalArrival();

    // ── 9. Comprobar Fin de Partida / Derrota ────────────────────────────────
    _checkEndConditions();

    // ── 10. Actualizar HUD y Telemetría de Pantalla Dividida ─────────────────
    _updateHUD();
  }

  /**
   * Dibuja los viewports correspondientes (Solo o Pantalla Dividida)
   */
  function draw() {
    if (!renderer1 || players.length === 0) return;

    const scrollSpeed = levelData?.scrollSpeed ?? 6;
    const p1 = players[0];
    const p2 = players[1];

    // ══════════════════════════════════════════════════════════════
    // VIEWPORT 1: PLAYER 1 (CYAN)
    // ══════════════════════════════════════════════════════════════
    const ctx1 = renderer1.ctx;
    ctx1.clearRect(0, 0, renderer1.W, renderer1.H);

    // Fondo y suelo de P1 (con speed lines dinámicas en Turbo o alta velocidad)
    renderer1.drawBackground(camera1, scrollSpeed, p1.turboTimer > 0);

    // Matriz de cámara P1
    camera1.applyTransform(ctx1, renderer1.groundY);

    // Meta, Monedas, Power-Ups y Obstáculos de P1
    renderer1.drawGoalPortal(goalWorldX, camera1);
    coinSystem1.draw(ctx1, camera1);
    if (powerUpSystem1) powerUpSystem1.draw(ctx1, camera1);
    obstacles1.draw(ctx1, camera1);

    // Si es multijugador, renderizar también al rival como fantasma translúcido en el carril
    if (isMultiplayer && p2 && p2.isAlive) {
      ctx1.save();
      ctx1.globalAlpha = 0.45;
      p2.draw(ctx1, camera1, renderer1.groundY);
      ctx1.restore();
    }

    // Corredor principal P1
    p1.draw(ctx1, camera1, renderer1.groundY);

    if (window.GlobalParticles) {
      window.GlobalParticles.draw(ctx1, camera1);
    }

    camera1.restoreTransform(ctx1);

    // ══════════════════════════════════════════════════════════════
    // VIEWPORT 2: PLAYER 2 (MAGENTA) — SÓLO EN MULTIJUGADOR
    // ══════════════════════════════════════════════════════════════
    if (isMultiplayer && renderer2 && p2) {
      const ctx2 = renderer2.ctx;
      ctx2.clearRect(0, 0, renderer2.W, renderer2.H);

      // Fondo y suelo de P2
      renderer2.drawBackground(camera2, scrollSpeed, p2.turboTimer > 0);

      // Matriz de cámara P2
      camera2.applyTransform(ctx2, renderer2.groundY);

      // Meta, Monedas, Power-Ups y Obstáculos de P2
      renderer2.drawGoalPortal(goalWorldX, camera2);
      coinSystem2.draw(ctx2, camera2);
      if (powerUpSystem2) powerUpSystem2.draw(ctx2, camera2);
      obstacles2.draw(ctx2, camera2);

      // Renderizar al rival P1 como fantasma translúcido en el carril de P2
      if (p1 && p1.isAlive) {
        ctx2.save();
        ctx2.globalAlpha = 0.45;
        p1.draw(ctx2, camera2, renderer2.groundY);
        ctx2.restore();
      }

      // Corredor principal P2
      p2.draw(ctx2, camera2, renderer2.groundY);

      if (window.GlobalParticles) {
        window.GlobalParticles.draw(ctx2, camera2);
      }

      camera2.restoreTransform(ctx2);
    }
  }

  /**
   * Manejo de colisiones independiente para cada carril/pantalla
   */
  function _handleCollisions() {
    const p1 = players[0];
    const p2 = players[1];

    // Colisiones P1
    if (p1 && p1.isAlive && !p1.hasFinished) {
      // Power-Ups P1
      if (powerUpSystem1) {
        const hitPU1 = CollisionSystem.checkPlayerVsPowerUps(p1, powerUpSystem1.items);
        if (hitPU1) {
          powerUpSystem1.collectPowerUp(hitPU1, p1);
        }
      }

      // Monedas P1
      const hitCoin1 = CollisionSystem.checkPlayerVsCoins(p1, coinSystem1.coins);
      if (hitCoin1) {
        coinSystem1.collectCoin(hitCoin1, camera1);
        p1Stats.coins++;
        p1Stats.score += 50;
        AudioManager.play('coin');
      }

      // Obstáculos P1
      const hitObs1 = CollisionSystem.checkPlayerVsObstacles(p1, obstacles1.obstacles);
      if (hitObs1) {
        if (p1.turboTimer > 0) {
          // TURBO SMASH: Destruye el obstáculo al paso
          hitObs1.destroyed = true;
          p1Stats.score += 100;
          if (typeof AudioManager !== 'undefined') AudioManager.play('smash');
          if (window.GlobalParticles) {
            window.GlobalParticles.spawnShatter(hitObs1.worldX, hitObs1.y, hitObs1.w, hitObs1.h, hitObs1.color, 14);
            window.GlobalParticles.spawnShockwave(hitObs1.worldX + hitObs1.w / 2, hitObs1.y + hitObs1.h / 2, '#FF0055', 40);
            window.GlobalParticles.spawnFloatingText(hitObs1.worldX, hitObs1.y - 15, '¡DESTRUIDO! +100', '#FFD700', 14);
          }
          camera1.triggerShake(8, 4);
        } else if (!p1.invulnerable) {
          const died = p1.takeDamage();
          camera1.triggerShake(16, 9);
          hitStopFrames = 5;

          // Efecto Glitch aislado para el viewport de P1
          const vpP1 = document.getElementById('viewport-p1');
          vpP1?.classList.add('glitch-effect');
          setTimeout(() => vpP1?.classList.remove('glitch-effect'), 150);

          if (died) p1Stats.isAlive = false;
        }
      }
    }

    // Colisiones P2 (Multijugador)
    if (isMultiplayer && p2 && p2.isAlive && !p2.hasFinished) {
      if (isOnline) {
        // En modo online, el rival calcula sus propias colisiones, daño y monedas en su cliente
        // para garantizar que la partida sea 100% justa y libre de desync por latencia.
        return;
      }

      // Power-Ups P2
      if (powerUpSystem2) {
        const hitPU2 = CollisionSystem.checkPlayerVsPowerUps(p2, powerUpSystem2.items);
        if (hitPU2) {
          powerUpSystem2.collectPowerUp(hitPU2, p2);
        }
      }

      // Monedas P2
      const hitCoin2 = CollisionSystem.checkPlayerVsCoins(p2, coinSystem2.coins);
      if (hitCoin2) {
        coinSystem2.collectCoin(hitCoin2, camera2);
        p2Stats.coins++;
        p2Stats.score += 50;
        AudioManager.play('coin');
      }

      // Obstáculos P2
      const hitObs2 = CollisionSystem.checkPlayerVsObstacles(p2, obstacles2.obstacles);
      if (hitObs2) {
        if (p2.turboTimer > 0) {
          // TURBO SMASH: Destruye el obstáculo al paso
          hitObs2.destroyed = true;
          p2Stats.score += 100;
          if (typeof AudioManager !== 'undefined') AudioManager.play('smash');
          if (window.GlobalParticles) {
            window.GlobalParticles.spawnShatter(hitObs2.worldX, hitObs2.y, hitObs2.w, hitObs2.h, hitObs2.color, 14);
            window.GlobalParticles.spawnShockwave(hitObs2.worldX + hitObs2.w / 2, hitObs2.y + hitObs2.h / 2, '#FF0055', 40);
            window.GlobalParticles.spawnFloatingText(hitObs2.worldX, hitObs2.y - 15, '¡DESTRUIDO! +100', '#FFD700', 14);
          }
          camera2.triggerShake(8, 4);
        } else if (!p2.invulnerable) {
          const died = p2.takeDamage();
          camera2.triggerShake(16, 9);
          hitStopFrames = 5;

          // Efecto Glitch aislado para el viewport de P2
          const vpP2 = document.getElementById('viewport-p2');
          vpP2?.classList.add('glitch-effect');
          setTimeout(() => vpP2?.classList.remove('glitch-effect'), 150);

          if (died) p2Stats.isAlive = false;
        }
      }
    }
  }

  /**
   * Determinación de llegada a la meta y asignación de ganador
   */
  function _checkGoalArrival() {
    const elapsedSecs = Math.floor((performance.now() - startTime) / 1000);

    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      if (player.isAlive && !player.hasFinished && player.worldX >= goalWorldX) {
        player.hasFinished = true;
        player.finishTime  = elapsedSecs;

        const stats = i === 0 ? p1Stats : p2Stats;
        stats.time  = elapsedSecs;

        // El primer jugador en llegar es el GANADOR
        if (!winnerChosen) {
          winnerChosen    = true;
          player.isWinner = true;
          stats.isWinner  = true;
          stats.score    += 500; // Bonus victoria
          AudioManager.play('goal');
        } else {
          stats.score += 250; // Bonus completar carrera
        }
      }
    }
  }

  /**
   * Comprobar fin de partida
   */
  function _checkEndConditions() {
    if (raceFinished) return;

    const allFinishedOrDead = players.every(p => !p.isAlive || p.hasFinished);
    const anyFinished       = players.some(p => p.hasFinished);

    if (allFinishedOrDead) {
      raceFinished = true;
      state = anyFinished ? STATE.LEVEL_COMPLETE : STATE.GAMEOVER;
      AudioManager.stopMusic();

      setTimeout(() => {
        if (anyFinished) {
          _onRaceComplete();
        } else {
          _onGameOver();
        }
      }, 700);
    }
  }

  /**
   * Finalización de carrera con resultados
   */
  function _onRaceComplete() {
    const elapsed = Math.floor((performance.now() - startTime) / 1000);

    // Guardar récord de P1
    const { newRecord, unlockedNext } = ScoreManager.saveResults({
      level: currentLevel,
      score: p1Stats.score,
      time:  elapsed,
      coins: p1Stats.coins
    });

    if (currentLevel === LevelConfig.TOTAL_LEVELS && !isMultiplayer) {
      _showVictory();
      return;
    }

    UI.showResults({
      level: currentLevel,
      isMultiplayer,
      p1: {
        name:     players[0]?.name || 'Player 1',
        score:    p1Stats.score,
        coins:    p1Stats.coins,
        time:     ScoreManager.formatTime(p1Stats.time || elapsed),
        isWinner: p1Stats.isWinner,
        isAlive:  players[0]?.isAlive
      },
      p2: isMultiplayer ? {
        name:     players[1]?.name || 'Player 2',
        score:    p2Stats.score,
        coins:    p2Stats.coins,
        time:     ScoreManager.formatTime(p2Stats.time || elapsed),
        isWinner: p2Stats.isWinner,
        isAlive:  players[1]?.isAlive
      } : null,
      record: ScoreManager.getRecord(currentLevel),
      unlockedLevel: unlockedNext ? currentLevel + 1 : null
    });
  }

  function _onGameOver() {
    state = STATE.GAMEOVER;
    UI.showGameOver({
      level: currentLevel,
      isMultiplayer,
      p1Score: p1Stats.score,
      p2Score: isMultiplayer ? p2Stats.score : null
    });
  }

  function _showVictory() {
    state = STATE.VICTORY;
    AudioManager.play('levelup');
    UI.showVictory({
      score: p1Stats.score,
      coins: p1Stats.coins,
      time:  ScoreManager.formatTime(p1Stats.time)
    });
  }

  function onNextLevel() {
    UI.hideScreen('results');
    const next = currentLevel + 1;
    if (next <= LevelConfig.TOTAL_LEVELS && ScoreManager.isLevelUnlocked(next)) {
      startLevel(next, isMultiplayer, players[0]?.name, players[1]?.name);
    } else {
      UI.showScreen('levels');
    }
  }

  /**
   * Actualiza el HUD superior, los overlays de viewports y la telemetría del divisor
   */
  function _updateHUD() {
    const elapsed = Math.floor((performance.now() - startTime) / 1000);
    const timeValEl = document.getElementById('hud-time-val');
    if (timeValEl) timeValEl.textContent = ScoreManager.formatTime(elapsed);

    const p1 = players[0];
    const p2 = players[1];

    // HUD Viewport 1 (P1)
    if (p1) {
      document.getElementById('vp-p1-score').textContent = p1Stats.score;
      document.getElementById('vp-p1-coins').textContent = p1Stats.coins;
      document.getElementById('vp-p1-lives').textContent = '❤️'.repeat(Math.max(0, p1.lives));

      const p1Progress = Math.min(100, Math.max(0, (p1.worldX / goalWorldX) * 100));
      const p1Fill = document.getElementById('progress-bar-fill-p1');
      const p1Icon = document.getElementById('progress-icon-p1');
      if (p1Fill) p1Fill.style.width = p1Progress + '%';
      if (p1Icon) p1Icon.style.left  = p1Progress + '%';

      // Badges de Power-Ups P1
      _renderPowerUpBadges(document.getElementById('vp-p1-powerups'), p1);
    }

    // HUD Viewport 2 (P2)
    if (isMultiplayer && p2) {
      document.getElementById('vp-p2-score').textContent = p2Stats.score;
      document.getElementById('vp-p2-coins').textContent = p2Stats.coins;
      document.getElementById('vp-p2-lives').textContent = '❤️'.repeat(Math.max(0, p2.lives));

      const p2Progress = Math.min(100, Math.max(0, (p2.worldX / goalWorldX) * 100));
      const p2Fill = document.getElementById('progress-bar-fill-p2');
      const p2Icon = document.getElementById('progress-icon-p2');
      if (p2Fill) p2Fill.style.width = p2Progress + '%';
      if (p2Icon) p2Icon.style.left  = p2Progress + '%';

      // Badges de Power-Ups P2
      _renderPowerUpBadges(document.getElementById('vp-p2-powerups'), p2);

      // ── Telemetría en Vivo de Pantalla Dividida ────────────────────────────
      const rankP1 = document.getElementById('vp-p1-rank');
      const rankP2 = document.getElementById('vp-p2-rank');
      const statusBadge = document.getElementById('split-status-badge');

      const distDiffPx = p1.worldX - p2.worldX;
      const distDiffMeters = Math.round(Math.abs(distDiffPx) / 10);

      if (distDiffPx > 30) {
        if (rankP1) rankP1.textContent = '1º LUGAR ⚡';
        if (rankP2) rankP2.textContent = '2º LUGAR';
        if (statusBadge) {
          statusBadge.textContent = `⚡ ${p1.name} LIDERANDO (+${distDiffMeters}m) ⚡`;
          statusBadge.style.color = 'var(--c-cyan)';
          statusBadge.style.borderColor = 'var(--c-cyan)';
        }
      } else if (distDiffPx < -30) {
        if (rankP1) rankP1.textContent = '2º LUGAR';
        if (rankP2) rankP2.textContent = '1º LUGAR ⚡';
        if (statusBadge) {
          statusBadge.textContent = `⚡ ${p2.name} LIDERANDO (+${distDiffMeters}m) ⚡`;
          statusBadge.style.color = 'var(--c-accent)';
          statusBadge.style.borderColor = 'var(--c-accent)';
        }
      } else {
        if (rankP1) rankP1.textContent = 'EMPATADOS';
        if (rankP2) rankP2.textContent = 'EMPATADOS';
        if (statusBadge) {
          statusBadge.textContent = `⚡ ¡CUELLO A CUELLO! ⚡`;
          statusBadge.style.color = '#FFD700';
          statusBadge.style.borderColor = '#FFD700';
        }
      }
    }
  }

  /**
   * Renderiza los badges de Power-Ups activos para el viewport del jugador
   */
  function _renderPowerUpBadges(containerEl, player) {
    if (!containerEl || !player) return;
    let html = '';
    if (player.shield) {
      html += `<div class="powerup-badge badge-shield"><span class="pu-icon">🛡️</span><span>ESCUDO</span></div>`;
    }
    if (player.magnetTimer > 0) {
      const sec = (player.magnetTimer / 60).toFixed(1);
      html += `<div class="powerup-badge badge-magnet"><span class="pu-icon">🧲</span><span>IMÁN</span><span class="pu-timer">${sec}s</span></div>`;
    }
    if (player.turboTimer > 0) {
      const sec = (player.turboTimer / 60).toFixed(1);
      html += `<div class="powerup-badge badge-turbo"><span class="pu-icon">⚡</span><span>TURBO</span><span class="pu-timer">${sec}s</span></div>`;
    }
    if (player.doubleJumpTimer > 0) {
      const sec = (player.doubleJumpTimer / 60).toFixed(1);
      html += `<div class="powerup-badge badge-doublejump"><span class="pu-icon">🦘</span><span>D. SALTO</span><span class="pu-timer">${sec}s</span></div>`;
    }
    containerEl.innerHTML = html;
  }

  /**
   * Gestión de Inputs de Teclado
   */
  function onKeyDown(e) {
    keys[e.code] = true;
    AudioManager.init();
    AudioManager.resume();

    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (state === STATE.PLAYING) pause();
      else if (state === STATE.PAUSED) resume();
    }

    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowRight', 'KeyW', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
      e.preventDefault();
    }
  }

  function onKeyUp(e) {
    keys[e.code] = false;
  }

  function pause() {
    if (state !== STATE.PLAYING) return;
    state = STATE.PAUSED;
    UI.showPause({
      p1Score: p1Stats.score,
      p2Score: isMultiplayer ? p2Stats.score : null
    });
  }

  function resume() {
    if (state !== STATE.PAUSED) return;
    state = STATE.PLAYING;
    UI.hidePause();
    lastTime = performance.now();
  }

  return {
    init,
    startLevel,
    startLevelOnline,
    pause,
    resume,
    onNextLevel,
    stopLoop,
    setSplitMode,
    toggleSplitMode,
    get state()         { return state; },
    get isMultiplayer() { return isMultiplayer; },
    get splitMode()     { return splitMode; }
  };
})();
