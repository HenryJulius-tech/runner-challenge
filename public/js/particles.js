/**
 * particles.js — Sistema de Efectos Visuales y "Game Juice"
 * 
 * Gestiona partículas en coordenadas de mundo renderizadas a través de la cámara:
 *  - Chispas de impacto y salto
 *  - Polvo y ondas expansivas (shockwaves) al caer/romper escudo
 *  - Shards/fragmentos al destruir obstáculos con Turbo
 *  - Textos flotantes de puntuación y power-ups con brillo de neón
 */

class ParticleSystem {
  constructor() {
    this.particles = [];
    this.floatingTexts = [];
    this.shockwaves = [];
  }

  clear() {
    this.particles = [];
    this.floatingTexts = [];
    this.shockwaves = [];
  }

  /**
   * Polvo al aterrizar o deslizarse
   */
  spawnDust(worldX, y, color = '#00F0FF', count = 5) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        type: 'dust',
        worldX: worldX + (Math.random() - 0.5) * 16,
        y: y - Math.random() * 4,
        vx: (Math.random() - 0.5) * 3.5,
        vy: -Math.random() * 2.2 - 0.5,
        radius: 3 + Math.random() * 3,
        life: 22,
        maxLife: 22,
        color
      });
    }
  }

  /**
   * Chispas luminosas de alta energía
   */
  spawnSparks(worldX, y, color = '#FF007F', count = 10, speedMult = 1) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (2 + Math.random() * 5) * speedMult;
      this.particles.push({
        type: 'spark',
        worldX,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 0.18,
        radius: 2 + Math.random() * 2,
        life: 28,
        maxLife: 28,
        color
      });
    }
  }

  /**
   * Anillo de onda expansiva (Shockwave)
   */
  spawnShockwave(worldX, y, color = '#00F0FF', maxRadius = 36) {
    this.shockwaves.push({
      worldX,
      y,
      radius: 4,
      maxRadius,
      lineWidth: 3.5,
      color,
      life: 20,
      maxLife: 20
    });
  }

  /**
   * Fragmentos de rotura al destruir obstáculo con Turbo
   */
  spawnShatter(worldX, y, w = 30, h = 30, color = '#FF3366', count = 12) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        type: 'shatter',
        worldX: worldX + Math.random() * w,
        y: y + Math.random() * h,
        vx: (Math.random() - 0.4) * 8 + 3,
        vy: (Math.random() - 0.5) * 8 - 2,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.4,
        size: 3 + Math.random() * 5,
        gravity: 0.25,
        life: 30,
        maxLife: 30,
        color
      });
    }
  }

  /**
   * Texto flotante de impacto (p. ej. "¡ESCUDO!", "¡TURBO!", "+100")
   */
  spawnFloatingText(worldX, y, text, color = '#00F0FF', fontSize = 14) {
    this.floatingTexts.push({
      worldX,
      y,
      text,
      color,
      fontSize,
      vy: -1.4,
      scale: 1.3,
      life: 42,
      maxLife: 42
    });
  }

  update() {
    // 1. Partículas
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.worldX += p.vx;
      p.y += p.vy;
      if (p.gravity) p.vy += p.gravity;
      if (p.rot !== undefined) p.rot += p.vRot;
      p.life--;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // 2. Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.radius += (s.maxRadius - s.radius) * 0.22;
      s.life--;
      if (s.life <= 0) this.shockwaves.splice(i, 1);
    }

    // 3. Textos flotantes
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.y += t.vy;
      t.vy *= 0.96;
      if (t.scale > 1.0) t.scale -= 0.03;
      t.life--;
      if (t.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  /**
   * Dibuja los efectos visuales proyectados en el viewport de la cámara
   */
  draw(ctx, camera) {
    const W = ctx.canvas.width;

    // 1. Dibujar shockwaves
    for (const s of this.shockwaves) {
      const sx = camera ? camera.worldToScreenX(s.worldX) : s.worldX;
      if (sx < -60 || sx > W + 60) continue;

      const alpha = Math.max(0, s.life / s.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.lineWidth * alpha;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(sx, s.y, s.radius * 1.2, s.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Dibujar partículas (dust, spark, shatter)
    for (const p of this.particles) {
      const sx = camera ? camera.worldToScreenX(p.worldX) : p.worldX;
      if (sx < -40 || sx > W + 40) continue;

      const progress = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.max(0, progress);

      if (p.type === 'dust') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, p.y, p.radius * (1 - (1 - progress) * 0.4), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'spark') {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(sx, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'shatter') {
        ctx.translate(sx, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 4;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }
      ctx.restore();
    }

    // 3. Dibujar textos flotantes
    for (const t of this.floatingTexts) {
      const sx = camera ? camera.worldToScreenX(t.worldX) : t.worldX;
      if (sx < -80 || sx > W + 80) continue;

      const alpha = Math.max(0, t.life / t.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${Math.round(t.fontSize * t.scale)}px 'Orbitron', 'Outfit', sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = t.color;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 8;
      ctx.fillText(t.text, sx, t.y);
      ctx.restore();
    }
  }
}

// Instancia global accesible
window.GlobalParticles = new ParticleSystem();
