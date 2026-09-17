// Ties it together: screens, input, the game loop, saved settings.
(function () {
  'use strict';

  var Core = window.SnakeCore;
  var Sound = window.SnakeAudio;

  var COLS = 20;
  var ROWS = 20;
  var DEMO_INTERVAL = 95; // ms per step of the self-playing snake
  var DIE_MS = 1050; // death animation before the results show
  var COUNT_MS = 450; // one number of the 3-2-1 after a pause

  var MODES = ['classic', 'wrap'];
  var SPEED_NAMES = ['chill', 'normal', 'turbo'];
  var THEME_NAMES = ['neon', 'candy', 'nokia'];

  function $(id) {
    return document.getElementById(id);
  }

  var board = $('board');
  var renderer = window.SnakeRender.create($('canvas'));

  var screens = {
    menu: $('screen-menu'),
    paused: $('screen-paused'),
    countdown: $('screen-countdown'),
    over: $('screen-over')
  };

  // ---- saved data -------------------------------------------------------

  function load(key, fallback) {
    try {
      var value = JSON.parse(window.localStorage.getItem(key));
      return value && typeof value === 'object' ? value : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // Storage can be blocked (private window); the game works without it.
    }
  }

  var settings = load('snake.settings', {});
  if (MODES.indexOf(settings.mode) < 0) settings.mode = 'classic';
  if (SPEED_NAMES.indexOf(settings.speed) < 0) settings.speed = 'normal';
  if (THEME_NAMES.indexOf(settings.theme) < 0) settings.theme = 'neon';
  settings.muted = settings.muted === true;

  var bests = load('snake.best', {});

  function bestKey() {
    return settings.mode + '-' + settings.speed;
  }

  function getBest() {
    var n = Number(bests[bestKey()]);
    return isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }

  // ---- state ------------------------------------------------------------

  // menu | playing | paused | countdown | dying | over
  var screen = 'menu';
  var game = null;
  var demo = null;
  var acc = 0;
  var demoAcc = 0;
  var elapsed = 0;
  var lastTime = null;
  var now = 0;
  var dieStart = 0;
  var countStart = 0;
  var countShown = 0;
  var bestAtStart = 0;
  var shown = {};
  var lastScene = null;

  function newDemo() {
    demo = Core.createGame({ cols: COLS, rows: ROWS, wrap: settings.mode === 'wrap', speed: 'normal' });
    demo.start();
    demoAcc = 0;
    renderer.reset();
  }

  function show(name) {
    screen = name;
    screens.menu.hidden = name !== 'menu';
    screens.paused.hidden = name !== 'paused';
    screens.countdown.hidden = name !== 'countdown';
    screens.over.hidden = name !== 'over';

    var pauseBtn = $('btn-pause');
    pauseBtn.disabled = !(name === 'playing' || name === 'paused' || name === 'countdown');
    pauseBtn.classList.toggle('is-paused', name === 'paused' || name === 'countdown');
  }

  // ---- settings UI ------------------------------------------------------

  function applySettings() {
    document.documentElement.setAttribute('data-theme', settings.theme);
    renderer.setTheme(settings.theme);
    renderer.setWalls(settings.mode !== 'wrap');
    $('btn-sound').classList.toggle('is-muted', settings.muted);
    Sound.setMuted(settings.muted);

    var buttons = document.querySelectorAll('.segment button');
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      var on = b.getAttribute('data-mode') === settings.mode ||
        b.getAttribute('data-speed') === settings.speed ||
        b.getAttribute('data-theme-pick') === settings.theme;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    $('menu-best').textContent = String(getBest());
    save('snake.settings', settings);
    // The board is a little narrower in the Nokia theme.
    onResize();
  }

  function setTheme(name) {
    settings.theme = name;
    applySettings();
  }

  function nextTheme() {
    setTheme(THEME_NAMES[(THEME_NAMES.indexOf(settings.theme) + 1) % THEME_NAMES.length]);
  }

  function toggleMute() {
    settings.muted = !settings.muted;
    applySettings();
    Sound.play('click');
  }

  // ---- game flow --------------------------------------------------------

  function startGame(firstTurn) {
    game = Core.createGame({ cols: COLS, rows: ROWS, wrap: settings.mode === 'wrap', speed: settings.speed });
    game.start();
    if (firstTurn) game.turn(firstTurn);
    acc = 0;
    elapsed = 0;
    bestAtStart = getBest();
    renderer.reset();
    renderer.setWalls(settings.mode !== 'wrap');
    show('playing');
    Sound.play('start');
  }

  function pauseGame() {
    if (screen === 'playing') {
      game.pause();
      show('paused');
      Sound.play('pause');
    } else if (screen === 'countdown') {
      show('paused');
    }
  }

  // Resuming gives a 3-2-1 first, so the snake does not run off at once.
  function resumeGame() {
    if (screen !== 'paused') return;
    countStart = now;
    countShown = 0;
    show('countdown');
  }

  function togglePause() {
    if (screen === 'playing' || screen === 'countdown') pauseGame();
    else if (screen === 'paused') resumeGame();
  }

  function toMenu() {
    game = null;
    newDemo();
    $('menu-best').textContent = String(getBest());
    show('menu');
  }

  function formatTime(ms) {
    var seconds = Math.floor(ms / 1000);
    var rest = seconds % 60;
    return Math.floor(seconds / 60) + ':' + (rest < 10 ? '0' : '') + rest;
  }

  function showResults() {
    var won = game.state === 'won';
    var isBest = game.score > bestAtStart;
    $('over-title').textContent = won ? 'You win!' : 'Game over';
    $('over-reason').textContent = won ? 'You filled the whole board.' :
      game.deathReason === 'wall' ? 'You hit the wall.' : 'You bit your own tail.';
    $('final-score').textContent = String(game.score);
    $('r-best').textContent = String(getBest());
    $('r-length').textContent = String(game.snake.length);
    $('r-time').textContent = formatTime(elapsed);
    $('r-combo').textContent = '×' + game.maxCombo;
    $('new-best').hidden = !isBest;
    show('over');
    if (isBest || won) {
      renderer.confetti();
      Sound.play('best');
    }
  }

  function handleEvents() {
    var events = game.events;
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      if (e.type === 'eat') {
        renderer.burst(e.cell, 14, 7);
        renderer.bulge(now);
        renderer.floatText(e.cell, '+' + e.points + (e.combo > 1 ? '  ×' + e.combo : ''), false);
        Sound.play('eat', e.combo);
      } else if (e.type === 'bonus') {
        renderer.burst(e.cell, 40, 11);
        renderer.bulge(now);
        renderer.shake(0.25);
        renderer.floatText(e.cell, '+' + e.points, true);
        Sound.play('bonus');
      } else if (e.type === 'bonusSpawn') {
        renderer.burst(e.cell, 10, 4);
        Sound.play('bonusSpawn');
      } else if (e.type === 'bonusGone') {
        Sound.play('bonusGone');
      } else if (e.type === 'boostOn') {
        Sound.play('boostOn');
      } else if (e.type === 'boostOff') {
        Sound.play('boostOff');
      } else if (e.type === 'boostDenied') {
        Sound.play('boostDenied');
      } else if (e.type === 'die') {
        renderer.shake(0.7);
        renderer.burst(game.snake[0], 26, 10);
        Sound.play('die');
      }
    }
    events.length = 0;

    if (game.score > getBest()) {
      bests[bestKey()] = game.score;
      save('snake.best', bests);
    }

    if (game.state === 'over' && screen === 'playing') {
      dieStart = now;
      show('dying');
    } else if (game.state === 'won' && screen === 'playing') {
      showResults();
    }
  }

  // ---- HUD --------------------------------------------------------------

  function setText(id, value) {
    if (shown[id] === value) return false;
    shown[id] = value;
    $(id).textContent = value;
    return true;
  }

  // g is null on the menu: the demo snake's numbers are not the player's.
  function updateHud(g, fraction) {
    if (!g) g = { score: 0, snake: { length: 3 }, comboLeft: 0, combo: 1, level: function () { return 1; } };
    if (setText('score', String(g.score)) && g.score > 0) {
      var el = $('score');
      el.classList.remove('bump');
      void el.offsetWidth; // restart the animation
      el.classList.add('bump');
    }
    setText('best', String(Math.max(getBest(), g.score)));
    setText('level', String(g.level()));
    setText('length', String(g.snake.length));

    var live = g.comboLeft > 0;
    var left = live ? Math.max(0, (g.comboLeft - fraction) / Core.RULES.comboSteps) : 0;
    setText('combo-label', live && g.combo > 1 ? 'COMBO ×' + g.combo : 'COMBO');
    if (shown.comboLive !== live) {
      shown.comboLive = live;
      $('combo').classList.toggle('is-live', live);
    }
    $('combo-fill').style.transform = 'scaleX(' + left.toFixed(3) + ')';

    var tank = g.boost ? g.boost.energy : 1;
    var boostState = g.boost && g.boost.on ? 'on' : tank < Core.RULES.boostMin ? 'low' : 'ready';
    if (shown.boostState !== boostState) {
      shown.boostState = boostState;
      $('boost').classList.toggle('is-on', boostState === 'on');
      $('boost').classList.toggle('is-low', boostState === 'low');
    }
    $('boost-fill').style.transform = 'scaleX(' + tank.toFixed(3) + ')';
  }

  // ---- loop -------------------------------------------------------------

  function frame(time) {
    now = time;
    if (lastTime === null) lastTime = time;
    // Cap the gap so a background tab does not fast-forward the snake.
    var dt = Math.min(time - lastTime, 250);
    lastTime = time;
    var fraction = 1;

    if (screen === 'menu') {
      demoAcc += dt;
      while (demoAcc >= DEMO_INTERVAL) {
        demoAcc -= DEMO_INTERVAL;
        var move = Core.autopilot(demo);
        if (move) demo.turn(move);
        demo.step();
        var demoEvents = demo.events;
        for (var i = 0; i < demoEvents.length; i++) {
          if (demoEvents[i].type === 'eat' || demoEvents[i].type === 'bonus') renderer.bulge(now);
        }
        demoEvents.length = 0;
        if (demo.state !== 'running' || demo.snake.length > 90) newDemo();
      }
      fraction = demoAcc / DEMO_INTERVAL;
      updateHud(null, 0);
      lastScene = { game: demo, fraction: fraction, now: now, dying: null };
      renderer.draw(lastScene);
      window.requestAnimationFrame(frame);
      return;
    }

    if (screen === 'playing') {
      acc += dt;
      elapsed += dt;
      game.tickBoost(dt);
      handleEvents();
      while (game.state === 'running' && acc >= game.interval()) {
        acc -= game.interval();
        game.step();
        handleEvents();
      }
    } else if (screen === 'countdown') {
      var n = 3 - Math.floor((now - countStart) / COUNT_MS);
      if (n <= 0) {
        game.togglePause();
        show('playing');
        Sound.play('go');
      } else if (n !== countShown) {
        countShown = n;
        var count = $('count');
        count.textContent = String(n);
        count.classList.remove('tick');
        void count.offsetWidth;
        count.classList.add('tick');
        Sound.play('tick');
      }
    } else if (screen === 'dying' && now - dieStart >= DIE_MS) {
      showResults();
    }

    // Between two steps the snake slides; once it is dead it stays put.
    if (game.state === 'running' || game.state === 'paused') {
      fraction = Math.min(1, acc / game.interval());
    }
    updateHud(game, fraction);
    lastScene = {
      game: game,
      fraction: fraction,
      now: now,
      dying: game.state === 'over' ? { start: dieStart } : null,
      boosting: game.boost.on && game.state === 'running'
    };
    renderer.draw(lastScene);
    window.requestAnimationFrame(frame);
  }

  // ---- input ------------------------------------------------------------

  var KEY_DIRS = {
    arrowup: 'up', w: 'up',
    arrowdown: 'down', s: 'down',
    arrowleft: 'left', a: 'left',
    arrowright: 'right', d: 'right'
  };

  var lastTap = { name: null, time: 0 };
  var DOUBLE_TAP_MS = 300;

  function toggleBoost() {
    if (screen !== 'playing') return;
    game.toggleBoost();
    handleEvents();
  }

  // The same direction twice in a row, quickly: boost on / off.
  function steer(name) {
    if (screen === 'menu') {
      startGame(name);
      return;
    }
    if (screen !== 'playing') return;
    var time = window.performance.now();
    if (lastTap.name === name && time - lastTap.time < DOUBLE_TAP_MS) {
      lastTap.name = null;
      toggleBoost();
      return;
    }
    lastTap = { name: name, time: time };
    game.turn(name);
  }

  // Enter / the big button of whatever screen is showing.
  function primary() {
    if (screen === 'menu' || screen === 'over') startGame();
    else if (screen === 'paused') resumeGame();
  }

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    Sound.unlock();
    var key = e.key.toLowerCase();
    // A focused button handles Enter and Space itself.
    var onButton = e.target && e.target.tagName === 'BUTTON';

    if (KEY_DIRS[key]) {
      e.preventDefault();
      // A held key repeats; that must not count as a double tap.
      if (!e.repeat) steer(KEY_DIRS[key]);
      return;
    }
    if (key === 'shift') {
      if (!e.repeat) toggleBoost();
      return;
    }
    if (key === ' ' || key === 'spacebar') {
      if (onButton) return;
      e.preventDefault();
      if (e.repeat) return;
      if (screen === 'menu' || screen === 'over') startGame();
      else togglePause();
      return;
    }
    if (key === 'enter') {
      if (onButton) return;
      e.preventDefault();
      if (!e.repeat) primary();
      return;
    }
    if (e.repeat) return;
    if (key === 'p') togglePause();
    else if (key === 'escape') {
      if (screen === 'playing' || screen === 'countdown') pauseGame();
      else if (screen === 'paused' || screen === 'over') toMenu();
    } else if (key === 'r') {
      if (screen === 'playing' || screen === 'paused' || screen === 'over') startGame();
    } else if (key === 'm') toggleMute();
    else if (key === 't') nextTheme();
  });

  document.addEventListener('pointerdown', function () {
    Sound.unlock();
  });

  // After a mouse click, give the focus back to the page, so Space and
  // Enter keep meaning "pause" and "play" instead of pressing that button.
  document.addEventListener('click', function (e) {
    var button = e.target.closest ? e.target.closest('button') : null;
    if (button && e.detail > 0) button.blur();
  });

  function onClick(id, fn) {
    $(id).addEventListener('click', function () {
      Sound.play('click');
      fn();
    });
  }

  onClick('btn-play', function () { startGame(); });
  onClick('btn-again', function () { startGame(); });
  onClick('btn-resume', resumeGame);
  onClick('btn-restart', function () { startGame(); });
  onClick('btn-menu-paused', toMenu);
  onClick('btn-menu-over', toMenu);
  onClick('btn-pause', togglePause);
  onClick('btn-theme', nextTheme);
  $('btn-sound').addEventListener('click', toggleMute);

  document.querySelector('.options').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button') : null;
    if (!b) return;
    if (b.hasAttribute('data-mode')) {
      settings.mode = b.getAttribute('data-mode');
      applySettings();
      newDemo();
    } else if (b.hasAttribute('data-speed')) {
      settings.speed = b.getAttribute('data-speed');
      applySettings();
    } else if (b.hasAttribute('data-theme-pick')) {
      setTheme(b.getAttribute('data-theme-pick'));
    }
    Sound.play('click');
  });

  var dpad = document.querySelectorAll('.dpad button');
  for (var i = 0; i < dpad.length; i++) {
    dpad[i].addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (this.hasAttribute('data-boost')) toggleBoost();
      else steer(this.getAttribute('data-dir'));
    });
  }

  // Swipes on the board. A long drag can make several turns.
  var touchStart = null;

  board.addEventListener('touchstart', function (e) {
    var t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });

  board.addEventListener('touchmove', function (e) {
    if (screen !== 'playing') return; // menus must stay scrollable and tappable
    e.preventDefault();
    if (!touchStart) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - touchStart.x;
    var dy = t.clientY - touchStart.y;
    if (Math.abs(dx) < 22 && Math.abs(dy) < 22) return;
    if (Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? 'right' : 'left');
    else steer(dy > 0 ? 'down' : 'up');
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: false });

  window.addEventListener('blur', pauseGame);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pauseGame();
  });
  // Resizing a canvas wipes it, so paint again right away.
  function onResize() {
    renderer.resize();
    if (lastScene) renderer.draw(lastScene);
  }
  window.addEventListener('resize', onResize);

  // ---- go ---------------------------------------------------------------

  applySettings();
  newDemo();
  show('menu');
  window.requestAnimationFrame(frame);
})();
