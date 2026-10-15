/**
 * renderer.js — Renderizado del Escenario y Efectos de Velocidad
 * 
 * Dibuja el escenario del juego con estética ciberpunk:
 *  - Cielo con estrellas parpadeantes y gradiente neón.
 *  - Suelo con cuadrícula de perspectiva en movimiento continuo.
 *  - Líneas de velocidad dinámicas (speed lines) a altas velocidades y en modo Turbo.
 *  - Portal / Meta final con iluminación de neón y bandera de cuadros.
 */

class Renderer {
  constructor(canvas, levelData) {
    this.canvas    = canvas;
    this.ctx       = canvas.getContext('2d');
    this.levelData = levelData;
    this.gridOffset = 0;
    this.stars = [];
    this._initStars();
    this.resize();
  }

  _initStars() {
    this.stars = [];
    for (let i = 0; i < 45; i++) {
      this.stars.push({
        x: Math.random() * 1600,
        y: Math.random() * 300,
        r: 0.8 + Math.random() * 1.5,
        alpha: 0.3 + Math.random() * 0.7
      });
    }
  }

  resize() {
    this.canvas.width  = this.canvas.offsetWidth  || window.innerWidth;
    this.canvas.height = this.canvas.offsetHeight || window.innerHeight;
    const bottomMargin = this.canvas.height < 420 ? 55 : 75;
    this.groundY = Math.floor(this.canvas.height - bottomMargin);
  }

  get W() { return this.canvas.width; }
  get H() { return this.canvas.height; }

  /**
   * Dibuja el fondo, estrellas y el suelo con cuadrícula de movimiento
   */
  drawBackground(camera, scrollSpeed, isTurbo = false) {
    const ctx = this.ctx;

    // 1. Cielo con gradiente profundo
    const grad = ctx.createLinearGradient(0, 0, 0, this.groundY);
    grad.addColorStop(0, '#090B16');
    grad.addColorStop(0.7, '#121528');
    grad.addColorStop(1, '#1C203A');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.W, this.groundY);

    // 2. Estrellas de fondo con paralaje sutil
    ctx.save();
    const camX = camera ? camera.x : 0;
    for (const star of this.stars) {
      const sx = (star.x - camX * 0.1) % (this.W + 40);
      const drawX = sx < 0 ? sx + this.W + 40 : sx;
      if (star.y < this.groundY - 10) {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
        ctx.beginPath();
        ctx.arc(drawX, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // 3. Suelo Synthwave
    ctx.fillStyle = '#0B0D18';
    ctx.fillRect(0, this.groundY, this.W, this.H - this.groundY);

    // Línea superior del suelo con neón
    const groundColor = this.levelData?.groundLine || '#00F0FF';
    ctx.save();
    ctx.strokeStyle = groundColor;
    ctx.shadowColor = groundColor;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, this.groundY);
    ctx.lineTo(this.W, this.groundY);
    ctx.stroke();
    ctx.restore();

    // 4. Cuadrícula de velocidad en el suelo
    this.gridOffset = (this.gridOffset - scrollSpeed) % 60;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.lineWidth = 2;
    for (let x = this.gridOffset; x < this.W; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, this.groundY);
      ctx.lineTo(x - 45, this.H);
      ctx.stroke();
    }

    // 5. Líneas cinéticas de velocidad (Speed Lines)
    this.drawSpeedLines(scrollSpeed, isTurbo);
  }

  /**
   * Líneas de viento cinético a altas velocidades o durante Turbo
   */
  drawSpeedLines(scrollSpeed, isTurbo) {
    if (scrollSpeed < 6.8 && !isTurbo) return;

    const ctx = this.ctx;
    const count = isTurbo ? 14 : 7;
    ctx.save();
    ctx.strokeStyle = isTurbo ? 'rgba(255, 80, 130, 0.45)' : 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = isTurbo ? 2.5 : 1.5;

    for (let i = 0; i < count; i++) {
      const y = (i * 39 + Math.abs(this.gridOffset) * 2.5) % (this.groundY - 30);
      const len = (60 + ((i * 47) % 110)) * (isTurbo ? 1.6 : 1);
      const startX = ((i * 137 - this.gridOffset * 5) % (this.W + 250)) - 120;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX + len, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Dibuja la Meta del nivel (Banner de llegada con iluminación de neón)
   */
  drawGoalPortal(goalWorldX, camera) {
    const screenX = camera ? camera.worldToScreenX(goalWorldX) : goalWorldX;
    if (screenX < -120 || screenX > this.W + 120) return;

    const ctx = this.ctx;
    const gateH = 145;
    const gateY = this.groundY - gateH;

    ctx.save();
    // Postes luminosos
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = '#00F0FF';
    ctx.shadowBlur = 10;
    ctx.fillRect(screenX - 8, gateY, 16, gateH);

    // Cartel META
    ctx.fillStyle = '#00F0FF';
    ctx.shadowBlur = 15;
    ctx.fillRect(screenX - 50, gateY - 32, 100, 30);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000000';
    ctx.font = "bold 13px 'Orbitron', 'Outfit', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('🏁 META', screenX, gateY - 12);

    ctx.restore();
  }
}
