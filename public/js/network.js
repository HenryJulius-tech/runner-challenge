/**
 * network.js — Cliente de Socket.IO para el Multijugador Online
 */

const Network = (() => {
  let socket = null;
  let roomId = null;
  let isHost = false;
  
  let onPlayerJoinedCallback = null;
  let onOpponentStateCallback = null;
  let onOpponentEventCallback = null;
  let onOpponentDisconnectedCallback = null;
  let onOpponentStartCallback = null;
  let onRoomReadyStatusCallback = null;
  let onMatchStartCountdownCallback = null;
  let onLevelUpdatedCallback = null;
  let onOpponentLeftLobbyCallback = null;

  function init() {
    if (typeof io !== 'undefined' && !socket) {
      socket = io();
      
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
      
      socket.on('opponent_disconnected', () => {
        if (onOpponentDisconnectedCallback) onOpponentDisconnectedCallback();
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
    }
  }

  function createRoom(options, callback) {
    if (!socket) init();
    if (!socket) {
      if (typeof callback === 'function') callback({ success: false, message: 'Socket.IO no está disponible. Revisa la conexión con el servidor.' });
      return;
    }
    const data = typeof options === 'object' ? options : {};
    socket.emit('create_room', data, (res) => {
      if (res && res.success) {
        roomId = res.roomId;
        isHost = true;
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
    const data = typeof idOrOptions === 'string' ? { roomId: idOrOptions } : idOrOptions;
    socket.emit('join_room', data, (res) => {
      if (res && res.success) {
        roomId = res.roomId;
        isHost = false;
      }
      if (typeof callback === 'function') callback(res);
    });
  }

  function sendReady(ready, name) {
    if (socket && roomId) {
      socket.emit('player_ready', { ready: !!ready, name });
    }
  }

  function changeLevel(level) {
    if (socket && roomId && isHost) {
      socket.emit('select_level', { level: parseInt(level, 10) || 1 });
    }
  }

  function leaveRoom() {
    if (socket && roomId) {
      socket.emit('leave_room');
      roomId = null;
      isHost = false;
    }
  }

  function sendState(state) {
    if (socket && roomId) {
      socket.emit('player_state', state);
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

  return {
    init,
    createRoom,
    joinRoom,
    sendReady,
    changeLevel,
    leaveRoom,
    sendState,
    sendEvent,
    sendLevelStart,
    get isConnected() { return !!socket && socket.connected; },
    get roomId() { return roomId; },
    get isHost() { return isHost; },
    
    set onPlayerJoined(cb) { onPlayerJoinedCallback = cb; },
    set onOpponentState(cb) { onOpponentStateCallback = cb; },
    set onOpponentEvent(cb) { onOpponentEventCallback = cb; },
    set onOpponentDisconnected(cb) { onOpponentDisconnectedCallback = cb; },
    set onOpponentStart(cb) { onOpponentStartCallback = cb; },
    set onRoomReadyStatus(cb) { onRoomReadyStatusCallback = cb; },
    set onMatchStartCountdown(cb) { onMatchStartCountdownCallback = cb; },
    set onLevelUpdated(cb) { onLevelUpdatedCallback = cb; },
    set onOpponentLeftLobby(cb) { onOpponentLeftLobbyCallback = cb; }
  };
})();
