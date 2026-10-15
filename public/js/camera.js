/**
 * camera.js — Controlador de Cámara Dinámica Compartida para Multijugador Local
 * 
 * Responsabilidades:
 *  - Seguir suavemente a 1 jugador (modo Solo) o al punto medio de 2 jugadores (Multiplayer Local).
 *  - Calcular distancia horizontal entre jugadores y ajustar zoom dinámico suave (Lerp).
 *  - NO empujar ni teletransportar artificialmente al rezagado (gameplay justo).
 *  - Detectar rezago severo y activar aviso flotante "⚠️ ¡VAS ATRÁS!".
 *  - Gestionar sacudidas de pantalla (Screen Shake) con amortiguación.
 *  - Proveer transformaciones de coordenadas de mundo a pantalla.
 */

class CameraController {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0;             // Posición de la cámara en el mundo (X)
    this.targetX = 0;       // Objetivo de seguimiento
    this.scale = 1.0;       // Factor de zoom
    this.targetScale = 1.0;

    // Parámetros de interpolación y seguimiento
    this.lerpSpeed = 0.12;
    this.zoomLerpSpeed = 0.05;
    this.minScale = 0.82;   // Zoom out máximo al separarse mucho
    this.maxScale = 1.0;    // Zoom normal

    // Desplazamiento base en pantalla (20% del ancho del viewport)
    this.baseScreenOffsetX = 180;

    // Screen Shake
    this.shakeDuration = 0;
    this.shakeIntensity = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;

    // Notificación "¡VAS ATRÁS!"
    this.p1Lagging = false;
    this.p2Lagging = false;
    this.lagThreshold = 340; // Distancia en px para considerar que un jugador va muy atrás
  }

  /**
   * Reinicia la cámara al inicio de un nivel
   */
  reset(initialWorldX = 0) {
    this.x = initialWorldX;
    this.targetX = initialWorldX;
    this.scale = 1.0;
    this.targetScale = 1.0;
    this.shakeDuration = 0;
    this.shakeIntensity = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.p1Lagging = false;
    this.p2Lagging = false;
    this._updateWarningTags();
  }

  /**
   * Dispara sacudida de pantalla por impacto
   */
  triggerShake(durationFrames = 14, intensity = 8) {
    this.shakeDuration = durationFrames;
    this.shakeIntensity = intensity;
  }

  /**
   * Actualiza el seguimiento de cámara centrado en el jugador del viewport
   * @param {Player|Array<Player>} playerOrPlayers - Jugador o lista de jugadores
   * @param {number} canvasW - Ancho del canvas del viewport
   */
  update(playerOrPlayers, canvasW) {
    if (!playerOrPlayers) return;
    const player = Array.isArray(playerOrPlayers) ? playerOrPlayers[0] : playerOrPlayers;
    if (!player) return;

    this.baseScreenOffsetX = Math.floor(canvasW * 0.22);
    this.targetX = player.worldX;
    this.targetScale = 1.0;
    this.p1Lagging = false;
    this.p2Lagging = false;

    // ── Interpolación suave (Lerp) ───────────────────────────────────────────
    this.x += (this.targetX - this.x) * this.lerpSpeed;
    this.scale += (this.targetScale - this.scale) * this.zoomLerpSpeed;

    // ── Actualizar sacudida de pantalla ──────────────────────────────────────
    if (this.shakeDuration > 0) {
      this.shakeOffsetX = (Math.random() - 0.5) * this.shakeIntensity * 2;
      this.shakeOffsetY = (Math.random() - 0.5) * this.shakeIntensity * 2;
      this.shakeDuration--;
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }

    this._updateWarningTags();
  }

  /**
   * Actualiza el cartel "¡VAS ATRÁS!" en el DOM
   */
  _updateWarningTags() {
    const elP1 = document.getElementById('warning-p1');
    const elP2 = document.getElementById('warning-p2');

    if (elP1) {
      if (this.p1Lagging) elP1.classList.remove('hidden');
      else elP1.classList.add('hidden');
    }
    if (elP2) {
      if (this.p2Lagging) elP2.classList.remove('hidden');
      else elP2.classList.add('hidden');
    }
  }

  /**
   * Convierte una coordenada del mundo a la posición X en pantalla
   */
  worldToScreenX(worldX) {
    return (worldX - this.x) * this.scale + this.baseScreenOffsetX;
  }

  /**
   * Convierte una posición en pantalla a coordenada en el mundo
   */
  screenToWorldX(screenX) {
    return (screenX - this.baseScreenOffsetX) / this.scale + this.x;
  }

  /**
   * Aplica la matriz de transformación de la cámara (Zoom + Shake + Offset)
   */
  applyTransform(ctx, groundY) {
    ctx.save();

    // Aplicar sacudida de pantalla
    if (this.shakeOffsetX !== 0 || this.shakeOffsetY !== 0) {
      ctx.translate(this.shakeOffsetX, this.shakeOffsetY);
    }

    // Aplicar zoom centrado en el suelo
    if (this.scale !== 1.0) {
      ctx.translate(this.baseScreenOffsetX, groundY);
      ctx.scale(this.scale, this.scale);
      ctx.translate(-this.baseScreenOffsetX, -groundY);
    }
  }

  /**
   * Restaura el contexto después de dibujar los elementos con la cámara
   */
  restoreTransform(ctx) {
    ctx.restore();
  }
}
