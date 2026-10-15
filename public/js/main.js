/**
 * main.js — Punto de entrada de Runner Challenge
 * 
 * Este archivo es el primero que se ejecuta después de cargar todos
 * los módulos JS. Sus responsabilidades son mínimas:
 * 
 *  1. Esperar a que el DOM esté listo
 *  2. Inicializar el motor de juego (Game.init)
 *  3. Conectar los eventos de UI (UI.setupEvents)
 *  4. Mostrar el menú principal
 *  5. Aplicar configuración de audio guardada
 * 
 * Todos los demás módulos se inicializan lazy (cuando se necesitan).
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── 1. Cargar configuración guardada ─────────────────────────────────────
  const settings = ScoreManager.getSettings();
  AudioManager.loadSettings(settings);

  // ── 2. Inicializar motor de juego ─────────────────────────────────────────
  Game.init();

  // ── 3. Conectar eventos de UI ─────────────────────────────────────────────
  UI.setupEvents();

  // ── 4. Mostrar menú principal ─────────────────────────────────────────────
  UI.showScreen('menu');

  // ── 5. Activar audio tras primer gesto del usuario ────────────────────────
  // (La política de autoplay del navegador requiere un gesto del usuario)
  document.addEventListener('click', () => {
    AudioManager.init();
    AudioManager.resume();
  }, { once: true });

  document.addEventListener('keydown', () => {
    AudioManager.init();
    AudioManager.resume();
  }, { once: true });

  console.log('%c🎮 Runner Challenge v1.0 — Iniciado', 'color:#6C63FF;font-size:14px;font-weight:bold;');
  console.log('%c📚 Proyecto Académico | Node.js + Socket.IO + Canvas', 'color:#4FC3F7;font-size:12px;');
});
