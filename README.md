# 🎮 Runner Challenge: Neon Run

**Videojuego 2D Runner por Niveles con Multijugador en Pantalla Dividida (Split-Screen)**  
Proyecto Académico de Videojuegos 2D — HTML5 Canvas + Vanilla JavaScript + Web Audio API + Node.js (Express)

---

## 🚀 Cómo Ejecutar

### Requisitos
- **Node.js** v18 o superior — [Descargar](https://nodejs.org)
- Cualquier navegador web moderno (Chrome, Edge, Firefox, Brave)

### Pasos de Ejecución

```bash
# 1. Instalar dependencias (solo Express)
npm install

# 2. Iniciar el servidor local
npm start
# o: npm run dev

# 3. Abrir en el navegador
http://localhost:3000
```

> **Versión Portable:** También se incluye `runner_challenge_PORTABLE.html` que funciona de forma 100% autónoma simplemente haciendo doble clic en el archivo HTML sin necesidad de Node.js o servidor.

---

## 👥 Modo Multijugador: Pantalla Dividida (Split-Screen)

El multijugador local en 1 solo equipo ahora cuenta con **Pantalla Dividida (Split-Screen)** completa:
- **Cámaras Independientes:** Cada jugador tiene su propio Viewport y Canvas dedicado centrado en su corredor.
- **División Flexible:** Soporta división **Horizontal** (Arriba / Abajo, recomendada para runners 2D) y división **Vertical** (Izquierda / Derecha), alternable con 1 clic en cualquier momento.
- **Pistas Deterministas y Simétricas:** Se utiliza un generador de números pseudoaleatorios (PRNG) por semilla de nivel para garantizar que ambos corredores enfrenten exactamente la misma distribución de obstáculos y monedas.
- **Telemetría y Estado en Vivo:**
  - El divisor neón central calcula la distancia exacta en metros entre competidores (`P1 +24m`, `P2 +15m`, o `¡CUELLO A CUELLO!`).
  - Badges con posición en tiempo real (`1º LUGAR` / `2º LUGAR`).
  - Efecto de daño aislado (sacudida de cámara y glitch en pantalla solo afectan al jugador impactado).
  - Si un jugador adelanta o se acerca al otro, también puede ver la silueta de su rival en su propio carril.

---

## 🎮 Controles de Juego (En el Mismo Teclado)

| Jugador | Tecla | Acción |
|---------|-------|--------|
| **Player 1 (Cyan)** | `W` o `Espacio` | Saltar (Doble salto en el aire) |
| | `S` | Agacharse en el suelo / **Caída Rápida en el aire (Fast-Fall Slam)** |
| | `D` o `Shift Izquierdo` | Dash / Acelerón |
| **Player 2 (Magenta)** | `▲ (Flecha Arriba)` | Saltar (Doble salto en el aire) |
| | `▼ (Flecha Abajo)` | Agacharse en el suelo / **Caída Rápida en el aire (Fast-Fall Slam)** |
| | `▶ (Flecha Derecha)` o `Shift Derecho` | Dash / Acelerón |
| **General** | `P` o `Escape` | Pausar / Continuar |

---

## 📁 Estructura Limpia del Proyecto

Se depuraron dependencias innecesarias (como Socket.IO) y scripts obsoletos (`multiplayer.js`), dejando una arquitectura modular, pura y ligera:

```
GameRunnig/
├── server.js                        ← Servidor local estático Express (sin librerías innecesarias)
├── package.json                     ← Dependencias mínimas y limpias (express)
├── runner_challenge_PORTABLE.html   ← Versión empaquetada monolítica 100% offline
├── empaquetar.ps1                   ← Script PowerShell para generar el HTML portable
├── PRESENTACION.md                  ← Memoria técnica del proyecto para evaluación académica
├── README.md                        ← Documentación del proyecto
│
└── public/                          ← Frontend modular del juego
    ├── index.html                   ← Estructura HTML5 semántica y contenedor de Viewports
    │
    ├── css/
    │   └── styles.css               ← Sistema de diseño Synthwave/Cyberpunk, Split-Screen y HUDs
    │
    └── js/
        ├── main.js                  ← Punto de entrada e inicialización de módulos
        ├── game.js                  ← Motor principal, bucle 60FPS, gestión dual de viewports
        ├── player.js                ← Física del corredor, gravedad, saltos y renderizado
        ├── camera.js                ← Controlador de cámara suave (Lerp) y Screen Shake aislado
        ├── obstacles.js             ← Sistema determinista de obstáculos (Pinchos, Drones, Cajas)
        ├── powerups.js              ← Sistema de Power-Ups (Escudo, Imán, Turbo, Doble Salto)
        ├── coins.js                 ← Sistema determinista de monedas holográficas y atracción magnética
        ├── collision.js             ← Detección de colisiones por cajas AABB y tolerancia elástica
        ├── renderer.js              ← Fondo Parallax Synthwave, suelo de velocidad, speed lines y Meta
        ├── levels.js                ← Parámetros de 20 niveles balanceados con progresión
        ├── particles.js             ← Sistema de chispas, polvo, ondas de choque (shockwaves) y textos flotantes
        ├── score.js                 ← Persistencia local de récords y configuración (localStorage)
        ├── ui.js                    ← Gestión de pantallas, selector de pantalla dividida y resultados
        └── audio.js                 ← Sonido procedural sin archivos externos (Web Audio API)
```

---

## ⚡ Sistema de Power-Ups y "Game Juice"

| Power-Up / Efecto | Icono | Duración / Tipo | Efecto en Juego |
| :--- | :---: | :---: | :--- |
| **Escudo Cibernético** | 🛡️ | Permanente (1 golpe) | Absorbe 1 impacto sin perder vidas, detonando una onda expansiva. |
| **Imán de Monedas** | 🧲 | 8 segundos | Atrae magnéticamente las monedas en un radio de 280px hacia el corredor. |
| **Hiper-Turbo** | ⚡ | 4.5 segundos | Aumenta la velocidad +55%, otorga invencibilidad y destruye obstáculos al paso (+100 pts). |
| **Doble Salto** | 🦘 | 10 segundos | Permite realizar un segundo salto acrobático en el aire con impulso propulsor. |
| **Estela Neón (Trail)** | 🏃‍♂️ | Continuo | Rastro de siluetas de neón que se intensifica con el movimiento y el Turbo. |
| **Líneas de Velocidad** | 💨 | Dinámico | Líneas cinéticas de viento en pantalla a altas velocidades. |

---

## 🏗️ Arquitectura Técnica

```
┌─────────────────────────────────────────────────────────────────┐
│                       MOTOR DEL JUEGO (game.js)                 │
│                                                                 │
│   ┌───────────────────────────┐     ┌───────────────────────┐   │
│   │   Viewport 1 (Player 1)   │     │ Viewport 2 (Player 2) │   │
│   │                           │     │                       │   │
│   │  • Canvas: canvas-p1      │     │  • Canvas: canvas-p2  │   │
│   │  • Cámara: camera1        │     │  • Cámara: camera2    │   │
│   │  • Renderer: renderer1    │     │  • Renderer: renderer2│   │
│   │  • Pista: obstacles1      │     │  • Pista: obstacles2  │   │
│   │  • Monedas: coinSystem1   │     │  • Monedas: coinSystem2│  │
│   └─────────────┬─────────────┘     └───────────┬───────────┘   │
│                 │                               │               │
│                 └───────────────┬───────────────┘               │
│                                 ▼                               │
│                   Telemetría y Divisor Neón                     │
│               (Diferencia de metros, Ranking 1º/2º)             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔊 Sonido Procedural (Web Audio API)

No requiere archivos de audio `.mp3` ni `.wav`. Todos los efectos y la música se sintetizan en tiempo real mediante la **Web Audio API**:
- **Salto:** Oscilador de frecuencia modulada ascendente.
- **Moneda:** Doble tono de alta frecuencia armónica.
- **Golpe:** Generador de onda diente de sierra con caída rápida.
- **Meta:** Fanfarria armónica pentatónica.
- **Música:** Sintetizador Synthwave procedural con bajos modulados.

---

## 💾 Persistencia de Datos (localStorage)

El progreso, mejores marcas por nivel y configuración de audio se almacenan automáticamente en el navegador bajo la clave `runnerChallenge_save`.

---

*Runner Challenge: Neon Run — Proyecto Universitario de Videojuegos 2D*
