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
    rooms[roomId] = {
      players: [socket.id],
      seed: Math.floor(Math.random() * 10000)
    };
    socket.join(roomId);
    socket.roomId = roomId;
    socket.playerIndex = 0; // P1
    callback({ success: true, roomId });
    console.log(`Sala creada: ${roomId} por ${socket.id}`);
  });

  socket.on('join_room', (roomId, callback) => {
    const room = rooms[roomId];
    if (room && room.players.length === 1) {
      room.players.push(socket.id);
      socket.join(roomId);
      socket.roomId = roomId;
      socket.playerIndex = 1; // P2
      
      callback({ success: true, roomId, seed: room.seed });
      
      // Notificar al creador que alguien se unió
      socket.to(roomId).emit('player_joined', { seed: room.seed });
      console.log(`${socket.id} se unió a la sala ${roomId}`);
    } else {
      callback({ success: false, message: 'Sala llena o no existe' });
    }
  });

  socket.on('player_state', (data) => {
    if (socket.roomId) {
      // Reenviar a los demás en la sala
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
      socket.to(socket.roomId).emit('opponent_disconnected');
      const room = rooms[socket.roomId];
      if (room) {
        room.players = room.players.filter(id => id !== socket.id);
        if (room.players.length === 0) {
          delete rooms[socket.roomId];
        }
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n🎮 Runner Challenge Online corriendo en http://localhost:${PORT}\n`);
});
