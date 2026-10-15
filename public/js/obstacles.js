/**
 * obstacles.js — Sistema de Obstáculos del Prototipo
 * 
 * Código sencillo y claro para explicar al profesor:
 *  - Genera obstáculos en el eje X del mundo con una distancia mínima de seguridad (gap).
 *  - Tipos de obstáculos de prueba:
 *     1. Bloque de Suelo (Caja de peligro para saltar).
 *     2. Barrera / Pincho Láser (Obstáculo vertical más alto).
 *     3. Drone Flotante (Obstáculo con oscilación senoidal).
 *  - Limpieza de memoria: Elimina del arreglo los obstáculos que ya quedaron atrás.
 */

class ObstacleSystem {
  constructor(levelData, seed = 12345) {
    this.levelData        = levelData;
    this.obstacles        = [];
    this.lastSpawnWorldX  = 450;
    this.minGap           = levelData?.minObstacleGap ?? 300;
    this.animTimer        = 0;
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
   * [EXPLICACIÓN: Generación de Obstáculo Balanceado]
   * Diseñado con medidas exactas para garantizar que cada obstáculo sea 100% esquivable:
   *  - Obstáculos de suelo (SPIKE, ROCK): altura 36-40px. El salto del jugador (130px) los supera fácilmente.
   *  - Obstáculos flotantes (LASER, DRONE): suspendidos a más de 34px sobre el suelo.
   *    Un jugador agachado (28px de altura) pasa por debajo con total seguridad.
   */
  spawnObstacle(worldX, groundY) {
    const types = ['SPIKE', 'ROCK', 'LASER', 'DRONE'];
    const typeName = types[Math.floor(this._random() * types.length)];

    let w = 32;
    let h = 38;
    let color = '#FF0055';
    let isMoving = false;
    let originY = groundY - h;

    if (typeName === 'SPIKE') {
      w = 28;
      h = 40;
      color = '#FF0055';
      originY = groundY - h;
    } else if (typeName === 'ROCK') {
      w = 34;
      h = 36;
      color = '#FF3366';
      originY = groundY - h;
    } else if (typeName === 'LASER') {
      // Barrera horizontal flotante: se esquiva agachándose (o con caída rápida)
      w = 50;
      h = 14;
      color = '#00F0FF';
      originY = groundY - 50; // La base queda a groundY - 36px (agachado mide 28px, pasa limpio)
    } else if (typeName === 'DRONE') {
      // Drone patrulla flotante: se puede saltar por encima o pasar agachado por debajo
      w = 38;
      h = 24;
      color = '#FFAA00';
      isMoving = true;
      originY = groundY - 74; // Oscila entre -81px y -67px, base a -43px del suelo
    }

    const obs = {
      typeName,
      worldX,
      y: originY,
      w,
      h,
      color,
      isMoving,
      originY,
      phase: this._random() * Math.PI * 2
    };

    this.obstacles.push(obs);
    this.lastSpawnWorldX = worldX;
  }

  /**
   * [EXPLICACIÓN: Actualización de Obstáculos]
   * 1. Genera nuevos obstáculos por delante del avance de los corredores.
   * 2. Si el obstáculo es flotante (drone), oscila suavemente con Math.sin().
   * 3. Descarta los obstáculos que ya salieron de la pantalla para optimizar memoria.
   */
  update(maxPlayerWorldX, groundY, goalWorldX) {
    this.animTimer += 0.06;
    const spawnHorizon = maxPlayerWorldX + 900;

    // 1. Crear obstáculo adelante respetando la separación mínima
    if (this.lastSpawnWorldX < spawnHorizon && this.lastSpawnWorldX < goalWorldX - 250) {
      const gap = this.minGap + this._random() * 160;
      this.spawnObstacle(this.lastSpawnWorldX + gap, groundY);
    }

    // 2. Animar drones flotantes suavemente
    for (const obs of this.obstacles) {
      if (obs.isMoving) {
        obs.phase += 0.04;
        obs.y = obs.originY + Math.sin(obs.phase) * 7;
      }
    }

    // 3. Eliminar los que quedaron muy atrás o fueron destruidos por Turbo
    this.obstacles = this.obstacles.filter(o => !o.destroyed && o.worldX + o.w > maxPlayerWorldX - 400);
  }

  /**
   * [EXPLICACIÓN: Dibujo en Canvas]
   * Dibuja los obstáculos de manera limpia y clara según su tipo.
   */
  draw(ctx, camera) {
    for (const obs of this.obstacles) {
      if (obs.destroyed) continue;
      const screenX = camera ? camera.worldToScreenX(obs.worldX) : obs.worldX;
      if (screenX < -60 || screenX > ctx.canvas.width + 60) continue;

      ctx.save();
      ctx.fillStyle = obs.color;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;

      if (obs.typeName === 'SPIKE') {
        // Triángulo de peligro / Pincho de suelo
        ctx.beginPath();
        ctx.moveTo(screenX, obs.y + obs.h);
        ctx.lineTo(screenX + obs.w / 2, obs.y);
        ctx.lineTo(screenX + obs.w, obs.y + obs.h);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (obs.typeName === 'LASER') {
        // Barrera láser flotante con brillo
        ctx.shadowColor = obs.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = obs.color;
        ctx.fillRect(screenX, obs.y, obs.w, obs.h);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(screenX + 4, obs.y + 4, obs.w - 8, obs.h - 8);
        ctx.shadowBlur = 0;
      } else if (obs.typeName === 'DRONE') {
        // Drone flotante redondeado
        ctx.beginPath();
        ctx.roundRect(screenX, obs.y, obs.w, obs.h, 6);
        ctx.fill();
        ctx.stroke();

        // Núcleo brillante
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(screenX + obs.w / 2, obs.y + obs.h / 2, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Bloque / Caja estándar
        ctx.beginPath();
        ctx.roundRect(screenX, obs.y, obs.w, obs.h, 4);
        ctx.fill();
        ctx.stroke();

        // Señal X de advertencia
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(screenX + 6, obs.y + 6);
        ctx.lineTo(screenX + obs.w - 6, obs.y + obs.h - 6);
        ctx.moveTo(screenX + obs.w - 6, obs.y + 6);
        ctx.lineTo(screenX + 6, obs.y + obs.h - 6);
        ctx.stroke();
      }

      ctx.restore();
    }
  }
}
