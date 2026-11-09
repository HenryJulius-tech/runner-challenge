/**
 * neon3d_ui.js — Controlador de Interfaz, HUD, Progresión y Eventos de Neon Run 3D
 * 
 * Integra el motor 3D con el sistema de niveles, menús y guardado del proyecto:
 *  - Cuadrícula de 20 niveles 3D interactiva sincronizada con ScoreManager (localStorage)
 *  - HUD 3D: Vidas (♥), cronómetro, barra de meta, escudo de energía, disco y dash
 *  - Botones táctiles móviles completos: Izq, Der, Agacharse (Slide), Salto, Disco, Dash
 *  - Modales Neón 3D: Pausa, Fin de Partida y Victoria con avance al Siguiente Nivel
 */

const Neon3DUI = (() => {

  let isInitialized = false;
  let activeLevel = 1;
  let isOnlineGame = false;
  let onlineOptions = {};

  function init() {
    if (isInitialized) return;
    isInitialized = true;

    const canvas3D = document.getElementById('canvas-neon3d');
    if (!canvas3D) {
      console.warn('[Neon3DUI] Canvas #canvas-neon3d no encontrado en el DOM.');
      return;
    }

    Neon3DEngine.init(canvas3D, {
      onHudUpdate: _updateHud,
      onToast: showToast,
      onEnd: _handleGameEnd,
      onPause: _handlePause
    });

    _bindTouchButtons();
    _bindUIButtons();
  }

  function _bindTouchButtons() {
    const hold = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      const on = e => { e.preventDefault(); Neon3DEngine.setTouchInput(key, true); };
      const off = e => { e.preventDefault(); Neon3DEngine.setTouchInput(key, false); };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    };

    hold('btn-touch-3d-left', 'l');
    hold('btn-touch-3d-right', 'r');
    hold('btn-touch-3d-duck', 'duck');

    const tap = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('pointerdown', e => {
        e.preventDefault();
        Neon3DEngine.setTouchInput(key, true);
      });
    };

    tap('btn-touch-3d-jump', 'jump');
    tap('btn-touch-3d-disc', 'disc');
    tap('btn-touch-3d-dash', 'dash');
  }

  function _bindUIButtons() {
    // ── Botón Volver desde Selector 3D ──────────────────────────────────────
    document.getElementById('btn-back-levels-3d')?.addEventListener('click', () => {
      if (typeof UI !== 'undefined' && UI.showScreen) {
        UI.showScreen('menu');
      }
    });

    // ── HUD y Pausa 3D ──────────────────────────────────────────────────────
    document.getElementById('btn-pause-3d')?.addEventListener('click', () => {
      Neon3DEngine.togglePause();
    });

    document.getElementById('btn-resume-3d')?.addEventListener('click', () => {
      Neon3DEngine.togglePause();
    });

    document.getElementById('btn-restart-3d')?.addEventListener('click', () => {
      _closeAllOverlays();
      if (isOnlineGame && typeof Network !== 'undefined' && Network.roomId) {
        Network.returnToLobby({ level: activeLevel, reason: 'restart', gameMode: '3d' });
      } else {
        startRace(activeLevel);
      }
    });

    document.getElementById('btn-exit-3d')?.addEventListener('click', () => {
      Neon3DEngine.stop();
      _closeAllOverlays();
      if (isOnlineGame && typeof Network !== 'undefined' && Network.roomId) {
        Network.leaveRoom();
      }
      if (typeof UI !== 'undefined' && UI.showScreen) {
        UI.showScreen('menu');
      }
    });

    // ── Fin de Partida / Derrota 3D ─────────────────────────────────────────
    document.getElementById('btn-retry-gameover-3d')?.addEventListener('click', () => {
      _closeAllOverlays();
      if (isOnlineGame && typeof Network !== 'undefined' && Network.roomId) {
        Network.returnToLobby({ level: activeLevel, reason: 'restart', gameMode: '3d' });
      } else {
        startRace(activeLevel);
      }
    });

    document.getElementById('btn-levels-from-gameover-3d')?.addEventListener('click', () => {
      Neon3DEngine.stop();
      _closeAllOverlays();
      if (isOnlineGame && typeof Network !== 'undefined' && Network.roomId) {
        Network.returnToLobby({ level: activeLevel, reason: 'lobby', gameMode: '3d' });
      } else if (typeof UI !== 'undefined' && UI.showScreen) {
        UI.showScreen('levels-3d');
      }
    });

    document.getElementById('btn-exit-gameover-3d')?.addEventListener('click', () => {
      Neon3DEngine.stop();
      _closeAllOverlays();
      if (isOnlineGame && typeof Network !== 'undefined' && Network.roomId) {
        Network.leaveRoom();
      }
      if (typeof UI !== 'undefined' && UI.showScreen) {
        UI.showScreen('menu');
      }
    });

    // ── Victoria 3D y Siguiente Nivel ───────────────────────────────────────
    document.getElementById('btn-next-level-3d')?.addEventListener('click', () => {
      _closeAllOverlays();
      const maxLevels = typeof Neon3DLevels !== 'undefined' ? Neon3DLevels.TOTAL_LEVELS : 20;
      const nextLvl = Math.min(maxLevels, activeLevel + 1);
      if (isOnlineGame && typeof Network !== 'undefined' && Network.roomId) {
        Network.returnToLobby({ nextLevel: true, level: nextLvl, gameMode: '3d' });
      } else {
        startRace(nextLvl);
      }
    });

    document.getElementById('btn-retry-victory-3d')?.addEventListener('click', () => {
      _closeAllOverlays();
      if (isOnlineGame && typeof Network !== 'undefined' && Network.roomId) {
        Network.returnToLobby({ level: activeLevel, reason: 'restart', gameMode: '3d' });
      } else {
        startRace(activeLevel);
      }
    });

    document.getElementById('btn-levels-from-victory-3d')?.addEventListener('click', () => {
      Neon3DEngine.stop();
      _closeAllOverlays();
      if (isOnlineGame && typeof Network !== 'undefined' && Network.roomId) {
        Network.returnToLobby({ level: activeLevel, reason: 'lobby', gameMode: '3d' });
      } else if (typeof UI !== 'undefined' && UI.showScreen) {
        UI.showScreen('levels-3d');
      }
    });

    document.getElementById('btn-exit-victory-3d')?.addEventListener('click', () => {
      Neon3DEngine.stop();
      _closeAllOverlays();
      if (isOnlineGame && typeof Network !== 'undefined' && Network.roomId) {
        Network.leaveRoom();
      }
      if (typeof UI !== 'undefined' && UI.showScreen) {
        UI.showScreen('menu');
      }
    });

    document.getElementById('btn-levels-from-pause-3d')?.addEventListener('click', () => {
      Neon3DEngine.stop();
      _closeAllOverlays();
      if (isOnlineGame && typeof Network !== 'undefined' && Network.roomId) {
        Network.returnToLobby({ level: activeLevel, reason: 'lobby', gameMode: '3d' });
      } else if (typeof UI !== 'undefined' && UI.showScreen) {
        UI.showScreen('levels-3d');
      }
    });
  }

  function _closeAllOverlays() {
    document.getElementById('screen-pause-3d')?.classList.remove('active');
    document.getElementById('screen-gameover-3d')?.classList.remove('active');
    document.getElementById('screen-victory-3d')?.classList.remove('active');
  }

  /**
   * Renderiza la cuadrícula de 20 niveles para Neon Run 3D
   */
  function renderLevels3DGrid() {
    const grid = document.getElementById('levels-3d-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    // Resetear scroll a la parte superior (Nivel 1 visible siempre)
    const screenEl = document.getElementById('screen-levels-3d');
    if (screenEl) screenEl.scrollTop = 0;
    grid.scrollTop = 0;
    window.scrollTo(0, 0);

    const levels = typeof Neon3DLevels !== 'undefined' 
      ? Neon3DLevels.getAllLevels() 
      : (typeof LevelConfig !== 'undefined' ? LevelConfig.getAllLevels() : []);

    const starEmojis = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];
    const diffColors = {
      'Fácil': '#00F0FF', 'Normal': '#00E5FF',
      'Difícil': '#FFD700', 'Muy Difícil': '#FF7700', 'Legendario': '#FF007F',
      'Extremo': '#9900FF', 'Demencial': '#00FFFF', 'Imposible': '#FFFF00', 'Infierno': '#FF0055', 'Mítico': '#FFFFFF'
    };

    levels.forEach(level => {
      const unlocked = typeof ScoreManager !== 'undefined' 
        ? ScoreManager.isLevelUnlocked(level.number) 
        : (level.number === 1);
      const record   = typeof ScoreManager !== 'undefined' ? ScoreManager.getRecord(level.number) : 0;
      const bestTime = typeof ScoreManager !== 'undefined' ? ScoreManager.getBestTime(level.number) : null;

      const card = document.createElement('div');
      card.className = `level-card card-3d ${unlocked ? '' : 'locked'}`;
      card.innerHTML = `
        ${!unlocked ? '<div class="level-card-lock">🔒</div>' : ''}
        <div class="level-card-number" style="color:${diffColors[level.difficulty] || '#00F0FF'}">
          ${level.number}
        </div>
        <div class="level-card-name">${level.name}</div>
        <div class="level-card-diff" style="color:${diffColors[level.difficulty] || '#9E9EC8'}">
          ${level.difficulty} · 3D
        </div>
        <div class="level-card-stars">${starEmojis[level.stars] || ''}</div>
        ${record ? `<div class="level-card-record">🏆 ${record} pts</div>` : ''}
        ${bestTime ? `<div class="level-card-record">⏱ ${ScoreManager.formatTime(bestTime)}</div>` : ''}
      `;

      if (unlocked) {
        card.addEventListener('click', () => {
          if (typeof AudioManager !== 'undefined') AudioManager.init();
          startRace(level.number);
        });
      }
      grid.appendChild(card);
    });
  }

  /**
   * Inicia la carrera en el nivel 3D especificado (Solo)
   */
  function startRace(levelNum = 1) {
    init();
    activeLevel = levelNum;
    isOnlineGame = false;
    onlineOptions = {};

    if (typeof UI !== 'undefined' && UI.showScreen) {
      UI.showScreen('game-3d');
    }

    _closeAllOverlays();

    Neon3DEngine.resize();
    Neon3DEngine.start(activeLevel);
  }

  /**
   * Inicia la carrera en el nivel 3D en modo Multiplayer Online
   */
  function startRaceOnline(levelNum = 1, options = {}) {
    init();
    activeLevel = levelNum;
    isOnlineGame = true;
    onlineOptions = options;

    if (typeof UI !== 'undefined' && UI.showScreen) {
      UI.showScreen('game-3d');
    }

    _closeAllOverlays();

    Neon3DEngine.resize();
    Neon3DEngine.start(activeLevel, {
      isOnline: true,
      raceId: options.raceId,
      seed: options.seed,
      myColor: options.myColor,
      rivalName: options.rivalName,
      rivalColor: options.rivalColor,
      isHost: options.isHost
    });
  }

  function _updateHud(data) {
    // Vidas en corazones
    const livesEl = document.getElementById('hud-3d-lives');
    if (livesEl) {
      livesEl.textContent = '♥'.repeat(data.lives) + '♡'.repeat(Math.max(0, 3 - data.lives));
    }

    // Barra de progreso hacia la meta
    const progEl = document.getElementById('hud-3d-progress-bar');
    if (progEl) {
      progEl.style.width = `${data.progress}%`;
    }

    // Marcadores de jugadores en el progreso (Online)
    const markerP1 = document.getElementById('hud-3d-runner-p1');
    const markerP2 = document.getElementById('hud-3d-runner-p2');
    const rankPill = document.getElementById('hud-3d-online-rank');

    if (data.isOnline) {
      if (markerP1) {
        markerP1.style.display = 'block';
        markerP1.style.left = `${data.playerProgress}%`;
        if (onlineOptions.myColor) markerP1.style.color = onlineOptions.myColor;
      }
      if (markerP2) {
        markerP2.style.display = 'block';
        markerP2.style.left = `${data.rivalProgress}%`;
        if (onlineOptions.rivalColor) markerP2.style.color = onlineOptions.rivalColor;
      }
      if (rankPill) {
        rankPill.style.display = 'inline-block';
        const gapTxt = data.isFirst ? `+${Math.max(0, data.distGap)}m` : `${data.distGap}m`;
        rankPill.textContent = `${data.isFirst ? '1º LUGAR' : '2º LUGAR'} (${gapTxt})`;
        rankPill.style.color = data.isFirst ? '#00FF88' : '#FF007F';
        rankPill.style.borderColor = data.isFirst ? '#00FF88' : '#FF007F';
      }
    } else {
      if (markerP1) markerP1.style.display = 'none';
      if (markerP2) markerP2.style.display = 'none';
      if (rankPill) rankPill.style.display = 'none';
    }

    // Cronómetro
    const timeEl = document.getElementById('hud-3d-time');
    if (timeEl) {
      timeEl.textContent = `${data.time} s`;
    }

    // Botón de disco
    const discBadge = document.getElementById('hud-3d-disc');
    const discTouch = document.getElementById('btn-touch-3d-disc');
    const discOpacity = data.canDisc ? '1' : '0.35';
    if (discBadge) discBadge.style.opacity = discOpacity;
    if (discTouch) discTouch.style.opacity = discOpacity;

    // Botón de dash táctil
    const dashTouch = document.getElementById('btn-touch-3d-dash');
    if (dashTouch) dashTouch.style.opacity = data.canDash ? '1' : '0.4';

    // Barra de escudo de energía
    const shieldWrap = document.getElementById('hud-3d-shield-wrap');
    const shieldBar = document.getElementById('hud-3d-shield-bar');
    if (shieldWrap && shieldBar) {
      if (data.shieldActive) {
        shieldWrap.style.display = 'block';
        shieldBar.style.width = '100%';
      } else {
        shieldWrap.style.display = 'none';
      }
    }
  }

  function showToast(message, color = '#2ff3ff') {
    const toast = document.getElementById('toast-3d');
    if (!toast) return;

    toast.textContent = message;
    toast.style.color = color;
    toast.style.opacity = '1';

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.style.opacity = '0';
    }, 1400);
  }

  function _handlePause(isPaused, isLiveOnline = false) {
    const pauseScreen = document.getElementById('screen-pause-3d');
    if (!pauseScreen) return;

    if (isPaused) {
      const titleEl = document.getElementById('pause-3d-title');
      const descEl = document.getElementById('pause-3d-desc');
      const restartBtn = document.getElementById('btn-restart-3d');
      const levelsBtn = document.getElementById('btn-levels-from-pause-3d');
      const exitBtn = document.getElementById('btn-exit-3d');

      if (isLiveOnline) {
        if (titleEl) titleEl.textContent = 'PAUSA 3D (CARRERA EN VIVO)';
        if (descEl) descEl.textContent = 'La carrera online continúa en tiempo real en la pista.';
        if (restartBtn) restartBtn.style.display = 'none';
        if (levelsBtn) levelsBtn.style.display = 'none';
        if (exitBtn) exitBtn.textContent = '🚪 ABANDONAR SALA';
      } else {
        if (titleEl) titleEl.textContent = 'PAUSA 3D';
        if (descEl) descEl.textContent = 'Partida detenida. ¿Qué deseas hacer?';
        if (restartBtn) restartBtn.style.display = 'block';
        if (levelsBtn) levelsBtn.style.display = 'block';
        if (exitBtn) exitBtn.textContent = '🚪 SALIR AL MENÚ';
      }
      pauseScreen.classList.add('active');
    } else {
      pauseScreen.classList.remove('active');
    }
  }

  function _handleGameEnd(win, stats) {
    activeLevel = stats.level;
    const maxLevels = typeof Neon3DLevels !== 'undefined' ? Neon3DLevels.TOTAL_LEVELS : 20;

    const victoryScreen = document.getElementById('screen-victory-3d');
    const soloStats = document.getElementById('victory-3d-solo-stats');
    const onlineComp = document.getElementById('victory-3d-online-comparison');
    const titleEl = document.getElementById('victory-3d-title');
    const msgEl = document.getElementById('victory-3d-msg');
    const nextBtn = document.getElementById('btn-next-level-3d');
    const retryBtn = document.getElementById('btn-retry-victory-3d');
    const levelsBtn = document.getElementById('btn-levels-from-victory-3d');
    const exitBtn = document.getElementById('btn-exit-victory-3d');

    if (stats.isOnline) {
      // ══════════════════════════════════════════════════════════════════
      // MODAL RESULTADOS MULTIJUGADOR ONLINE 3D
      // ══════════════════════════════════════════════════════════════════
      _closeAllOverlays();
      if (victoryScreen) {
        if (soloStats) soloStats.style.display = 'none';
        if (onlineComp) onlineComp.classList.remove('hidden');

        const myRes = stats.myResult || {};
        const oppRes = stats.oppResult || {};
        const isWinner = !!myRes.isWinner;

        if (titleEl) {
          titleEl.textContent = isWinner ? '¡VICTORIA ONLINE! 🥇' : '2º LUGAR ONLINE 🥈';
          titleEl.style.textShadow = isWinner ? '0 0 25px #00F0FF, 0 0 40px #FFD700' : '0 0 25px #FF007F';
        }
        if (msgEl) {
          msgEl.textContent = isWinner
            ? `¡Cruzaste la meta cibernética en 1º puesto del Nivel ${stats.level}!`
            : `¡Buena carrera! El ganador fue ${stats.winnerName || oppRes.name || 'tu rival'}.`;
        }

        // Columna Local
        const p1Name = document.getElementById('res-3d-p1-name');
        const p1Pos = document.getElementById('res-3d-p1-pos');
        const p1Time = document.getElementById('res-3d-p1-time');
        const p1Coins = document.getElementById('res-3d-p1-coins');
        const p1Score = document.getElementById('res-3d-p1-score');
        const p1Col = document.getElementById('res-3d-p1-col');

        if (p1Name) {
          p1Name.textContent = myRes.name || 'Tú';
          p1Name.style.color = myRes.color || '#00F0FF';
        }
        if (p1Col) p1Col.style.borderColor = myRes.color || '#00F0FF';
        if (p1Pos) {
          p1Pos.textContent = isWinner ? '1º WINNER 🥇' : '2º PUESTO 🥈';
          p1Pos.style.color = isWinner ? '#FFD700' : '#cbd5e1';
        }
        if (p1Time) p1Time.textContent = `${myRes.time || stats.time} s`;
        if (p1Coins) p1Coins.textContent = String(myRes.coins ?? stats.coins);
        if (p1Score) p1Score.textContent = String(myRes.score ?? stats.score);

        // Columna Rival
        const p2Name = document.getElementById('res-3d-p2-name');
        const p2Pos = document.getElementById('res-3d-p2-pos');
        const p2Time = document.getElementById('res-3d-p2-time');
        const p2Coins = document.getElementById('res-3d-p2-coins');
        const p2Score = document.getElementById('res-3d-p2-score');
        const p2Col = document.getElementById('res-3d-p2-col');

        if (p2Name) {
          p2Name.textContent = oppRes.name || 'Rival';
          p2Name.style.color = oppRes.color || '#FF007F';
        }
        if (p2Col) p2Col.style.borderColor = oppRes.color || '#FF007F';
        if (p2Pos) {
          p2Pos.textContent = oppRes.isWinner ? '1º WINNER 🥇' : '2º PUESTO 🥈';
          p2Pos.style.color = oppRes.isWinner ? '#FFD700' : '#cbd5e1';
        }
        if (p2Time) p2Time.textContent = oppRes.time ? `${oppRes.time} s` : '--';
        if (p2Coins) p2Coins.textContent = String(oppRes.coins ?? 0);
        if (p2Score) p2Score.textContent = String(oppRes.score ?? 0);

        // Botones de acción
        if (nextBtn) {
          if (onlineOptions.isHost) {
            nextBtn.style.display = 'block';
            nextBtn.textContent = `⏩ SIGUIENTE NIVEL (${Math.min(maxLevels, stats.level + 1)})`;
          } else {
            nextBtn.style.display = 'none';
          }
        }
        if (retryBtn) retryBtn.textContent = '🔄 REVANCHA';
        if (levelsBtn) levelsBtn.textContent = '📋 SALIR AL LOBBY';
        if (exitBtn) exitBtn.textContent = '🏠 MENÚ PRINCIPAL';

        victoryScreen.classList.add('active');
      }
      return;
    }

    // ══════════════════════════════════════════════════════════════════
    // MODO SOLO (ORIGINAL)
    // ══════════════════════════════════════════════════════════════════
    if (soloStats) soloStats.style.display = 'flex';
    if (onlineComp) onlineComp.classList.add('hidden');

    if (win) {
      if (typeof ScoreManager !== 'undefined') {
        ScoreManager.saveResults({
          level: stats.level,
          score: stats.score,
          time: parseFloat(stats.time)
        });
      }

      if (victoryScreen) {
        if (titleEl) {
          titleEl.textContent = '¡META CRUZADA! 🏆';
          titleEl.style.textShadow = '0 0 25px #2ff3ff';
        }
        if (msgEl) msgEl.textContent = `¡Cruzaste la meta cibernética del Nivel ${stats.level} con éxito!`;
        document.getElementById('victory-3d-time').textContent = `${stats.time} s`;
        document.getElementById('victory-3d-lives').textContent = `${stats.lives} / 3`;
        document.getElementById('victory-3d-score').textContent = stats.score;

        if (nextBtn) {
          if (stats.level < maxLevels) {
            nextBtn.style.display = 'block';
            nextBtn.textContent = `⏩ SIGUIENTE NIVEL (${stats.level + 1})`;
          } else {
            nextBtn.style.display = 'none';
          }
        }
        if (retryBtn) retryBtn.textContent = '🔄 REPETIR NIVEL';
        if (levelsBtn) levelsBtn.textContent = '📋 SELECCIÓN DE NIVELES';
        if (exitBtn) exitBtn.textContent = '🚪 MENÚ PRINCIPAL';

        victoryScreen.classList.add('active');
      }
    } else {
      const goScreen = document.getElementById('screen-gameover-3d');
      if (goScreen) {
        const lvlEl = document.getElementById('gameover-3d-level');
        if (lvlEl) lvlEl.textContent = stats.level;
        document.getElementById('gameover-3d-time').textContent = `${stats.time} s`;
        goScreen.classList.add('active');
      }
    }
  }

  return {
    init,
    startRace,
    startRaceOnline,
    showToast,
    renderLevels3DGrid,
    get activeLevel() { return activeLevel; }
  };
})();
