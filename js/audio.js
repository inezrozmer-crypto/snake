// Sound effects, synthesised with WebAudio. No audio files needed.
(function (root) {
  'use strict';

  var ctx = null;
  var master = null;
  var muted = false;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    var AudioCtx = root.AudioContext || root.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.16;
      master.connect(ctx.destination);
    } catch (e) {
      ctx = null;
    }
  }

  function setMuted(value) {
    muted = !!value;
    if (master) master.gain.value = muted ? 0 : 0.16;
  }

  function tone(freq, at, length, type, volume, slideTo) {
    var start = ctx.currentTime + at;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + length);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume || 0.5, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + length + 0.02);
  }

  function noise(at, length, volume) {
    var frames = Math.floor(ctx.sampleRate * length);
    var buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    var source = ctx.createBufferSource();
    var gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(master);
    source.start(ctx.currentTime + at);
  }

  var SOUNDS = {
    eat: function (combo) {
      // Each combo step is a whole tone higher.
      var f = 520 * Math.pow(2, ((combo || 1) - 1) * 2 / 12);
      tone(f, 0, 0.07, 'square', 0.45);
      tone(f * 1.5, 0.06, 0.1, 'square', 0.4);
    },
    bonus: function () {
      var notes = [660, 880, 1100, 1320, 1760];
      for (var i = 0; i < notes.length; i++) tone(notes[i], i * 0.055, 0.09, 'triangle', 0.6);
    },
    bonusSpawn: function () {
      tone(1200, 0, 0.08, 'sine', 0.4);
      tone(1600, 0.09, 0.12, 'sine', 0.4);
    },
    bonusGone: function () {
      tone(420, 0, 0.18, 'sine', 0.3, 240);
    },
    die: function () {
      tone(320, 0, 0.55, 'sawtooth', 0.5, 55);
      noise(0, 0.35, 0.5);
    },
    start: function () {
      tone(440, 0, 0.08, 'square', 0.4);
      tone(660, 0.09, 0.14, 'square', 0.4);
    },
    tick: function () {
      tone(760, 0, 0.07, 'square', 0.35);
    },
    go: function () {
      tone(1140, 0, 0.16, 'square', 0.4);
    },
    pause: function () {
      tone(520, 0, 0.12, 'triangle', 0.4, 340);
    },
    boostOn: function () {
      tone(300, 0, 0.22, 'sawtooth', 0.35, 1200);
    },
    boostOff: function () {
      tone(700, 0, 0.2, 'triangle', 0.35, 260);
    },
    boostDenied: function () {
      tone(180, 0, 0.09, 'square', 0.3);
    },
    click: function () {
      tone(900, 0, 0.04, 'triangle', 0.3);
    },
    best: function () {
      var notes = [523, 659, 784, 1047];
      for (var i = 0; i < notes.length; i++) tone(notes[i], i * 0.11, 0.2, 'triangle', 0.6);
    }
  };

  function play(name, arg) {
    if (!ctx || muted || !SOUNDS[name]) return;
    try {
      SOUNDS[name](arg);
    } catch (e) {
      // A sound must never break the game.
    }
  }

  root.SnakeAudio = { unlock: unlock, setMuted: setMuted, play: play };
})(window);
