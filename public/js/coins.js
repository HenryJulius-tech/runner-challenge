/**
 * coins.js — Sistema de Monedas del Prototipo
 * 
 * Código simple y directo para explicar al profesor:
 *  - Genera monedas coleccionables en el aire o sobre el suelo.
 *  - Soporta dos patrones geométricos sencillos:
 *     1. Línea horizontal (LINE).
 *     2. Arco de salto parabólico (ARC).
 *  - Al tocarse, se marca collected = true y suma +50 puntos.
 */

class CoinSystem {
  constructor(levelData, seed = 54321) {
    this.levelData        = levelData;
    this.coins            = [];
    this.popups           = [];
    this.lastSpawnWorldX  = 300;
    this.spawnInterval    = 280;
    this.seed             = seed;
    this._rngState        = seed;
  }

  _random() {
    let t = (this._rngState += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * [EXPLICACIÓN: Generación de Monedas]
   * Crea un grupo de monedas alineadas o en arco parabólico.
   */
  spawnPattern(patternType, startWorldX, groundY) {
    const numCoins = 4;
    const spacing  = 40;

    for (let i = 0; i < numCoins; i++) {
      let yOffset = -45; // Altura estándar del suelo

      if (patternType === 'ARC') {
        // [FÓRMULA PARABÓLICA]: Acompaña la curva del salto
        const mid = (numCoins - 1) / 2;
        const dist = i - mid;
        yOffset = -75 + (dist * dist) * 14;
      }

      this.coins.push({
        worldX: startWorldX + i * spacing,
        y: groundY + yOffset,
        radius: 10,
        collected: false
      });
    }
  }

  /**
   * [EXPLICACIÓN: Actualización de Monedas]
   * 1. Spawnea monedas adelante a medida que el jugador avanza.
   * 2. Efecto de atracción magnética si el jugador tiene el Imán activo.
   * 3. Actualiza los textos flotantes (+50).
   * 4. Descarta monedas que ya quedaron atrás.
   */
  update(maxPlayerWorldX, groundY, goalWorldX, activePlayer = null) {
    const spawnHorizon = maxPlayerWorldX + 900;

    if (this.lastSpawnWorldX < spawnHorizon && this.lastSpawnWorldX < goalWorldX - 200) {
      const type = this._random() > 0.5 ? 'ARC' : 'LINE';
      this.spawnPattern(type, this.lastSpawnWorldX, groundY);
      this.lastSpawnWorldX += this.spawnInterval + this._random() * 100;
    }

    // Efecto de Imán activo: atrae monedas en radio de 280px hacia el corredor
    if (activePlayer && activePlayer.magnetTimer > 0 && activePlayer.isAlive) {
      const px = activePlayer.worldX + activePlayer.w / 2;
      const py = activePlayer.y + (activePlayer.isDucking ? activePlayer.duckHeight : activePlayer.h) / 2;
      const magnetRadius = 280;

      for (const coin of this.coins) {
        if (coin.collected) continue;
        const dx = px - coin.worldX;
        const dy = py - coin.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < magnetRadius * magnetRadius) {
          const dist = Math.sqrt(distSq);
          if (dist > 2) {
            const pullSpeed = Math.min(18, 6 + (1 - dist / magnetRadius) * 16);
            coin.worldX += (dx / dist) * pullSpeed;
            coin.y      += (dy / dist) * pullSpeed;
          }
        }
      }
    }

    // Actualizar popups de puntuación
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y -= 1.2;
      pop.life--;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }

    // Filtrar monedas lejanas
    this.coins = this.coins.filter(c => !c.collected && c.worldX > maxPlayerWorldX - 400);
  }

  /**
   * [EXPLICACIÓN: Recolección de Moneda]
   * Marca la moneda como recogida y crea un indicador visual de puntos.
   */
  collectCoin(coin, camera) {
    coin.collected = true;
    this.popups.push({
      worldX: coin.worldX,
      y: coin.y - 10,
      text: '+50',
      life: 30
    });

    if (window.GlobalParticles) {
      window.GlobalParticles.spawnSparks(coin.worldX, coin.y, '#FFD700', 6, 0.8);
    }
  }

  /**
   * [EXPLICACIÓN: Dibujo en Canvas]
   * Dibuja las monedas como círculos dorados brillantes usando ctx.arc().
   */
  draw(ctx, camera) {
    // 1. Monedas activas
    for (const coin of this.coins) {
      if (coin.collected) continue;
      const screenX = camera ? camera.worldToScreenX(coin.worldX) : coin.worldX;
      if (screenX < -20 || screenX > ctx.canvas.width + 20) continue;

      ctx.save();
      // Moneda dorada exterior
      ctx.fillStyle = '#FFD700';
      ctx.strokeStyle = '#FFA500';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenX, coin.y, coin.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Brillo interior
      ctx.fillStyle = '#FFF275';
      ctx.beginPath();
      ctx.arc(screenX - 2, coin.y - 2, coin.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Textos flotantes (+50)
    for (const pop of this.popups) {
      const screenX = camera ? camera.worldToScreenX(pop.worldX) : pop.worldX;
      ctx.save();
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#FFD700';
      ctx.textAlign = 'center';
      ctx.fillText(pop.text, screenX, pop.y);
      ctx.restore();
    }
  }
}
