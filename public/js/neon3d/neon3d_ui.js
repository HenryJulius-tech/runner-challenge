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
      startRace(activeLevel);
    });

    document.getElementById('btn-exit-3d')?.addEventListener('click', () => {
      Neon3DEngine.stop();
      _closeAllOverlays();
      if (typeof UI !== 'undefined' && UI.showScreen) {
        UI.showScreen('menu');
      }
    });

    // ── Fin de Partida / Derrota 3D ─────────────────────────────────────────
    document.getElementById('btn-retry-gameover-3d')?.addEventListener('click', () => {
      _closeAllOverlays();
      startRace(activeLevel);
    });

    document.getElementById('btn-levels-from-gameover-3d')?.addEventListener('click', () => {
      Neon3DEngine.stop();
      _closeAllOverlays();
      if (typeof UI !== 'undefined' && UI.showScreen) {
        UI.showScreen('levels-3d');
      }
    });

    document.getElementById('btn-exit-gameover-3d')?.addEventListener('click', () => {
      Neon3DEngine.stop();
      _closeAllOverlays();
      if (typeof UI !== 'undefined' && UI.showScreen) {
        UI.showScreen('menu');
      }
    });

    // ── Victoria 3D y Siguiente Nivel ───────────────────────────────────────
    document.getElementById('btn-next-level-3d')?.addEventListener('click', () => {
      _closeAllOverlays();
      const maxLevels = typeof Neon3DLevels !== 'undefined' ? Neon3DLevels.TOTAL_LEVELS : 20;
      const nextLvl = Math.min(maxLevels, activeLevel + 1);
      startRace(nextLvl);
    });

    document.getElementById('btn-retry-victory-3d')?.addEventListener('click', () => {
      _closeAllOverlays();
      startRace(activeLevel);
    });

    document.getElementById('btn-levels-from-victory-3d')?.addEventListener('click', () => {
      Neon3DEngine.stop();
      _closeAllOverlays();
      if (typeof UI !== 'undefined' && UI.showScreen) {
        UI.showScreen('levels-3d');
      }
    });

    document.getElementById('btn-exit-victory-3d')?.addEventListener('click', () => {
      Neon3DEngine.stop();
      _closeAllOverlays();
      if (typeof UI !== 'undefined' && UI.showScreen) {
        UI.showScreen('menu');
      }
    });

    document.getElementById('btn-levels-from-pause-3d')?.addEventListener('click', () => {
      Neon3DEngine.stop();
      _closeAllOverlays();
      if (typeof UI !== 'undefined' && UI.showScreen) {
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
   * Inicia la carrera en el nivel 3D especificado
   */
  function startRace(levelNum = 1) {
    init();
    activeLevel = levelNum;

    if (typeof UI !== 'undefined' && UI.showScreen) {
      UI.showScreen('game-3d');
    }

    _closeAllOverlays();

    Neon3DEngine.resize();
    Neon3DEngine.start(activeLevel);
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

  function _handlePause(isPaused) {
    const pauseScreen = document.getElementById('screen-pause-3d');
    if (!pauseScreen) return;
    if (isPaused) pauseScreen.classList.add('active');
    else pauseScreen.classList.remove('active');
  }

  function _handleGameEnd(win, stats) {
    activeLevel = stats.level;
    const maxLevels = typeof Neon3DLevels !== 'undefined' ? Neon3DLevels.TOTAL_LEVELS : 20;

    if (win) {
      // Guardar récord y desbloquear siguiente nivel
      if (typeof ScoreManager !== 'undefined') {
        ScoreManager.saveResults({
          level: stats.level,
          score: stats.score,
          time: parseFloat(stats.time)
        });
      }

      const victoryScreen = document.getElementById('screen-victory-3d');
      if (victoryScreen) {
        const msgEl = document.getElementById('victory-3d-msg');
        if (msgEl) {
          msgEl.textContent = `¡Cruzaste la meta cibernética del Nivel ${stats.level} con éxito!`;
        }
        document.getElementById('victory-3d-time').textContent = `${stats.time} s`;
        document.getElementById('victory-3d-lives').textContent = `${stats.lives} / 3`;
        document.getElementById('victory-3d-score').textContent = stats.score;

        const nextBtn = document.getElementById('btn-next-level-3d');
        if (nextBtn) {
          if (stats.level < maxLevels) {
            nextBtn.style.display = 'block';
            nextBtn.textContent = `⏩ SIGUIENTE NIVEL (${stats.level + 1})`;
          } else {
            nextBtn.style.display = 'none';
          }
        }

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
    showToast,
    renderLevels3DGrid,
    get activeLevel() { return activeLevel; }
  };
})();
