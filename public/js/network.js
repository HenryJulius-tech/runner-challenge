/**
 * network.js — Cliente de Socket.IO para el Multijugador Online
 *
 * El cliente no decide posiciones oficiales ni ganadores: sólo envía su estado
 * (con secuencia y raceId) y representa el estado autoritativo que difunde el servidor.
 */

const Network = (() => {
  const SESSION_KEY = 'rc_online_session';

  let socket = null;
  let roomId = null;
  let isHost = false;
  let playerId = null;
  let playerToken = null;
  let playerSlot = null;
  let lastProfile = { name: null, color: null };
  let intentionalLeave = false;
  let stateSeq = 0;
  let timeSyncTimer = null;
  let clockOffset = 0;
  let hasClockSync = false;

  let onPlayerJoinedCallback = null;
  let onOpponentStateCallback = null;
  let onOpponentEventCallback = null;
  let onOpponentDisconnectedCallback = null;
  let onOpponentReconnectedCallback = null;
  let onOpponentStartCallback = null;
  let onRoomReadyStatusCallback = null;
  let onMatchStartCountdownCallback = null;
  let onLevelUpdatedCallback = null;
  let onOpponentLeftLobbyCallback = null;
  let onRoomReturnedToLobbyCallback = null;
  let onPlayerGoalReachedCallback = null;
  let onPlayerProfileUpdatedCallback = null;
  let onRaceStateCallback = null;
  let onRaceFinishedCallback = null;
  let onMatchResumedCallback = null;
  let onReconnectedCallback = null;

  // ── Sesión local (por pestaña) para reconexiones ──────────────────────────
  function _saveSession() {
    try {
      if (!roomId || !playerToken) return;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        roomId,
        token: playerToken,
        playerId,
        slot: playerSlot,
        name: lastProfile.name,
        color: lastProfile.color
      }));
    } catch (_) { /* almacenamiento no disponible */ }
  }

  function _clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_) { /* ignore */ }
  }

  function _syncTime() {
    if (!socket || !socket.connected) return;
    const sentAt = Date.now();
    socket.emit('time_sync', { clientTime: sentAt }, (res) => {
      if (!res || !Number.isFinite(Number(res.serverTime))) return;
      const receivedAt = Date.now();
      const rtt = Math.max(0, receivedAt - sentAt);
      const offset = Number(res.serverTime) + rtt / 2 - receivedAt;
      clockOffset = hasClockSync ? (clockOffset * 0.8 + offset * 0.2) : offset;
      hasClockSync = true;
    });
  }

  function init() {
    if (typeof io !== 'undefined' && !socket) {
      socket = io();

      socket.on('connect', () => {
        _syncTime();
        if (timeSyncTimer) clearInterval(timeSyncTimer);
        timeSyncTimer = setInterval(_syncTime, 5000);

        // Reconexión automática si el socket se cayó sin abandonar la sala.
        if (roomId && playerToken && !intentionalLeave) {
          socket.emit('join_room', {
            roomId,
            token: playerToken,
            name: lastProfile.name,
            color: lastProfile.color
          }, (res) => {
            if (res && res.success) {
              roomId = res.roomId || roomId;
              playerId = res.playerId || playerId;
              playerToken = res.token || playerToken;
              playerSlot = Number.isFinite(Number(res.slot)) ? Number(res.slot) : playerSlot;
              isHost = playerSlot === 0;
              _saveSession();
              if (onReconnectedCallback) onReconnectedCallback(res);
            } else if (res && res.success === false) {
              // La sala ya no existe: limpiar la sesión para no reintentar indefinidamente.
              roomId = null;
              playerToken = null;
              playerId = null;
              playerSlot = null;
              _clearSession();
              if (onReconnectedCallback) onReconnectedCallback(res);
            }
          });
        }
      });

      socket.on('player_joined', (data) => {
        if (onPlayerJoinedCallback) onPlayerJoinedCallback(data);
      });

      socket.on('opponent_state', (data) => {
        if (onOpponentStateCallback) onOpponentStateCallback(data);
      });

      socket.on('opponent_event', (data) => {
        if (onOpponentEventCallback) onOpponentEventCallback(data);
      });

      socket.on('opponent_start', (data) => {
        if (onOpponentStartCallback) onOpponentStartCallback(data);
      });

      socket.on('opponent_disconnected', (data) => {
        if (onOpponentDisconnectedCallback) onOpponentDisconnectedCallback(data);
      });

      socket.on('opponent_reconnected', (data) => {
        if (onOpponentReconnectedCallback) onOpponentReconnectedCallback(data);
      });

      socket.on('room_ready_status', (data) => {
        if (onRoomReadyStatusCallback) onRoomReadyStatusCallback(data);
      });

      socket.on('match_start_countdown', (data) => {
        if (onMatchStartCountdownCallback) onMatchStartCountdownCallback(data);
      });

      socket.on('level_updated', (data) => {
        if (onLevelUpdatedCallback) onLevelUpdatedCallback(data);
      });

      socket.on('opponent_left_lobby', (data) => {
        if (onOpponentLeftLobbyCallback) onOpponentLeftLobbyCallback(data);
      });

      socket.on('room_returned_to_lobby', (data) => {
        if (onRoomReturnedToLobbyCallback) onRoomReturnedToLobbyCallback(data);
      });

      socket.on('player_goal_reached', (data) => {
        if (onPlayerGoalReachedCallback) onPlayerGoalReachedCallback(data);
      });

      socket.on('player_profile_updated', (data) => {
        if (onPlayerProfileUpdatedCallback) onPlayerProfileUpdatedCallback(data);
      });

      socket.on('race_state', (data) => {
        if (onRaceStateCallback) onRaceStateCallback(data);
      });

      socket.on('race_finished', (data) => {
        if (onRaceFinishedCallback) onRaceFinishedCallback(data);
      });

      socket.on('match_resumed', (data) => {
        if (onMatchResumedCallback) onMatchResumedCallback(data);
      });
    }
  }

  function createRoom(options, callback) {
    if (!socket) init();
    if (!socket) {
      if (typeof callback === 'function') callback({ success: false, message: 'Socket.IO no está disponible. Revisa la conexión con el servidor.' });
      return;
    }
    const data = typeof options === 'object' ? options : {};
    lastProfile = { name: data.name || lastProfile.name, color: data.color || lastProfile.color };
    intentionalLeave = false;
    socket.emit('create_room', data, (res) => {
      if (res && res.success) {
        roomId = res.roomId;
        isHost = true;
        playerId = res.playerId || null;
        playerToken = res.token || null;
        playerSlot = Number.isFinite(Number(res.slot)) ? Number(res.slot) : 0;
        stateSeq = 0;
        _saveSession();
      }
      if (typeof callback === 'function') callback(res);
    });
  }

  function joinRoom(idOrOptions, callback) {
    if (!socket) init();
    if (!socket) {
      if (typeof callback === 'function') callback({ success: false, message: 'Socket.IO no está disponible. Revisa la conexión con el servidor.' });
      return;
    }
    const data = typeof idOrOptions === 'string' ? { roomId: idOrOptions } : (idOrOptions || {});
    lastProfile = { name: data.name || lastProfile.name, color: data.color || lastProfile.color };
    intentionalLeave = false;
    socket.emit('join_room', data, (res) => {
      if (res && res.success) {
        roomId = res.roomId;
        isHost = Number(res.slot) === 0;
        playerId = res.playerId || null;
        playerToken = res.token || null;
        playerSlot = Number.isFinite(Number(res.slot)) ? Number(res.slot) : null;
        stateSeq = 0;
        _saveSession();
      }
      if (typeof callback === 'function') callback(res);
    });
  }

  function sendReady(ready, name, color, goalWorldX) {
    if (socket && roomId) {
      if (name) lastProfile.name = name;
      if (color) lastProfile.color = color;
      _saveSession();
      socket.emit('player_ready', { ready: !!ready, name, color, goalWorldX });
    }
  }

  function updateProfile(name, color) {
    if (socket && roomId) {
      if (name) lastProfile.name = name;
      if (color) lastProfile.color = color;
      _saveSession();
      socket.emit('update_profile', { name, color });
    }
  }

  function sendPlayerFinished(finishData) {
    if (socket && roomId) {
      socket.emit('player_finished', finishData);
    }
  }

  function changeLevel(level, goalWorldX) {
    if (socket && roomId && isHost) {
      socket.emit('select_level', {
        level: parseInt(level, 10) || 1,
        goalWorldX
      });
    }
  }

  function returnToLobby(data) {
    if (socket && roomId) {
      socket.emit('return_to_lobby', data || {});
    }
  }

  function leaveRoom() {
    intentionalLeave = true;
    if (socket && roomId) {
      socket.emit('leave_room');
    }
    roomId = null;
    isHost = false;
    playerId = null;
    playerToken = null;
    playerSlot = null;
    stateSeq = 0;
    _clearSession();
  }

  function sendState(state) {
    if (socket && roomId) {
      stateSeq++;
      socket.emit('player_state', { ...state, seq: stateSeq });
    }
  }

  function sendEvent(eventData) {
    if (socket && roomId) {
      socket.emit('game_event', eventData);
    }
  }

  function sendLevelStart(data) {
    if (socket && roomId) {
      socket.emit('level_start', data);
    }
  }

  function getServerNow() {
    return Date.now() + clockOffset;
  }

  function getSnapshotAgeMs(serverTime) {
    if (!hasClockSync || !Number.isFinite(Number(serverTime))) return 0;
    return Math.max(0, Math.min(250, getServerNow() - Number(serverTime)));
  }

  return {
    init,
    createRoom,
    joinRoom,
    sendReady,
    updateProfile,
    sendPlayerFinished,
    changeLevel,
    returnToLobby,
    leaveRoom,
    sendState,
    sendEvent,
    sendLevelStart,
    getServerNow,
    getSnapshotAgeMs,
    get isConnected() { return !!socket && socket.connected; },
    get roomId() { return roomId; },
    get isHost() { return isHost; },
    get playerId() { return playerId; },
    get playerSlot() { return playerSlot; },

    set onPlayerJoined(cb) { onPlayerJoinedCallback = cb; },
    set onOpponentState(cb) { onOpponentStateCallback = cb; },
    set onOpponentEvent(cb) { onOpponentEventCallback = cb; },
    set onOpponentDisconnected(cb) { onOpponentDisconnectedCallback = cb; },
    set onOpponentReconnected(cb) { onOpponentReconnectedCallback = cb; },
    set onOpponentStart(cb) { onOpponentStartCallback = cb; },
    set onRoomReadyStatus(cb) { onRoomReadyStatusCallback = cb; },
    set onMatchStartCountdown(cb) { onMatchStartCountdownCallback = cb; },
    set onLevelUpdated(cb) { onLevelUpdatedCallback = cb; },
    set onOpponentLeftLobby(cb) { onOpponentLeftLobbyCallback = cb; },
    set onRoomReturnedToLobby(cb) { onRoomReturnedToLobbyCallback = cb; },
    set onPlayerGoalReached(cb) { onPlayerGoalReachedCallback = cb; },
    set onPlayerProfileUpdated(cb) { onPlayerProfileUpdatedCallback = cb; },
    set onRaceState(cb) { onRaceStateCallback = cb; },
    set onRaceFinished(cb) { onRaceFinishedCallback = cb; },
    set onMatchResumed(cb) { onMatchResumedCallback = cb; },
    set onReconnected(cb) { onReconnectedCallback = cb; }
  };
})();
