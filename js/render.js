// Everything that is drawn on the canvas: board, snake, food, particles.
(function (root) {
  'use strict';

  var THEMES = {
    neon: {
      style: 'smooth',
      bg: ['#131a3d', '#070a1c'],
      checker: 'rgba(130, 150, 255, 0.045)',
      wall: '#22e6c8',
      body: ['#3dfbe0', '#7a5cff', '#ff4fd8'],
      head: '#8dfff0',
      glow: 'rgba(34, 230, 200, 0.6)',
      glowBlur: 0.9,
      glowOffset: 0,
      food: ['#ffb3c0', '#ff2e63'],
      foodGlow: 'rgba(255, 46, 99, 0.85)',
      leaf: '#7dffb2',
      bonus: ['#fff6b0', '#ffae00'],
      bonusGlow: 'rgba(255, 190, 40, 0.95)',
      eye: '#ffffff',
      pupil: '#0b1026',
      tongue: '#ff4f7b',
      sparks: ['#22e6c8', '#7a5cff', '#ff4fd8', '#ffffff', '#ffe066'],
      text: '#ffffff',
      font: '800 {s}px Rubik, "Segoe UI", sans-serif'
    },
    candy: {
      style: 'smooth',
      bg: ['#fff9fb', '#ffe3ee'],
      checker: 'rgba(255, 111, 156, 0.07)',
      wall: '#ff8fb3',
      body: ['#5fd6a0', '#58c4dd', '#b48cf2'],
      head: '#4ccf95',
      glow: 'rgba(58, 42, 77, 0.22)',
      glowBlur: 0.35,
      glowOffset: 0.14,
      food: ['#ff9aa8', '#ff3d6e'],
      foodGlow: 'rgba(255, 61, 110, 0.35)',
      leaf: '#3fbf7f',
      bonus: ['#fff1a8', '#ffb627'],
      bonusGlow: 'rgba(255, 182, 39, 0.55)',
      eye: '#ffffff',
      pupil: '#3a2a4d',
      tongue: '#ff3d6e',
      sparks: ['#ff6f9c', '#5fd6a0', '#58c4dd', '#b48cf2', '#ffb627'],
      text: '#3a2a4d',
      font: '800 {s}px Rubik, "Segoe UI", sans-serif'
    },
    nokia: {
      style: 'pixel',
      bg: ['#c7f0d8', '#c7f0d8'],
      ink: '#43523d',
      gridLine: 'rgba(67, 82, 61, 0.09)',
      sparks: ['#43523d'],
      text: '#43523d',
      font: '{s}px "Press Start 2P", "Courier New", monospace'
    }
  };

  function hexToRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // Colour at position u (0..1) along a list of hex stops.
  function colorAt(stops, u) {
    u = Math.max(0, Math.min(1, u));
    var scaled = u * (stops.length - 1);
    var i = Math.min(stops.length - 2, Math.floor(scaled));
    var t = scaled - i;
    var a = stops[i];
    var b = stops[i + 1];
    return 'rgb(' +
      Math.round(a[0] + (b[0] - a[0]) * t) + ',' +
      Math.round(a[1] + (b[1] - a[1]) * t) + ',' +
      Math.round(a[2] + (b[2] - a[2]) * t) + ')';
  }

  function easeOutBack(t) {
    var c = 1.70158;
    var u = t - 1;
    return 1 + (c + 1) * u * u * u + c * u * u;
  }

  function create(canvas) {
    var ctx = canvas.getContext('2d');
    var themeName = 'neon';
    var theme = THEMES.neon;
    var bodyStops = theme.body.map(hexToRgb);
    var walls = true;

    var bg = document.createElement('canvas');
    var bgKey = '';

    var particles = [];
    var texts = [];
    var bulges = [];
    var shakeMag = 0;
    var lastNow = null;
    var frameDt = 16;
    var lastCell = 20;
    var headAngle = 0;
    var popped = 0;
    var foodSeen = '';
    var foodBorn = 0;
    var bonusSeen = '';
    var bonusBorn = 0;
    var reducedMotion = false;
    try {
      reducedMotion = root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      reducedMotion = false;
    }

    function setTheme(name) {
      if (!THEMES[name]) name = 'neon';
      themeName = name;
      theme = THEMES[name];
      bodyStops = theme.body ? theme.body.map(hexToRgb) : [];
      bgKey = '';
    }

    function setWalls(value) {
      walls = !!value;
      bgKey = '';
    }

    function resize() {
      var dpr = root.devicePixelRatio || 1;
      var size = Math.max(1, Math.round(canvas.parentNode.clientWidth * dpr));
      if (canvas.width !== size || canvas.height !== size) {
        canvas.width = size;
        canvas.height = size;
      }
    }

    // Forget everything that belongs to the previous round.
    function reset() {
      particles = [];
      texts = [];
      bulges = [];
      shakeMag = 0;
      popped = 0;
      foodSeen = '';
      bonusSeen = '';
    }

    // ---- background (drawn once, then reused) ---------------------------

    function buildBackground(cols, rows) {
      var W = canvas.width;
      var H = canvas.height;
      var cell = W / cols;
      bg.width = W;
      bg.height = H;
      var b = bg.getContext('2d');
      var x, y;

      if (theme.style === 'pixel') {
        b.fillStyle = theme.bg[0];
        b.fillRect(0, 0, W, H);
        b.strokeStyle = theme.gridLine;
        b.lineWidth = Math.max(1, cell * 0.04);
        b.beginPath();
        for (x = 1; x < cols; x++) {
          b.moveTo(Math.round(x * cell), 0);
          b.lineTo(Math.round(x * cell), H);
        }
        for (y = 1; y < rows; y++) {
          b.moveTo(0, Math.round(y * cell));
          b.lineTo(W, Math.round(y * cell));
        }
        b.stroke();
        b.strokeStyle = theme.ink;
        b.lineWidth = Math.max(2, cell * 0.16);
        if (!walls) b.setLineDash([cell * 0.16, cell * 0.34]);
        b.strokeRect(b.lineWidth / 2, b.lineWidth / 2, W - b.lineWidth, H - b.lineWidth);
        return;
      }

      var grad = b.createRadialGradient(W / 2, H / 2, W * 0.1, W / 2, H / 2, W * 0.75);
      grad.addColorStop(0, theme.bg[0]);
      grad.addColorStop(1, theme.bg[1]);
      b.fillStyle = grad;
      b.fillRect(0, 0, W, H);

      b.fillStyle = theme.checker;
      for (y = 0; y < rows; y++) {
        for (x = 0; x < cols; x++) {
          if ((x + y) % 2 === 0) b.fillRect(x * cell, y * cell, cell, cell);
        }
      }

      var line = Math.max(2, cell * 0.12);
      b.strokeStyle = theme.wall;
      b.lineWidth = line;
      if (walls) {
        b.shadowColor = theme.wall;
        b.shadowBlur = cell * 0.6;
        b.strokeRect(line / 2, line / 2, W - line, H - line);
      } else {
        // No walls: a faint dashed edge says "you can pass through here".
        b.globalAlpha = 0.35;
        b.setLineDash([cell * 0.3, cell * 0.5]);
        b.strokeRect(line / 2, line / 2, W - line, H - line);
      }
    }

    // ---- effects ----------------------------------------------------------

    function addParticle(x, y, vx, vy, life, size, color, gravity, square) {
      if (particles.length > 700) return;
      particles.push({
        x: x, y: y, vx: vx, vy: vy, life: life, max: life,
        size: size, color: color, gravity: gravity || 0, square: !!square
      });
    }

    function sparkColor() {
      return theme.sparks[Math.floor(Math.random() * theme.sparks.length)];
    }

    // x, y in canvas pixels; speed in cells per second.
    function burstAt(x, y, count, speed) {
      if (reducedMotion) count = Math.ceil(count / 3);
      var unit = lastCell / 1000;
      for (var i = 0; i < count; i++) {
        var angle = Math.random() * Math.PI * 2;
        var v = speed * (0.35 + Math.random() * 0.65) * unit;
        addParticle(x, y, Math.cos(angle) * v, Math.sin(angle) * v,
          350 + Math.random() * 350, lastCell * (0.08 + Math.random() * 0.12),
          sparkColor(), 0, theme.style === 'pixel');
      }
    }

    function burst(cellPos, count, speed) {
      burstAt((cellPos.x + 0.5) * lastCell, (cellPos.y + 0.5) * lastCell, count, speed);
    }

    function floatText(cellPos, text, big) {
      texts.push({
        x: (cellPos.x + 0.5) * lastCell,
        y: (cellPos.y + 0.2) * lastCell,
        text: text, big: !!big, life: 900, max: 900
      });
    }

    function bulge(now) {
      bulges.push({ born: now });
    }

    function shake(cells) {
      if (reducedMotion) return;
      shakeMag = Math.max(shakeMag, cells * lastCell);
    }

    function confetti() {
      if (reducedMotion) return;
      var unit = lastCell / 1000;
      for (var i = 0; i < 150; i++) {
        addParticle(Math.random() * canvas.width, -Math.random() * canvas.height * 0.5,
          (Math.random() - 0.5) * 3 * unit, (3 + Math.random() * 5) * unit,
          2200 + Math.random() * 1400, lastCell * (0.16 + Math.random() * 0.14),
          sparkColor(), 4 * unit / 1000, true);
      }
    }

    function drawEffects(dt) {
      var i, p;
      for (i = particles.length - 1; i >= 0; i--) {
        p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.globalAlpha = Math.min(1, p.life / p.max * 1.6);
        ctx.fillStyle = p.color;
        if (p.square) {
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (i = texts.length - 1; i >= 0; i--) {
        var t = texts[i];
        t.life -= dt;
        if (t.life <= 0) {
          texts.splice(i, 1);
          continue;
        }
        var age = 1 - t.life / t.max;
        var size = lastCell * (t.big ? 0.95 : 0.7) * (theme.style === 'pixel' ? 0.6 : 1);
        ctx.font = theme.font.replace('{s}', String(Math.round(size)));
        ctx.globalAlpha = Math.min(1, t.life / t.max * 2);
        var tx = Math.max(size * 1.5, Math.min(canvas.width - size * 1.5, t.x));
        var ty = Math.max(size, t.y - age * lastCell * 1.6);
        if (theme.style !== 'pixel') {
          ctx.lineWidth = Math.max(2, size * 0.18);
          ctx.strokeStyle = theme.bg[1];
          ctx.lineJoin = 'round';
          ctx.strokeText(t.text, tx, ty);
        }
        ctx.fillStyle = t.big && theme.bonus ? theme.bonus[1] : theme.text;
        ctx.fillText(t.text, tx, ty);
      }
      ctx.globalAlpha = 1;
    }

    // ---- smooth style -----------------------------------------------------

    function drawApple(g, now, cell) {
      var key = g.food.x + ',' + g.food.y;
      if (key !== foodSeen) {
        foodSeen = key;
        foodBorn = now;
      }
      var pop = easeOutBack(Math.min(1, (now - foodBorn) / 320));
      var r = cell * 0.36 * pop * (1 + 0.07 * Math.sin(now / 210));
      var x = (g.food.x + 0.5) * cell;
      var y = (g.food.y + 0.54) * cell;
      if (r <= 0) return;

      ctx.save();
      ctx.shadowColor = theme.foodGlow;
      ctx.shadowBlur = cell * 0.8;
      var grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
      grad.addColorStop(0, theme.food[0]);
      grad.addColorStop(1, theme.food[1]);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = theme.leaf;
      ctx.lineWidth = Math.max(1.5, cell * 0.09);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y - r * 0.85);
      ctx.quadraticCurveTo(x + r * 0.1, y - r * 1.3, x + r * 0.5, y - r * 1.4);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.ellipse(x - r * 0.35, y - r * 0.35, r * 0.2, r * 0.12, -0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawStar(g, fraction, now, cell) {
      var key = g.bonus.cell.x + ',' + g.bonus.cell.y;
      if (key !== bonusSeen) {
        bonusSeen = key;
        bonusBorn = now;
      }
      var pop = easeOutBack(Math.min(1, (now - bonusBorn) / 320));
      var x = (g.bonus.cell.x + 0.5) * cell;
      var y = (g.bonus.cell.y + 0.5) * cell;
      var outer = cell * 0.44 * pop * (1 + 0.08 * Math.sin(now / 150));
      var inner = outer * 0.48;
      if (outer <= 0) return;

      ctx.save();
      ctx.translate(x, y);

      // Ring that runs out as the star's time runs out.
      var left = Math.max(0, (g.bonus.left - fraction) / root.SnakeCore.RULES.bonusSteps);
      ctx.strokeStyle = theme.bonus[1];
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = Math.max(1.5, cell * 0.09);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, cell * 0.62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.rotate(now / 600);
      ctx.shadowColor = theme.bonusGlow;
      ctx.shadowBlur = cell * 0.9;
      var grad = ctx.createRadialGradient(0, 0, inner * 0.2, 0, 0, outer);
      grad.addColorStop(0, theme.bonus[0]);
      grad.addColorStop(1, theme.bonus[1]);
      ctx.fillStyle = grad;
      ctx.beginPath();
      for (var i = 0; i < 10; i++) {
        var radius = i % 2 === 0 ? outer : inner;
        var angle = -Math.PI / 2 + i * Math.PI / 5;
        if (i === 0) ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        else ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Shortest step between two neighbouring snake cells, seeing through
    // the board edge in no-walls mode (19 -> 0 is one step, not nineteen).
    function wrapDelta(d, size, wrap) {
      if (!wrap) return d;
      if (d > 1) return d - size;
      if (d < -1) return d + size;
      return d;
    }

    function tracePath(pts, from) {
      ctx.beginPath();
      ctx.moveTo(pts[from].x, pts[from].y);
      for (var i = from + 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    }

    function drawSnakeSmooth(g, t, now, dying, cell, boosting) {
      var s = g.snake;
      var n = s.length;
      var i, k;

      // The snake as one continuous line through cell centres. In no-walls
      // mode the line is "unwrapped", so it may run off the board; it is
      // then drawn once per board-sized offset it touches.
      var chain = [{ x: s[0].x, y: s[0].y }];
      for (i = 1; i < n; i++) {
        chain.push({
          x: chain[i - 1].x + wrapDelta(s[i].x - s[i - 1].x, g.cols, g.wrap),
          y: chain[i - 1].y + wrapDelta(s[i].y - s[i - 1].y, g.rows, g.wrap)
        });
      }

      var pts = [];
      if (g.headFrom && n > 1) {
        pts.push({
          x: chain[1].x + (chain[0].x - chain[1].x) * t,
          y: chain[1].y + (chain[0].y - chain[1].y) * t
        });
      } else {
        pts.push(chain[0]);
      }
      for (i = 1; i < n; i++) pts.push(chain[i]);
      if (g.tailFrom) {
        var end = chain[n - 1];
        var tx = end.x + wrapDelta(g.tailFrom.x - s[n - 1].x, g.cols, g.wrap);
        var ty = end.y + wrapDelta(g.tailFrom.y - s[n - 1].y, g.rows, g.wrap);
        pts.push({ x: tx + (end.x - tx) * t, y: ty + (end.y - ty) * t });
      }

      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (i = 0; i < pts.length; i++) {
        minX = Math.min(minX, pts[i].x);
        maxX = Math.max(maxX, pts[i].x);
        minY = Math.min(minY, pts[i].y);
        maxY = Math.max(maxY, pts[i].y);
        pts[i] = { x: (pts[i].x + 0.5) * cell, y: (pts[i].y + 0.5) * cell };
      }

      var m = pts.length - 1;
      var base = cell * 0.74;
      var W = cell * g.cols;
      var H = cell * g.rows;

      // Dying: a white flash, then the body pops from head to tail.
      var flash = false;
      var hide = 0;
      if (dying) {
        var age = now - dying.start;
        flash = age < 180;
        hide = Math.floor(Math.max(0, Math.min(1, (age - 180) / 650)) * (m + 2));
        for (k = popped; k < hide && k <= m; k++) {
          burstAt(((pts[k].x % W) + W) % W, ((pts[k].y % H) + H) % H, 3, 5);
        }
        popped = Math.max(popped, hide);
      } else {
        popped = 0;
      }
      if (hide > m) return;

      // Boosting: sparks fly off the tail, and the glow burns brighter.
      if (boosting && !reducedMotion) {
        burstAt(((pts[m].x % W) + W) % W, ((pts[m].y % H) + H) % H, 2, 4);
      }

      for (i = bulges.length - 1; i >= 0; i--) {
        if ((now - bulges[i].born) / 30 > m + 4) bulges.splice(i, 1);
      }

      function widthAt(index) {
        var fromTail = m - 1 - index;
        var w = base * (0.55 + 0.45 * Math.min(1, fromTail / 6));
        for (var b = 0; b < bulges.length; b++) {
          var d = index - (now - bulges[b].born) / 30;
          w *= 1 + 0.36 * Math.exp(-d * d / 1.3);
        }
        return w;
      }

      var target = Math.atan2(g.dir.y, g.dir.x);
      var diff = target - headAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      headAngle += diff * Math.min(1, frameDt / 70);

      var first = g.wrap ? Math.floor((minX - 0.5) / g.cols) : 0;
      var lastX = g.wrap ? Math.floor((maxX + 0.5) / g.cols) : 0;
      var firstY = g.wrap ? Math.floor((minY - 0.5) / g.rows) : 0;
      var lastY = g.wrap ? Math.floor((maxY + 0.5) / g.rows) : 0;

      for (var ox = first; ox <= lastX; ox++) {
        for (var oy = firstY; oy <= lastY; oy++) {
          ctx.save();
          ctx.translate(-ox * W, -oy * H);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          // glow / soft shadow under the whole body
          ctx.save();
          ctx.globalAlpha = boosting ? 1 : 0.6;
          ctx.shadowColor = theme.glow;
          ctx.shadowBlur = cell * theme.glowBlur * (boosting ? 1.8 : 1);
          ctx.shadowOffsetY = cell * theme.glowOffset;
          ctx.strokeStyle = theme.glow;
          ctx.lineWidth = base * 0.62;
          tracePath(pts, hide);
          ctx.stroke();
          ctx.restore();

          // body, tail first so the head end lies on top
          for (k = m - 1; k >= hide; k--) {
            ctx.strokeStyle = flash ? '#ffffff' : colorAt(bodyStops, k / Math.max(1, m - 1));
            ctx.lineWidth = widthAt(k);
            ctx.beginPath();
            ctx.moveTo(pts[k].x, pts[k].y);
            ctx.lineTo(pts[k + 1].x, pts[k + 1].y);
            ctx.stroke();
          }

          // a thin highlight makes the body read as a tube
          ctx.save();
          ctx.translate(-base * 0.12, -base * 0.12);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
          ctx.lineWidth = base * 0.16;
          tracePath(pts, hide);
          ctx.stroke();
          ctx.restore();

          if (hide === 0) drawHead(g, pts[0], now, cell, base, flash, dying);
          ctx.restore();
        }
      }
    }

    function drawHead(g, at, now, cell, base, flash, dying) {
      ctx.save();
      ctx.translate(at.x, at.y);
      ctx.rotate(headAngle);

      // tongue: a quick flick every few seconds
      var flick = (now % 2600) / 260;
      if (!dying && flick < 1) {
        var reach = base * 0.5 + cell * 0.38 * Math.sin(Math.PI * flick);
        ctx.strokeStyle = theme.tongue;
        ctx.lineWidth = Math.max(1.5, cell * 0.07);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(base * 0.4, 0);
        ctx.lineTo(reach, 0);
        ctx.lineTo(reach + cell * 0.12, -cell * 0.1);
        ctx.moveTo(reach, 0);
        ctx.lineTo(reach + cell * 0.12, cell * 0.1);
        ctx.stroke();
      }

      ctx.fillStyle = flash ? '#ffffff' : theme.head;
      ctx.beginPath();
      ctx.ellipse(0, 0, base * 0.64, base * 0.58, 0, 0, Math.PI * 2);
      ctx.fill();

      // pupils follow the apple (the star, when there is one)
      var lookX = 1;
      var lookY = 0;
      var prey = g.bonus ? g.bonus.cell : g.food;
      if (prey) {
        var dx = (prey.x + 0.5) * cell - at.x;
        var dy = (prey.y + 0.5) * cell - at.y;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var cos = Math.cos(-headAngle);
        var sin = Math.sin(-headAngle);
        lookX = (dx * cos - dy * sin) / len;
        lookY = (dx * sin + dy * cos) / len;
      }

      var blink = now % 3700 < 130;
      for (var side = -1; side <= 1; side += 2) {
        var ex = base * 0.2;
        var ey = side * base * 0.3;
        var r = base * 0.2;
        if (dying) {
          ctx.strokeStyle = theme.pupil;
          ctx.lineWidth = Math.max(1.5, cell * 0.07);
          ctx.beginPath();
          ctx.moveTo(ex - r * 0.7, ey - r * 0.7);
          ctx.lineTo(ex + r * 0.7, ey + r * 0.7);
          ctx.moveTo(ex + r * 0.7, ey - r * 0.7);
          ctx.lineTo(ex - r * 0.7, ey + r * 0.7);
          ctx.stroke();
        } else if (blink) {
          ctx.strokeStyle = theme.pupil;
          ctx.lineWidth = Math.max(1.5, cell * 0.06);
          ctx.beginPath();
          ctx.moveTo(ex, ey - r * 0.8);
          ctx.lineTo(ex, ey + r * 0.8);
          ctx.stroke();
        } else {
          ctx.fillStyle = theme.eye;
          ctx.beginPath();
          ctx.arc(ex, ey, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = theme.pupil;
          ctx.beginPath();
          ctx.arc(ex + lookX * r * 0.4, ey + lookY * r * 0.4, r * 0.52, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // ---- pixel style (Nokia) ----------------------------------------------

    function drawPixel(g, now, dying, cell) {
      var gap = Math.max(1, cell * 0.08);
      var u = cell / 3;
      var i;
      ctx.fillStyle = theme.ink;

      if (g.food) {
        var fx = g.food.x * cell;
        var fy = g.food.y * cell;
        var dots = [[1, 0], [0, 1], [2, 1], [1, 2]];
        for (i = 0; i < dots.length; i++) {
          ctx.fillRect(fx + dots[i][0] * u + gap / 2, fy + dots[i][1] * u + gap / 2, u - gap, u - gap);
        }
      }

      if (g.bonus) {
        var bx = g.bonus.cell.x * cell;
        var by = g.bonus.cell.y * cell;
        // blinks faster as it runs out
        var rate = g.bonus.left < 12 ? 110 : 240;
        if (Math.floor(now / rate) % 2 === 0) {
          ctx.fillRect(bx + gap, by + gap, cell - gap * 2, cell - gap * 2);
          ctx.fillStyle = theme.bg[0];
          ctx.fillRect(bx + u + gap / 2, by + u + gap / 2, u - gap, u - gap);
          ctx.fillStyle = theme.ink;
        } else {
          ctx.lineWidth = gap * 1.5;
          ctx.strokeStyle = theme.ink;
          ctx.strokeRect(bx + gap * 1.75, by + gap * 1.75, cell - gap * 3.5, cell - gap * 3.5);
        }
      }

      // Dying: the classic blink.
      if (dying && Math.floor((now - dying.start) / 130) % 2 === 1) return;

      for (i = 0; i < g.snake.length; i++) {
        var part = g.snake[i];
        ctx.fillRect(part.x * cell + gap, part.y * cell + gap, cell - gap * 2, cell - gap * 2);
      }
      var head = g.snake[0];
      ctx.fillStyle = theme.bg[0];
      ctx.fillRect(
        head.x * cell + cell / 2 - u / 4 + g.dir.x * u * 0.6,
        head.y * cell + cell / 2 - u / 4 + g.dir.y * u * 0.6,
        u / 2, u / 2);
    }

    // ---- frame ------------------------------------------------------------

    // scene: { game, fraction (0..1 between two steps), now, dying }
    function draw(scene) {
      var g = scene.game;
      var now = scene.now;
      frameDt = lastNow === null ? 16 : Math.min(60, Math.max(0, now - lastNow));
      lastNow = now;

      var cell = canvas.width / g.cols;
      lastCell = cell;

      var key = themeName + '|' + canvas.width + '|' + walls + '|' + g.cols + 'x' + g.rows;
      if (key !== bgKey) {
        buildBackground(g.cols, g.rows);
        bgKey = key;
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(bg, 0, 0);

      ctx.save();
      if (shakeMag > 0.3) {
        ctx.translate((Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag);
        shakeMag *= Math.exp(-frameDt / 110);
      } else {
        shakeMag = 0;
      }

      if (theme.style === 'pixel') {
        drawPixel(g, now, scene.dying, cell);
        if (scene.boosting && !reducedMotion) burst(g.snake[g.snake.length - 1], 1, 4);
      } else {
        if (g.food) drawApple(g, now, cell);
        if (g.bonus) drawStar(g, scene.fraction, now, cell);
        drawSnakeSmooth(g, scene.fraction, now, scene.dying, cell, !!scene.boosting);
      }
      drawEffects(frameDt);
      ctx.restore();
    }

    return {
      setTheme: setTheme,
      setWalls: setWalls,
      resize: resize,
      reset: reset,
      draw: draw,
      burst: burst,
      floatText: floatText,
      bulge: bulge,
      shake: shake,
      confetti: confetti
    };
  }

  root.SnakeRender = { create: create, THEMES: THEMES };
})(window);
