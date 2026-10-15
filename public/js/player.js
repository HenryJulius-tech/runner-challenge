/**
 * player.js — Prototipo del Jugador con Efectos y Power-Ups
 * 
 * Físicas 2D, Acciones y "Game Juice":
 *  - Salto y Doble Salto acrobático en el aire
 *  - Agacharse en el suelo y Caída Rápida en Picada (Fast-Fall / Slam)
 *  - Estela Neón (Ghost Trail) de velocidad
 *  - Power-Ups activos:
 *     1. 🛡️ Escudo cibernético (absorbe 1 impacto sin perder vidas)
 *     2. 🧲 Imán (atrae monedas cercanas)
 *     3. ⚡ Turbo / Hiper-Dash (acelera +55%, invencible y destruye obstáculos)
 *     4. 🦘 Doble Salto (salto acrobático en pleno aire)
 */

class Player {
  constructor({ worldX = 0, groundY = 320, color = '#00F0FF', name = 'Player', levelData, playerIndex = 0 }) {
    this.playerIndex = playerIndex;
    this.isP1        = playerIndex === 0;
    this.name        = name;
    this.color       = color;
    this.groundY     = groundY;

    // Dimensiones básicas del personaje
    this.w          = 36;
    this.h          = 52;
    this.duckHeight = 28; // Altura reducida al agacharse

    // Coordenadas y físicas
    this.worldX       = worldX;
    this.y            = groundY - this.h;
    this.vy           = 0;
    this.gravity      = levelData?.gravity ?? 0.75;
    this.jumpForce    = levelData?.jumpForce ?? -14;
    this.currentSpeed = levelData?.scrollSpeed ?? 5;

    // Estados de movimiento
    this.onGround      = true;
    this.isJumping     = false;
    this.isDucking     = false;
    this.isFastFalling = false;

    // Vidas y partida
    this.lives       = 3;
    this.isAlive     = true;
    this.hasFinished = false;
    this.finishTime  = 0;
    this.isWinner    = false;

    // Invulnerabilidad tras golpe
    this.invulnerable = false;
    this.invulnTimer  = 0;

    // Animación de correr
    this.animTimer = 0;

    // ── Power-Ups y Mejoras ──
    this.shield          = false; // 🛡️ Escudo protector
    this.magnetTimer     = 0;     // 🧲 Imán de monedas (frames)
    this.turboTimer      = 0;     // ⚡ Hiper-Velocidad (frames)
    this.doubleJumpTimer = 0;     // 🦘 Habilidad de doble salto (frames)
    this.canDoubleJump   = false; // Bandera de recarga de doble salto

    // ── Estela Neón / Ghost Trail ──
    this.trail = [];
    this.trailCounter = 0;
  }

  /**
   * Reinicia al jugador para una nueva partida
   */
  reset(groundY, levelData) {
    this.groundY      = groundY;
    this.gravity      = levelData?.gravity ?? 0.75;
    this.jumpForce    = levelData?.jumpForce ?? -14;
    this.currentSpeed = levelData?.scrollSpeed ?? 5;
    this.y            = groundY - this.h;
    this.vy           = 0;
    this.onGround     = true;
    this.isJumping    = false;
    this.isDucking    = false;
    this.isFastFalling= false;
    this.lives        = 3;
    this.isAlive      = true;
    this.hasFinished  = false;
    this.isWinner     = false;
    this.invulnerable = false;
    this.invulnTimer  = 0;

    // Resetear power-ups
    this.shield          = false;
    this.magnetTimer     = 0;
    this.turboTimer      = 0;
    this.doubleJumpTimer = 0;
    this.canDoubleJump   = false;
    this.trail           = [];
  }

  /**
   * Aplica un Power-Up recogido
   */
  applyPowerUp(type, durationSecs) {
    const frames = Math.round((durationSecs || 0) * 60);

    if (type === 'SHIELD') {
      this.shield = true;
    } else if (type === 'MAGNET') {
      this.magnetTimer = frames;
    } else if (type === 'TURBO') {
      this.turboTimer = frames;
    } else if (type === 'DOUBLE_JUMP') {
      this.doubleJumpTimer = frames;
      this.canDoubleJump = true;
    }
  }

  /**
   * [EXPLICACIÓN: Salto y Doble Salto Acrobático]
   * - Si está en el suelo: salto estándar hacia arriba.
   * - Si está en el aire y tiene el buff de Doble Salto activo: realiza un segundo salto con onda de energía.
   */
  jump() {
    if (!this.isAlive || this.hasFinished) return;

    if (this.onGround && !this.isDucking) {
      // Salto normal desde el suelo
      this.vy = this.jumpForce;
      this.onGround = false;
      this.isJumping = true;
      this.canDoubleJump = true; // Recargar potencial de doble salto

      if (typeof AudioManager !== 'undefined') AudioManager.play('jump');

      if (window.GlobalParticles) {
        window.GlobalParticles.spawnDust(this.worldX + this.w / 2, this.groundY, this.color, 4);
      }
    } else if (!this.onGround && this.doubleJumpTimer > 0 && this.canDoubleJump) {
      // ¡DOBLE SALTO EN EL AIRE!
      this.vy = this.jumpForce * 0.92;
      this.canDoubleJump = false;
      this.isFastFalling = false;

      if (typeof AudioManager !== 'undefined') AudioManager.play('doubleJump');

      if (window.GlobalParticles) {
        window.GlobalParticles.spawnShockwave(this.worldX + this.w / 2, this.y + this.h, '#00FF88', 34);
        window.GlobalParticles.spawnSparks(this.worldX + this.w / 2, this.y + this.h, '#00FF88', 10, 1.2);
        window.GlobalParticles.spawnFloatingText(this.worldX + this.w / 2, this.y - 12, '¡DOBLE SALTO!', '#00FF88', 13);
      }
    }
  }

  /**
   * [EXPLICACIÓN: Agacharse y Caída Rápida en el Aire (Fast-Fall / Slam)]
   * - En el suelo: reduce la altura del personaje a duckHeight para esquivar obstáculos altos.
   * - En el aire: lanza al personaje inmediatamente en picada hacia el suelo
   *   para aterrizar rápido y esquivar obstáculos flotantes.
   */
  setDucking(ducking) {
    if (!this.isAlive) return;
    this.isDucking = ducking;

    // Si se presiona agacharse en el aire, impulso descendente instantáneo
    if (ducking && !this.onGround) {
      if (this.vy < 15) {
        this.vy = 16;
        if (!this.isFastFalling && typeof AudioManager !== 'undefined') {
          AudioManager.play('whoosh');
        }
      }
      this.isFastFalling = true;
    } else if (!ducking) {
      this.isFastFalling = false;
    }
  }

  /**
   * Impulso rápido opcional (Dash)
   */
  dash() {
    if (!this.isAlive || this.hasFinished) return;
    this.worldX += 25;
    if (window.GlobalParticles) {
      window.GlobalParticles.spawnSparks(this.worldX, this.y + this.h / 2, this.color, 6, 1.5);
    }
  }

  /**
   * [EXPLICACIÓN: Daño, Escudo y Pérdida de Vidas]
   * - Si el Escudo está activo: lo consume, genera una onda expansiva y NO pierde vidas.
   * - Si el Turbo está activo: es invulnerable y no recibe daño.
   * - Sin escudo: pierde 1 vida, salta hacia atrás e inicia invulnerabilidad temporal.
   */
  takeDamage() {
    if (!this.isAlive || this.hasFinished) return false;

    // 1. Inmunidad durante Turbo
    if (this.turboTimer > 0) return false;

    // 2. Absorción por Escudo Cibernético
    if (this.shield) {
      this.shield = false;
      this.invulnerable = true;
      this.invulnTimer = 35; // Ventana de perdón
      this.vy = -3;

      if (typeof AudioManager !== 'undefined') AudioManager.play('shieldBreak');

      if (window.GlobalParticles) {
        window.GlobalParticles.spawnShockwave(this.worldX + this.w / 2, this.y + this.h / 2, '#00F0FF', 55);
        window.GlobalParticles.spawnSparks(this.worldX + this.w / 2, this.y + this.h / 2, '#00F0FF', 14, 1.5);
        window.GlobalParticles.spawnFloatingText(this.worldX + this.w / 2, this.y - 18, '¡ESCUDO ROTO!', '#00F0FF', 14);
      }
      return false; // ¡Salvado por el escudo!
    }

    if (this.invulnerable) return false;

    // 3. Daño normal
    this.lives--;
    this.invulnerable = true;
    this.invulnTimer = 60;
    this.vy = -4;

    if (typeof AudioManager !== 'undefined') AudioManager.play('hit');

    if (window.GlobalParticles) {
      window.GlobalParticles.spawnSparks(this.worldX + this.w / 2, this.y + this.h / 2, '#FF0055', 12, 1.2);
    }

    if (this.lives <= 0) {
      this.isAlive = false;
      this.lives = 0;
      return true; // Murió
    }
    return false;
  }

  /**
   * [EXPLICACIÓN: Actualización por Frame]
   * 1. Manejo de temporizadores de Power-Ups.
   * 2. Velocidad horizontal (acelerada con Turbo).
   * 3. Físicas de caída/salto y detección de suelo.
   * 4. Registro de estela luminosa (Ghost Trail).
   */
  update(scrollSpeed) {
    if (this.hasFinished) {
      this.worldX += this.currentSpeed * 0.8;
      return;
    }
    if (!this.isAlive) return;

    // 1. Temporizadores de Power-Ups
    if (this.magnetTimer > 0)     this.magnetTimer--;
    if (this.turboTimer > 0)      this.turboTimer--;
    if (this.doubleJumpTimer > 0) this.doubleJumpTimer--;

    // 2. Velocidad con Turbo (+55% boost)
    const isTurbo = this.turboTimer > 0;
    this.currentSpeed = isTurbo ? scrollSpeed * 1.55 : scrollSpeed;
    this.worldX += this.currentSpeed;

    // 3. Físicas de caída / salto
    const effectiveGravity = (this.isDucking && !this.onGround) ? this.gravity * 2.2 : this.gravity;
    this.vy += effectiveGravity;
    this.y += this.vy;

    const currentH = this.isDucking ? this.duckHeight : this.h;
    const targetGroundY = this.groundY - currentH;

    // 4. Detener caída al tocar el suelo
    if (this.y >= targetGroundY) {
      this.y = targetGroundY;
      this.vy = 0;
      this.onGround = true;
      this.isJumping = false;
      this.canDoubleJump = true; // Recarga doble salto al pisar suelo

      if (this.isFastFalling) {
        this.isFastFalling = false;
        if (window.GlobalParticles) {
          window.GlobalParticles.spawnShockwave(this.worldX + this.w / 2, this.groundY, this.color, 36);
          window.GlobalParticles.spawnDust(this.worldX + this.w / 2, this.groundY, this.color, 8);
        }
      }
    } else {
      this.onGround = false;
    }

    // 5. Temporizador de invulnerabilidad
    if (this.invulnerable) {
      this.invulnTimer--;
      if (this.invulnTimer <= 0) this.invulnerable = false;
    }

    // Animación de correr
    if (this.onGround) this.animTimer += 0.22;

    // 6. Registro de Estela Neón (Ghost Trail)
    this.trailCounter++;
    const shouldAddTrail = isTurbo || this.isFastFalling || (!this.onGround && this.trailCounter % 2 === 0) || (this.trailCounter % 3 === 0);

    if (shouldAddTrail) {
      let trailColor = this.color;
      if (isTurbo) {
        const rainbow = ['#FF0055', '#FF7700', '#00F0FF', '#00FF88', '#FFFF00'];
        trailColor = rainbow[Math.floor(Math.random() * rainbow.length)];
      }

      this.trail.push({
        worldX: this.worldX,
        y: this.y,
        h: currentH,
        color: trailColor,
        alpha: isTurbo ? 0.8 : 0.45,
        isTurbo
      });
    }

    // Actualizar y desvanecer estelas
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const t = this.trail[i];
      t.alpha -= t.isTurbo ? 0.07 : 0.05;
      if (t.alpha <= 0) this.trail.splice(i, 1);
    }
  }

  /**
   * [EXPLICACIÓN: Dibujo en Canvas con Estela Neón y Efectos Visuales]
   */
  draw(ctx, camera, overrideGroundY = null) {
    if (!this.isAlive && this.lives <= 0) return;

    // Parpadeo cuando está invulnerable (excepto si tiene escudo)
    if (this.invulnerable && !this.shield && Math.floor(this.invulnTimer / 6) % 2 === 0) return;

    const screenX = camera ? camera.worldToScreenX(this.worldX) : this.worldX;
    if (screenX < -90 || screenX > ctx.canvas.width + 90) return;

    const gY = overrideGroundY !== null ? overrideGroundY : this.groundY;
    const currentH = this.isDucking ? this.duckHeight : this.h;
    const drawY = overrideGroundY !== null ? (gY + (this.y - this.groundY)) : this.y;
    const isTurbo = this.turboTimer > 0;

    ctx.save();

    // ══════════════════════════════════════════════════════════════
    // 1. ESTELA NEÓN (GHOST TRAIL)
    // ══════════════════════════════════════════════════════════════
    for (const t of this.trail) {
      const tsx = camera ? camera.worldToScreenX(t.worldX) : t.worldX;
      if (tsx < -60 || tsx > ctx.canvas.width + 60) continue;

      ctx.save();
      ctx.globalAlpha = Math.max(0, t.alpha);
      ctx.fillStyle = t.color;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = t.isTurbo ? 10 : 4;
      ctx.beginPath();
      ctx.roundRect(tsx, t.y, this.w, t.h, 6);
      ctx.fill();
      ctx.restore();
    }

    // ══════════════════════════════════════════════════════════════
    // 2. SOMBRA EN EL PISO
    // ══════════════════════════════════════════════════════════════
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(screenX + this.w / 2, gY, this.w * 0.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // ══════════════════════════════════════════════════════════════
    // 3. EFECTOS ESPECIALES DE CAÍDA RÁPIDA (VIENTO VERTICAL)
    // ══════════════════════════════════════════════════════════════
    if (this.isFastFalling) {
      ctx.save();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(screenX + 6, drawY - 14);
      ctx.lineTo(screenX + 6, drawY);
      ctx.moveTo(screenX + this.w - 6, drawY - 14);
      ctx.lineTo(screenX + this.w - 6, drawY);
      ctx.stroke();
      ctx.restore();
    }

    // ══════════════════════════════════════════════════════════════
    // 4. CUERPO DEL CORREDOR
    // ══════════════════════════════════════════════════════════════
    ctx.fillStyle = '#1A1C2E';
    ctx.strokeStyle = isTurbo ? '#FF3366' : this.color;
    ctx.lineWidth = isTurbo ? 3.5 : 2.5;

    ctx.beginPath();
    ctx.roundRect(screenX, drawY, this.w, currentH, 6);
    ctx.fill();
    ctx.stroke();

    // Visor de neón
    ctx.fillStyle = isTurbo ? '#FFD700' : this.color;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = isTurbo ? 14 : 8;
    const visorY = drawY + 8;
    ctx.fillRect(screenX + 8, visorY, this.w - 12, this.isDucking ? 6 : 9);
    ctx.shadowBlur = 0;

    // Propulsor de Turbo trasero
    if (isTurbo) {
      ctx.save();
      ctx.fillStyle = '#FFAA00';
      ctx.shadowColor = '#FF3300';
      ctx.shadowBlur = 12;
      const flameLen = 14 + Math.random() * 10;
      ctx.beginPath();
      ctx.moveTo(screenX, drawY + currentH * 0.5 - 5);
      ctx.lineTo(screenX - flameLen, drawY + currentH * 0.5);
      ctx.lineTo(screenX, drawY + currentH * 0.5 + 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Piernas animadas si está en el suelo
    if (this.onGround && !this.isDucking) {
      const legOffset = Math.sin(this.animTimer) * 5;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 3;
      // Pierna 1
      ctx.beginPath();
      ctx.moveTo(screenX + 10, drawY + currentH - 4);
      ctx.lineTo(screenX + 10 + legOffset, drawY + currentH + 3);
      ctx.stroke();
      // Pierna 2
      ctx.beginPath();
      ctx.moveTo(screenX + 26, drawY + currentH - 4);
      ctx.lineTo(screenX + 26 - legOffset, drawY + currentH + 3);
      ctx.stroke();
    }

    // ══════════════════════════════════════════════════════════════
    // 5. EFECTO VISUAL: ESCUDO CIBERNÉTICO (SHIELD)
    // ══════════════════════════════════════════════════════════════
    if (this.shield) {
      ctx.save();
      const shieldPulse = 1 + Math.sin(this.animTimer * 3) * 0.08;
      const centerX = screenX + this.w / 2;
      const centerY = drawY + currentH / 2;
      const radX = (this.w * 0.75 + 10) * shieldPulse;
      const radY = (currentH * 0.65 + 10) * shieldPulse;

      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 2.5;
      ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
      ctx.shadowColor = '#00F0FF';
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radX, radY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Nodos orbitales del escudo
      const angle = this.animTimer * 2;
      for (let i = 0; i < 3; i++) {
        const a = angle + (i * Math.PI * 2 / 3);
        const nx = centerX + Math.cos(a) * radX;
        const ny = centerY + Math.sin(a) * radY;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(nx, ny, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // ══════════════════════════════════════════════════════════════
    // 6. EFECTO VISUAL: AURA DE IMÁN (MAGNET)
    // ══════════════════════════════════════════════════════════════
    if (this.magnetTimer > 0) {
      ctx.save();
      const centerX = screenX + this.w / 2;
      const centerY = drawY + currentH / 2;
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 1.8;
      ctx.globalAlpha = 0.5 + Math.sin(this.animTimer * 5) * 0.3;
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(centerX, centerY, this.w * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // ══════════════════════════════════════════════════════════════
    // 7. EFECTO VISUAL: ALAS DE DOBLE SALTO (DOUBLE JUMP)
    // ══════════════════════════════════════════════════════════════
    if (this.doubleJumpTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#00FF88';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#00FF88';
      ctx.shadowBlur = 8;

      // Alas estilizadas en los talones
      const footY = drawY + currentH;
      ctx.beginPath();
      ctx.moveTo(screenX - 4, footY - 8);
      ctx.lineTo(screenX + 4, footY - 2);
      ctx.moveTo(screenX + this.w + 4, footY - 8);
      ctx.lineTo(screenX + this.w - 4, footY - 2);
      ctx.stroke();
      ctx.restore();
    }

    // ══════════════════════════════════════════════════════════════
    // 8. ETIQUETA P1 O P2 SOBRE LA CABEZA
    // ══════════════════════════════════════════════════════════════
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.color;
    ctx.fillText(this.isP1 ? 'P1' : 'P2', screenX + this.w / 2, drawY - 8);

    ctx.restore();
  }
}
