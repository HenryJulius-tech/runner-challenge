/**
 * score.js — Sistema de Puntuación y Récords del Prototipo
 * 
 * Código simple y directo para explicar al profesor:
 *  - Suma puntos por distancia recorrida y monedas recogidas (+50 pts c/u).
 *  - Guarda y recupera récords por nivel usando localStorage del navegador.
 *  - Desbloquea el siguiente nivel al cruzar la meta.
 */

const ScoreManager = (() => {
  const STORAGE_KEY = 'runner_prototype_save';

  const DEFAULT_DATA = {
    unlockedLevels: [1],
    records: { 1: 0, 2: 0, 3: 0 },
    bestTimes: { 1: null, 2: null, 3: null },
    settings: { music: true, sfx: true }
  };

  // Cargar desde localStorage
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : structuredClone(DEFAULT_DATA);
    } catch (e) {
      return structuredClone(DEFAULT_DATA);
    }
  }

  // Guardar en localStorage
  function save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[Score] Error al guardar:', e);
    }
  }

  let data = load();

  /**
   * [EXPLICACIÓN PROFESOR: Formato de Tiempo]
   * Convierte segundos transcurridos en formato legible MM:SS.
   */
  function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  /**
   * [EXPLICACIÓN PROFESOR: Guardar Resultados y Desbloqueo]
   * Compara si se batió récord y desbloquea el siguiente nivel.
   */
  function saveResults({ level, score, time }) {
    let newRecord = false;
    let unlockedNext = false;

    if (!data.records[level] || score > data.records[level]) {
      data.records[level] = score;
      newRecord = true;
    }
    if (!data.bestTimes[level] || time < data.bestTimes[level]) {
      data.bestTimes[level] = time;
    }

    // Desbloquear siguiente nivel (hasta el total de niveles)
    const next = level + 1;
    const maxLevels = typeof LevelConfig !== 'undefined' ? LevelConfig.TOTAL_LEVELS : 20;
    if (next <= maxLevels && !data.unlockedLevels.includes(next)) {
      data.unlockedLevels.push(next);
      unlockedNext = true;
    }

    save(data);
    return { newRecord, unlockedNext };
  }

  function isLevelUnlocked(levelNum) {
    return data.unlockedLevels.includes(levelNum);
  }

  function getRecord(level) {
    return data.records[level] || 0;
  }

  function getBestTime(level) {
    return data.bestTimes[level];
  }

  function getSettings() {
    return data.settings;
  }

  function saveSettings(s) {
    Object.assign(data.settings, s);
    save(data);
  }

  function clearAll() {
    data = structuredClone(DEFAULT_DATA);
    save(data);
  }

  return {
    formatTime,
    saveResults,
    isLevelUnlocked,
    getRecord,
    getBestTime,
    getSettings,
    saveSettings,
    clearAll,
    getPlayerName: () => (data.settings && data.settings.name) ? data.settings.name : 'Jugador'
  };
})();
