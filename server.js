/**
 * server.js — Servidor local con Socket.IO para Runner Challenge: Neon Run
 *
 * El servidor es la autoridad de la carrera online:
 *  - Mantiene el progreso oficial de cada jugador (identificado por un playerId estable).
 *  - Descarta paquetes viejos, duplicados o de otra carrera mediante raceId + seq.
 *  - Difunde snapshots comunes del estado de la carrera a ambos clientes.
 *  - Determina al ganador una sola vez y lo comunica a ambos jugadores.
 */

const express = require('express');
const http    = require('http');
const path    = require('path');
const crypto  = require('crypto');
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

// ── Configuración de red ──────────────────────────────────────────────────────
const RACE_TICK_MS           = 50;    // 20 snapshots por segundo
const FINISH_ARBITRATION_MS  = 500;   // Ventana para resolver llegadas casi simultáneas
const DISCONNECT_GRACE_MS    = Math.max(1000, parseInt(process.env.DISCONNECT_GRACE_MS, 10) || 30000); // Ventana de reconexión (configurable para pruebas/ops)
const MATCH_START_DELAY_MS   = 4000;  // 500 ms + cuenta regresiva de 3.5 s en el cliente
const MAX_WORLD_X            = 100000;

// Manejo de Salas
const rooms = {};
let raceCounter = 0;

// ── Utilidades ────────────────────────────────────────────────────────────────
function makeId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
}

function generateRoomCode() {
  let code;
  do {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
  } while (rooms[code]);
  return code;
}

function safeName(value, fallback) {
  if (value === undefined || value === null) return fallback;
  const clean = String(value).trim().slice(0, 16);
  return clean || fallback;
}

function safeColor(value, fallback) {
  if (value === undefined || value === null) return fallback;
  const clean = String(value).trim().slice(0, 32);
  return clean || fallback;
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getSocketPlayer(socket) {
  const room = rooms[socket.roomId];
  if (!room) return { room: null, player: null };
  const player = room.players.find(p => p.id === socket.id);
  return { room, player };
}

function getPlayerBySlot(room, slot) {
  return room.players.find(p => p.slot === slot) || null;
}

function getConnectedPlayers(room) {
  return room.players.filter(p => p.connected);
}

function getPlayerState(room, playerId) {
  return room.race?.players?.[playerId] || null;
}

function roomReadyPayload(room) {
  const p1 = getPlayerBySlot(room, 0) || { ready: false, name: 'Host', color: '#00F0FF' };
  const p2 = getPlayerBySlot(room, 1) || { ready: false, name: 'Rival', color: '#FF007F' };
  return {
    p1Ready: !!p1.ready,
    p2Ready: !!p2.ready,
    p1Name: p1.name || 'Host',
    p2Name: p2.name || 'Rival',
    p1Color: p1.color || '#00F0FF',
    p2Color: p2.color || '#FF007F',
    p1Connected: !!p1.connected,
    p2Connected: !!p2.connected,
    p1Wins: safeNumber(p1.wins),
    p1Losses: safeNumber(p1.losses),
    p2Wins: safeNumber(p2.wins),
    p2Losses: safeNumber(p2.losses),
    bothReady: room.players.length === 2 && !!p1.ready && !!p2.ready
  };
}

function emitReadyStatus(room) {
  io.to(room.id).emit('room_ready_status', roomReadyPayload(room));
}

// ── Estado de la carrera ──────────────────────────────────────────────────────
function createRace(room) {
  return {
    id: ++raceCounter,
    active: false,
    finalized: false,
    winnerId: null,
    winnerSlot: null,
    reason: null,
    goalWorldX: room.goalWorldX || 3200,
    tick: 0,
    serverTime: Date.now(),
    startServerTime: null,
    players: {},
    finished: {},
    finishTimer: null,
    abandonTimer: null,
    tickTimer: null
  };
}

function resetRacePlayers(room, race) {
  race.players = {};
  for (const player of room.players) {
    race.players[player.playerId] = {
      playerId: player.playerId,
      slot: player.slot,
      name: player.name,
      color: player.color,
      worldX: 0,
      y: 0,
      vy: 0,
      speed: 5,
      isDucking: false,
      hasFinished: false,
      isAlive: true,
      lives: 3,
      score: 0,
      coins: 0,
      turboTimer: 0,
      dashTimer: 0,
      shield: false,
      lastSeq: -1,
      finishTimeMs: null
    };
  }
}

function buildRaceSnapshot(room) {
  const race = room.race;
  return {
    raceId: race.id,
    tick: race.tick,
    serverTime: race.serverTime,
    goalWorldX: race.goalWorldX,
    active: race.active,
    finalized: race.finalized,
    winnerId: race.winnerId,
    winnerSlot: race.winnerSlot,
    reason: race.reason,
    players: room.players.map(player => {
      const s = getPlayerState(room, player.playerId) || {};
      const finish = race.finished[player.playerId];
      return {
        playerId: player.playerId,
        slot: player.slot,
        name: player.name,
        color: player.color,
        connected: !!player.connected,
        worldX: safeNumber(s.worldX),
        y: safeNumber(s.y),
        vy: safeNumber(s.vy),
        speed: safeNumber(s.speed, 5),
        isDucking: !!s.isDucking,
        hasFinished: !!s.hasFinished || !!finish,
        isAlive: s.isAlive !== false,
        lives: safeNumber(s.lives, 3),
        score: safeNumber(s.score),
        coins: safeNumber(s.coins),
        turboTimer: safeNumber(s.turboTimer),
        dashTimer: safeNumber(s.dashTimer),
        shield: !!s.shield,
        finishTimeMs: finish ? finish.elapsedMs : null,
        isWinner: race.winnerId === player.playerId
      };
    })
  };
}

function buildRaceFinishedPayload(room) {
  const race = room.race;
  if (!race) return null;
  const winner = race.winnerId ? room.players.find(p => p.playerId === race.winnerId) : null;

  const results = room.players.map(player => {
    const s = getPlayerState(room, player.playerId) || {};
    const finish = race.finished[player.playerId];
    return {
      playerId: player.playerId,
      slot: player.slot,
      name: player.name,
      color: player.color,
      connected: !!player.connected,
      isWinner: player.playerId === race.winnerId,
      finishTimeMs: finish ? finish.elapsedMs : null,
      time: finish ? Math.round(safeNumber(finish.elapsedMs) / 1000) : null,
      score: finish ? safeNumber(finish.score, safeNumber(s.score)) : safeNumber(s.score),
      coins: finish ? safeNumber(finish.coins, safeNumber(s.coins)) : safeNumber(s.coins),
      worldX: safeNumber(s.worldX),
      hasFinished: !!finish || !!s.hasFinished,
      isAlive: s.isAlive !== false
    };
  });

  return {
    raceId: race.id,
    winnerId: race.winnerId,
    winnerSlot: race.winnerSlot,
    winnerName: winner ? winner.name : null,
    winnerColor: winner ? winner.color : null,
    reason: race.reason,
    results
  };
}

function broadcastRaceState(room) {
  const race = room.race;
  if (!race) return;
  race.tick++;
  race.serverTime = Date.now();
  io.to(room.id).emit('race_state', buildRaceSnapshot(room));
}

function stopRaceTick(room) {
  if (room.race?.tickTimer) {
    clearInterval(room.race.tickTimer);
    room.race.tickTimer = null;
  }
}

function startRaceTick(room) {
  stopRaceTick(room);
  room.race.tickTimer = setInterval(() => {
    if (!room.race || !room.race.active) return;
    broadcastRaceState(room);
  }, RACE_TICK_MS);
}

function clearRaceTimers(race) {
  if (!race) return;
  if (race.finishTimer)  { clearTimeout(race.finishTimer);  race.finishTimer = null; }
  if (race.abandonTimer) { clearTimeout(race.abandonTimer); race.abandonTimer = null; }
}

function startRace(room) {
  stopRaceTick(room);
  clearRaceTimers(room.race);

  const race = createRace(room);
  race.active = true;
  race.goalWorldX = Math.max(100, Math.min(MAX_WORLD_X, safeNumber(room.goalWorldX, 3200)));
  race.startServerTime = Date.now() + MATCH_START_DELAY_MS;
  room.race = race;
  room.winnerId = null;
  room.finishedPlayers = {};
  resetRacePlayers(room, race);

  const p1 = getPlayerBySlot(room, 0) || {};
  const p2 = getPlayerBySlot(room, 1) || {};

  console.log(`Sala ${room.id}: inicia carrera #${race.id} (nivel ${room.level}, meta ${race.goalWorldX}px)`);
  io.to(room.id).emit('match_start_countdown', {
    raceId: race.id,
    goalWorldX: race.goalWorldX,
    startAt: race.startServerTime,
    serverTime: Date.now(),
    level: room.level,
    seed: room.seed,
    p1Name: p1.name || 'Host',
    p2Name: p2.name || 'Rival',
    p1Color: p1.color || '#00F0FF',
    p2Color: p2.color || '#FF007F'
  });

  startRaceTick(room);
}

function finalizeRace(room, reason, forcedWinnerId = null) {
  const race = room.race;
  if (!race || !race.active || race.finalized) return;
  race.finalized = true;
  race.active = false;
  clearRaceTimers(race);

  let winnerId = forcedWinnerId;
  if (!winnerId) {
    const candidates = Object.entries(race.finished)
      .sort((a, b) => {
        const ta = safeNumber(a[1].elapsedMs, Number.MAX_SAFE_INTEGER);
        const tb = safeNumber(b[1].elapsedMs, Number.MAX_SAFE_INTEGER);
        if (ta !== tb) return ta - tb;
        return safeNumber(a[1].receivedAt) - safeNumber(b[1].receivedAt);
      });
    if (candidates.length > 0) winnerId = candidates[0][0];
  }

  const winner = winnerId ? room.players.find(p => p.playerId === winnerId) : null;
  race.winnerId = winner ? winner.playerId : null;
  race.winnerSlot = winner ? winner.slot : null;
  race.reason = reason || null;
  room.winnerId = race.winnerId;

  // Marcar al ganador en el estado final (el servidor lo decide una única vez).
  for (const player of room.players) {
    const s = getPlayerState(room, player.playerId);
    if (s && player.playerId === race.winnerId) s.hasFinished = true;
  }

  // Marcador de la sala: se conserva entre carreras mientras la sala siga viva.
  if (winner) {
    for (const player of room.players) {
      if (player.playerId === race.winnerId) {
        player.wins = safeNumber(player.wins) + 1;
      } else {
        player.losses = safeNumber(player.losses) + 1;
      }
    }
  }

  // Último snapshot + evento final para ambos clientes.
  broadcastRaceState(room);
  stopRaceTick(room);

  io.to(room.id).emit('race_finished', buildRaceFinishedPayload(room));

  console.log(`[Meta] Sala ${room.id} | Carrera #${race.id} finalizada. Ganador: ${winner ? `${winner.name} (${winner.playerId})` : 'sin ganador'} | Motivo: ${race.reason}`);
}

function registerFinish(room, playerId, data = {}) {
  const race = room.race;
  if (!race || !race.active || race.finalized) return;

  const player = room.players.find(p => p.playerId === playerId);
  const s = getPlayerState(room, playerId);
  if (!player || !s) return;
  if (race.finished[playerId]) return;

  const reportedX = safeNumber(data.worldX, s.worldX);
  const crossed = reportedX >= race.goalWorldX - 1 || s.worldX >= race.goalWorldX - 1;
  // No se acepta una llegada si el progreso validado aún no alcanzó la meta.
  if (!crossed) return;

  s.worldX = race.goalWorldX;
  s.hasFinished = true;

  const fallbackElapsed = Math.max(0, Date.now() - safeNumber(race.startServerTime, Date.now()));
  let elapsedMs = safeNumber(data.elapsedMs, fallbackElapsed);
  if (elapsedMs < 0 || elapsedMs > 30 * 60 * 1000) elapsedMs = fallbackElapsed;

  const finish = {
    playerId,
    slot: player.slot,
    name: player.name,
    elapsedMs,
    receivedAt: Date.now(),
    score: safeNumber(data.score, safeNumber(s.score)),
    coins: safeNumber(data.coins, safeNumber(s.coins))
  };
  race.finished[playerId] = finish;
  s.score = Math.max(safeNumber(s.score), finish.score);
  s.coins = Math.max(safeNumber(s.coins), finish.coins);

  room.finishedPlayers[playerId] = {
    isWinner: false,
    time: Math.round(elapsedMs / 1000),
    score: finish.score,
    coins: finish.coins
  };

  io.to(room.id).emit('player_goal_reached', {
    raceId: race.id,
    playerId,
    slot: player.slot,
    isHost: player.slot === 0,
    name: player.name,
    time: Math.round(elapsedMs / 1000),
    elapsedMs,
    score: finish.score,
    coins: finish.coins
  });

  const finishCount = Object.keys(race.finished).length;
  if (finishCount >= 2) {
    if (race.finishTimer) { clearTimeout(race.finishTimer); race.finishTimer = null; }
    // Pequeña ventana final para absorber paquetes casi simultáneos.
    race.finishTimer = setTimeout(() => finalizeRace(room, 'both_finished'), 80);
  } else if (!race.finishTimer) {
    // Esperar un instante por si el rival cruza casi al mismo tiempo.
    race.finishTimer = setTimeout(() => finalizeRace(room, 'finish'), FINISH_ARBITRATION_MS);
  }
}

function checkNoContest(room) {
  const race = room.race;
  if (!race || !race.active || race.finalized) return;
  if (room.players.length < 2) return;

  const everyoneDead = room.players.every(player => {
    const s = getPlayerState(room, player.playerId);
    return s && s.isAlive === false && !race.finished[player.playerId];
  });

  if (everyoneDead && !race.finishTimer) {
    race.finishTimer = setTimeout(() => finalizeRace(room, 'no_contest'), 300);
  }
}

function applyPlayerState(room, player, data) {
  const race = room.race;
  if (!race || !race.active || race.finalized) return;

  // Rechazar paquetes de otra carrera (partida anterior o nivel anterior).
  if (safeNumber(data?.raceId, -1) !== race.id) return;

  const s = getPlayerState(room, player.playerId);
  if (!s) return;

  // Orden de actualizaciones: la secuencia debe crecer; los duplicados/viejos se ignoran.
  const seq = safeNumber(data?.seq, -1);
  if (seq >= 0) {
    if (seq <= s.lastSeq) return;
    s.lastSeq = seq;
  }

  const incomingX = safeNumber(data?.worldX, s.worldX);
  // El progreso oficial es monótono: nunca retrocede por un paquete atrasado.
  s.worldX = Math.max(0, Math.min(race.goalWorldX, Math.max(safeNumber(s.worldX), incomingX)));
  s.y = safeNumber(data?.y, safeNumber(s.y));
  s.vy = safeNumber(data?.vy, safeNumber(s.vy));
  s.speed = Math.max(0, Math.min(30, safeNumber(data?.speed, safeNumber(s.speed, 5))));
  s.isDucking = !!data?.isDucking;
  s.turboTimer = Math.max(0, safeNumber(data?.turboTimer));
  s.dashTimer = Math.max(0, safeNumber(data?.dashTimer));
  s.shield = !!data?.shield;

  // Puntuación y monedas sólo crecen (evita que un paquete viejo los reduzca).
  s.score = Math.max(safeNumber(s.score), safeNumber(data?.score));
  s.coins = Math.max(safeNumber(s.coins), safeNumber(data?.coins));

  const incomingLives = safeNumber(data?.lives, s.lives);
  s.lives = Math.min(safeNumber(s.lives, 3), incomingLives);
  s.isAlive = s.isAlive !== false && data?.isAlive !== false;
  if (s.isAlive === false) s.lives = 0;
  if (data?.hasFinished) s.hasFinished = true;

  if (s.hasFinished || s.worldX >= race.goalWorldX - 1) {
    registerFinish(room, player.playerId, {
      worldX: Math.max(incomingX, s.worldX),
      elapsedMs: data?.elapsedMs,
      score: s.score,
      coins: s.coins
    });
  }

  checkNoContest(room);
}

function markPlayerDisconnected(room, player) {
  player.connected = false;
  const race = room.race;

  if (race && race.active && !race.finalized) {
    const remaining = room.players.find(p => p.playerId !== player.playerId && p.connected);
    if (remaining) {
      // El rival tiene una ventana para reconectarse antes de ganar por abandono.
      if (race.abandonTimer) clearTimeout(race.abandonTimer);
      race.abandonTimer = setTimeout(() => {
        const stillInside = room.players.find(p => p.playerId === player.playerId);
        const connectedRemaining = room.players.find(p => p.playerId !== player.playerId && p.connected);
        if (stillInside && !stillInside.connected && connectedRemaining) {
          finalizeRace(room, 'abandon', connectedRemaining.playerId);
        }
      }, DISCONNECT_GRACE_MS);
    }
  }

  // Mantener el slot reservado durante la ventana de reconexión.
  if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
  player.disconnectTimer = setTimeout(() => {
    const currentRoom = rooms[room.id];
    if (!currentRoom) return;
    const current = currentRoom.players.find(p => p.playerId === player.playerId);
    if (!current || current.connected) return;

    // Si la carrera sigue activa, el jugador que sí permaneció conectado gana por abandono.
    const stillConnected = currentRoom.players.find(p => p.playerId !== player.playerId && p.connected);
    if (stillConnected && currentRoom.race && currentRoom.race.active && !currentRoom.race.finalized) {
      finalizeRace(currentRoom, 'abandon', stillConnected.playerId);
    }

    // Expiró la ventana de reconexión: liberar el slot.
    currentRoom.players = currentRoom.players.filter(p => p.playerId !== player.playerId);
    if (currentRoom.players.length === 0) {
      stopRaceTick(currentRoom);
      clearRaceTimers(currentRoom.race);
      delete rooms[currentRoom.id];
      return;
    }

    currentRoom.players.forEach(p => { p.ready = false; });
    io.to(currentRoom.id).emit('opponent_left_lobby', {
      message: 'Tu rival se desconectó y no volvió a conectarse.'
    });
    emitReadyStatus(currentRoom);
  }, DISCONNECT_GRACE_MS);
}

// ── Conexión de clientes ──────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado:', socket.id);

  socket.on('create_room', (data, callback) => {
    const roomId = generateRoomCode();
    const playerName = safeName(data && data.name, 'Host (P1)');
    const playerColor = safeColor(data && data.color, '#00F0FF');
    const level = parseInt(data && data.level, 10) || 1;
    const token = makeId();
    const playerId = makeId();

    rooms[roomId] = {
      id: roomId,
      players: [{
        id: socket.id,
        playerId,
        token,
        slot: 0,
        name: playerName,
        color: playerColor,
        ready: false,
        connected: true,
        wins: 0,
        losses: 0,
        disconnectTimer: null
      }],
      seed: Math.floor(Math.random() * 10000),
      level: level,
      goalWorldX: safeNumber(data && data.goalWorldX, 3200),
      winnerId: null,
      finishedPlayers: {},
      race: createRace({ goalWorldX: safeNumber(data && data.goalWorldX, 3200) })
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
        hostColor: playerColor,
        playerId,
        token,
        slot: 0
      });
    }
    console.log(`Sala creada: ${roomId} por ${socket.id} (${playerName}, ${playerColor})`);
  });

  socket.on('join_room', (data, callback) => {
    const roomId = typeof data === 'string' ? data.trim().toUpperCase() : (data && data.roomId ? String(data.roomId).trim().toUpperCase() : '');
    const playerName = safeName(data && data.name, 'Rival (P2)');
    const playerColor = safeColor(data && data.color, '#FF007F');
    const token = data && data.token ? String(data.token) : null;

    const room = rooms[roomId];
    if (!room) {
      if (typeof callback === 'function') callback({ success: false, message: 'Sala llena o código inexistente' });
      return;
    }

    // ── Reconexión con token estable ─────────────────────────────────────
    if (token) {
      const existing = room.players.find(p => p.token === token);
      if (existing) {
        if (existing.disconnectTimer) {
          clearTimeout(existing.disconnectTimer);
          existing.disconnectTimer = null;
        }
        if (room.race?.abandonTimer) {
          clearTimeout(room.race.abandonTimer);
          room.race.abandonTimer = null;
        }

        existing.id = socket.id;
        existing.connected = true;
        if (data && data.name) existing.name = safeName(data.name, existing.name);
        if (data && data.color) existing.color = safeColor(data.color, existing.color);

        socket.join(roomId);
        socket.roomId = roomId;
        socket.playerIndex = existing.slot;

        const p1 = getPlayerBySlot(room, 0) || { name: 'Host', color: '#00F0FF' };
        const p2 = getPlayerBySlot(room, 1) || { name: 'Rival', color: '#FF007F' };

        if (typeof callback === 'function') {
          callback({
            success: true,
            reconnected: true,
            roomId,
            seed: room.seed,
            level: room.level,
            hostName: p1.name,
            hostColor: p1.color || '#00F0FF',
            guestName: p2.name,
            guestColor: p2.color || '#FF007F',
            playerId: existing.playerId,
            token: existing.token,
            slot: existing.slot,
            opponentConnected: getConnectedPlayers(room).length > 1,
            raceActive: !!(room.race && room.race.active),
            raceId: room.race?.id || null,
            goalWorldX: room.goalWorldX || 3200
          });
        }

        socket.to(roomId).emit('opponent_reconnected', {
          playerId: existing.playerId,
          slot: existing.slot,
          isHost: existing.slot === 0,
          name: existing.name,
          color: existing.color,
          opponentConnected: true
        });
        emitReadyStatus(room);

        if (room.race && room.race.active) {
          io.to(roomId).emit('match_resumed', {
            raceId: room.race.id,
            goalWorldX: room.race.goalWorldX,
            level: room.level,
            seed: room.seed
          });
          socket.emit('race_state', buildRaceSnapshot(room));
        } else if (room.race && room.race.finalized) {
          socket.emit('race_state', buildRaceSnapshot(room));
          socket.emit('race_finished', buildRaceFinishedPayload(room));
        }

        console.log(`${socket.id} (${existing.name}) se reconectó a la sala ${roomId} (slot ${existing.slot})`);
        return;
      }
    }

    // ── Nuevo jugador ─────────────────────────────────────────────────────
    if (room.players.length < 2) {
      const playerId = makeId();
      const newToken = makeId();
      const slot = room.players.some(p => p.slot === 1) ? 0 : 1;
      room.players.push({
        id: socket.id,
        playerId,
        token: newToken,
        slot,
        name: playerName,
        color: playerColor,
        ready: false,
        connected: true,
        wins: 0,
        losses: 0,
        disconnectTimer: null
      });
      socket.join(roomId);
      socket.roomId = roomId;
      socket.playerIndex = slot;

      const hostPlayer = getPlayerBySlot(room, 0) || room.players[0];

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
          playerId,
          token: newToken,
          slot,
          p1Ready: !!hostPlayer.ready,
          p2Ready: false
        });
      }

      // Notificar al Host que se unió el Rival con nombre, color y estado
      socket.to(roomId).emit('player_joined', {
        seed: room.seed,
        level: room.level,
        opponentName: playerName,
        opponentColor: playerColor,
        playerId,
        slot,
        p1Ready: !!hostPlayer.ready,
        p2Ready: false
      });
      emitReadyStatus(room);
      console.log(`${socket.id} (${playerName}, ${playerColor}) se unió a la sala ${roomId}`);
    } else {
      if (typeof callback === 'function') {
        callback({ success: false, message: 'Sala llena o código inexistente' });
      }
    }
  });

  // Actualizar perfil (nombre y color de corredor) en tiempo real
  socket.on('update_profile', (data) => {
    const { room, player } = getSocketPlayer(socket);
    if (!room || !player) return;

    if (data && data.name) player.name = safeName(data.name, player.name);
    if (data && data.color) player.color = safeColor(data.color, player.color);
    const state = getPlayerState(room, player.playerId);
    if (state) {
      state.name = player.name;
      state.color = player.color;
    }

    io.to(room.id).emit('player_profile_updated', {
      playerId: player.playerId,
      slot: player.slot,
      isHost: player.slot === 0,
      name: player.name,
      color: player.color
    });
  });

  // Alternar estado LISTO (Ready) de cada jugador
  socket.on('player_ready', (data) => {
    const { room, player } = getSocketPlayer(socket);
    if (!room || !player) return;

    player.ready = !!(data && data.ready);
    if (data && data.name)  player.name  = safeName(data.name, player.name);
    if (data && data.color) player.color = safeColor(data.color, player.color);

    if (data && Number.isFinite(Number(data.goalWorldX))) {
      room.goalWorldX = Math.max(100, Math.min(MAX_WORLD_X, Number(data.goalWorldX)));
    }

    emitReadyStatus(room);

    const p1 = getPlayerBySlot(room, 0) || { ready: false, name: 'Host', color: '#00F0FF' };
    const p2 = getPlayerBySlot(room, 1) || { ready: false, name: 'Rival', color: '#FF007F' };
    const bothReady = room.players.length === 2 && !!p1.ready && !!p2.ready;

    if (bothReady && !(room.race && room.race.active)) {
      startRace(room);
    }
  });

  // Árbitro central de llegada a la meta (compatibilidad con clientes anteriores).
  socket.on('player_finished', (data) => {
    const { room, player } = getSocketPlayer(socket);
    if (!room || !player) return;
    registerFinish(room, player.playerId, data || {});
  });

  // Cambio de nivel por el Host
  socket.on('select_level', (data) => {
    const { room, player } = getSocketPlayer(socket);
    if (!room || !player || player.slot !== 0) return;

    stopRaceTick(room);
    clearRaceTimers(room.race);
    room.level = parseInt(data.level, 10) || 1;
    if (data && Number.isFinite(Number(data.goalWorldX))) {
      room.goalWorldX = Math.max(100, Math.min(MAX_WORLD_X, Number(data.goalWorldX)));
    }
    room.winnerId = null;
    room.finishedPlayers = {};
    // Resetear estados listos para que ambos reconfirmen con el nuevo nivel
    room.players.forEach(p => p.ready = false);
    room.race = createRace(room);
    room.race.goalWorldX = room.goalWorldX;

    io.to(room.id).emit('level_updated', {
      level: room.level,
      goalWorldX: room.goalWorldX,
      p1Ready: false,
      p2Ready: false
    });
  });

  // Regreso conjunto a la Sala de Espera (para Siguiente Nivel o Revancha/Reiniciar)
  socket.on('return_to_lobby', (data) => {
    const { room } = getSocketPlayer(socket);
    if (!room) return;

    stopRaceTick(room);
    clearRaceTimers(room.race);

    if (data && data.level) {
      room.level = parseInt(data.level, 10);
    } else if (data && data.nextLevel) {
      room.level = Math.min((room.level || 1) + 1, 20);
    }
    if (data && Number.isFinite(Number(data.goalWorldX))) {
      room.goalWorldX = Math.max(100, Math.min(MAX_WORLD_X, Number(data.goalWorldX)));
    }
    room.seed = Math.floor(Math.random() * 10000);
    room.winnerId = null;
    room.finishedPlayers = {};
    room.players.forEach(p => p.ready = false);
    room.race = createRace(room);
    room.race.goalWorldX = room.goalWorldX;

    const p1 = getPlayerBySlot(room, 0) || { ready: false, name: 'Host', color: '#00F0FF' };
    const p2 = getPlayerBySlot(room, 1) || { ready: false, name: 'Rival', color: '#FF007F' };

    console.log(`Sala ${room.id} regresando al lobby. Nivel objetivo: ${room.level}, Motivo: ${data?.reason || 'siguiente'}`);

    io.to(room.id).emit('room_returned_to_lobby', {
      level: room.level,
      seed: room.seed,
      goalWorldX: room.goalWorldX,
      p1Name: p1.name,
      p2Name: p2.name,
      p1Color: p1.color || '#00F0FF',
      p2Color: p2.color || '#FF007F',
      reason: data?.reason || 'next_level'
    });
    emitReadyStatus(room);
  });

  socket.on('leave_room', () => {
    const roomId = socket.roomId;
    const room = rooms[roomId];
    const player = room ? room.players.find(p => p.id === socket.id) : null;
    if (!room || !player) return;

    socket.leave(roomId);
    socket.roomId = null;

    if (room.race && room.race.active && !room.race.finalized) {
      const remaining = room.players.find(p => p.playerId !== player.playerId && p.connected);
      if (remaining) {
        finalizeRace(room, 'abandon', remaining.playerId);
      }
    }

    if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    room.players = room.players.filter(p => p.playerId !== player.playerId);
    if (room.players.length === 0) {
      stopRaceTick(room);
      clearRaceTimers(room.race);
      delete rooms[roomId];
    } else {
      room.winnerId = null;
      room.finishedPlayers = {};
      room.players.forEach(p => p.ready = false);
      io.to(roomId).emit('opponent_left_lobby', {
        message: 'Tu rival abandonó la sala de espera.'
      });
      emitReadyStatus(room);
    }
  });

  // Estado de un jugador: el servidor lo valida y lo incorpora al estado oficial.
  socket.on('player_state', (data) => {
    const { room, player } = getSocketPlayer(socket);
    if (!room || !player || !player.connected) return;
    applyPlayerState(room, player, data);
  });

  socket.on('game_event', (data) => {
    const { room } = getSocketPlayer(socket);
    if (!room) return;
    socket.to(room.id).emit('opponent_event', data);
  });

  socket.on('level_start', (data) => {
    const { room } = getSocketPlayer(socket);
    if (!room) return;
    socket.to(room.id).emit('opponent_start', data);
  });

  // Sincronización de reloj para compensar latencia en la representación visual.
  socket.on('time_sync', (data, callback) => {
    if (typeof callback === 'function') {
      callback({
        clientTime: safeNumber(data && data.clientTime, Date.now()),
        serverTime: Date.now()
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
    const roomId = socket.roomId;
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    const other = room.players.find(p => p.playerId !== player.playerId && p.connected);
    socket.to(roomId).emit('opponent_disconnected', {
      playerId: player.playerId,
      slot: player.slot,
      name: player.name,
      reconnectWindowMs: DISCONNECT_GRACE_MS
    });
    if (other) {
      socket.to(roomId).emit('opponent_left_lobby', {
        message: 'Tu rival se desconectó. Esperando reconexión...'
      });
    }

    markPlayerDisconnected(room, player);
    emitReadyStatus(room);
  });
});

server.listen(PORT, () => {
  console.log(`\n🎮 Runner Challenge Online corriendo en http://localhost:${PORT}\n`);
});
