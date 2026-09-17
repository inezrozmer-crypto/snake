// Game rules. No DOM in here, so the rules can be tested on their own
// (node) and reused for the self-playing snake behind the menu.
(function (root) {
  'use strict';

  var DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };
  var DIR_NAMES = ['up', 'down', 'left', 'right'];

  // ms per step: where it starts and the fastest it gets
  var SPEEDS = {
    chill: { start: 170, min: 95 },
    normal: { start: 135, min: 70 },
    turbo: { start: 100, min: 50 }
  };

  var RULES = {
    foodPoints: 10,
    bonusPoints: 50,
    bonusEvery: 5, // a bonus star appears after every 5th apple
    bonusSteps: 45, // and stays for this many steps
    comboSteps: 28, // eat again within this many steps to raise the combo
    comboMax: 5,
    speedup: 2, // ms faster per apple
    foodsPerLevel: 5,
    boostMs: 10000, // a full tank is 10 seconds of boost
    rechargeMs: 60000, // and takes a minute to fill up again
    boostFactor: 0.55, // step time while boosting
    boostMin: 0.1, // tank needed to switch the boost on
    boostPoints: 2 // points are doubled while boosting
  };

  function same(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  function createGame(opts) {
    opts = opts || {};
    var cols = opts.cols || 20;
    var rows = opts.rows || 20;
    var wrap = !!opts.wrap;
    var random = opts.random || Math.random;
    var speed = SPEEDS[opts.speed] || SPEEDS.normal;

    var game = {
      cols: cols,
      rows: rows,
      wrap: wrap,
      snake: [],
      dir: DIRS.right,
      queue: [],
      food: null,
      bonus: null, // { cell, left }
      score: 0,
      foods: 0,
      bonuses: 0,
      steps: 0,
      combo: 1,
      comboLeft: 0,
      maxCombo: 1,
      boost: { energy: 1, on: false }, // energy: 0..1 of a full tank
      state: 'ready', // ready | running | paused | over | won
      deathReason: null, // wall | self
      // Where the head came from and where the tail was before the last
      // step, so the renderer can slide the snake between cells.
      headFrom: null,
      tailFrom: null,
      events: [],
      reset: reset,
      start: start,
      pause: pause,
      togglePause: togglePause,
      turn: turn,
      step: step,
      setBoost: setBoost,
      toggleBoost: toggleBoost,
      tickBoost: tickBoost,
      interval: interval,
      level: level
    };

    function freeCell() {
      var taken = new Uint8Array(cols * rows);
      var i;
      for (i = 0; i < game.snake.length; i++) {
        taken[game.snake[i].y * cols + game.snake[i].x] = 1;
      }
      if (game.food) taken[game.food.y * cols + game.food.x] = 1;
      if (game.bonus) taken[game.bonus.cell.y * cols + game.bonus.cell.x] = 1;

      var free = [];
      for (i = 0; i < taken.length; i++) {
        if (!taken[i]) free.push(i);
      }
      if (free.length === 0) return null;
      var pick = free[Math.floor(random() * free.length)];
      return { x: pick % cols, y: Math.floor(pick / cols) };
    }

    function reset() {
      var cx = Math.floor(cols / 2);
      var cy = Math.floor(rows / 2);
      game.snake = [
        { x: cx, y: cy },
        { x: cx - 1, y: cy },
        { x: cx - 2, y: cy }
      ];
      game.dir = DIRS.right;
      game.queue = [];
      game.score = 0;
      game.foods = 0;
      game.bonuses = 0;
      game.steps = 0;
      game.combo = 1;
      game.comboLeft = 0;
      game.maxCombo = 1;
      game.boost = { energy: 1, on: false };
      game.state = 'ready';
      game.deathReason = null;
      game.headFrom = null;
      game.tailFrom = null;
      game.events = [];
      game.food = null;
      game.bonus = null;
      game.food = freeCell();
    }

    function start() {
      if (game.state === 'over' || game.state === 'won') reset();
      if (game.state === 'ready' || game.state === 'paused') game.state = 'running';
    }

    function pause() {
      if (game.state === 'running') game.state = 'paused';
    }

    function togglePause() {
      if (game.state === 'running') game.state = 'paused';
      else if (game.state === 'paused') game.state = 'running';
    }

    // Queue a turn. Compared against the last queued direction (not the
    // current one), so two quick key presses can never fold the snake back
    // onto itself within a single step.
    function turn(name) {
      var d = DIRS[name];
      if (!d) return false;
      if (game.state !== 'running' && game.state !== 'ready') return false;
      var last = game.queue.length ? game.queue[game.queue.length - 1] : game.dir;
      if (d.x === last.x && d.y === last.y) return false;
      if (d.x === -last.x && d.y === -last.y) return false;
      if (game.queue.length >= 2) return false;
      game.queue.push(d);
      return true;
    }

    function setBoost(on) {
      if (!on) {
        if (game.boost.on) {
          game.boost.on = false;
          game.events.push({ type: 'boostOff' });
        }
        return true;
      }
      if (game.boost.on) return true;
      if (game.state !== 'running' || game.boost.energy < RULES.boostMin) {
        game.events.push({ type: 'boostDenied' });
        return false;
      }
      game.boost.on = true;
      game.events.push({ type: 'boostOn' });
      return true;
    }

    function toggleBoost() {
      return setBoost(!game.boost.on);
    }

    // Real time, not steps: the tank drains while boosting, refills otherwise.
    function tickBoost(ms) {
      if (game.state !== 'running') return;
      if (game.boost.on) {
        game.boost.energy -= ms / RULES.boostMs;
        if (game.boost.energy <= 0) {
          game.boost.energy = 0;
          game.boost.on = false;
          game.events.push({ type: 'boostOff', empty: true });
        }
      } else {
        game.boost.energy = Math.min(1, game.boost.energy + ms / RULES.rechargeMs);
      }
    }

    function die(reason) {
      game.boost.on = false;
      game.state = 'over';
      game.deathReason = reason;
      game.events.push({ type: 'die', reason: reason });
    }

    function step() {
      if (game.state !== 'running') return;

      if (game.queue.length) game.dir = game.queue.shift();

      var head = {
        x: game.snake[0].x + game.dir.x,
        y: game.snake[0].y + game.dir.y
      };

      if (wrap) {
        head.x = (head.x + cols) % cols;
        head.y = (head.y + rows) % rows;
      } else if (head.x < 0 || head.y < 0 || head.x >= cols || head.y >= rows) {
        die('wall');
        return;
      }

      var ateFood = game.food !== null && same(head, game.food);
      var ateBonus = game.bonus !== null && same(head, game.bonus.cell);
      var grow = ateFood || ateBonus;

      // The tail cell is free to move into, unless the snake is growing.
      var bodyLength = grow ? game.snake.length : game.snake.length - 1;
      for (var i = 0; i < bodyLength; i++) {
        if (same(game.snake[i], head)) {
          die('self');
          return;
        }
      }

      var oldHead = game.snake[0];
      var oldTail = game.snake[game.snake.length - 1];
      game.snake.unshift(head);
      if (!grow) game.snake.pop();
      game.headFrom = oldHead;
      game.tailFrom = grow ? null : oldTail;
      game.steps += 1;

      if (game.comboLeft > 0) {
        game.comboLeft -= 1;
        if (game.comboLeft === 0) game.combo = 1;
      }

      if (grow) {
        game.combo = game.comboLeft > 0 ? Math.min(game.combo + 1, RULES.comboMax) : 1;
        game.comboLeft = RULES.comboSteps;
        if (game.combo > game.maxCombo) game.maxCombo = game.combo;
      }

      if (game.bonus && !ateBonus) {
        game.bonus.left -= 1;
        if (game.bonus.left <= 0) {
          game.bonus = null;
          game.events.push({ type: 'bonusGone' });
        }
      }

      var points;
      var boosted = game.boost.on;
      var multiplier = game.combo * (boosted ? RULES.boostPoints : 1);
      if (ateBonus) {
        points = RULES.bonusPoints * multiplier;
        game.score += points;
        game.bonuses += 1;
        game.bonus = null;
        game.events.push({ type: 'bonus', cell: head, points: points, combo: game.combo, boosted: boosted });
      }

      if (ateFood) {
        points = RULES.foodPoints * multiplier;
        game.score += points;
        game.foods += 1;
        game.events.push({ type: 'eat', cell: head, points: points, combo: game.combo, boosted: boosted });

        game.food = null;
        game.food = freeCell();
        if (game.food === null && game.bonus) {
          // The star sits on the last free cell: swap it for an apple.
          game.bonus = null;
          game.food = freeCell();
        }
        if (game.food === null) {
          game.state = 'won';
          game.events.push({ type: 'win' });
          return;
        }

        if (game.foods % RULES.bonusEvery === 0 && !game.bonus) {
          var cell = freeCell();
          if (cell) {
            game.bonus = { cell: cell, left: RULES.bonusSteps };
            game.events.push({ type: 'bonusSpawn', cell: cell });
          }
        }
      }
    }

    function interval() {
      var ms = Math.max(speed.min, speed.start - game.foods * RULES.speedup);
      return game.boost.on ? ms * RULES.boostFactor : ms;
    }

    function level() {
      return Math.floor(game.foods / RULES.foodsPerLevel) + 1;
    }

    reset();
    return game;
  }

  // Picks a direction for the self-playing snake behind the menu: shortest
  // path to the food, as long as that move does not box the snake in.
  function autopilot(game) {
    var cols = game.cols;
    var rows = game.rows;
    var snake = game.snake;
    var size = cols * rows;
    var i;

    var blocked = new Uint8Array(size);
    for (i = 0; i < snake.length - 1; i++) {
      blocked[snake[i].y * cols + snake[i].x] = 1;
    }

    function neighbour(index, d) {
      var x = (index % cols) + d.x;
      var y = Math.floor(index / cols) + d.y;
      if (game.wrap) {
        x = (x + cols) % cols;
        y = (y + rows) % rows;
      } else if (x < 0 || y < 0 || x >= cols || y >= rows) {
        return -1;
      }
      return y * cols + x;
    }

    // Distance from every reachable cell to `from`.
    function distances(from) {
      var dist = new Int32Array(size);
      for (var k = 0; k < size; k++) dist[k] = -1;
      var list = [from];
      dist[from] = 0;
      for (var at = 0; at < list.length; at++) {
        for (var n = 0; n < 4; n++) {
          var to = neighbour(list[at], DIRS[DIR_NAMES[n]]);
          if (to < 0 || blocked[to] || dist[to] >= 0) continue;
          dist[to] = dist[list[at]] + 1;
          list.push(to);
        }
      }
      return { dist: dist, count: list.length };
    }

    var headIndex = snake[0].y * cols + snake[0].x;
    var last = game.queue.length ? game.queue[game.queue.length - 1] : game.dir;
    var options = [];
    for (i = 0; i < 4; i++) {
      var d = DIRS[DIR_NAMES[i]];
      if (d.x === -last.x && d.y === -last.y) continue;
      var to = neighbour(headIndex, d);
      if (to < 0 || blocked[to]) continue;
      options.push({ name: DIR_NAMES[i], index: to, toFood: Infinity, room: 0 });
    }
    if (options.length === 0) return null;

    var target = game.bonus ? game.bonus.cell : game.food;
    var toTarget = target ? distances(target.y * cols + target.x).dist : null;
    for (i = 0; i < options.length; i++) {
      var o = options[i];
      if (toTarget && toTarget[o.index] >= 0) o.toFood = toTarget[o.index];
      o.room = distances(o.index).count;
    }

    options.sort(function (a, b) {
      return a.toFood - b.toFood;
    });
    for (i = 0; i < options.length; i++) {
      if (options[i].toFood < Infinity && options[i].room >= snake.length) return options[i].name;
    }
    options.sort(function (a, b) {
      return b.room - a.room;
    });
    return options[0].name;
  }

  var api = {
    createGame: createGame,
    autopilot: autopilot,
    DIRS: DIRS,
    SPEEDS: SPEEDS,
    RULES: RULES
  };

  root.SnakeCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
