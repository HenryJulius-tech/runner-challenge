/**
 * server.js — Servidor local con Socket.IO para Runner Challenge: Neon Run
 */

const express = require('express');
const http    = require('http');
const path    = require('path');
const { Server } = require('socket.io');

const app  = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Endpoint de salud para plataformas en la nube (Render, Koyeb, Railway)
app.get('/health', (req, res) => {
  res.json({ status: 'online', game: 'Runner Challenge: Neon Run', activeRooms: Object.keys(rooms).length });
});

// Manejo de Salas
const rooms = {};

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado:', socket.id);

  socket.on('create_room', (data, callback) => {
    const roomId = generateRoomCode();
    const playerName = (data && data.name) ? String(data.name).trim().slice(0, 16) : 'Host (P1)';
    const playerColor = (data && data.color) ? String(data.color).trim() : '#00F0FF';
    const level = (data && data.level) ? parseInt(data.level, 10) : 1;

    rooms[roomId] = {
      players: [{ id: socket.id, name: playerName, color: playerColor, ready: false }],
      seed: Math.floor(Math.random() * 10000),
      level: level,
      winnerId: null,
      finishedPlayers: {}
    };

    socket.join(roomId);
    socket.roomId = roomId;
    socket.playerIndex = 0; // Host (P1)

    if (typeof callback === 'function') {
      callback({
        success: true,
        roomId,
        seed: rooms[roomId].seed,
        level: rooms[roomId].level,
        hostName: playerName,
        hostColor: playerColor
      });
    }
    console.log(`Sala creada: ${roomId} por ${socket.id} (${playerName}, ${playerColor})`);
  });

  socket.on('join_room', (data, callback) => {
    const roomId = typeof data === 'string' ? data.trim().toUpperCase() : (data && data.roomId ? String(data.roomId).trim().toUpperCase() : '');
    const playerName = (typeof data === 'object' && data && data.name) ? String(data.name).trim().slice(0, 16) : 'Rival (P2)';
    const playerColor = (typeof data === 'object' && data && data.color) ? String(data.color).trim() : '#FF007F';

    const room = rooms[roomId];
    if (room && room.players.length === 1) {
      room.players.push({ id: socket.id, name: playerName, color: playerColor, ready: false });
      socket.join(roomId);
      socket.roomId = roomId;
      socket.playerIndex = 1; // P2 (Rival)

      const hostPlayer = room.players[0];

      if (typeof callback === 'function') {
        callback({
          success: true,
          roomId,
          seed: room.seed,
          level: room.level,
          hostName: hostPlayer.name,
          hostColor: hostPlayer.color || '#00F0FF',
          guestName: playerName,
          guestColor: playerColor,
          p1Ready: hostPlayer.ready,
          p2Ready: false
        });
      }

      // Notificar al Host que se unió el Rival con nombre, color y estado
      socket.to(roomId).emit('player_joined', {
        seed: room.seed,
        level: room.level,
        opponentName: playerName,
        opponentColor: playerColor,
        p1Ready: hostPlayer.ready,
        p2Ready: false
      });
      console.log(`${socket.id} (${playerName}, ${playerColor}) se unió a la sala ${roomId}`);
    } else {
      if (typeof callback === 'function') {
        callback({ success: false, message: 'Sala llena o código inexistente' });
      }
    }
  });

  // Actualizar perfil (nombre y color de corredor) en tiempo real
  socket.on('update_profile', (data) => {
    const roomId = socket.roomId;
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      if (data && data.name) player.name = String(data.name).trim().slice(0, 16);
      if (data && data.color) player.color = String(data.color).trim();
    }

    io.to(roomId).emit('player_profile_updated', {
      playerId: socket.id,
      isHost: (socket.playerIndex === 0),
      name: player?.name,
      color: player?.color
    });
  });

  // Alternar estado LISTO (Ready) de cada jugador
  socket.on('player_ready', (data) => {
    const roomId = socket.roomId;
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.ready = !!(data && data.ready);
      if (data && data.name) player.name = String(data.name).trim().slice(0, 16);
      if (data && data.color) player.color = String(data.color).trim();
    }

    const p1 = room.players[0] || { ready: false, name: 'Host', color: '#00F0FF' };
    const p2 = room.players[1] || { ready: false, name: 'Rival', color: '#FF007F' };
    const bothReady = room.players.length === 2 && p1.ready && p2.ready;

    io.to(roomId).emit('room_ready_status', {
      p1Ready: p1.ready,
      p2Ready: p2.ready,
      p1Name: p1.name,
      p2Name: p2.name,
      p1Color: p1.color || '#00F0FF',
      p2Color: p2.color || '#FF007F',
      bothReady: bothReady
    });

    if (bothReady) {
      room.winnerId = null;
      room.finishedPlayers = {};
      console.log(`¡Ambos listos en ${roomId}! Iniciando partida sincronizada.`);
      io.to(roomId).emit('match_start_countdown', {
        level: room.level,
        seed: room.seed,
        p1Name: p1.name,
        p2Name: p2.name,
        p1Color: p1.color || '#00F0FF',
        p2Color: p2.color || '#FF007F'
      });
    }
  });

  // Árbitro central de llegada a la meta para evitar desincronización de ganador
  socket.on('player_finished', (data) => {
    const roomId = socket.roomId;
    const room = rooms[roomId];
    if (!room) return;

    if (!room.winnerId) {
      // El primero en llegar es coronado ganador oficial por el servidor
      room.winnerId = socket.id;
    }

    const isWinner = (room.winnerId === socket.id);
    room.finishedPlayers = room.finishedPlayers || {};
    room.finishedPlayers[socket.id] = {
      isWinner,
      time: data?.time || 0,
      score: (data?.score || 0) + (isWinner ? 500 : 250),
      coins: data?.coins || 0
    };

    io.to(roomId).emit('player_goal_reached', {
      playerId: socket.id,
      isHost: (socket.playerIndex === 0),
      isWinner: isWinner,
      time: data?.time || 0,
      score: room.finishedPlayers[socket.id].score,
      coins: data?.coins || 0
    });

    console.log(`[Meta] Sala ${roomId} | Jugador ${socket.id} (Host:${socket.playerIndex === 0}) cruzó la meta. ¿Ganador?: ${isWinner}`);
  });

  // Cambio de nivel por el Host
  socket.on('select_level', (data) => {
    const roomId = socket.roomId;
    const room = rooms[roomId];
    if (!room || socket.playerIndex !== 0) return;

    room.level = parseInt(data.level, 10) || 1;
    room.winnerId = null;
    room.finishedPlayers = {};
    // Resetear estados listos para que ambos reconfirmen con el nuevo nivel
    room.players.forEach(p => p.ready = false);

    io.to(roomId).emit('level_updated', {
      level: room.level,
      p1Ready: false,
      p2Ready: false
    });
  });

  // Regreso conjunto a la Sala de Espera (para Siguiente Nivel o Revancha/Reiniciar)
  socket.on('return_to_lobby', (data) => {
    const roomId = socket.roomId;
    const room = rooms[roomId];
    if (!room) return;

    if (data && data.level) {
      room.level = parseInt(data.level, 10);
    } else if (data && data.nextLevel) {
      room.level = Math.min((room.level || 1) + 1, 20);
    }
    room.seed = Math.floor(Math.random() * 10000);
    room.winnerId = null;
    room.finishedPlayers = {};

    // Resetear estados listos de los jugadores para la nueva carrera
    room.players.forEach(p => p.ready = false);

    const p1 = room.players[0] || { ready: false, name: 'Host', color: '#00F0FF' };
    const p2 = room.players[1] || { ready: false, name: 'Rival', color: '#FF007F' };

    console.log(`Sala ${roomId} regresando al lobby. Nivel objetivo: ${room.level}, Motivo: ${data?.reason || 'siguiente'}`);

    io.to(roomId).emit('room_returned_to_lobby', {
      level: room.level,
      seed: room.seed,
      p1Name: p1.name,
      p2Name: p2.name,
      p1Color: p1.color || '#00F0FF',
      p2Color: p2.color || '#FF007F',
      reason: data?.reason || 'next_level'
    });
  });

  socket.on('leave_room', () => {
    if (socket.roomId) {
      const roomId = socket.roomId;
      const room = rooms[roomId];
      socket.leave(roomId);
      socket.roomId = null;

      if (room) {
        room.players = room.players.filter(p => p.id !== socket.id);
        if (room.players.length === 0) {
          delete rooms[roomId];
        } else {
          // El rival restante pasa a no listo y se le notifica
          room.winnerId = null;
          room.finishedPlayers = {};
          room.players.forEach(p => p.ready = false);
          io.to(roomId).emit('opponent_left_lobby', {
            message: 'Tu rival abandonó la sala de espera.'
          });
          io.to(roomId).emit('room_ready_status', {
            p1Ready: false,
            p2Ready: false,
            p1Name: room.players[0]?.name || 'Host',
            p2Name: 'Esperando rival...',
            p1Color: room.players[0]?.color || '#00F0FF',
            p2Color: '#FF007F',
            bothReady: false
          });
        }
      }
    }
  });

  socket.on('player_state', (data) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('opponent_state', data);
    }
  });

  socket.on('game_event', (data) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('opponent_event', data);
    }
  });

  socket.on('level_start', (data) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('opponent_start', data);
    }
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
    if (socket.roomId) {
      const roomId = socket.roomId;
      socket.to(roomId).emit('opponent_disconnected');
      socket.to(roomId).emit('opponent_left_lobby', {
        message: 'Tu rival se desconectó.'
      });

      const room = rooms[roomId];
      if (room) {
        room.players = room.players.filter(p => p.id !== socket.id);
        if (room.players.length === 0) {
          delete rooms[roomId];
        } else {
          room.winnerId = null;
          room.finishedPlayers = {};
          room.players.forEach(p => p.ready = false);
          io.to(roomId).emit('room_ready_status', {
            p1Ready: false,
            p2Ready: false,
            p1Name: room.players[0]?.name || 'Host',
            p2Name: 'Esperando rival...',
            p1Color: room.players[0]?.color || '#00F0FF',
            p2Color: '#FF007F',
            bothReady: false
          });
        }
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n🎮 Runner Challenge Online corriendo en http://localhost:${PORT}\n`);
});
