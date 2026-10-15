/**
 * collision.js — Sistema de detección de colisiones 2D
 * 
 * Responsabilidades:
 *  - Detección AABB precisa en coordenadas de mundo
 *  - Margen de tolerancia elástico para jugabilidad fluida
 *  - Detección circular para recolección de monedas / ítems
 */

const CollisionSystem = (() => {

  /**
   * [EXPLICACIÓN: Detección de Colisiones AABB (Axis-Aligned Bounding Box)]
   * Comprueba si dos rectángulos alineados a los ejes se intersectan en 2D.
   * La condición matemática de colisión requiere que se solapen simultáneamente en X e Y:
   * (ax < bx + bw) && (ax + aw > bx) && (ay < by + bh) && (ay + ah > by)
   * El parámetro 'shrink' reduce el área efectiva del obstáculo para dar un margen
   * de tolerancia ("coyote time" / perdón de impacto) y evitar frustración al jugador.
   */
  function checkAABB(a, b, shrink = 6) {
    const ax = a.x + shrink;
    const ay = a.y + shrink;
    const aw = Math.max(2, a.w - shrink * 2);
    const ah = Math.max(2, a.h - shrink * 2);

    return (
      ax < b.x + b.w &&
      ax + aw > b.x &&
      ay < b.y + b.h &&
      ay + ah > b.y
    );
  }

  /**
   * [EXPLICACIÓN: Colisión con Obstáculos]
   * Modifica la caja de colisión (Hitbox) del jugador en tiempo real:
   * Si está agachado (isDucking), su altura se reduce a duckHeight para
   * permitir pasar por debajo de obstáculos altos.
   */
  function checkPlayerVsObstacles(player, obstacles) {
    const px = player.worldX !== undefined ? player.worldX : player.x;
    const currentH = player.isDucking ? player.duckHeight : player.h;
    const pRect = {
      x: px,
      y: player.y,
      w: player.w,
      h: currentH
    };

    for (const obs of obstacles) {
      const ox = obs.worldX !== undefined ? obs.worldX : obs.screenX;
      const oRect = { x: ox, y: obs.y, w: obs.w, h: obs.h };
      if (checkAABB(pRect, oRect, 6)) return obs;
    }
    return null;
  }

  /**
   * [EXPLICACIÓN: Recolección de Monedas y Prevención de Tunneling]
   * 1. Anti-tunneling: a altas velocidades o durante un Dash, el jugador podría
   *    atravesar una moneda entre un frame y otro. Para evitarlo, estiramos la caja
   *    hacia atrás por la distancia recorrida en ese frame.
   * 2. Tolerancia negativa (-20px): expande el área de captura para que recoger monedas
   *    se sienta suave y gratificante.
   */
  function checkPlayerVsCoins(player, coins) {
    const px = player.worldX !== undefined ? player.worldX : player.x;
    const currentH = player.isDucking ? player.duckHeight : player.h;
    
    // Caja estirada hacia atrás para cubrir la trayectoria del frame actual
    const speed = player.currentSpeed || 0;
    const pRect = {
      x: px - speed,
      y: player.y,
      w: player.w + speed,
      h: currentH
    };

    for (const coin of coins) {
      if (coin.collected) continue;
      
      const cx = coin.worldX !== undefined ? coin.worldX : coin.screenX;
      const cRect = { 
        x: cx - coin.radius, 
        y: coin.y - coin.radius, 
        w: coin.radius * 2, 
        h: coin.radius * 2 
      };

      // Tolerancia negativa (-20) = caja expandida para magnetismo/recolección generosa
      if (checkAABB(pRect, cRect, -20)) return coin;
    }
    return null;
  }

  /**
   * [EXPLICACIÓN: Detección de Colisión con Power-Ups]
   * Detecta contacto con cápsulas de power-ups con margen generoso.
   */
  function checkPlayerVsPowerUps(player, powerups) {
    if (!powerups || powerups.length === 0) return null;
    const px = player.worldX !== undefined ? player.worldX : player.x;
    const currentH = player.isDucking ? player.duckHeight : player.h;
    const speed = player.currentSpeed || 0;
    const pRect = {
      x: px - speed,
      y: player.y,
      w: player.w + speed,
      h: currentH
    };

    for (const item of powerups) {
      if (item.collected) continue;
      const iRect = {
        x: item.worldX - item.radius,
        y: item.y - item.radius,
        w: item.radius * 2,
        h: item.radius * 2
      };
      if (checkAABB(pRect, iRect, -16)) return item;
    }
    return null;
  }

  return {
    checkAABB,
    checkPlayerVsObstacles,
    checkPlayerVsCoins,
    checkPlayerVsPowerUps
  };
})();
