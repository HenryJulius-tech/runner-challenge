/**
 * audio.js — Sistema de audio de Runner Challenge
 * 
 * Utiliza la Web Audio API para generar sonidos proceduralmente,
 * sin necesidad de archivos de audio externos (.mp3/.wav).
 * 
 * Sonidos disponibles:
 *  - jump:    al saltar
 *  - coin:    al recoger moneda
 *  - hit:     al chocar con obstáculo
 *  - goal:    al llegar a la meta
 *  - gameover: al quedarse sin vidas
 *  - levelup:  al desbloquear nivel
 * 
 * Música de fondo: tono ambient generado con osciladores.
 */

const AudioManager = (() => {
  let ctx = null;           // AudioContext
  let masterGain = null;    // Volumen maestro
  let musicNodes = [];      // Nodos de música activos
  let musicEnabled = true;
  let sfxEnabled   = true;
  let volume       = 0.7;

  /**
   * Inicializa el AudioContext.
   * Debe llamarse tras un gesto del usuario (click/keypress).
   */
  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = volume;
      masterGain.connect(ctx.destination);
    } catch (e) {
      console.warn('[Audio] Web Audio API no disponible:', e);
    }
  }

  // Reanudar contexto si estaba suspendido (política autoplay)
  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // ── Generador de sonido genérico ─────────────────────────────────────────
  /**
   * Crea y reproduce un oscilador con envolvente de amplitud.
   * @param {number} freq       Frecuencia inicial en Hz
   * @param {string} type       Tipo de onda: 'sine'|'square'|'sawtooth'|'triangle'
   * @param {number} duration   Duración total en segundos
   * @param {number} gainPeak   Amplitud máxima (0-1)
   * @param {number} freqEnd    Frecuencia final (para pitch bend)
   */
  function playTone(freq, type = 'sine', duration = 0.2, gainPeak = 0.4, freqEnd = null) {
    if (!ctx || !sfxEnabled) return;
    resume();

    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (freqEnd !== null) {
      osc.frequency.linearRampToValueAtTime(freqEnd, ctx.currentTime + duration);
    }

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(gainPeak, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  // ── Sonidos del juego ─────────────────────────────────────────────────────
  const sounds = {
    /** Salto: pitch ascendente corto */
    jump() {
      playTone(280, 'sine', 0.15, 0.3, 520);
    },

    /** Recoger moneda: nota aguda brillante */
    coin() {
      playTone(880, 'sine', 0.12, 0.35, 1100);
      setTimeout(() => playTone(1100, 'sine', 0.1, 0.25), 80);
    },

    /** Golpe con obstáculo: ruido grave */
    hit() {
      playTone(120, 'sawtooth', 0.3, 0.5, 60);
      playTone(80,  'square',   0.2, 0.3, 40);
    },

    /** Llegada a la meta: fanfarria ascendente */
    goal() {
      const notes = [440, 554, 659, 880];
      notes.forEach((f, i) => {
        setTimeout(() => playTone(f, 'sine', 0.2, 0.5), i * 100);
      });
    },

    /** Game over: descenso lento */
    gameover() {
      playTone(440, 'sawtooth', 0.4, 0.4, 220);
      setTimeout(() => playTone(220, 'sawtooth', 0.6, 0.4, 110), 300);
    },

    /** Desbloqueo de nivel: acorde brillante */
    levelup() {
      [523, 659, 784, 1047].forEach((f, i) => {
        setTimeout(() => playTone(f, 'triangle', 0.3, 0.4), i * 80);
      });
    },

    /** Cuenta regresiva: tick */
    tick() {
      playTone(600, 'square', 0.1, 0.3);
    },

    /** Inicio de carrera: ¡CORRE! */
    go() {
      playTone(880, 'sine', 0.4, 0.6, 880);
      setTimeout(() => playTone(1100, 'sine', 0.3, 0.5), 100);
    },

    /** Recoger Power-Up: arpegio brillante ascendente */
    powerup() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((f, i) => {
        setTimeout(() => playTone(f, 'sine', 0.15, 0.4), i * 60);
      });
    },

    /** Romper Escudo: distorsión eléctrica y crujido */
    shieldBreak() {
      playTone(340, 'sawtooth', 0.25, 0.5, 120);
      playTone(180, 'square',   0.2,  0.4, 60);
    },

    /** Turbo activado: barrido ascendente supersónico */
    turbo() {
      playTone(300, 'sawtooth', 0.35, 0.45, 900);
      setTimeout(() => playTone(600, 'sine', 0.25, 0.35, 1200), 120);
    },

    /** Doble salto: resorte ágil en el aire */
    doubleJump() {
      playTone(420, 'sine', 0.18, 0.4, 760);
      setTimeout(() => playTone(760, 'sine', 0.12, 0.3, 980), 60);
    },

    /** Imán activado: resonancia magnética */
    magnet() {
      playTone(700, 'triangle', 0.2, 0.35, 880);
      setTimeout(() => playTone(880, 'triangle', 0.2, 0.35, 1100), 80);
    },

    /** Caída rápida en picada: corte de aire descendente */
    whoosh() {
      playTone(550, 'sawtooth', 0.16, 0.35, 180);
    },

    /** Destrucción de obstáculo con Turbo: explosión sónica */
    smash() {
      playTone(160, 'sawtooth', 0.2, 0.5, 60);
      playTone(280, 'square',   0.15, 0.4, 80);
    }
  };

  // ── Música de fondo ───────────────────────────────────────────────────────
  /**
   * Genera música ambient de fondo con osciladores LFO.
   * Muy simple, solo para ambiente.
   */
  function startMusic() {
    if (!ctx || !musicEnabled || musicNodes.length > 0) return;
    resume();

    // Notas base de la escala (loop cada ~4 beats)
    const baseFreqs = [130.81, 164.81, 196.00, 261.63]; // C3 E3 G3 C4

    baseFreqs.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      const lfo  = ctx.createOscillator();
      const lfoG = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.value = freq;

      lfo.type = 'sine';
      lfo.frequency.value = 0.15 + i * 0.05; // modulación lenta
      lfoG.gain.value = 0.02;

      lfo.connect(lfoG);
      lfoG.connect(osc.frequency);

      gain.gain.value = 0.03; // volumen bajo (música de fondo)
      osc.connect(gain);
      gain.connect(masterGain);

      osc.start();
      lfo.start();
      musicNodes.push(osc, lfo, gain, lfoG);
    });
  }

  function stopMusic() {
    musicNodes.forEach(n => { try { n.stop(); } catch(e) {} });
    musicNodes = [];
  }

  // ── API pública ───────────────────────────────────────────────────────────
  return {
    init,
    resume,

    play(soundName) {
      if (!sfxEnabled) return;
      if (sounds[soundName]) sounds[soundName]();
    },

    startMusic,
    stopMusic,

    setVolume(val) {
      volume = Math.max(0, Math.min(1, val));
      if (masterGain) masterGain.gain.value = volume;
    },

    setMusicEnabled(val) {
      musicEnabled = val;
      if (!val) stopMusic();
    },

    setSfxEnabled(val) { sfxEnabled = val; },

    loadSettings(settings) {
      this.setVolume(settings.volume ?? 0.7);
      this.setMusicEnabled(settings.music ?? true);
      this.setSfxEnabled(settings.sfx ?? true);
    }
  };
})();
