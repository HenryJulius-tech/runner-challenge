/**
 * neon3d_world.js — Generación del Mundo, Ciudad Cyberpunk, Obstáculos y Coleccionables 3D
 * 
 * Extraído, modularizado y enriquecido a partir de neon_run.html:
 *  - Texturas procedurales generadas en Canvas (Cielo gradiente, Pista Synthwave, Ventanas de Rascacielos, Sol Retro)
 *  - Adaptación cromática dinámica para los 20 niveles
 *  - Autopista con carriles de neón y guardarraíles luminosos
 *  - Rascacielos con ventanas iluminadas y letreros en azoteas
 *  - Sol Synthwave gigante con franjas horizontales y campo de estrellas
 *  - Portal monumental de META con banner luminoso
 *  - Fabricador de Obstáculos 3D: Barras, Pilares, Láseres Elevados y Drones Flotantes
 *  - Fabricador de Coleccionables: Monedas Doradas 3D y 4 Power-Ups (Escudo, Imán, Turbo, Doble Salto)
 */

const Neon3DWorld = (() => {
  const CY = 0x2ff3ff;
  const MG = 0xff2bd6;

  function gradTex(stops, h = 256) {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = h;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, h);
    stops.forEach(s => gr.addColorStop(s[0], s[1]));
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, h);
    return new THREE.CanvasTexture(c);
  }

  function gridTex(lineColorHex = '#2ff3ff', groundColorHex = '#070420') {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = groundColorHex;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = lineColorHex;
    g.lineWidth = 4;
    g.globalAlpha = 0.85;
    g.strokeRect(0, 0, 128, 128);
    g.globalAlpha = 0.25;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(64, 0);
    g.lineTo(64, 128);
    g.stroke();

    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 130);
    t.anisotropy = 4;
    return t;
  }

  function winTex(col) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#0a0620';
    g.fillRect(0, 0, 64, 128);
    for (let y = 6; y < 128; y += 12) {
      for (let x = 6; x < 64; x += 12) {
        if (Math.random() < 0.45) {
          g.fillStyle = col[(Math.random() * col.length) | 0];
          g.globalAlpha = 0.5 + Math.random() * 0.5;
          g.fillRect(x, y, 6, 7);
        }
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  function metaTex() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 96;
    const g = c.getContext('2d');
    g.fillStyle = '#10052a';
    g.fillRect(0, 0, 512, 96);
    g.font = '900 72px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillStyle = '#fff';
    g.shadowColor = '#ff2bd6';
    g.shadowBlur = 24;
    g.fillText('META', 256, 74);
    return new THREE.CanvasTexture(c);
  }

  function sunTex(colors = ['#ffe45c', '#ff5fa8', '#a020f0']) {
    const sunC = document.createElement('canvas');
    sunC.width = sunC.height = 256;
    const g = sunC.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, colors[0] || '#ffe45c');
    gr.addColorStop(0.5, colors[1] || '#ff5fa8');
    gr.addColorStop(1, colors[2] || '#a020f0');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(128, 128, 126, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 9; i++) {
      g.fillRect(0, 120 + i * 15, 256, 2 + i * 1.6);
    }
    return new THREE.CanvasTexture(sunC);
  }

  function box(w, h, d, m) {
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  }

  function B(c, o = {}) {
    return new THREE.MeshBasicMaterial(Object.assign({ color: c }, o));
  }

  function S(c, o = {}) {
    return new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.45, metalness: 0.5 }, o));
  }

  /**
   * Construye el entorno adaptado a la paleta del nivel
   */
  function build({ scene, finishDistance = 700, palette = null }) {
    const envGroup = new THREE.Group();
    const pal = palette || {
      neonMain: CY,
      neonSecondary: MG,
      groundColor: 0x070420,
      groundLine: '#2ff3ff',
      skyTop: '#03020f',
      skyMid: '#1a0a3d',
      skyBottom: '#ff3fa0',
      fogColor: 0x2a0d4a,
      sunColors: ['#ffe45c', '#ff5fa8', '#a020f0']
    };

    // 1. Cielo Gradiente y Niebla
    scene.background = gradTex([[0, pal.skyTop], [0.55, pal.skyMid], [1, pal.skyBottom]]);
    scene.fog = new THREE.Fog(pal.fogColor, 40, 240);

    // 2. Luces
    const hemiLight = new THREE.HemisphereLight(pal.neonMain, 0x1a0a30, 0.9);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(pal.neonSecondary, 0.6);
    dirLight.position.set(-5, 10, 6);
    scene.add(dirLight);

    const playerLight = new THREE.PointLight(pal.neonMain, 1.4, 16);
    scene.add(playerLight);

    // 3. Pista Synthwave con Textura Neón
    const track = new THREE.Mesh(new THREE.PlaneGeometry(10, 2400), B(0xffffff, { map: gridTex(pal.groundLine, '#070420') }));
    track.rotation.x = -Math.PI / 2;
    track.position.set(0, 0, -1000);
    envGroup.add(track);

    // 4. Suelo exterior infinito
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 2600), B(0x05020f));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.05, -1000);
    envGroup.add(ground);

    // 5. Guardarraíles de Neón en los bordes
    for (const x of [-5.15, 5.15]) {
      const col = x < 0 ? pal.neonMain : pal.neonSecondary;
      const r = box(0.18, 0.18, 2400, B(col));
      r.position.set(x, 0.09, -1000);
      envGroup.add(r);
    }

    // 6. Líneas discontinuas en el centro de la pista
    const lm = B(pal.neonMain);
    for (let z = 10; z > -finishDistance - 80; z -= 7) {
      const l = box(0.12, 0.02, 2.2, lm);
      l.position.set(0, 0.02, z);
      envGroup.add(l);
    }

    // 7. Ciudad Cyberpunk (Rascacielos con ventanas iluminadas)
    const palettes = [
      ['#2ff3ff', '#7be7ff'],
      ['#ff2bd6', '#ff8fe9'],
      ['#ffd54a', '#ff9a3c']
    ];
    const bm = [];
    for (const p of palettes) {
      for (const h of [14, 26, 42]) {
        const t = winTex(p);
        t.repeat.set(2, h / 9);
        bm.push({ m: B(0xffffff, { map: t }), h });
      }
    }
    const signs = [B(pal.neonMain), B(pal.neonSecondary), B(0xffd54a)];

    for (let z = 40; z > -finishDistance - 140; z -= 14) {
      for (const side of [-1, 1]) {
        const k = bm[(Math.random() * bm.length) | 0];
        const w = 6 + Math.random() * 5;
        const x = side * (11 + Math.random() * 16);

        const b = new THREE.Mesh(new THREE.BoxGeometry(w, k.h, w), k.m);
        b.position.set(x, k.h / 2, z + Math.random() * 6);
        envGroup.add(b);

        const s = box(w + 0.2, 0.35, w + 0.2, signs[(Math.random() * 3) | 0]);
        s.position.set(x, k.h + 0.17, b.position.z);
        envGroup.add(s);
      }
    }

    // 8. Sol Retro Synthwave
    const sun = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 160),
      B(0xffffff, { map: sunTex(pal.sunColors), transparent: true, fog: false })
    );
    envGroup.add(sun);

    // 9. Campo de estrellas
    const sg = new Float32Array(1200);
    for (let i = 0; i < 400; i++) {
      const a = Math.random() * 6.28;
      const e = Math.random() * 1.2;
      sg[i * 3] = Math.cos(a) * 320 * Math.cos(e * 0.6);
      sg[i * 3 + 1] = 40 + Math.sin(e) * 160;
      sg[i * 3 + 2] = -Math.abs(Math.sin(a)) * 320 - 20;
    }
    const starsG = new THREE.BufferGeometry();
    starsG.setAttribute('position', new THREE.BufferAttribute(sg, 3));
    const stars = new THREE.Points(
      starsG,
      new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, fog: false })
    );
    envGroup.add(stars);

    // 10. Meta del Nivel
    const goalGroup = new THREE.Group();
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(10.6, 2), B(0xffffff, { map: metaTex(), side: THREE.DoubleSide }));
    ban.position.set(0, 6, -finishDistance);
    goalGroup.add(ban);

    for (const x of [-5.3, 5.3]) {
      const p = box(0.4, 7, 0.4, B(pal.neonMain));
      p.position.set(x, 3.5, -finishDistance);
      goalGroup.add(p);
    }
    const fb = box(10.6, 0.25, 0.4, B(pal.neonSecondary));
    fb.position.set(0, 7.1, -finishDistance);
    goalGroup.add(fb);

    const fl = box(10, 0.03, 1.2, B(0xffffff));
    fl.position.set(0, 0.03, -finishDistance);
    goalGroup.add(fl);
    envGroup.add(goalGroup);

    scene.add(envGroup);

    return {
      envGroup,
      sun,
      stars,
      playerLight,
      goalGroup
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  // FABRICADORES DE COLECCIONABLES Y OBSTÁCULOS
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Moneda dorada 3D rotatoria
   */
  function createCoinMesh() {
    const coinG = new THREE.CylinderGeometry(0.4, 0.4, 0.08, 16);
    coinG.rotateX(Math.PI / 2);
    const coinM = new THREE.MeshStandardMaterial({
      color: 0xFFD700,
      emissive: 0x664400,
      metalness: 0.9,
      roughness: 0.2
    });
    return new THREE.Mesh(coinG, coinM);
  }

  /**
   * Power-Ups 3D con formas poliédricas e iconos de neón
   */
  function createPowerUpMesh(type) {
    const g = new THREE.Group();
    let col = CY;
    if (type === 'MAGNET') col = 0xFFD700;
    if (type === 'TURBO') col = 0xFF3366;
    if (type === 'DOUBLE_JUMP') col = 0x00FF88;

    const coreGeo = new THREE.IcosahedronGeometry(0.42, 1);
    const coreMat = B(col);
    g.add(new THREE.Mesh(coreGeo, coreMat));

    const ringGeo = new THREE.TorusGeometry(0.72, 0.04, 8, 24);
    const ringMat = B(col);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 3;
    g.add(ring);

    g.userData.ring = ring;
    g.userData.type = type;
    return g;
  }

  /**
   * Láser elevado: se esquiva deslizándose por debajo (agacharse / slide)
   */
  function createLaserObstacle(x, d, width = 6.0) {
    const g = new THREE.Group();
    const pylonGeo = new THREE.CylinderGeometry(0.2, 0.25, 2.4, 8);
    const pylonMat = S(0x1a1236, { metalness: 0.8 });

    // Postes laterales
    const p1 = new THREE.Mesh(pylonGeo, pylonMat);
    p1.position.set(-width / 2, 1.2, 0);
    g.add(p1);

    const p2 = new THREE.Mesh(pylonGeo, pylonMat);
    p2.position.set(width / 2, 1.2, 0);
    g.add(p2);

    // Haz láser elevado a 1.25m (agachado pasa a 0.6m sin tocar)
    const beamGeo = new THREE.CylinderGeometry(0.08, 0.08, width, 8);
    beamGeo.rotateZ(Math.PI / 2);
    const beamMat = B(CY);
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 1.25;
    g.add(beam);

    g.position.set(x, 0, -d);
    return {
      mesh: g,
      x,
      z: -d,
      hw: width / 2,
      hd: 0.35,
      h: 2.2,
      minH: 0.95, // Altura mínima de colisión (por debajo estás a salvo si estás agachado)
      isLaser: true,
      dying: 0
    };
  }

  /**
   * Dron patrullero volador que oscila suavemente en el aire
   */
  function createDroneObstacle(x, d) {
    const g = new THREE.Group();
    const bodyGeo = new THREE.SphereGeometry(0.55, 14, 12);
    bodyGeo.scale(1.2, 0.6, 1.0);
    const bodyMat = S(0x15112e, { metalness: 0.9, roughness: 0.2 });
    g.add(new THREE.Mesh(bodyGeo, bodyMat));

    // Ojo escáner de neón
    const eyeGeo = new THREE.SphereGeometry(0.2, 10, 10);
    const eye = new THREE.Mesh(eyeGeo, B(0xFF0033));
    eye.position.set(0, 0, 0.55);
    g.add(eye);

    // Hélice / Rotor superior
    const rotorGeo = new THREE.BoxGeometry(1.8, 0.04, 0.2);
    const rotor = new THREE.Mesh(rotorGeo, B(0xFFAA00));
    rotor.position.y = 0.42;
    g.add(rotor);
    g.userData.rotor = rotor;

    g.position.set(x, 1.8, -d);
    return {
      mesh: g,
      x,
      z: -d,
      hw: 0.75,
      hd: 0.75,
      h: 2.5,
      minH: 1.0,
      isDrone: true,
      phase: Math.random() * Math.PI * 2,
      dying: 0
    };
  }

  return {
    build,
    createCoinMesh,
    createPowerUpMesh,
    createLaserObstacle,
    createDroneObstacle,
    CY,
    MG
  };
})();
