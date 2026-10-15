/**
 * powerups.js — Sistema de Power-Ups e Ítems Especiales
 * 
 * Gestiona la aparición, animación, recolección y efectos de los 4 potenciadores:
 *  1. 🛡️ ESCUDO (SHIELD): Absorbe 1 impacto sin perder vidas.
 *  2. 🧲 IMÁN (MAGNET): Atrae monedas automáticamente en un radio de 280px.
 *  3. ⚡ TURBO (TURBO): +55% velocidad, invencibilidad y destruye obstáculos al paso.
 *  4. 🦘 DOBLE SALTO (DOUBLE_JUMP): Permite saltar de nuevo en el aire con impulso acrobático.
 */

const PowerUpTypes = {
  SHIELD: {
    type: 'SHIELD',
    name: 'ESCUDO',
    icon: '🛡️',
    color: '#00F0FF',
    glowColor: 'rgba(0, 240, 255, 0.6)',
    durationSecs: 0 // Permanente hasta recibir golpe
  },
  MAGNET: {
    type: 'MAGNET',
    name: 'IMÁN',
    icon: '🧲',
    color: '#FFD700',
    glowColor: 'rgba(255, 215, 0, 0.6)',
    durationSecs: 8
  },
  TURBO: {
    type: 'TURBO',
    name: 'TURBO',
    icon: '⚡',
    color: '#FF3366',
    glowColor: 'rgba(255, 51, 102, 0.7)',
    durationSecs: 4.5
  },
  DOUBLE_JUMP: {
    type: 'DOUBLE_JUMP',
    name: 'DOBLE SALTO',
    icon: '🦘',
    color: '#00FF88',
    glowColor: 'rgba(0, 255, 136, 0.6)',
    durationSecs: 10
  }
};

class PowerUpSystem {
  constructor(levelData, seed = 8888) {
    this.levelData       = levelData;
    this.items           = [];
    this.lastSpawnWorldX = 550;
    this.spawnInterval   = 700;
    this.animTimer       = 0;
    this.seed            = seed;
    this._rngState       = seed;
  }

  _random() {
    let t = (this._rngState += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Spawnea un potenciador en la pista
   */
  spawnPowerUp(worldX, groundY, typeOverride = null) {
    const keys = Object.keys(PowerUpTypes);
    const chosenKey = typeOverride || keys[Math.floor(this._random() * keys.length)];
    const def = PowerUpTypes[chosenKey];

    // Flota a una altura accesible tanto en carrera como en salto bajo
    const baseY = groundY - 50;

    this.items.push({
      type: def.type,
      name: def.name,
      icon: def.icon,
      color: def.color,
      glowColor: def.glowColor,
      durationSecs: def.durationSecs,
      worldX,
      baseY,
      y: baseY,
      w: 32,
      h: 32,
      radius: 16,
      collected: false,
      rotOffset: this._random() * Math.PI * 2
    });
  }

  /**
   * Actualiza posiciones y spawn de power-ups
   */
  update(maxPlayerWorldX, groundY, goalWorldX) {
    this.animTimer += 0.05;

    // Generar nuevos power-ups hacia adelante
    const spawnHorizon = maxPlayerWorldX + 950;
    if (this.lastSpawnWorldX < spawnHorizon && this.lastSpawnWorldX < goalWorldX - 350) {
      this.spawnPowerUp(this.lastSpawnWorldX, groundY);
      this.lastSpawnWorldX += this.spawnInterval + this._random() * 250;
    }

    // Animación de levitación senoidal
    for (const item of this.items) {
      if (item.collected) continue;
      item.y = item.baseY + Math.sin(this.animTimer * 2 + item.rotOffset) * 7;
    }

    // Descartar ítems lejanos que quedaron atrás
    this.items = this.items.filter(it => !it.collected && it.worldX > maxPlayerWorldX - 300);
  }

  /**
   * Recolección de Power-Up por parte del jugador
   */
  collectPowerUp(item, player) {
    if (item.collected) return;
    item.collected = true;

    // Aplicar mejora al jugador
    player.applyPowerUp(item.type, item.durationSecs);

    // Efectos de partículas (Shockwave + Chispas + Texto Flotante)
    if (window.GlobalParticles) {
      window.GlobalParticles.spawnShockwave(item.worldX, item.y, item.color, 44);
      window.GlobalParticles.spawnSparks(item.worldX, item.y, item.color, 14, 1.3);
      window.GlobalParticles.spawnFloatingText(item.worldX, item.y - 18, `¡${item.name}!`, item.color, 15);
    }

    // Efectos de sonido específicos
    if (typeof AudioManager !== 'undefined') {
      if (item.type === 'SHIELD') {
        AudioManager.play('powerup');
      } else if (item.type === 'TURBO') {
        AudioManager.play('turbo');
      } else if (item.type === 'MAGNET') {
        AudioManager.play('magnet');
      } else if (item.type === 'DOUBLE_JUMP') {
        AudioManager.play('doubleJump');
      } else {
        AudioManager.play('powerup');
      }
    }
  }

  /**
   * Dibuja los power-ups con estilo cápsula cibernética de neón
   */
  draw(ctx, camera) {
    const W = ctx.canvas.width;

    for (const item of this.items) {
      if (item.collected) continue;

      const sx = camera ? camera.worldToScreenX(item.worldX) : item.worldX;
      if (sx < -40 || sx > W + 40) continue;

      ctx.save();

      // 1. Resplandor exterior pulsante
      const pulse = 1 + Math.sin(this.animTimer * 4 + item.rotOffset) * 0.15;
      ctx.shadowColor = item.color;
      ctx.shadowBlur = 14 * pulse;

      // 2. Anillo de energía exterior rotatorio
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(sx, item.y, item.radius * pulse, 0, Math.PI * 2);
      ctx.stroke();

      // 3. Fondo interior translúcido
      ctx.fillStyle = 'rgba(15, 18, 35, 0.85)';
      ctx.beginPath();
      ctx.arc(sx, item.y, item.radius - 2, 0, Math.PI * 2);
      ctx.fill();

      // 4. Diamante/Rombo interior
      ctx.save();
      ctx.translate(sx, item.y);
      ctx.rotate(this.animTimer * 1.5 + item.rotOffset);
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-item.radius * 0.5, -item.radius * 0.5, item.radius, item.radius);
      ctx.restore();

      // 5. Ícono central
      ctx.shadowBlur = 0;
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.icon, sx, item.y + 1);

      ctx.restore();
    }
  }
}

window.PowerUpTypes = PowerUpTypes;
window.PowerUpSystem = PowerUpSystem;
