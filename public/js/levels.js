/**
 * levels.js — Configuración de los 20 Niveles de Runner Challenge: Neon Run
 * 
 * 20 niveles equilibrados con progresión matemática justa:
 *  - Velocidades suaves de 5.0 px/frame hasta 9.6 px/frame en el nivel final.
 *  - Distancia mínima entre obstáculos (minObstacleGap) calculada para permitir
 *    tiempo suficiente de salto, aterrizaje, agacharse y caída rápida (fast-fall).
 *  - Físicas adaptadas (jumpForce y gravity) para mantener el control a cualquier velocidad.
 *  - Temáticas y paletas de colores Synthwave/Cyberpunk únicas para cada nivel.
 */

const LevelConfig = (() => {

  const LEVELS = [
    {
      number:         1,
      name:           'Nivel 1: Neon Highway',
      difficulty:     'Fácil',
      scrollSpeed:    5.0,
      jumpForce:      -14.0,
      gravity:        0.75,
      levelLength:    2600,
      minObstacleGap: 380,
      stars:          1,
      groundColor:    '#0B0D1B',
      groundLine:     '#00F0FF'
    },
    {
      number:         2,
      name:           'Nivel 2: Cyber Alley',
      difficulty:     'Fácil',
      scrollSpeed:    5.3,
      jumpForce:      -14.0,
      gravity:        0.75,
      levelLength:    2900,
      minObstacleGap: 370,
      stars:          1,
      groundColor:    '#0A101D',
      groundLine:     '#00E5FF'
    },
    {
      number:         3,
      name:           'Nivel 3: Retro Grid',
      difficulty:     'Fácil',
      scrollSpeed:    5.6,
      jumpForce:      -14.2,
      gravity:        0.76,
      levelLength:    3200,
      minObstacleGap: 360,
      stars:          1,
      groundColor:    '#081415',
      groundLine:     '#00FF99'
    },
    {
      number:         4,
      name:           'Nivel 4: Techno Core',
      difficulty:     'Normal',
      scrollSpeed:    5.9,
      jumpForce:      -14.2,
      gravity:        0.76,
      levelLength:    3500,
      minObstacleGap: 350,
      stars:          2,
      groundColor:    '#07140B',
      groundLine:     '#39FF14'
    },
    {
      number:         5,
      name:           'Nivel 5: Synthwave Sunset',
      difficulty:     'Normal',
      scrollSpeed:    6.2,
      jumpForce:      -14.4,
      gravity:        0.77,
      levelLength:    3800,
      minObstacleGap: 345,
      stars:          2,
      groundColor:    '#171207',
      groundLine:     '#FFD700'
    },
    {
      number:         6,
      name:           'Nivel 6: Digital Mirage',
      difficulty:     'Normal',
      scrollSpeed:    6.5,
      jumpForce:      -14.4,
      gravity:        0.77,
      levelLength:    4100,
      minObstacleGap: 340,
      stars:          2,
      groundColor:    '#170F05',
      groundLine:     '#FFA500'
    },
    {
      number:         7,
      name:           'Nivel 7: Pulse Station',
      difficulty:     'Normal',
      scrollSpeed:    6.8,
      jumpForce:      -14.6,
      gravity:        0.78,
      levelLength:    4400,
      minObstacleGap: 335,
      stars:          2,
      groundColor:    '#17080B',
      groundLine:     '#FF7700'
    },
    {
      number:         8,
      name:           'Nivel 8: Voltage District',
      difficulty:     'Difícil',
      scrollSpeed:    7.0,
      jumpForce:      -14.6,
      gravity:        0.78,
      levelLength:    4700,
      minObstacleGap: 330,
      stars:          3,
      groundColor:    '#170512',
      groundLine:     '#FF007F'
    },
    {
      number:         9,
      name:           'Nivel 9: Cyber Rooftops',
      difficulty:     'Difícil',
      scrollSpeed:    7.2,
      jumpForce:      -14.8,
      gravity:        0.79,
      levelLength:    5000,
      minObstacleGap: 325,
      stars:          3,
      groundColor:    '#180517',
      groundLine:     '#FF1493'
    },
    {
      number:         10,
      name:           'Nivel 10: Matrix Overdrive',
      difficulty:     'Difícil',
      scrollSpeed:    7.5,
      jumpForce:      -14.8,
      gravity:        0.79,
      levelLength:    5300,
      minObstacleGap: 320,
      stars:          3,
      groundColor:    '#110518',
      groundLine:     '#BA55D3'
    },
    {
      number:         11,
      name:           'Nivel 11: Quantum Tunnel',
      difficulty:     'Difícil',
      scrollSpeed:    7.7,
      jumpForce:      -15.0,
      gravity:        0.80,
      levelLength:    5600,
      minObstacleGap: 320,
      stars:          3,
      groundColor:    '#0C0518',
      groundLine:     '#9933FF'
    },
    {
      number:         12,
      name:           'Nivel 12: Hologram Canyon',
      difficulty:     'Muy Difícil',
      scrollSpeed:    7.9,
      jumpForce:      -15.0,
      gravity:        0.80,
      levelLength:    5900,
      minObstacleGap: 315,
      stars:          4,
      groundColor:    '#090518',
      groundLine:     '#7B2CBF'
    },
    {
      number:         13,
      name:           'Nivel 13: Laser Facility',
      difficulty:     'Muy Difícil',
      scrollSpeed:    8.1,
      jumpForce:      -15.2,
      gravity:        0.81,
      levelLength:    6200,
      minObstacleGap: 310,
      stars:          4,
      groundColor:    '#180509',
      groundLine:     '#FF0055'
    },
    {
      number:         14,
      name:           'Nivel 14: Dark Cybercity',
      difficulty:     'Muy Difícil',
      scrollSpeed:    8.3,
      jumpForce:      -15.2,
      gravity:        0.81,
      levelLength:    6500,
      minObstacleGap: 310,
      stars:          4,
      groundColor:    '#170505',
      groundLine:     '#E63946'
    },
    {
      number:         15,
      name:           'Nivel 15: Overclock Sector',
      difficulty:     'Muy Difícil',
      scrollSpeed:    8.5,
      jumpForce:      -15.4,
      gravity:        0.82,
      levelLength:    6800,
      minObstacleGap: 305,
      stars:          4,
      groundColor:    '#180A05',
      groundLine:     '#FF4800'
    },
    {
      number:         16,
      name:           'Nivel 16: Zero Gravity',
      difficulty:     'Extremo',
      scrollSpeed:    8.7,
      jumpForce:      -15.4,
      gravity:        0.82,
      levelLength:    7100,
      minObstacleGap: 300,
      stars:          5,
      groundColor:    '#051817',
      groundLine:     '#00FFF5'
    },
    {
      number:         17,
      name:           'Nivel 17: Hyperdrive Lab',
      difficulty:     'Extremo',
      scrollSpeed:    8.9,
      jumpForce:      -15.6,
      gravity:        0.83,
      levelLength:    7400,
      minObstacleGap: 300,
      stars:          5,
      groundColor:    '#051813',
      groundLine:     '#05F1CD'
    },
    {
      number:         18,
      name:           'Nivel 18: Vortex Matrix',
      difficulty:     'Extremo',
      scrollSpeed:    9.1,
      jumpForce:      -15.6,
      gravity:        0.83,
      levelLength:    7800,
      minObstacleGap: 295,
      stars:          5,
      groundColor:    '#171605',
      groundLine:     '#FFE600'
    },
    {
      number:         19,
      name:           'Nivel 19: Singularity',
      difficulty:     'Demencial',
      scrollSpeed:    9.3,
      jumpForce:      -15.8,
      gravity:        0.84,
      levelLength:    8200,
      minObstacleGap: 290,
      stars:          5,
      groundColor:    '#130518',
      groundLine:     '#E0AAFF'
    },
    {
      number:         20,
      name:           'Nivel 20: Omega Neon (Final)',
      difficulty:     'Mítico',
      scrollSpeed:    9.6,
      jumpForce:      -16.0,
      gravity:        0.85,
      levelLength:    8800,
      minObstacleGap: 285,
      stars:          5,
      groundColor:    '#101018',
      groundLine:     '#FFFFFF'
    }
  ];

  return {
    getLevelData(num) {
      return LEVELS.find(l => l.number === num) || LEVELS[0];
    },
    getAllLevels() {
      return LEVELS;
    },
    TOTAL_LEVELS: LEVELS.length
  };
})();
