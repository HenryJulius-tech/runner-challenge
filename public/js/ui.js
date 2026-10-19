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
        `<option value="${lvl.number}">Nivel ${lvl.number}: ${lvl.name} — [${lvl.difficulty}]</option>`
      ).join('');
    }

    // ── Paleta Neón para Corredores ────────────────────────────────────────
    const NEON_COLORS = [
      { name: 'Cyan Neón', hex: '#00F0FF' },
      { name: 'Magenta Neón', hex: '#FF007F' },
      { name: 'Verde Cyber', hex: '#00FF88' },
      { name: 'Amarillo Turbo', hex: '#FFD700' },
      { name: 'Naranja Fuego', hex: '#FF7700' },
      { name: 'Violeta Cósmico', hex: '#9900FF' },
      { name: 'Rojo Carmesí', hex: '#FF3366' }
    ];

    function _getColorName(hex) {
      const found = NEON_COLORS.find(c => c.hex.toLowerCase() === (hex || '').toLowerCase());
      return found ? found.name : 'Personalizado';
    }

    function _renderSwatches(containerId, activeColor, onSelect) {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = '';
      NEON_COLORS.forEach(c => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `color-swatch ${c.hex.toLowerCase() === (activeColor || '').toLowerCase() ? 'active' : ''}`;
        btn.style.backgroundColor = c.hex;
        btn.style.color = c.hex;
        btn.title = c.name;
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          onSelect(c.hex);
        });
        container.appendChild(btn);
      });
    }

    // ── Estado de la Sala Online ────────────────────────────────────────────
    const onlineState = {
      inRoom: false,
      isHost: false,
      roomId: null,
      seed: 42,
      level: 1,
      myReady: false,
      opponentReady: false,
      opponentConnected: false,
      p1Name: 'Host',
      p2Name: 'Rival',
      p1Color: '#00F0FF',
      p2Color: '#FF007F'
    };

    function _showOnlineLobbyView(inRoom) {
      onlineState.inRoom = inRoom;
      const initialView = document.getElementById('mp-online-initial-view');
      const roomView    = document.getElementById('mp-online-room-view');

      if (inRoom) {
        initialView?.classList.add('hidden');
        roomView?.classList.remove('hidden');
      } else {
        initialView?.classList.remove('hidden');
        roomView?.classList.add('hidden');
        const statusEl = document.getElementById('join-status-msg');
        if (statusEl) statusEl.textContent = '';
        onlineState.myReady = false;
        onlineState.opponentReady = false;
        onlineState.opponentConnected = false;
        onlineState.roomId = null;
      }
    }

    function _updateOnlineLobbyUI() {
      if (!onlineState.inRoom) return;

      // Código de sala
      const badge = document.getElementById('room-code-badge');
      if (badge) badge.textContent = onlineState.roomId || '------';

      // Nivel
      const hostWrap = document.getElementById('online-level-host-wrap');
      const guestWrap = document.getElementById('online-level-guest-wrap');
      const guestText = document.getElementById('online-level-guest-text');
      const selectLevel = document.getElementById('mp-select-level-online');

      const lvlData = LevelConfig.getLevelData ? LevelConfig.getLevelData(onlineState.level) : null;
      const lvlLabel = lvlData ? `Nivel ${onlineState.level}: ${lvlData.name}` : `Nivel ${onlineState.level}`;

      if (onlineState.isHost) {
        hostWrap?.classList.remove('hidden');
        guestWrap?.classList.add('hidden');
        if (selectLevel && parseInt(selectLevel.value, 10) !== onlineState.level) {
          selectLevel.value = String(onlineState.level);
        }
      } else {
        hostWrap?.classList.add('hidden');
        guestWrap?.classList.remove('hidden');
        if (guestText) guestText.textContent = `${lvlLabel} (Elegido por el Host)`;
      }

      // Configuración de tarjetas P1 y P2 según seas Host o Rival
      const p1NameDisplayWrap = document.getElementById('p1-name-display-wrap');
      const p1NameEditWrap    = document.getElementById('p1-name-edit-wrap');
      const p1Input           = document.getElementById('lobby-input-p1');
      const p1NameEl          = document.getElementById('online-p1-name');
      const p1SwatchesWrap    = document.getElementById('p1-swatches-wrap');
      const p1PreviewWrap     = document.getElementById('p1-color-preview-wrap');
      const p1Dot             = document.getElementById('dot-p1');
      const p1ColorLabel      = document.getElementById('label-color-p1');
      const p1Avatar          = document.getElementById('avatar-p1-lobby');
      const p1Card            = document.getElementById('card-p1-online');
      const p1StatusEl        = document.getElementById('lobby-p1-status');

      const p2NameDisplayWrap = document.getElementById('p2-name-display-wrap');
      const p2NameEditWrap    = document.getElementById('p2-name-edit-wrap');
      const p2Input           = document.getElementById('lobby-input-p2');
      const p2NameEl          = document.getElementById('online-p2-name');
      const p2SwatchesWrap    = document.getElementById('p2-swatches-wrap');
      const p2PreviewWrap     = document.getElementById('p2-color-preview-wrap');
      const p2Dot             = document.getElementById('dot-p2');
      const p2ColorLabel      = document.getElementById('label-color-p2');
      const p2Avatar          = document.getElementById('avatar-p2-lobby');
      const p2Card            = document.getElementById('card-p2-online');
      const p2StatusEl        = document.getElementById('lobby-p2-status');

      if (onlineState.isHost) {
        // TÚ eres P1 (Host)
        p1NameDisplayWrap?.classList.add('hidden');
        p1NameEditWrap?.classList.remove('hidden');
        if (p1Input && document.activeElement !== p1Input) p1Input.value = onlineState.p1Name;

        p1SwatchesWrap?.classList.remove('hidden');
        p1PreviewWrap?.classList.add('hidden');
        _renderSwatches('swatches-p1', onlineState.p1Color, (chosenHex) => {
          onlineState.p1Color = chosenHex;
          Network.updateProfile(onlineState.p1Name, chosenHex);
          _updateOnlineLobbyUI();
        });

        // P2 es el Rival
        p2NameEditWrap?.classList.add('hidden');
        p2NameDisplayWrap?.classList.remove('hidden');
        if (p2NameEl) p2NameEl.textContent = onlineState.opponentConnected ? onlineState.p2Name : 'Esperando rival...';

        p2SwatchesWrap?.classList.add('hidden');
        p2PreviewWrap?.classList.remove('hidden');
        if (p2Dot) p2Dot.style.background = onlineState.p2Color;
        if (p2ColorLabel) p2ColorLabel.textContent = _getColorName(onlineState.p2Color);
      } else {
        // TÚ eres P2 (Rival)
        p1NameEditWrap?.classList.add('hidden');
        p1NameDisplayWrap?.classList.remove('hidden');
        if (p1NameEl) p1NameEl.textContent = onlineState.p1Name;

        p1SwatchesWrap?.classList.add('hidden');
        p1PreviewWrap?.classList.remove('hidden');
        if (p1Dot) p1Dot.style.background = onlineState.p1Color;
        if (p1ColorLabel) p1ColorLabel.textContent = _getColorName(onlineState.p1Color);

        // P2 eres tú (editable)
        p2NameDisplayWrap?.classList.add('hidden');
        p2NameEditWrap?.classList.remove('hidden');
        if (p2Input && document.activeElement !== p2Input) p2Input.value = onlineState.p2Name;

        p2SwatchesWrap?.classList.remove('hidden');
        p2PreviewWrap?.classList.add('hidden');
        _renderSwatches('swatches-p2', onlineState.p2Color, (chosenHex) => {
          onlineState.p2Color = chosenHex;
          Network.updateProfile(onlineState.p2Name, chosenHex);
          _updateOnlineLobbyUI();
        });
      }

      // Estilos visuales neón de Avatares y Tarjetas
      if (p1Avatar) {
        p1Avatar.style.background = `linear-gradient(135deg, ${onlineState.p1Color}, #000)`;
        p1Avatar.style.border = `2px solid ${onlineState.p1Color}`;
        p1Avatar.style.boxShadow = `0 0 16px ${onlineState.p1Color}`;
      }
      if (p1Card) p1Card.style.borderColor = `${onlineState.p1Color}77`;

      if (p2Avatar) {
        p2Avatar.style.background = `linear-gradient(135deg, ${onlineState.p2Color}, #000)`;
        p2Avatar.style.border = `2px solid ${onlineState.p2Color}`;
        p2Avatar.style.boxShadow = `0 0 16px ${onlineState.p2Color}`;
      }
      if (p2Card) p2Card.style.borderColor = `${onlineState.p2Color}77`;

      // Estados de Listo P1
      const p1IsReady = onlineState.isHost ? onlineState.myReady : onlineState.opponentReady;
      if (p1StatusEl) {
        if (p1IsReady) {
          p1StatusEl.className = 'lobby-status-pill status-ready';
          p1StatusEl.innerHTML = '<span class="status-icon">✅</span> <span class="status-txt">¡LISTO!</span>';
        } else {
          p1StatusEl.className = 'lobby-status-pill status-waiting';
          p1StatusEl.innerHTML = '<span class="status-icon">⏳</span> <span class="status-txt">NO LISTO</span>';
        }
      }

      // Estados de Listo P2
      if (!onlineState.opponentConnected && onlineState.isHost) {
        if (p2StatusEl) {
          p2StatusEl.className = 'lobby-status-pill status-disconnected';
          p2StatusEl.innerHTML = '<span class="status-icon">⌛</span> <span class="status-txt">ESPERANDO...</span>';
        }
      } else {
        const p2IsReady = onlineState.isHost ? onlineState.opponentReady : onlineState.myReady;
        if (p2StatusEl) {
          if (p2IsReady) {
            p2StatusEl.className = 'lobby-status-pill status-ready';
            p2StatusEl.innerHTML = '<span class="status-icon">✅</span> <span class="status-txt">¡LISTO!</span>';
          } else {
            p2StatusEl.className = 'lobby-status-pill status-waiting';
            p2StatusEl.innerHTML = '<span class="status-icon">⏳</span> <span class="status-txt">NO LISTO</span>';
          }
        }
      }

      // Botón de Preparado / Listo
      const btnReady = document.getElementById('btn-toggle-ready');
      const btnIcon = document.getElementById('btn-ready-icon');
      const btnText = document.getElementById('btn-ready-text');
      const hintEl = document.getElementById('lobby-ready-hint');

      const opponentName = onlineState.isHost ? onlineState.p2Name : onlineState.p1Name;

      if (!onlineState.opponentConnected && onlineState.isHost) {
        if (btnReady) {
          btnReady.disabled = true;
          btnReady.className = 'btn-ready-toggle';
        }
        if (btnIcon) btnIcon.textContent = '⏳';
        if (btnText) btnText.textContent = 'ESPERANDO A TU RIVAL...';
        if (hintEl) hintEl.textContent = 'Comparte el enlace o código para que tu amigo se una a la sala.';
      } else {
        if (btnReady) btnReady.disabled = false;

        if (onlineState.myReady) {
          if (btnReady) btnReady.className = 'btn-ready-toggle is-ready';
          if (btnIcon) btnIcon.textContent = '🟡';
          if (btnText) btnText.textContent = 'CANCELAR (NO LISTO)';
          if (hintEl) {
            hintEl.textContent = onlineState.opponentReady 
              ? '🚀 ¡Ambos listos! Iniciando partida...' 
              : `Esperando a que ${opponentName} pulse '¡Estoy Listo!'...`;
          }
        } else {
          if (btnReady) btnReady.className = 'btn-ready-toggle';
          if (btnIcon) btnIcon.textContent = '🟢';
          if (btnText) btnText.textContent = '¡ESTOY LISTO!';
          if (hintEl) {
            hintEl.textContent = onlineState.opponentReady 
              ? `🔥 ¡${opponentName} ya está listo! Pulsa '¡ESTOY LISTO!' para arrancar.` 
              : 'Elige tu color y presiona el botón cuando estés listo.';
          }
        }
      }
    }

    function _setupNetworkListeners() {
      Network.onPlayerJoined = (data) => {
        onlineState.opponentConnected = true;
        onlineState.p2Name = data.opponentName || 'Rival';
        onlineState.p2Color = data.opponentColor || '#FF007F';
        onlineState.seed = data.seed;
        onlineState.myReady = false;
        onlineState.opponentReady = false;
        _updateOnlineLobbyUI();
        if (AudioManager.playPowerup) AudioManager.playPowerup();
        showToast(`⚡ ¡${onlineState.p2Name} se unió a la sala!`, 'success');
      };

      Network.onPlayerProfileUpdated = (data) => {
        if (data.isHost) {
          onlineState.p1Name = data.name || onlineState.p1Name;
          onlineState.p1Color = data.color || onlineState.p1Color;
        } else {
          onlineState.p2Name = data.name || onlineState.p2Name;
          onlineState.p2Color = data.color || onlineState.p2Color;
        }
        _updateOnlineLobbyUI();
      };

      Network.onRoomReadyStatus = (data) => {
        if (onlineState.isHost) {
          onlineState.myReady = data.p1Ready;
          onlineState.opponentReady = data.p2Ready;
          onlineState.p1Name = data.p1Name || onlineState.p1Name;
          onlineState.p2Name = data.p2Name || onlineState.p2Name;
          onlineState.p1Color = data.p1Color || onlineState.p1Color;
          onlineState.p2Color = data.p2Color || onlineState.p2Color;
        } else {
          onlineState.myReady = data.p2Ready;
          onlineState.opponentReady = data.p1Ready;
          onlineState.p1Name = data.p1Name || onlineState.p1Name;
          onlineState.p2Name = data.p2Name || onlineState.p2Name;
          onlineState.p1Color = data.p1Color || onlineState.p1Color;
          onlineState.p2Color = data.p2Color || onlineState.p2Color;
        }
        _updateOnlineLobbyUI();
      };

      Network.onMatchStartCountdown = (data) => {
        const btnReady = document.getElementById('btn-toggle-ready');
        if (btnReady) {
          btnReady.disabled = true;
          btnReady.className = 'btn-ready-toggle both-ready';
        }
        const btnIcon = document.getElementById('btn-ready-icon');
        const btnText = document.getElementById('btn-ready-text');
        if (btnIcon) btnIcon.textContent = '🚀';
        if (btnText) btnText.textContent = '¡AMBOS LISTOS! INICIANDO...';
        showToast('🚀 ¡Ambos jugadores listos! La carrera comienza...', 'success');

        const matchLevel = data.level || onlineState.level;
        const matchSeed  = data.seed || onlineState.seed;
        const p1Name     = data.p1Name || onlineState.p1Name;
        const p2Name     = data.p2Name || onlineState.p2Name;
        const p1Color    = data.p1Color || onlineState.p1Color;
        const p2Color    = data.p2Color || onlineState.p2Color;

        setTimeout(() => {
          startCountdown(() => {
            Game.startLevelOnline(
              matchLevel,
              true,
              onlineState.isHost,
              matchSeed,
              onlineState.isHost ? p1Name : p2Name,
              onlineState.isHost ? p2Name : p1Name,
              onlineState.isHost ? p1Color : p2Color,
              onlineState.isHost ? p2Color : p1Color
            );
          });
        }, 500);
      };

      Network.onLevelUpdated = (data) => {
        onlineState.level = data.level;
        onlineState.myReady = false;
        onlineState.opponentReady = false;
        _updateOnlineLobbyUI();
        showToast(`El Host cambió la carrera al Nivel ${data.level}. Confirmen con ¡Listo!`, 'info');
      };

      Network.onOpponentLeftLobby = (data) => {
        onlineState.opponentConnected = false;
        onlineState.opponentReady = false;
        onlineState.myReady = false;
        onlineState.p2Name = 'Esperando rival...';
        _updateOnlineLobbyUI();
        showToast('⚠️ Tu rival salió de la sala.', 'warning');
      };

      Network.onRoomReturnedToLobby = (data) => {
        if (typeof Game !== 'undefined') Game.stopLoop();

        hideScreen('game');
        hideScreen('results');
        hideScreen('gameover');
        hidePause();

        onlineState.inRoom = true;
        onlineState.level = data.level || onlineState.level;
        onlineState.seed = data.seed || Math.floor(Math.random() * 10000);
        onlineState.myReady = false;
        onlineState.opponentReady = false;
        onlineState.opponentConnected = true;

        onlineState.p1Name  = data.p1Name || onlineState.p1Name;
        onlineState.p2Name  = data.p2Name || onlineState.p2Name;
        onlineState.p1Color = data.p1Color || onlineState.p1Color;
        onlineState.p2Color = data.p2Color || onlineState.p2Color;

        showScreen('lobby');
        _showOnlineLobbyView(true);
        _updateOnlineLobbyUI();

        const msg = data.reason === 'restart'
          ? `↺ Revancha en el Nivel ${onlineState.level}. ¡Pulsen "¡ESTOY LISTO!"!`
          : `🏁 Pasando al Nivel ${onlineState.level}. ¡Pulsen "¡ESTOY LISTO!"!`;
        showToast(msg, 'info');
      };
    }

    // Escuchar cambios de nombre en tiempo real
    document.getElementById('lobby-input-p1')?.addEventListener('input', (e) => {
      if (!onlineState.isHost) return;
      const val = e.target.value.trim().slice(0, 14) || 'Host';
      onlineState.p1Name = val;
      ScoreManager.saveSettings({ name: val });
      Network.updateProfile(val, onlineState.p1Color);
    });

    document.getElementById('lobby-input-p2')?.addEventListener('input', (e) => {
      if (onlineState.isHost) return;
      const val = e.target.value.trim().slice(0, 14) || 'Rival';
      onlineState.p2Name = val;
      ScoreManager.saveSettings({ name: val });
      Network.updateProfile(val, onlineState.p2Color);
    });

    // ── Lobby Online ────────────────────────────────────────────────────────
    document.getElementById('btn-online')?.addEventListener('click', () => {
      AudioManager.init();
      showScreen('lobby');
      Network.init();
      _setupNetworkListeners();
      _populateOnlineLevels();
      _showOnlineLobbyView(false);
    });
    
    document.getElementById('btn-back-lobby')?.addEventListener('click', () => {
      if (onlineState.inRoom) {
        Network.leaveRoom();
        _showOnlineLobbyView(false);
      }
      showScreen('menu');
    });

    document.getElementById('btn-leave-room')?.addEventListener('click', () => {
      Network.leaveRoom();
      _showOnlineLobbyView(false);
      showToast('Has salido de la sala', 'info');
    });

    // Crear Sala
    document.getElementById('btn-create-room')?.addEventListener('click', () => {
      _populateOnlineLevels();
      Network.init();
      _setupNetworkListeners();

      const pName = ScoreManager.getPlayerName() || 'Host';
      const selLevel = parseInt(document.getElementById('mp-select-level-online')?.value || '1', 10);
      const pColor = onlineState.p1Color || '#00F0FF';

      Network.createRoom({ name: pName, level: selLevel, color: pColor }, (res) => {
        if (res && res.success) {
          onlineState.isHost = true;
          onlineState.roomId = res.roomId;
          onlineState.seed = res.seed;
          onlineState.level = res.level || selLevel;
          onlineState.p1Name = pName;
          onlineState.p1Color = res.hostColor || pColor;
          onlineState.p2Name = 'Esperando rival...';
          onlineState.p2Color = '#FF007F';
          onlineState.opponentConnected = false;
          onlineState.myReady = false;
          onlineState.opponentReady = false;

          _showOnlineLobbyView(true);
          _updateOnlineLobbyUI();
          showToast(`¡Sala ${res.roomId} creada! Comparte el código o enlace con tu rival`, 'success');
        } else {
          showToast('Error al crear sala: ' + (res?.message || 'Sin conexión'), 'danger');
        }
      });
    });

    // Unirse a Sala
    document.getElementById('btn-join-room')?.addEventListener('click', () => {
      const codeInput = document.getElementById('join-room-code');
      const code = codeInput ? codeInput.value.trim().toUpperCase() : '';
      if (code.length !== 6) {
        showToast('El código debe tener exactamente 6 letras', 'danger');
        return;
      }

      const statusEl = document.getElementById('join-status-msg');
      if (statusEl) statusEl.textContent = 'Conectando con la sala ' + code + '...';

      Network.init();
      _setupNetworkListeners();

      const pName = ScoreManager.getPlayerName() || 'Rival';
      const pColor = onlineState.p2Color || '#FF007F';

      Network.joinRoom({ roomId: code, name: pName, color: pColor }, (res) => {
        if (res && res.success) {
          onlineState.isHost = false;
          onlineState.roomId = res.roomId;
          onlineState.seed = res.seed;
          onlineState.level = res.level || 1;
          onlineState.p1Name = res.hostName || 'Host';
          onlineState.p1Color = res.hostColor || '#00F0FF';
          onlineState.p2Name = pName;
          onlineState.p2Color = res.guestColor || pColor;
          onlineState.opponentConnected = true;
          onlineState.myReady = false;
          onlineState.opponentReady = !!res.p1Ready;

          _showOnlineLobbyView(true);
          _updateOnlineLobbyUI();
          if (AudioManager.playPowerup) AudioManager.playPowerup();
          showToast(`¡Conectado a la sala ${code}! Pulsa ¡ESTOY LISTO!`, 'success');
        } else {
          if (statusEl) statusEl.textContent = '❌ ' + (res?.message || 'Error al unirse');
          showToast(res?.message || 'Error al unirse a la sala', 'danger');
        }
      });
    });

    // Botón para Alternar Estado LISTO (Ready)
    document.getElementById('btn-toggle-ready')?.addEventListener('click', () => {
      if (!onlineState.opponentConnected && onlineState.isHost) return;

      onlineState.myReady = !onlineState.myReady;
      if (AudioManager.playJump) AudioManager.playJump();

      const myName = onlineState.isHost ? onlineState.p1Name : onlineState.p2Name;
      const myColor = onlineState.isHost ? onlineState.p1Color : onlineState.p2Color;
      Network.sendReady(onlineState.myReady, myName, myColor);
      _updateOnlineLobbyUI();
    });

    // Selector de Nivel (solo el Host)
    document.getElementById('mp-select-level-online')?.addEventListener('change', (e) => {
      if (!onlineState.isHost) return;
      const newLevel = parseInt(e.target.value, 10) || 1;
      onlineState.level = newLevel;
      onlineState.myReady = false;
      onlineState.opponentReady = false;
      Network.changeLevel(newLevel);
      _updateOnlineLobbyUI();
      showToast(`Nivel cambiado al Nivel ${newLevel}. Ambos deben confirmar con ¡Listo!`, 'info');
    });

    // Botones para copiar Código y Enlace de Invitación
    document.getElementById('btn-copy-code')?.addEventListener('click', () => {
      const code = onlineState.roomId;
      if (code && code !== '------') {
        navigator.clipboard.writeText(code).then(() => {
          showToast('📋 ¡Código ' + code + ' copiado al portapapeles!', 'info');
        }).catch(() => {
          showToast('Código: ' + code, 'info');
        });
      }
    });

    document.getElementById('btn-copy-link')?.addEventListener('click', () => {
      const code = onlineState.roomId;
      if (code && code !== '------') {
        const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${code}`;
        navigator.clipboard.writeText(inviteUrl).then(() => {
          showToast('🔗 ¡Enlace de invitación copiado! Envíalo a tu amigo', 'success');
        }).catch(() => {
          prompt('Copia este enlace de invitación:', inviteUrl);
        });
      }
    });

    // Detección automática de parámetro ?room=XYZ en la URL
    setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const roomParam = (params.get('room') || window.location.hash.replace('#room=', '')).trim().toUpperCase();
      if (roomParam && roomParam.length === 6) {
        showScreen('lobby');
        Network.init();
        _setupNetworkListeners();
        _populateOnlineLevels();
        _showOnlineLobbyView(false);
        const input = document.getElementById('join-room-code');
        if (input) input.value = roomParam;
        showToast(`🎮 ¡Invitación detectada para la sala ${roomParam}! Haz clic en UNIRSE A LA SALA`, 'info');
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
