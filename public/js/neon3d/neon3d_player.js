/**
 * neon3d_player.js — Modelo y Animación del Corredor 3D Cyberpunk
 * 
 * Extraído, estructurado y enriquecido a partir de neon_run.html:
 *  - Rigging 3D fiel estilo Tron Legacy (traje negro reflectante con líneas de luz, casco y disco en la espalda)
 *  - Animaciones procedurales ampliadas:
 *     1. Carrera atlética con braceo y zancada dinámica
 *     2. Agacharse / Deslizamiento en el suelo (Slide) con postura baja
 *     3. Caída rápida en picada (Fast-Fall Slam) con postura aerodinámica
 *     4. Salto normal y giro acrobático de Doble Salto en el aire
 *     5. Aceleración con llamas de turbo / propulsores
 *     6. Celebración triunfal al cruzar la meta
 *  - Efectos visuales de Power-Ups integrados:
 *     * 🛡️ Escudo de energía icosaédrico translúcido
 *     * 🧲 Anillo magnético dorado giratorio en la cintura
 *     * ⚡ Llamas propulsoras de Hiper-Turbo
 *  - Proyectil de disco de ataque destructor
 */

const Neon3DPlayer = (() => {
  const CY = 0x2ff3ff;
  const MG = 0xff2bd6;

  function S(c, o = {}) {
    return new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.45, metalness: 0.5 }, o));
  }

  function B(c, o = {}) {
    return new THREE.MeshBasicMaterial(Object.assign({ color: c }, o));
  }

  function box(w, h, d, m) {
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  }

  function cyl(a, b, l, m) {
    return new THREE.Mesh(new THREE.CylinderGeometry(a, b, l, 14), m);
  }

  function sph(r, m, sx = 1, sy = 1, sz = 1) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m);
    s.scale.set(sx, sy, sz);
    return s;
  }

  function at(o, x, y, z) {
    o.position.set(x, y, z);
    return o;
  }

  function ln(par, w, h, d, x, y, z, rz, color = CY) {
    const m = box(w, h, d, B(color));
    m.position.set(x, y, z);
    m.rotation.z = rz || 0;
    par.add(m);
    return m;
  }

  function damp(o, a, t, dt, k) {
    o.rotation[a] += (t - o.rotation[a]) * Math.min(1, dt * k);
  }

  function limb(par, x, y, L1, a1, b1, L2, a2, b2, sx, sz, end, suit, glowC) {
    const up = new THREE.Group();
    at(up, x, y, 0);
    par.add(up);
    up.add(at(cyl(a1, b1, L1, suit), 0, -L1 / 2, 0));
    up.add(at(sph(b1 * 1.05, suit), 0, -L1, 0));

    const lo = new THREE.Group();
    at(lo, 0, -L1, 0);
    up.add(lo);
    lo.add(at(cyl(a2, b2, L2, suit), 0, -L2 / 2, 0));

    const o1 = (a1 + b1) / 2 + 0.006;
    const o2 = (a2 + b2) / 2 + 0.006;
    ln(up, 0.022, L1 * 0.85, 0.022, sx * o1, -L1 / 2, sz * o1, 0, glowC);
    ln(lo, 0.022, L2 * 0.85, 0.022, sx * o2, -L2 / 2, sz * o2, 0, glowC);

    if (end) lo.add(at(end, 0, -L2, 0));
    return { up, lo };
  }

  /**
   * Crea el personaje 3D completo con todas sus articulaciones y efectos visuales
   */
  function create(scene, options = {}) {
    const suit = S(0x07080f, { roughness: 0.22, metalness: 0.85 });
    const skinM = S(0xd9a58a, { roughness: 0.6, metalness: 0 });
    const glowC = options.glowColor || CY;
    const glowMat = B(glowC);

    const player = new THREE.Group();
    scene.add(player);

    const torso = new THREE.Group();
    torso.position.y = 1.05;
    player.add(torso);

    player.add(at(sph(0.2, suit, 1.2, 0.75, 0.9), 0, 1.05, 0));
    const chest = cyl(0.33, 0.2, 0.64, suit);
    chest.scale.z = 0.6;
    torso.add(at(chest, 0, 0.5, 0));

    const waist = cyl(0.2, 0.19, 0.24, suit);
    waist.scale.z = 0.8;
    torso.add(at(waist, 0, 0.1, 0));

    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.018, 8, 24), glowMat);
    belt.rotation.x = Math.PI / 2;
    belt.scale.set(1, 0.8, 1);
    torso.add(at(belt, 0, 0.18, 0));

    for (const s of [-1, 1]) {
      torso.add(at(sph(0.1, suit, 1, 1, 0.9), s * 0.36, 0.74, 0));
      ln(torso, 0.025, 0.45, 0.02, s * 0.245, 0.42, 0.09, 0, glowC);
      ln(torso, 0.2, 0.025, 0.02, s * 0.2, 0.84, 0.1, s * -0.25, glowC);
    }
    ln(torso, 0.04, 0.5, 0.02, 0, 0.5, -0.17, 0, glowC);

    torso.add(at(cyl(0.065, 0.08, 0.16, skinM), 0, 0.88, 0));
    torso.add(at(cyl(0.1, 0.16, 0.08, suit), 0, 0.83, 0));

    const head = new THREE.Group();
    torso.add(at(head, 0, 1.04, 0));
    head.add(at(sph(0.16, skinM, 0.88, 1.12, 1), 0, 0, -0.01));

    const hm = new THREE.Mesh(new THREE.SphereGeometry(0.185, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), suit);
    hm.scale.y = 1.1;
    head.add(at(hm, 0, 0.02, 0));

    const hb = new THREE.Mesh(new THREE.SphereGeometry(0.186, 18, 12, 0, Math.PI, 0, Math.PI * 0.88), suit);
    hb.scale.y = 1.1;
    head.add(at(hb, 0, 0.02, 0));

    const t1 = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.008, 6, 28, Math.PI), glowMat);
    t1.rotation.y = Math.PI / 2;
    head.add(at(t1, 0, 0.02, 0));

    const t2 = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.007, 6, 28, Math.PI), glowMat);
    t2.rotation.x = Math.PI / 2;
    head.add(at(t2, 0, -0.02, 0));

    // Disco de neón en la espalda (Tron Legacy)
    const disc = new THREE.Group();
    torso.add(at(disc, 0, 0.5, 0.19));
    const d1 = cyl(0.3, 0.3, 0.03, suit);
    d1.rotation.x = Math.PI / 2;
    disc.add(d1);
    disc.add(
      at(new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.02, 8, 32), glowMat), 0, 0, 0.02),
      at(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 8, 28), glowMat), 0, 0, 0.02)
    );

    // Llamas propulsoras de Hiper-Turbo en la espalda
    const flameGeo = new THREE.ConeGeometry(0.14, 0.7, 8);
    flameGeo.rotateX(Math.PI);
    const flameMat = B(0xFFAA00);
    const flameL = new THREE.Mesh(flameGeo, flameMat);
    flameL.position.set(-0.2, 0.35, 0.28);
    flameL.visible = false;
    torso.add(flameL);

    const flameR = new THREE.Mesh(flameGeo, flameMat);
    flameR.position.set(0.2, 0.35, 0.28);
    flameR.visible = false;
    torso.add(flameR);

    // Brazos articulados
    const armL = limb(torso, -0.41, 0.72, 0.34, 0.075, 0.06, 0.32, 0.06, 0.045, -1, 0, sph(0.055, suit, 1, 1.3, 0.8), suit, glowC);
    const armR = limb(torso, 0.41, 0.72, 0.34, 0.075, 0.06, 0.32, 0.06, 0.045, 1, 0, sph(0.055, suit, 1, 1.3, 0.8), suit, glowC);

    // Piernas articuladas
    const legL = limb(player, -0.13, 1.05, 0.5, 0.115, 0.085, 0.5, 0.08, 0.055, 0, 1, null, suit, glowC);
    const legR = limb(player, 0.13, 1.05, 0.5, 0.115, 0.085, 0.5, 0.08, 0.055, 0, 1, null, suit, glowC);

    for (const l of [legL, legR]) {
      l.lo.add(at(box(0.12, 0.1, 0.3, suit), 0, -0.5, -0.07));
      l.lo.add(at(box(0.125, 0.02, 0.3, glowMat), 0, -0.545, -0.07));
    }

    // Escudo de energía (Icosaedro wireframe + Esfera interior translúcida)
    const shieldM = new THREE.Mesh(new THREE.IcosahedronGeometry(1.45, 2), B(CY, { wireframe: true, transparent: true, opacity: 0.55 }));
    const shieldS = new THREE.Mesh(new THREE.SphereGeometry(1.4, 20, 16), B(CY, { transparent: true, opacity: 0.12, depthWrite: false }));
    shieldM.visible = shieldS.visible = false;
    scene.add(shieldM, shieldS);

    // Anillo magnético de monedas
    const magnetRingGeo = new THREE.TorusGeometry(1.25, 0.04, 8, 32);
    magnetRingGeo.rotateX(Math.PI / 2);
    const magnetRingMesh = new THREE.Mesh(magnetRingGeo, B(0xFFD700));
    magnetRingMesh.position.y = 1.1;
    magnetRingMesh.visible = false;
    player.add(magnetRingMesh);

    return {
      root: player,
      torso,
      armL,
      armR,
      legL,
      legR,
      flameL,
      flameR,
      shieldM,
      shieldS,
      magnetRingMesh,
      suit,
      glowMat
    };
  }

  /**
   * Anima proceduralmente el modelo del personaje con soporte de todas las mecánicas 2D
   */
  function animate(rig, dt, grounded, speed, phase, boost, isWin, options = {}) {
    const k = 18;
    const p = phase;
    const pi = Math.PI;
    const isDucking = options.isDucking || false;
    const isFastFalling = options.isFastFalling || false;
    const isTurbo = options.isTurbo || false;

    // Control de llamas del Hiper-Turbo
    if (rig.flameL && rig.flameR) {
      rig.flameL.visible = isTurbo || boost > 0;
      rig.flameR.visible = isTurbo || boost > 0;
      if (isTurbo) {
        const s = 1.0 + Math.random() * 0.5;
        rig.flameL.scale.set(s, s, s);
        rig.flameR.scale.set(s, s, s);
      }
    }

    // Anillo magnético
    if (rig.magnetRingMesh) {
      rig.magnetRingMesh.visible = options.hasMagnet || false;
      if (rig.magnetRingMesh.visible) {
        rig.magnetRingMesh.rotation.z += dt * 5;
      }
    }

    // 1. Postura de Victoria / Fin de nivel
    if (isWin) {
      damp(rig.armL.up, 'x', -2.8, dt, 10);
      damp(rig.armR.up, 'x', -2.8, dt, 10);
      damp(rig.armL.lo, 'x', 0.2, dt, 10);
      damp(rig.armR.lo, 'x', 0.2, dt, 10);
      for (const l of [rig.legL, rig.legR]) {
        damp(l.up, 'x', 0, dt, k);
        damp(l.lo, 'x', 0, dt, k);
      }
      damp(rig.torso, 'x', 0, dt, 8);
      damp(rig.torso, 'y', 0, dt, 8);
      damp(rig.torso, 'z', 0, dt, 8);
      return;
    }

    // 2. Postura de Agachado / Deslizamiento en el Suelo (Slide)
    if (isDucking && grounded) {
      damp(rig.torso, 'x', 0.65, dt, 14); // Torso echado hacia adelante
      damp(rig.torso, 'y', 0, dt, 14);
      damp(rig.torso, 'z', 0, dt, 14);

      damp(rig.legL.up, 'x', -1.2, dt, 16); // Piernas estiradas deslizando
      damp(rig.legR.up, 'x', -1.2, dt, 16);
      damp(rig.legL.lo, 'x', 0.2, dt, 16);
      damp(rig.legR.lo, 'x', 0.2, dt, 16);

      damp(rig.armL.up, 'x', 0.8, dt, 16);
      damp(rig.armR.up, 'x', 0.8, dt, 16);
      damp(rig.armL.lo, 'x', 0.3, dt, 16);
      damp(rig.armR.lo, 'x', 0.3, dt, 16);
      return;
    }

    // 3. Postura de Caída Rápida en Picada (Fast-Fall Slam en el aire)
    if (isFastFalling && !grounded) {
      damp(rig.torso, 'x', 0.75, dt, 18); // Inclinación fuerte hacia el piso
      damp(rig.legL.up, 'x', 0.5, dt, 18);
      damp(rig.legR.up, 'x', 0.5, dt, 18);
      damp(rig.armL.up, 'x', -1.8, dt, 18); // Brazos replegados atrás como ala delta
      damp(rig.armR.up, 'x', -1.8, dt, 18);
      return;
    }

    // 4. Ciclo de Carrera normal en suelo (Run Cycle fluido)
    if (grounded) {
      const a = 0.55 + (Math.min(speed, 26) / 26) * 0.55;
      damp(rig.legL.up, 'x', Math.sin(p) * a, dt, k);
      damp(rig.legR.up, 'x', Math.sin(p + pi) * a, dt, k);
      damp(rig.legL.lo, 'x', -(0.7 + 0.8 * Math.sin(p - 1.5)), dt, k);
      damp(rig.legR.lo, 'x', -(0.7 + 0.8 * Math.sin(p + pi - 1.5)), dt, k);

      damp(rig.armL.up, 'x', Math.sin(p + pi) * a * 0.95, dt, k);
      damp(rig.armR.up, 'x', Math.sin(p) * a * 0.95, dt, k);
      damp(rig.armL.lo, 'x', 1.1 + 0.4 * Math.sin(p + pi), dt, k);
      damp(rig.armR.lo, 'x', 1.1 + 0.4 * Math.sin(p), dt, k);

      const lean = isTurbo ? -0.45 : (-0.22 - boost * 0.12);
      damp(rig.torso, 'x', lean, dt, 8);
      damp(rig.torso, 'y', Math.sin(p) * 0.2, dt, k);
      damp(rig.torso, 'z', Math.sin(p * 2) * 0.03, dt, k);
    } else {
      // 5. Salto normal en el aire
      damp(rig.legL.up, 'x', 1.1, dt, k);
      damp(rig.legR.up, 'x', -0.5, dt, k);
      damp(rig.legL.lo, 'x', -1.3, dt, k);
      damp(rig.legR.lo, 'x', -0.6, dt, k);

      damp(rig.armL.up, 'x', -1.6, dt, k);
      damp(rig.armR.up, 'x', 1, dt, k);
      damp(rig.armL.lo, 'x', 0.6, dt, k);
      damp(rig.armR.lo, 'x', 0.8, dt, k);

      damp(rig.torso, 'x', -0.12, dt, 8);
      damp(rig.torso, 'y', 0, dt, 8);
      damp(rig.torso, 'z', 0, dt, 8);
    }
  }

  /**
   * Crea un proyectil de disco de neón
   */
  function createDiscMesh(suitMat, glowColor = CY) {
    const discG = new THREE.CylinderGeometry(0.42, 0.42, 0.05, 24);
    const discRG = new THREE.TorusGeometry(0.4, 0.04, 8, 28);
    const g = new THREE.Group();
    const r = new THREE.Mesh(discRG, B(glowColor));
    r.rotation.x = Math.PI / 2;
    g.add(new THREE.Mesh(discG, suitMat), r);
    return g;
  }

  return {
    create,
    animate,
    createDiscMesh,
    damp,
    CY,
    MG
  };
})();
