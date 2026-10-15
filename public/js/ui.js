/**
 * ui.js — Gestión de Pantallas, Menús y HUD de Runner Challenge: Neon Run
 * 
 * Responsabilidades:
 *  - Navegación entre pantallas del juego (Glassmorphism Cyberpunk)
 *  - Modos de inicio: Solo y Multijugador Local Offline (2 jugadores en 1 PC)
 *  - Cuenta regresiva animada (3, 2, 1, ¡CORRE!)
 *  - Pantalla de Resultados comparativa P1 vs P2 (WINNER / RUNNER-UP)
 *  - Grid de niveles, configuración y récords persistentes
 */

const UI = (() => {

  const SCREENS = [
    'menu', 'levels', 'multiplayer', 'lobby',
    'countdown', 'game', 'pause', 'gameover',
    'results', 'victory', 'records', 'settings'
  ];

  let currentScreen = 'menu';
  let countdownTimer = null;

  /**
   * Muestra una pantalla específica y oculta las demás.
   */
  function showScreen(screenName) {
    SCREENS.forEach(name => {
      const el = document.getElementById(`screen-${name}`);
      if (el) {
        if (name === screenName) el.classList.add('active');
        else el.classList.remove('active');
      }
    });
    currentScreen = screenName;

    if (screenName === 'levels') _renderLevelsGrid();
    if (screenName === 'multiplayer') _populateMpLevels();
    if (screenName === 'lobby') _populateMpOnlineLevels();
    if (screenName === 'records') _renderRecords();
    if (screenName === 'settings') _loadSettings();
  }

  function hideScreen(screenName) {
    const el = document.getElementById(`screen-${screenName}`);
    if (el) el.classList.remove('active');
  }

  /**
   * Llena el selector de niveles para multijugador con los 20 niveles disponibles
   */
  function _populateMpLevels() {
    const select = document.getElementById('mp-select-level');
    if (!select) return;
    const currentVal = select.value || '1';
    select.innerHTML = '';
    const levels = LevelConfig.getAllLevels();
    levels.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.number;
      opt.textContent = `${l.name} (${l.difficulty})`;
      if (String(l.number) === String(currentVal)) opt.selected = true;
      select.appendChild(opt);
    });
  }

  /**
   * Llena el selector de niveles para multijugador online con los 20 niveles disponibles
   */
  function _populateMpOnlineLevels() {
    const select = document.getElementById('mp-select-level-online');
    if (!select) return;
    const currentVal = select.value || '1';
    select.innerHTML = '';
    const levels = LevelConfig.getAllLevels();
    levels.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.number;
      opt.textContent = `${l.name} (${l.difficulty})`;
      if (String(l.number) === String(currentVal)) opt.selected = true;
      select.appendChild(opt);
    });
  }

  /**
   * Renderiza la cuadrícula de niveles
   */
  function _renderLevelsGrid() {
    const grid = document.getElementById('levels-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const levels = LevelConfig.getAllLevels();
    const starEmojis = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];
    const diffColors = {
      'Fácil': '#00F0FF', 'Normal': '#00E5FF',
      'Difícil': '#FFD700', 'Muy Difícil': '#FF7700', 'Legendario': '#FF007F',
      'Extremo': '#9900FF', 'Demencial': '#00FFFF', 'Imposible': '#FFFF00', 'Infierno': '#FF0055', 'Mítico': '#FFFFFF'
    };

    levels.forEach(level => {
      const unlocked = ScoreManager.isLevelUnlocked(level.number);
      const record   = ScoreManager.getRecord(level.number);
      const bestTime = ScoreManager.getBestTime(level.number);

      const card = document.createElement('div');
      card.className = `level-card ${unlocked ? '' : 'locked'}`;
      card.innerHTML = `
        ${!unlocked ? '<div class="level-card-lock">🔒</div>' : ''}
        <div class="level-card-number" style="color:${diffColors[level.difficulty] || '#00F0FF'}">
          ${level.number}
        </div>
        <div class="level-card-name">${level.name}</div>
        <div class="level-card-diff" style="color:${diffColors[level.difficulty] || '#9E9EC8'}">
          ${level.difficulty}
        </div>
        <div class="level-card-stars">${starEmojis[level.stars] || ''}</div>
        ${record ? `<div class="level-card-record">🏆 ${record} pts</div>` : ''}
        ${bestTime ? `<div class="level-card-record">⏱ ${ScoreManager.formatTime(bestTime)}</div>` : ''}
      `;

      if (unlocked) {
        card.addEventListener('click', () => {
          AudioManager.init();
          startCountdown(() => {
            Game.startLevel(level.number, false, ScoreManager.getPlayerName());
          });
        });
      }
      grid.appendChild(card);
    });
  }

  /**
   * Cuenta regresiva previa al inicio (3.. 2.. 1.. ¡CORRE!)
   */
  function startCountdown(callback) {
    showScreen('countdown');
    const numberEl = document.getElementById('countdown-number');
    let count = 3;
    if (numberEl) numberEl.textContent = count;
    AudioManager.play('countdown');

    if (countdownTimer) clearInterval(countdownTimer);

    countdownTimer = setInterval(() => {
      count--;
      if (count > 0) {
        if (numberEl) numberEl.textContent = count;
        AudioManager.play('countdown');
      } else if (count === 0) {
        if (numberEl) numberEl.textContent = '¡CORRE!';
        AudioManager.play('goal');
      } else {
        clearInterval(countdownTimer);
        countdownTimer = null;
        callback();
      }
    }, 850);
  }

  /**
   * Muestra la pantalla de pausa
   */
  function showPause({ p1Score, p2Score }) {
    const el = document.getElementById('screen-pause');
    if (el) el.classList.add('active');
  }

  function hidePause() {
    hideScreen('pause');
  }

  /**
   * Muestra la pantalla de Game Over
   */
  function showGameOver({ level, isMultiplayer, p1Score, p2Score }) {
    const msg = document.getElementById('go-message');
    if (msg) {
      msg.textContent = isMultiplayer
        ? '¡Ambos corredores fueron eliminados!'
        : '¡Te has quedado sin vidas!';
    }
    const el = document.getElementById('screen-gameover');
    if (el) el.classList.add('active');
  }

  /**
   * Muestra los resultados comparativos del nivel (P1 vs P2)
   */
  function showResults({ level, isMultiplayer, p1, p2, record, unlockedLevel }) {
    const title = document.getElementById('results-title');
    const badge = document.getElementById('results-badge');

    if (isMultiplayer && p1 && p2) {
      if (p1.isWinner) {
        title.textContent = `¡${p1.name} GANA LA CARRERA!`;
        badge.textContent = '🥇';
      } else if (p2.isWinner) {
        title.textContent = `¡${p2.name} GANA LA CARRERA!`;
        badge.textContent = '🥇';
      } else {
        title.textContent = 'CARRERA TERMINADA';
        badge.textContent = '🏁';
      }

      // Columna P1
      document.getElementById('res-p1-col')?.classList.remove('hidden');
      document.getElementById('res-p1-pos').textContent = p1.isWinner ? 'WINNER 🏆' : (p1.isAlive ? 'RUNNER-UP' : 'ELIMINADO 💀');
      document.getElementById('res-p1-time').textContent = p1.time;
      document.getElementById('res-p1-coins').textContent = p1.coins;
      document.getElementById('res-p1-score').textContent = p1.score;

      // Columna P2
      document.getElementById('res-p2-col')?.classList.remove('hidden');
      document.getElementById('res-mid-divider')?.classList.remove('hidden');
      document.getElementById('res-p2-pos').textContent = p2.isWinner ? 'WINNER 🏆' : (p2.isAlive ? 'RUNNER-UP' : 'ELIMINADO 💀');
      document.getElementById('res-p2-time').textContent = p2.time;
      document.getElementById('res-p2-coins').textContent = p2.coins;
      document.getElementById('res-p2-score').textContent = p2.score;
    } else {
      // Modo Solo
      title.textContent = '¡NIVEL COMPLETADO!';
      badge.textContent = '🥇';

      document.getElementById('res-p1-col')?.classList.remove('hidden');
      document.getElementById('res-p1-pos').textContent = 'COMPLETADO ✨';
      document.getElementById('res-p1-time').textContent = p1.time;
      document.getElementById('res-p1-coins').textContent = p1.coins;
      document.getElementById('res-p1-score').textContent = p1.score;

      document.getElementById('res-p2-col')?.classList.add('hidden');
      document.getElementById('res-mid-divider')?.classList.add('hidden');
    }

    // Banner de desbloqueo
    const banner = document.getElementById('unlock-banner');
    if (banner) {
      if (unlockedLevel) {
        document.getElementById('unlocked-level').textContent = unlockedLevel;
        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }
    }

    const el = document.getElementById('screen-results');
    if (el) el.classList.add('active');
  }

  /**
   * Pantalla de Victoria Final (Completar todos los niveles)
   */
  function showVictory({ score, coins, time }) {
    const summary = document.getElementById('victory-summary-content');
    if (summary) {
      summary.innerHTML = `
        <div class="vic-stat"><span>Puntuación Final:</span><strong>${score} pts</strong></div>
        <div class="vic-stat"><span>Monedas Totales:</span><strong>🪙 ${coins}</strong></div>
        <div class="vic-stat"><span>Tiempo:</span><strong>⏱ ${time}</strong></div>
      `;
    }
    const el = document.getElementById('screen-victory');
    if (el) el.classList.add('active');
  }

  /**
   * Renderiza la tabla de récords
   */
  function _renderRecords() {
    const container = document.getElementById('records-container');
    if (!container) return;
    container.innerHTML = '';

    const levels = LevelConfig.getAllLevels();
    levels.forEach(lvl => {
      const record = ScoreManager.getRecord(lvl.number);
      const time   = ScoreManager.getBestTime(lvl.number);

      const row = document.createElement('div');
      row.className = 'record-row';
      row.innerHTML = `
        <div class="rec-level">NIVEL ${lvl.number}: ${lvl.name}</div>
        <div class="rec-score">${record ? `🏆 ${record} pts` : '—'}</div>
        <div class="rec-time">${time ? `⏱ ${ScoreManager.formatTime(time)}` : '—'}</div>
      `;
      container.appendChild(row);
    });
  }

  /**
   * Carga la configuración guardada
   */
  function _loadSettings() {
    const nameInput = document.getElementById('setting-name');
    if (nameInput) nameInput.value = ScoreManager.getPlayerName();

    const settings = ScoreManager.getSettings();
    const musicToggle = document.getElementById('setting-music');
    const sfxToggle   = document.getElementById('setting-sfx');
    const volumeSlider= document.getElementById('setting-volume');

    if (musicToggle) musicToggle.checked = settings.music;
    if (sfxToggle)   sfxToggle.checked   = settings.sfx;
    if (volumeSlider)volumeSlider.value  = Math.floor(settings.volume * 100);
  }

  function _saveSettings() {
    const name = document.getElementById('setting-name')?.value.trim() || 'Player 1';
    const music = document.getElementById('setting-music')?.checked ?? true;
    const sfx   = document.getElementById('setting-sfx')?.checked ?? true;
    const volume = (parseInt(document.getElementById('setting-volume')?.value ?? 70, 10)) / 100;

    ScoreManager.saveSettings({ name, music, sfx, volume });
    AudioManager.loadSettings({ music, sfx, volume });
    showToast('Configuración guardada 💾');
    showScreen('menu');
  }

  /**
   * Notificación Toast flotante
   */
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 2500);
  }

  /**
   * Conecta todos los eventos de UI
   */
  function setupEvents() {
    // ── Menú Principal ──────────────────────────────────────────────────────
    document.getElementById('btn-play-solo')?.addEventListener('click', () => {
      AudioManager.init();
      startCountdown(() => {
        Game.startLevel(1, false, ScoreManager.getPlayerName());
      });
    });

    document.getElementById('btn-multiplayer')?.addEventListener('click', () => {
      AudioManager.init();
      showScreen('multiplayer');
    });

    document.getElementById('btn-levels')?.addEventListener('click', () => {
      showScreen('levels');
    });

    document.getElementById('btn-records')?.addEventListener('click', () => {
      showScreen('records');
    });

    document.getElementById('btn-settings')?.addEventListener('click', () => {
      showScreen('settings');
    });

    // ── Helper para poblar los 20 niveles en el selector Online ────────────
    function _populateOnlineLevels() {
      const select = document.getElementById('mp-select-level-online');
      if (!select || select.children.length > 0) return;
      const allLevels = LevelConfig.getAllLevels ? LevelConfig.getAllLevels() : [];
      select.innerHTML = allLevels.map(lvl => 
        `<option value="${lvl.number}">${lvl.name} — [${lvl.difficulty}]</option>`
      ).join('');
    }

    // ── Lobby Online ────────────────────────────────────────────────────────
    document.getElementById('btn-online')?.addEventListener('click', () => {
      AudioManager.init();
      showScreen('lobby');
      Network.init();
      _populateOnlineLevels();
      document.getElementById('room-code-display')?.classList.add('hidden');
    });
    
    document.getElementById('btn-back-lobby')?.addEventListener('click', () => {
      showScreen('menu');
    });

    document.getElementById('btn-create-room')?.addEventListener('click', () => {
      _populateOnlineLevels();
      Network.createRoom((res) => {
        if (res.success) {
          document.getElementById('room-code-display')?.classList.remove('hidden');
          const codeEl = document.getElementById('room-code-text');
          if (codeEl) codeEl.textContent = res.roomId;
          showToast(`¡Sala ${res.roomId} creada! Comparte el código o el enlace`, 'success');
          
          Network.onPlayerJoined = (data) => {
            showToast('⚡ ¡Rival conectado! La carrera comenzará en breve...', 'success');
            const selectedLevel = parseInt(document.getElementById('mp-select-level-online')?.value || '1', 10);
            
            // Notificar al cliente para sincronizar inicio
            Network.sendLevelStart({ level: selectedLevel, seed: data.seed });
            
            setTimeout(() => {
              startCountdown(() => {
                Game.startLevelOnline(selectedLevel, true, true, data.seed);
              });
            }, 1000);
          };
        } else {
          showToast('Error al crear sala: ' + (res.message || 'Sin conexión'), 'danger');
        }
      });
    });

    // Botones para copiar Código y Enlace de Invitación
    document.getElementById('btn-copy-code')?.addEventListener('click', () => {
      const code = document.getElementById('room-code-text')?.textContent;
      if (code && code !== '---') {
        navigator.clipboard.writeText(code).then(() => {
          showToast('📋 ¡Código ' + code + ' copiado al portapapeles!', 'info');
        }).catch(() => {
          showToast('Código: ' + code, 'info');
        });
      }
    });

    document.getElementById('btn-copy-link')?.addEventListener('click', () => {
      const code = document.getElementById('room-code-text')?.textContent;
      if (code && code !== '---') {
        const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${code}`;
        navigator.clipboard.writeText(inviteUrl).then(() => {
          showToast('🔗 ¡Enlace de invitación copiado! Envíalo a tu amigo', 'success');
        }).catch(() => {
          prompt('Copia este enlace de invitación:', inviteUrl);
        });
      }
    });

    document.getElementById('btn-join-room')?.addEventListener('click', () => {
      const codeInput = document.getElementById('join-room-code');
      const code = codeInput ? codeInput.value.trim().toUpperCase() : '';
      if (code.length !== 6) {
        showToast('El código debe tener exactamente 6 letras', 'danger');
        return;
      }

      const statusEl = document.getElementById('join-status-msg');
      if (statusEl) statusEl.textContent = 'Conectando con la sala ' + code + '...';

      Network.joinRoom(code, (res) => {
        if (res.success) {
          if (statusEl) statusEl.textContent = '✅ Conectado. Esperando que el Host inicie la partida...';
          showToast('¡Conectado a la sala! Esperando al Host...', 'success');
          
          Network.onOpponentStart = (data) => {
            startCountdown(() => {
              Game.startLevelOnline(data.level, true, false, data.seed);
            });
          };
        } else {
          if (statusEl) statusEl.textContent = '❌ ' + (res.message || 'Error al unirse');
          showToast(res.message || 'Error al unirse a la sala', 'danger');
        }
      });
    });

    // Detección automática de parámetro ?room=XYZ en la URL
    setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const roomParam = (params.get('room') || window.location.hash.replace('#room=', '')).trim().toUpperCase();
      if (roomParam && roomParam.length === 6) {
        showScreen('lobby');
        Network.init();
        _populateOnlineLevels();
        const input = document.getElementById('join-room-code');
        if (input) input.value = roomParam;
        showToast(`🎮 ¡Invitación detectada para la sala ${roomParam}! Haz clic en UNIRSE`, 'info');
      }
    }, 400);

    // ── Opciones de División de Pantalla (Horizontal / Vertical) ────────────
    const optSplitH = document.getElementById('opt-split-h');
    const optSplitV = document.getElementById('opt-split-v');

    optSplitH?.addEventListener('click', () => {
      optSplitH.classList.add('active');
      optSplitV?.classList.remove('active');
      Game.setSplitMode('horizontal');
    });

    optSplitV?.addEventListener('click', () => {
      optSplitV.classList.add('active');
      optSplitH?.classList.remove('active');
      Game.setSplitMode('vertical');
    });

    // ── Multijugador Local: Iniciar Carrera Dividida ─────────────────────────
    document.getElementById('btn-start-local-mp')?.addEventListener('click', () => {
      AudioManager.init();
      const p1Name = document.getElementById('mp-p1-name')?.value.trim() || 'Player 1';
      const p2Name = document.getElementById('mp-p2-name')?.value.trim() || 'Player 2';
      const selectedLevel = parseInt(document.getElementById('mp-select-level')?.value || '1', 10);

      startCountdown(() => {
        Game.startLevel(selectedLevel, true, p1Name, p2Name);
      });
    });

    // ── Botones de Volver ───────────────────────────────────────────────────
    document.getElementById('btn-back-levels')?.addEventListener('click', () => showScreen('menu'));
    document.getElementById('btn-back-mp')?.addEventListener('click', () => showScreen('menu'));
    document.getElementById('btn-back-records')?.addEventListener('click', () => showScreen('menu'));
    document.getElementById('btn-back-settings')?.addEventListener('click', () => showScreen('menu'));

    // ── Configuración ──────────────────────────────────────────────────────
    document.getElementById('btn-save-settings')?.addEventListener('click', _saveSettings);

    // ── Borrar récords ──────────────────────────────────────────────────────
    document.getElementById('btn-clear-records')?.addEventListener('click', () => {
      if (confirm('¿Deseas reiniciar todos los récords?')) {
        ScoreManager.clearAll();
        _renderRecords();
        showToast('Récords reiniciados.');
      }
    });
  }

  return {
    showScreen,
    hideScreen,
    showPause,
    hidePause,
    showGameOver,
    showResults,
    showVictory,
    startCountdown,
    showToast,
    setupEvents,
    get currentScreen() { return currentScreen; }
  };
})();
