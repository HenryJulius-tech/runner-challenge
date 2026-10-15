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
    }
  }

  function createRoom(callback) {
    if (!socket) init();
    if (!socket) {
      callback({ success: false, message: 'Socket.IO no está disponible. Revisa la conexión con el servidor.' });
      return;
    }
    socket.emit('create_room', {}, (res) => {
      if (res.success) {
        roomId = res.roomId;
        isHost = true;
      }
      callback(res);
    });
  }

  function joinRoom(id, callback) {
    if (!socket) init();
    if (!socket) {
      callback({ success: false, message: 'Socket.IO no está disponible. Revisa la conexión con el servidor.' });
      return;
    }
    socket.emit('join_room', id, (res) => {
      if (res.success) {
        roomId = res.roomId;
        isHost = false;
      }
      callback(res);
    });
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
    set onOpponentStart(cb) { onOpponentStartCallback = cb; }
  };
})();
