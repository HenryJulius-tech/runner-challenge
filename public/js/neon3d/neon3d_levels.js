/**
 * neon3d_levels.js — Configuración de los 20 Niveles para Neon Run 3D
 * 
 * Migra los 20 niveles del juego 2D al espacio tridimensional:
 *  - Distancias de meta (finishDistance) escaladas proporcionalmente de 650m a 2200m.
 *  - Velocidades Three.js escaladas progresivamente de 13.0 u/s a 26.0 u/s.
 *  - Físicas adaptadas de salto y gravedad en 3D.
 *  - Separación mínima entre obstáculos (minObstacleGap) matemáticamente segura.
 *  - Paletas de colores neón únicas para cada nivel (pista, guardarraíles, cielo, niebla y sol retro).
 */

const Neon3DLevels = (() => {

  const LEVELS_3D = [
    {
      number: 1,
      name: 'Nivel 1: Neon Highway',
      difficulty: 'Fácil',
      stars: 1,
      finishDistance: 650,
      baseSpeed: 13.0,
      jumpForce: 12.2,
      gravity: 35.0,
      minObstacleGap: 14.0,
      palette: {
        neonMain: 0x00F0FF, // Cyan Neón
        neonSecondary: 0xFF007F, // Magenta Neón
        groundColor: 0x070420,
        groundLine: '#00F0FF',
        skyTop: '#03020f',
        skyMid: '#1a0a3d',
        skyBottom: '#ff3fa0',
        fogColor: 0x2a0d4a,
        sunColors: ['#ffe45c', '#ff5fa8', '#a020f0']
      }
    },
    {
      number: 2,
      name: 'Nivel 2: Cyber Alley',
      difficulty: 'Fácil',
      stars: 1,
      finishDistance: 720,
      baseSpeed: 13.8,
      jumpForce: 12.2,
      gravity: 35.0,
      minObstacleGap: 13.5,
      palette: {
        neonMain: 0x00E5FF,
        neonSecondary: 0xFF2BD6,
        groundColor: 0x080422,
        groundLine: '#00E5FF',
        skyTop: '#020214',
        skyMid: '#140c38',
        skyBottom: '#d922bb',
        fogColor: 0x200a40,
        sunColors: ['#ffd043', '#ff4d94', '#8b1bc7']
      }
    },
    {
      number: 3,
      name: 'Nivel 3: Retro Grid',
      difficulty: 'Fácil',
      stars: 1,
      finishDistance: 800,
      baseSpeed: 14.5,
      jumpForce: 12.4,
      gravity: 35.5,
      minObstacleGap: 13.0,
      palette: {
        neonMain: 0x00FF99, // Verde Neón
        neonSecondary: 0x00F0FF,
        groundColor: 0x041814,
        groundLine: '#00FF99',
        skyTop: '#010f0d',
        skyMid: '#062620',
        skyBottom: '#00e6a8',
        fogColor: 0x052e24,
        sunColors: ['#eaff55', '#00ffaa', '#007788']
      }
    },
    {
      number: 4,
      name: 'Nivel 4: Techno Core',
      difficulty: 'Normal',
      stars: 2,
      finishDistance: 880,
      baseSpeed: 15.2,
      jumpForce: 12.4,
      gravity: 35.5,
      minObstacleGap: 12.6,
      palette: {
        neonMain: 0x39FF14, // Verde Matrix
        neonSecondary: 0x00FF88,
        groundColor: 0x051a08,
        groundLine: '#39FF14',
        skyTop: '#010d04',
        skyMid: '#0a260f',
        skyBottom: '#28c71e',
        fogColor: 0x06280e,
        sunColors: ['#d5ff40', '#39ff14', '#086e18']
      }
    },
    {
      number: 5,
      name: 'Nivel 5: Synthwave Sunset',
      difficulty: 'Normal',
      stars: 2,
      finishDistance: 950,
      baseSpeed: 16.0,
      jumpForce: 12.6,
      gravity: 36.0,
      minObstacleGap: 12.2,
      palette: {
        neonMain: 0xFFD700, // Oro Turbo
        neonSecondary: 0xFF007F,
        groundColor: 0x1a1205,
        groundLine: '#FFD700',
        skyTop: '#15050f',
        skyMid: '#380c1e',
        skyBottom: '#ff8800',
        fogColor: 0x3a1215,
        sunColors: ['#ffee55', '#ff4400', '#aa0044']
      }
    },
    {
      number: 6,
      name: 'Nivel 6: Digital Mirage',
      difficulty: 'Normal',
      stars: 2,
      finishDistance: 1020,
      baseSpeed: 16.8,
      jumpForce: 12.6,
      gravity: 36.0,
      minObstacleGap: 11.8,
      palette: {
        neonMain: 0xFFA500, // Naranja
        neonSecondary: 0xFF2BD6,
        groundColor: 0x180f03,
        groundLine: '#FFA500',
        skyTop: '#100508',
        skyMid: '#38160a',
        skyBottom: '#ff7700',
        fogColor: 0x331405,
        sunColors: ['#ffea77', '#ff6600', '#990033']
      }
    },
    {
      number: 7,
      name: 'Nivel 7: Pulse Station',
      difficulty: 'Normal',
      stars: 2,
      finishDistance: 1100,
      baseSpeed: 17.5,
      jumpForce: 12.8,
      gravity: 36.5,
      minObstacleGap: 11.5,
      palette: {
        neonMain: 0xFF7700, // Fuego Neón
        neonSecondary: 0x00F0FF,
        groundColor: 0x180806,
        groundLine: '#FF7700',
        skyTop: '#0e0408',
        skyMid: '#300f0a',
        skyBottom: '#ff4400',
        fogColor: 0x2e0c08,
        sunColors: ['#ffd455', '#ff3300', '#660022']
      }
    },
    {
      number: 8,
      name: 'Nivel 8: Voltage District',
      difficulty: 'Difícil',
      stars: 3,
      finishDistance: 1180,
      baseSpeed: 18.2,
      jumpForce: 12.8,
      gravity: 36.5,
      minObstacleGap: 11.2,
      palette: {
        neonMain: 0xFF007F, // Magenta Intenso
        neonSecondary: 0x00F0FF,
        groundColor: 0x180412,
        groundLine: '#FF007F',
        skyTop: '#0c020f',
        skyMid: '#2e0724',
        skyBottom: '#ff0088',
        fogColor: 0x2e0520,
        sunColors: ['#ff77cc', '#ff0066', '#4a0055']
      }
    },
    {
      number: 9,
      name: 'Nivel 9: Cyber Rooftops',
      difficulty: 'Difícil',
      stars: 3,
      finishDistance: 1250,
      baseSpeed: 18.8,
      jumpForce: 13.0,
      gravity: 37.0,
      minObstacleGap: 11.0,
      palette: {
        neonMain: 0xFF1493, // Rosa Eléctrico
        neonSecondary: 0x00E5FF,
        groundColor: 0x180517,
        groundLine: '#FF1493',
        skyTop: '#0d0214',
        skyMid: '#2d082e',
        skyBottom: '#ff20aa',
        fogColor: 0x2a0628,
        sunColors: ['#ff88ee', '#dd0077', '#440044']
      }
    },
    {
      number: 10,
      name: 'Nivel 10: Matrix Overdrive',
      difficulty: 'Difícil',
      stars: 3,
      finishDistance: 1320,
      baseSpeed: 19.5,
      jumpForce: 13.0,
      gravity: 37.0,
      minObstacleGap: 10.7,
      palette: {
        neonMain: 0xBA55D3, // Orquídea Neón
        neonSecondary: 0x00FF99,
        groundColor: 0x110518,
        groundLine: '#BA55D3',
        skyTop: '#0a0314',
        skyMid: '#220930',
        skyBottom: '#b040e0',
        fogColor: 0x22072e,
        sunColors: ['#e4a0ff', '#9922cc', '#330055']
      }
    },
    {
      number: 11,
      name: 'Nivel 11: Quantum Tunnel',
      difficulty: 'Difícil',
      stars: 3,
      finishDistance: 1400,
      baseSpeed: 20.2,
      jumpForce: 13.2,
      gravity: 37.5,
      minObstacleGap: 10.5,
      palette: {
        neonMain: 0x9933FF, // Púrpura Cuántico
        neonSecondary: 0x00F0FF,
        groundColor: 0x0c0418,
        groundLine: '#9933FF',
        skyTop: '#060212',
        skyMid: '#180730',
        skyBottom: '#8822ff',
        fogColor: 0x18052e,
        sunColors: ['#cc88ff', '#7711ee', '#220044']
      }
    },
    {
      number: 12,
      name: 'Nivel 12: Hologram Canyon',
      difficulty: 'Muy Difícil',
      stars: 4,
      finishDistance: 1480,
      baseSpeed: 20.8,
      jumpForce: 13.2,
      gravity: 37.5,
      minObstacleGap: 10.2,
      palette: {
        neonMain: 0x7B2CBF, // Violeta Profundo
        neonSecondary: 0xFF007F,
        groundColor: 0x090418,
        groundLine: '#7B2CBF',
        skyTop: '#04010f',
        skyMid: '#140528',
        skyBottom: '#6611cc',
        fogColor: 0x15032a,
        sunColors: ['#bb77ff', '#5500aa', '#1a0033']
      }
    },
    {
      number: 13,
      name: 'Nivel 13: Laser Facility',
      difficulty: 'Muy Difícil',
      stars: 4,
      finishDistance: 1550,
      baseSpeed: 21.5,
      jumpForce: 13.4,
      gravity: 38.0,
      minObstacleGap: 10.0,
      palette: {
        neonMain: 0xFF0055, // Láser Carmesí
        neonSecondary: 0x00F0FF,
        groundColor: 0x180408,
        groundLine: '#FF0055',
        skyTop: '#0e0104',
        skyMid: '#2d050f',
        skyBottom: '#ee0044',
        fogColor: 0x28030b,
        sunColors: ['#ff6688', '#cc0033', '#440011']
      }
    },
    {
      number: 14,
      name: 'Nivel 14: Dark Cybercity',
      difficulty: 'Muy Difícil',
      stars: 4,
      finishDistance: 1620,
      baseSpeed: 22.1,
      jumpForce: 13.4,
      gravity: 38.0,
      minObstacleGap: 9.8,
      palette: {
        neonMain: 0xE63946, // Rojo Sangre
        neonSecondary: 0xFFD700,
        groundColor: 0x170404,
        groundLine: '#E63946',
        skyTop: '#0b0101',
        skyMid: '#280404',
        skyBottom: '#c91825',
        fogColor: 0x240202,
        sunColors: ['#ff7777', '#aa0000', '#330000']
      }
    },
    {
      number: 15,
      name: 'Nivel 15: Overclock Sector',
      difficulty: 'Muy Difícil',
      stars: 4,
      finishDistance: 1700,
      baseSpeed: 22.8,
      jumpForce: 13.6,
      gravity: 38.5,
      minObstacleGap: 9.6,
      palette: {
        neonMain: 0xFF4800, // Naranja Lava
        neonSecondary: 0xFF007F,
        groundColor: 0x180803,
        groundLine: '#FF4800',
        skyTop: '#0d0301',
        skyMid: '#2c0c03',
        skyBottom: '#dd3300',
        fogColor: 0x280802,
        sunColors: ['#ffaa55', '#dd2200', '#550000']
      }
    },
    {
      number: 16,
      name: 'Nivel 16: Zero Gravity',
      difficulty: 'Extremo',
      stars: 5,
      finishDistance: 1780,
      baseSpeed: 23.5,
      jumpForce: 13.6,
      gravity: 38.5,
      minObstacleGap: 9.4,
      palette: {
        neonMain: 0x00FFF5, // Turquesa Cósmico
        neonSecondary: 0xFF2BD6,
        groundColor: 0x031816,
        groundLine: '#00FFF5',
        skyTop: '#010e0c',
        skyMid: '#042724',
        skyBottom: '#00ccb8',
        fogColor: 0x032822,
        sunColors: ['#88ffff', '#009999', '#003333']
      }
    },
    {
      number: 17,
      name: 'Nivel 17: Hyperdrive Lab',
      difficulty: 'Extremo',
      stars: 5,
      finishDistance: 1860,
      baseSpeed: 24.1,
      jumpForce: 13.8,
      gravity: 39.0,
      minObstacleGap: 9.2,
      palette: {
        neonMain: 0x05F1CD, // Esmeralda Cyber
        neonSecondary: 0x9933FF,
        groundColor: 0x031812,
        groundLine: '#05F1CD',
        skyTop: '#010c08',
        skyMid: '#05251a',
        skyBottom: '#04be9c',
        fogColor: 0x032418,
        sunColors: ['#77ffdd', '#008866', '#002818']
      }
    },
    {
      number: 18,
      name: 'Nivel 18: Vortex Matrix',
      difficulty: 'Extremo',
      stars: 5,
      finishDistance: 1950,
      baseSpeed: 24.8,
      jumpForce: 13.8,
      gravity: 39.0,
      minObstacleGap: 9.0,
      palette: {
        neonMain: 0xFFE600, // Amarillo Nuclear
        neonSecondary: 0xFF007F,
        groundColor: 0x171503,
        groundLine: '#FFE600',
        skyTop: '#0c0a01',
        skyMid: '#292404',
        skyBottom: '#d4aa00',
        fogColor: 0x252003,
        sunColors: ['#ffff77', '#cc8800', '#442200']
      }
    },
    {
      number: 19,
      name: 'Nivel 19: Singularity',
      difficulty: 'Demencial',
      stars: 5,
      finishDistance: 2050,
      baseSpeed: 25.4,
      jumpForce: 14.0,
      gravity: 39.5,
      minObstacleGap: 8.8,
      palette: {
        neonMain: 0xE0AAFF, // Lavanda Estelar
        neonSecondary: 0x00F0FF,
        groundColor: 0x120418,
        groundLine: '#E0AAFF',
        skyTop: '#0a020f',
        skyMid: '#240630',
        skyBottom: '#ba66ee',
        fogColor: 0x22052c,
        sunColors: ['#f0ccff', '#9933cc', '#220033']
      }
    },
    {
      number: 20,
      name: 'Nivel 20: Omega Neon (Final)',
      difficulty: 'Mítico',
      stars: 5,
      finishDistance: 2200,
      baseSpeed: 26.2,
      jumpForce: 14.2,
      gravity: 40.0,
      minObstacleGap: 8.5,
      palette: {
        neonMain: 0xFFFFFF, // Blanco Puro Diamante
        neonSecondary: 0x00F0FF,
        groundColor: 0x10101a,
        groundLine: '#FFFFFF',
        skyTop: '#050510',
        skyMid: '#151530',
        skyBottom: '#ffffff',
        fogColor: 0x151528,
        sunColors: ['#ffffff', '#00f0ff', '#ff007f']
      }
    }
  ];

  return {
    getLevelData(num) {
      return LEVELS_3D.find(l => l.number === num) || LEVELS_3D[0];
    },
    getAllLevels() {
      return LEVELS_3D;
    },
    TOTAL_LEVELS: LEVELS_3D.length
  };
})();
