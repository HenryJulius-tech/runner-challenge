# 🎮 GUÍA DE EXPOSICIÓN: RUNNER CHALLENGE (AVANCE 1 - PROTOTIPO)

Esta guía está diseñada específicamente para presentar el **avance / prototipo inicial** del proyecto frente a tu profesor de forma clara, sencilla y sin tecnicismos innecesarios.

---

## 1. Nombre del Proyecto
**Runner Challenge — Prototipo Funcional (Avance 1)**  
*(Videojuego 2D Runner desarrollado con JavaScript Vanilla y Canvas)*

---

## 2. Objetivo de esta Entrega (Avance 1)
El objetivo de este primer hito es presentar la **arquitectura base y el prototipo jugable** del videojuego, demostrando que las mecánicas fundamentales están resueltas:
1. **Bucle de juego (Game Loop a 60 FPS):** Lectura de entradas, actualización de físicas y renderizado continuo.
2. **Físicas básicas de plataforma:** Gravedad, aceleración vertical, salto y detección del suelo.
3. **Mecánicas de juego:** Desplazamiento horizontal continuo, esquivar obstáculos en el suelo y recolección de monedas.
4. **Detección de colisiones:** Algoritmo AABB para verificar choques contra obstáculos y captura de monedas.
5. **Prototipo de 2 Jugadores (Local):** Demostración de dos corredores compitiendo en el mismo teclado y pantalla.
6. **Condiciones de fin:** Contador de vidas, Game Over al perderlas y llegada a la Meta.

---

## 3. Tecnologías Utilizadas (100% Reales del Proyecto)
* **HTML5:** Define el lienzo (`<canvas>`) y las capas de interfaz básicas (menú, HUD y resultados).
* **JavaScript (ES6+ Vanilla):** Toda la lógica del juego escrita desde cero sin librerías externas ni motores pesados (sin Phaser ni Unity).
  * **Clases (POO):** `Player`, `ObstacleSystem`, `CoinSystem`, `Renderer`, `CameraController`.
  * **Módulos:** `Game` (motor central), `CollisionSystem` (colisiones), `ScoreManager` (puntos), `LevelConfig` (niveles).
* **HTML5 Canvas 2D API:** Renderizado de gráficos en tiempo real mediante `requestAnimationFrame`.
* **Web Audio API:** Generación de sonidos simples mediante osciladores nativos (sin necesidad de cargar archivos de audio pesados).
* **localStorage:** Para guardar el mejor puntaje en el navegador.
* **Node.js & Express (`server.js`):** Servidor local mínimo para correr el proyecto offline en `http://localhost:3000`.

---

## 4. Explicación Sencilla de Cómo Funciona el Prototipo
Se le puede explicar al profesor en 4 pasos muy fáciles:

1. **El Bucle Principal (`gameLoop` en `game.js`):**  
   Se ejecuta 60 veces por segundo usando `requestAnimationFrame`. En cada cuadro realiza dos tareas:
   * **`update()`:** Lee las teclas presionadas, mueve al jugador, aplica gravedad, avanza los obstáculos y verifica colisiones.
   * **`draw()`:** Borra el canvas y dibuja el fondo, la meta, las monedas, los obstáculos y los personajes.
2. **El Salto y la Gravedad:**  
   El personaje tiene una coordenada `y` y una velocidad vertical `vy`. En cada frame sumamos la gravedad a la velocidad (`vy += gravity`). Al saltar, simplemente le damos un impulso negativo (`vy = -14`), haciendo que suba y luego caiga naturalmente hasta tocar el suelo.
3. **Generación de Obstáculos y Monedas:**  
   A medida que el jugador avanza por el eje X (`worldX`), el juego crea obstáculos y monedas por delante de la pantalla respetando una distancia mínima para que siempre sea posible saltarlos.
4. **Colisiones AABB:**  
   Comparamos las cajas de colisión (rectángulos) del jugador con las de los obstáculos. Si se tocan, el jugador pierde 1 vida. Si toca una moneda, suma 50 puntos.

---

## 5. Explicación de los Archivos Principales
| Archivo | Qué hace (explicación breve) |
| :--- | :--- |
| `server.js` | Servidor Express mínimo que entrega los archivos del juego localmente sin requerir internet. |
| `public/index.html` | Contiene el `<canvas>` donde se dibuja el juego y los paneles del HUD (vidas, monedas, puntuación). |
| `public/js/game.js` | **El núcleo del juego:** Administra el bucle a 60 FPS, los controles del teclado y las reglas de victoria/derrota. |
| `public/js/player.js` | **La entidad del jugador:** Contiene la posición, el salto, la gravedad, el agacharse y el dibujado del corredor. |
| `public/js/collision.js` | **Detección de colisiones:** Función matemática que comprueba si dos rectángulos se superponen (AABB). |
| `public/js/obstacles.js` | **Obstáculos:** Crea bloques y pinchos adelante en la pista y los elimina cuando quedan atrás. |
| `public/js/powerups.js` | **Power-Ups:** Administra la aparición de cápsulas de Escudo, Imán, Turbo y Doble Salto. |
| `public/js/coins.js` | **Monedas:** Genera monedas doradas en línea o arco y aplica atracción magnética con el Imán. |
| `public/js/levels.js` | **Niveles:** Define 20 niveles balanceados con progresión milimétrica de velocidad y separación. |
| `public/js/particles.js` | **Partículas & Juice:** Genera chispas, polvo al aterrizar, ondas de choque y textos flotantes. |
| `public/js/score.js` | **Puntuación:** Suma puntos por distancia y monedas recogidas, guardando el récord en `localStorage`. |
| `public/js/camera.js` | **Cámara Dinámica:** Controla el seguimiento suave e independiente para cada viewport con Screen Shake. |
| `public/js/renderer.js` | **Escenario:** Dibuja el fondo Synthwave, estrellas con paralaje, líneas de velocidad y el pórtico de Meta. |

---

## 6. Las Funciones Más Importantes Explicadas de Forma Didáctica

### 1. `jump()` en `player.js`
```javascript
jump() {
  if (this.onGround && !this.isDucking) {
    this.vy = this.jumpForce; // Impulso hacia arriba (ej: -14)
    this.onGround = false;
  }
}
```
* **Explicación:** *"Profesor, el salto no mueve directamente la posición `y`, sino que cambia la velocidad `vy` a un valor negativo hacia arriba. La gravedad se encarga en los siguientes cuadros de frenar al jugador y devolverlo al piso."*

### 2. `update()` en `player.js`
```javascript
this.worldX += this.currentSpeed; // Avanza hacia la derecha
this.vy += this.gravity;          // La gravedad acelera la caída
this.y += this.vy;                // Modifica la altura

if (this.y >= targetGroundY) {    // Si llega al suelo, frena
  this.y = targetGroundY;
  this.vy = 0;
  this.onGround = true;
}
```
* **Explicación:** *"En cada cuadro actualizamos posición horizontal y vertical. Si la posición vertical supera el nivel del suelo, corregimos `y` al piso y ponemos la velocidad vertical en cero."*

### 3. `checkAABB()` en `collision.js`
```javascript
function checkAABB(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}
```
* **Explicación:** *"Es la fórmula clásica de colisión entre dos rectángulos alineados. Comprueba si los límites izquierdo, derecho, superior e inferior de ambos cuerpos se cruzan a la vez."*

### 4. `_handleCollisions()` en `game.js`
* **Explicación:** *"Revisa si el jugador tocó una moneda para sumarle puntos, o si tocó un obstáculo para restarle una vida (`player.takeDamage()`). Si las vidas llegan a 0, activa el Game Over."*

---

## 7. Qué Aprendí Haciendo este Prototipo
1. **Cómo estructurar un Game Loop:** Entendí la separación fundamental entre lógica (`update`) y presentación visual (`draw`).
2. **Matemáticas aplicadas a videojuegos:** Cómo la aceleración y la gravedad se calculan sumando vectores en cada cuadro.
3. **Manejo de estados:** Cómo transicionar limpiamente entre Menú, Jugando, Pausa, Derrota y Nivel Completado.
4. **Optimización temprana:** Descartar del arreglo de memoria los obstáculos y monedas que ya salieron de la pantalla para no saturar el navegador.

---

## 8. Próximos Pasos (Para la Entrega Final)
Si el profesor pregunta: *"¿Qué le falta o qué vas a agregar para la versión final?"*, dile:
1. **Power-ups:** Agregar imán de monedas y escudo de invencibilidad temporal.
2. **Más tipos de obstáculos:** Añadir plataformas móviles donde el jugador pueda subirse.
3. **Mayor variedad visual:** Añadir sprites o animaciones más detalladas para los corredores.
4. **Efectos de sonido mejorados:** Pulir los efectos sonoros y agregar música de fondo variada por nivel.

---

## 9. Preguntas Típicas del Profesor sobre este Avance

**P1: ¿Por qué decidiste hacer un prototipo con Canvas en vez de usar un framework como Phaser?**  
*R:* *"Porque para este primer avance quería entender a fondo los fundamentos: cómo funciona un bucle de juego manual con `requestAnimationFrame`, el cálculo matemático de gravedad y las colisiones AABB desde cero, sin depender de librerías que oculten esa lógica."*

**P2: ¿Cómo funciona el modo de 2 jugadores en este avance?**  
*R:* *"Es multijugador local con **pantalla dividida (Split-Screen)** en el mismo computador. Implementamos dos viewports y cámaras independientes: cada jugador tiene su propia pantalla dedicada (pudiendo dividirse horizontal o verticalmente), con pistas simétricas deterministas y telemetría de carrera en tiempo real (metros de ventaja, ranking 1º/2º y divisor neón dinámico). El Player 1 usa **W, S, D** y el Player 2 usa las **Flechas direccionales**."*

**P3: ¿Cómo sabe el juego cuándo termina el nivel?**  
*R:* *"Cada nivel tiene una distancia fija en píxeles (`levelLength`, por ejemplo 2600px en el Nivel 1). Cuando la coordenada `worldX` del jugador alcanza ese valor, cruza la meta, se otorgan puntos adicionales y se muestra la pantalla de nivel completado."*

**P4: ¿Se pierden los récords al refrescar la página?**  
*R:* *"No, usamos la API nativa de `localStorage` en `score.js` para persistir la puntuación más alta y el mejor tiempo de cada nivel en el navegador."*

---

## 10. Guion de 2 Minutos para la Exposición (Fácil de Memorizar)

> *"Buenos días, profesor. Hoy vengo a presentar el **primer avance de mi proyecto: Runner Challenge**, un prototipo funcional de videojuego 2D desarrollado con JavaScript y HTML5 Canvas.*
>
> *Para esta primera entrega, mi objetivo principal fue construir las mecánicas fundamentales del juego desde cero, sin utilizar motores prefabricados.*
>
> *El prototipo cuenta con:*
> 1. *Un **bucle de juego a 60 cuadros por segundo** que sincroniza las entradas del teclado con la física y el renderizado.*
> 2. *Un **motor de físicas en `player.js`** con gravedad, salto realista, doble salto y **caída rápida en picada al agacharse en el aire (fast-fall)** para esquivar obstáculos con precisión.*
> 3. *Un **sistema de obstáculos y monedas procedurales**, calibrados con márgenes matemáticos exactos para garantizar que cada obstáculo sea 100% pasable.*
> 4. *Detección de **colisiones AABB en `collision.js`** que gestiona el daño de vidas y la recolección de puntos.*
> 5. *Y una implementación completa de **multijugador local en pantalla dividida (Split-Screen)**, donde cada jugador tiene su propia cámara, carril y visión independiente: Player 1 con W, S, D y Player 2 con las flechas direccionales, con telemetría en vivo y divisor neón.*
>
> *Diseñé un repertorio de **20 niveles completos** con progresión balanceada de velocidad, paletas Synthwave únicas y una meta al final de cada pista.*
>
> *A continuación, le muestro una partida rápida para que pueda observar el movimiento, los saltos, la pantalla dividida y las colisiones en funcionamiento."*
