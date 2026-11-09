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
    'menu', 'levels', 'levels-3d', 'multiplayer', 'lobby',
    'countdown', 'game', 'game-3d', 'pause', 'gameover',
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
    if (screenName === 'levels-3d' && typeof Neon3DUI !== 'undefined') Neon3DUI.renderLevels3DGrid();
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
    document.getElementById('btn-play-neon-3d')?.addEventListener('click', () => {
      AudioManager.init();
      showScreen('levels-3d');
    });

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

    // ── Helper para poblar los 20 niveles en el selector Online (2D o 3D) ──
    function _populateOnlineLevels(forceMode) {
      const select = document.getElementById('mp-select-level-online');
      if (!select) return;
      const mode = forceMode || onlineState.gameMode || '2d';
      const is3D = mode === '3d';
      const allLevels = (is3D && typeof Neon3DLevels !== 'undefined')
        ? Neon3DLevels.getAllLevels()
        : (LevelConfig.getAllLevels ? LevelConfig.getAllLevels() : []);

      const prevVal = select.value || '1';
      select.innerHTML = allLevels.map(lvl => 
        `<option value="${lvl.number}">Nivel ${lvl.number}: ${lvl.name} — [${lvl.difficulty}${is3D ? ' · 3D' : ''}]</option>`
      ).join('');

      if (prevVal && select.querySelector(`option[value="${prevVal}"]`)) {
        select.value = prevVal;
      }
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
      gameMode: '2d', // '2d' | '3d'
      roomId: null,
      seed: 42,
      level: 1,
      myReady: false,
      opponentReady: false,
      opponentConnected: false,
      p1Name: 'Host',
      p2Name: 'Rival',
      p1Color: '#00F0FF',
      p2Color: '#FF007F',
      p1Wins: 0,
      p1Losses: 0,
      p2Wins: 0,
      p2Losses: 0
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
        onlineState.p1Wins = 0;
        onlineState.p1Losses = 0;
        onlineState.p2Wins = 0;
        onlineState.p2Losses = 0;
      }
    }

    function _updateOnlineScoreboard() {
      const tbody = document.getElementById('online-scoreboard-body');
      if (!tbody) return;

      const players = [
        {
          slot: 0,
          name: onlineState.p1Name || 'Host',
          color: onlineState.p1Color || '#00F0FF',
          wins: Math.max(0, Number(onlineState.p1Wins) || 0),
          losses: Math.max(0, Number(onlineState.p1Losses) || 0)
        },
        {
          slot: 1,
          name: onlineState.opponentConnected ? (onlineState.p2Name || 'Rival') : 'Esperando rival...',
          color: onlineState.p2Color || '#FF007F',
          wins: Math.max(0, Number(onlineState.p2Wins) || 0),
          losses: Math.max(0, Number(onlineState.p2Losses) || 0)
        }
      ];

      players.sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (a.losses !== b.losses) return a.losses - b.losses;
        return a.slot - b.slot;
      });

      const recordsDiffer = players[0].wins !== players[1].wins || players[0].losses !== players[1].losses;
      tbody.innerHTML = '';

      players.forEach((player, index) => {
        const played = player.wins + player.losses;
        const tr = document.createElement('tr');
        if (recordsDiffer && index === 0) tr.classList.add('is-leader');
        if (recordsDiffer && index === 1) tr.classList.add('is-trailing');

        const posCell = document.createElement('td');
        posCell.className = 'col-pos';
        const posBadge = document.createElement('span');
        posBadge.className = 'scoreboard-position';
        posBadge.textContent = String(index + 1);
        posCell.appendChild(posBadge);

        const playerCell = document.createElement('td');
        playerCell.className = 'col-player';
        const playerWrap = document.createElement('div');
        playerWrap.className = 'scoreboard-player';
        const dot = document.createElement('span');
        dot.className = 'scoreboard-player-dot';
        dot.style.backgroundColor = player.color;
        dot.style.color = player.color;
        const name = document.createElement('span');
        name.className = 'scoreboard-player-name';
        name.textContent = player.name;
        playerWrap.appendChild(dot);
        playerWrap.appendChild(name);
        playerCell.appendChild(playerWrap);

        const winsCell = document.createElement('td');
        winsCell.className = 'col-stat scoreboard-stat-win';
        winsCell.textContent = String(player.wins);

        const lossesCell = document.createElement('td');
        lossesCell.className = 'col-stat scoreboard-stat-loss';
        lossesCell.textContent = String(player.losses);

        const stateCell = document.createElement('td');
        stateCell.className = 'col-state';
        const stateBadge = document.createElement('span');
        stateBadge.className = 'scoreboard-state neutral';
        if (played === 0) {
          stateBadge.textContent = 'SIN PARTIDAS';
        } else if (player.wins > player.losses) {
          stateBadge.className = 'scoreboard-state winning';
          stateBadge.textContent = 'GANANDO';
        } else if (player.wins < player.losses) {
          stateBadge.className = 'scoreboard-state losing';
          stateBadge.textContent = 'PERDIENDO';
        } else {
          stateBadge.textContent = 'EMPATE';
        }
        stateCell.appendChild(stateBadge);

        tr.appendChild(posCell);
        tr.appendChild(playerCell);
        tr.appendChild(winsCell);
        tr.appendChild(lossesCell);
        tr.appendChild(stateCell);
        tbody.appendChild(tr);
      });
    }

    function _updateOnlineLobbyUI() {
      if (!onlineState.inRoom) return;

      // Código de sala
      const badge = document.getElementById('room-code-badge');
      if (badge) badge.textContent = onlineState.roomId || '------';

      // Modo de Juego (2D vs 3D)
      const btnMode2D = document.getElementById('btn-mode-2d');
      const btnMode3D = document.getElementById('btn-mode-3d');
      const guestModeWrap = document.getElementById('online-mode-guest-indicator');
      const guestModeText = document.getElementById('online-mode-guest-text');
      const is3D = onlineState.gameMode === '3d';

      if (onlineState.isHost) {
        btnMode2D?.removeAttribute('disabled');
        btnMode3D?.removeAttribute('disabled');
        guestModeWrap?.classList.add('hidden');
        if (is3D) {
          btnMode3D?.classList.add('active');
          btnMode2D?.classList.remove('active');
        } else {
          btnMode2D?.classList.add('active');
          btnMode3D?.classList.remove('active');
        }
      } else {
        btnMode2D?.setAttribute('disabled', 'true');
        btnMode3D?.setAttribute('disabled', 'true');
        guestModeWrap?.classList.remove('hidden');
        if (guestModeText) {
          guestModeText.textContent = is3D ? '🕶️ Modo 3D Cyberpunk' : '🕹️ Modo 2D Clásico';
          guestModeText.style.color = is3D ? '#FF007F' : '#00F0FF';
        }
        if (is3D) {
          btnMode3D?.classList.add('active');
          btnMode2D?.classList.remove('active');
        } else {
          btnMode2D?.classList.add('active');
          btnMode3D?.classList.remove('active');
        }
      }

      // Nivel
      const hostWrap = document.getElementById('online-level-host-wrap');
      const guestWrap = document.getElementById('online-level-guest-wrap');
      const guestText = document.getElementById('online-level-guest-text');
      const selectLevel = document.getElementById('mp-select-level-online');

      const lvlData = is3D
        ? (typeof Neon3DLevels !== 'undefined' ? Neon3DLevels.getLevelData(onlineState.level) : null)
        : (LevelConfig.getLevelData ? LevelConfig.getLevelData(onlineState.level) : null);
      const lvlLabel = lvlData ? `Nivel ${onlineState.level}: ${lvlData.name}${is3D ? ' (3D)' : ''}` : `Nivel ${onlineState.level}`;

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

      _updateOnlineScoreboard();
    }

    function _setupNetworkListeners() {
      Network.onPlayerJoined = (data) => {
        onlineState.opponentConnected = true;
        onlineState.p2Name = data.opponentName || 'Rival';
        onlineState.p2Color = data.opponentColor || '#FF007F';
        onlineState.seed = data.seed;
        if (data.gameMode) onlineState.gameMode = data.gameMode;
        onlineState.myReady = false;
        onlineState.opponentReady = false;
        _populateOnlineLevels();
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

      Network.onOpponentDisconnected = (data) => {
        onlineState.opponentConnected = false;
        _updateOnlineLobbyUI();
        if (data && data.reconnectWindowMs) {
          showToast('⚠️ Rival desconectado. Esperando reconexión...', 'warning');
        }
      };

      Network.onOpponentReconnected = (data) => {
        onlineState.opponentConnected = true;
        if (data && data.name) {
          if (Number(data.slot) === 0) onlineState.p1Name = data.name;
          else onlineState.p2Name = data.name;
        }
        if (data && data.color) {
          if (Number(data.slot) === 0) onlineState.p1Color = data.color;
          else onlineState.p2Color = data.color;
        }
        _updateOnlineLobbyUI();
        showToast('✅ Rival reconectado. La sala continúa.', 'success');
      };

      Network.onReconnected = (res) => {
        if (!res || !res.success) {
          if (res && res.success === false) showToast('La sala anterior ya no existe.', 'warning');
          return;
        }
        onlineState.inRoom = true;
        onlineState.roomId = res.roomId || onlineState.roomId;
        onlineState.isHost = Number(res.slot) === 0;
        onlineState.seed = res.seed || onlineState.seed;
        onlineState.level = res.level || onlineState.level;
        if (res.gameMode) onlineState.gameMode = res.gameMode;
        onlineState.opponentConnected = res.opponentConnected !== false;
        onlineState.p1Name = res.hostName || onlineState.p1Name;
        onlineState.p1Color = res.hostColor || onlineState.p1Color;
        onlineState.p2Name = res.guestName || onlineState.p2Name;
        onlineState.p2Color = res.guestColor || onlineState.p2Color;
        onlineState.myReady = false;
        onlineState.opponentReady = false;

        _populateOnlineLevels();

        if (typeof Game !== 'undefined' && Game.state === 'playing') {
          showToast('🔄 Conexión restablecida. La carrera continúa.', 'success');
          return;
        }
        _showOnlineLobbyView(true);
        _updateOnlineLobbyUI();
        showToast('🔄 Reconectado a la sala.', 'success');
      };

      Network.onRoomReadyStatus = (data) => {
        if (data.gameMode) onlineState.gameMode = data.gameMode;
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
        onlineState.p1Wins = Number(data.p1Wins) || 0;
        onlineState.p1Losses = Number(data.p1Losses) || 0;
        onlineState.p2Wins = Number(data.p2Wins) || 0;
        onlineState.p2Losses = Number(data.p2Losses) || 0;
        _populateOnlineLevels();
        _updateOnlineLobbyUI();
      };

      Network.onModeUpdated = (data) => {
        onlineState.gameMode = data.gameMode || '2d';
        onlineState.level = data.level || onlineState.level;
        onlineState.myReady = false;
        onlineState.opponentReady = false;
        _populateOnlineLevels();
        _updateOnlineLobbyUI();
        const modeLabel = onlineState.gameMode === '3d' ? '3D Cyberpunk' : '2D Clásico';
        showToast(`🎮 Modo de carrera cambiado a ${modeLabel}.`, 'info');
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
        const is3D       = (data.gameMode === '3d') || (onlineState.gameMode === '3d');

        setTimeout(() => {
          startCountdown(() => {
            if (is3D && typeof Neon3DUI !== 'undefined') {
              Neon3DUI.startRaceOnline(
                matchLevel,
                {
                  raceId: data.raceId || null,
                  seed: matchSeed,
                  isHost: onlineState.isHost,
                  myColor: onlineState.isHost ? p1Color : p2Color,
                  rivalName: onlineState.isHost ? p2Name : p1Name,
                  rivalColor: onlineState.isHost ? p2Color : p1Color
                }
              );
            } else {
              Game.startLevelOnline(
                matchLevel,
                true,
                onlineState.isHost,
                matchSeed,
                onlineState.isHost ? p1Name : p2Name,
                onlineState.isHost ? p2Name : p1Name,
                onlineState.isHost ? p1Color : p2Color,
                onlineState.isHost ? p2Color : p1Color,
                data.raceId || null
              );
            }
          });
        }, 500);
      };

      Network.onLevelUpdated = (data) => {
        onlineState.level = data.level;
        if (data.gameMode) onlineState.gameMode = data.gameMode;
        onlineState.myReady = false;
        onlineState.opponentReady = false;
        _populateOnlineLevels();
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
        if (typeof Neon3DEngine !== 'undefined') Neon3DEngine.stop();

        hideScreen('game');
        hideScreen('game-3d');
        hideScreen('results');
        hideScreen('gameover');
        hidePause();
        document.getElementById('screen-pause-3d')?.classList.remove('active');
        document.getElementById('screen-gameover-3d')?.classList.remove('active');
        document.getElementById('screen-victory-3d')?.classList.remove('active');

        onlineState.inRoom = true;
        if (data.gameMode) onlineState.gameMode = data.gameMode;
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
        _populateOnlineLevels();
        _showOnlineLobbyView(true);
        _updateOnlineLobbyUI();

        const modeTxt = onlineState.gameMode === '3d' ? '3D Cyberpunk' : '2D';
        const msg = data.reason === 'restart'
          ? `↺ Revancha en el Nivel ${onlineState.level} (${modeTxt}). ¡Pulsen "¡ESTOY LISTO!"!`
          : `🏁 Pasando al Nivel ${onlineState.level} (${modeTxt}). ¡Pulsen "¡ESTOY LISTO!"!`;
        showToast(msg, 'info');
      };
    }

    // Escuchar cambios de nombre en tiempo real
    document.getElementById('lobby-input-p1')?.addEventListener('input', (e) => {
      if (!onlineState.isHost) return;
      const rawVal = e.target.value.slice(0, 14);
      onlineState.p1Name = rawVal;
      const cleanVal = rawVal.trim() || 'Host';
      ScoreManager.saveSettings({ name: cleanVal });
      Network.updateProfile(cleanVal, onlineState.p1Color);
    });

    document.getElementById('lobby-input-p2')?.addEventListener('input', (e) => {
      if (onlineState.isHost) return;
      const rawVal = e.target.value.slice(0, 14);
      onlineState.p2Name = rawVal;
      const cleanVal = rawVal.trim() || 'Rival';
      ScoreManager.saveSettings({ name: cleanVal });
      Network.updateProfile(cleanVal, onlineState.p2Color);
    });

    // ── Lobby Online ────────────────────────────────────────────────────────
    const _openOnlineLobby = (defaultMode = '2d') => {
      AudioManager.init();
      showScreen('lobby');
      _setupNetworkListeners();
      Network.init();
      onlineState.gameMode = defaultMode;
      _populateOnlineLevels(defaultMode);
      _showOnlineLobbyView(false);
      const btn2D = document.getElementById('btn-mode-2d');
      const btn3D = document.getElementById('btn-mode-3d');
      if (defaultMode === '3d') {
        btn3D?.classList.add('active');
        btn2D?.classList.remove('active');
      } else {
        btn2D?.classList.add('active');
        btn3D?.classList.remove('active');
      }
    };

    document.getElementById('btn-online')?.addEventListener('click', () => {
      _openOnlineLobby('2d');
    });

    document.getElementById('btn-online-3d-menu')?.addEventListener('click', () => {
      _openOnlineLobby('3d');
    });

    document.getElementById('btn-online-from-3d')?.addEventListener('click', () => {
      _openOnlineLobby('3d');
    });

    // ── Conmutador de modo 2D / 3D en la sala ────────────────────────────────
    document.getElementById('btn-mode-2d')?.addEventListener('click', () => {
      if (!onlineState.isHost) return;
      if (onlineState.gameMode === '2d') return;
      onlineState.gameMode = '2d';
      onlineState.myReady = false;
      onlineState.opponentReady = false;
      _populateOnlineLevels('2d');
      const lvlData = LevelConfig.getLevelData ? LevelConfig.getLevelData(onlineState.level) : null;
      Network.changeGameMode('2d', onlineState.level, lvlData?.levelLength || 3200);
      _updateOnlineLobbyUI();
      showToast('🎮 Modo cambiado a 2D Clásico.', 'info');
    });

    document.getElementById('btn-mode-3d')?.addEventListener('click', () => {
      if (!onlineState.isHost) return;
      if (onlineState.gameMode === '3d') return;
      onlineState.gameMode = '3d';
      onlineState.myReady = false;
      onlineState.opponentReady = false;
      _populateOnlineLevels('3d');
      const lvlData = typeof Neon3DLevels !== 'undefined' ? Neon3DLevels.getLevelData(onlineState.level) : null;
      Network.changeGameMode('3d', onlineState.level, lvlData?.finishDistance || 650);
      _updateOnlineLobbyUI();
      showToast('🕶️ Modo cambiado a 3D Cyberpunk.', 'info');
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
      _setupNetworkListeners();
      Network.init();

      const pName = ScoreManager.getPlayerName() || 'Host';
      const selLevel = parseInt(document.getElementById('mp-select-level-online')?.value || '1', 10);
      const pColor = onlineState.p1Color || '#00F0FF';
      const is3D = onlineState.gameMode === '3d';
      const lvlInfo = is3D
        ? (typeof Neon3DLevels !== 'undefined' ? Neon3DLevels.getLevelData(selLevel) : null)
        : (LevelConfig.getLevelData ? LevelConfig.getLevelData(selLevel) : null);
      const goalDist = is3D ? (lvlInfo?.finishDistance || 650) : (lvlInfo?.levelLength || 3200);

      Network.createRoom({ name: pName, level: selLevel, color: pColor, gameMode: onlineState.gameMode || '2d', goalWorldX: goalDist }, (res) => {
        if (res && res.success) {
          onlineState.isHost = true;
          onlineState.roomId = res.roomId;
          onlineState.gameMode = res.gameMode || onlineState.gameMode || '2d';
          onlineState.seed = res.seed;
          onlineState.level = res.level || selLevel;
          onlineState.p1Name = pName;
          onlineState.p1Color = res.hostColor || pColor;
          onlineState.p2Name = 'Esperando rival...';
          onlineState.p2Color = '#FF007F';
          onlineState.opponentConnected = false;
          onlineState.myReady = false;
          onlineState.opponentReady = false;
          onlineState.p1Wins = 0;
          onlineState.p1Losses = 0;
          onlineState.p2Wins = 0;
          onlineState.p2Losses = 0;

          _populateOnlineLevels();
          _showOnlineLobbyView(true);
          _updateOnlineLobbyUI();
          const modeTag = onlineState.gameMode === '3d' ? '3D' : '2D';
          showToast(`¡Sala ${res.roomId} (${modeTag}) creada! Comparte el código o enlace con tu rival`, 'success');
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

      _setupNetworkListeners();
      Network.init();

      const pName = ScoreManager.getPlayerName() || 'Rival';
      const pColor = onlineState.p2Color || '#FF007F';

      Network.joinRoom({ roomId: code, name: pName, color: pColor }, (res) => {
        if (res && res.success) {
          onlineState.isHost = false;
          onlineState.roomId = res.roomId;
          onlineState.gameMode = res.gameMode || '2d';
          onlineState.seed = res.seed;
          onlineState.level = res.level || 1;
          onlineState.p1Name = res.hostName || 'Host';
          onlineState.p1Color = res.hostColor || '#00F0FF';
          onlineState.p2Name = pName;
          onlineState.p2Color = res.guestColor || pColor;
          onlineState.opponentConnected = true;
          onlineState.myReady = false;
          onlineState.opponentReady = !!res.p1Ready;
          onlineState.p1Wins = 0;
          onlineState.p1Losses = 0;
          onlineState.p2Wins = 0;
          onlineState.p2Losses = 0;

          _populateOnlineLevels();
          _showOnlineLobbyView(true);
          _updateOnlineLobbyUI();
          if (AudioManager.playPowerup) AudioManager.playPowerup();
          const modeTag = onlineState.gameMode === '3d' ? '3D' : '2D';
          showToast(`¡Conectado a la sala ${code} (${modeTag})! Pulsa ¡ESTOY LISTO!`, 'success');
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
      const is3D = onlineState.gameMode === '3d';
      const levelInfo = is3D
        ? (typeof Neon3DLevels !== 'undefined' ? Neon3DLevels.getLevelData(onlineState.level) : null)
        : (LevelConfig.getLevelData ? LevelConfig.getLevelData(onlineState.level) : null);
      const goalDist = is3D ? (levelInfo?.finishDistance || 650) : (levelInfo?.levelLength || 3200);
      Network.sendReady(onlineState.myReady, myName, myColor, goalDist);
      _updateOnlineLobbyUI();
    });

    // Selector de Nivel (solo el Host)
    document.getElementById('mp-select-level-online')?.addEventListener('change', (e) => {
      if (!onlineState.isHost) return;
      const newLevel = parseInt(e.target.value, 10) || 1;
      onlineState.level = newLevel;
      onlineState.myReady = false;
      onlineState.opponentReady = false;
      const is3D = onlineState.gameMode === '3d';
      const levelInfo = is3D
        ? (typeof Neon3DLevels !== 'undefined' ? Neon3DLevels.getLevelData(newLevel) : null)
        : (LevelConfig.getLevelData ? LevelConfig.getLevelData(newLevel) : null);
      const goalDist = is3D ? (levelInfo?.finishDistance || 650) : (levelInfo?.levelLength || 3200);
      Network.changeLevel(newLevel, goalDist, onlineState.gameMode);
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
        _setupNetworkListeners();
        Network.init();
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
