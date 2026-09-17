# Snake

The classic Snake, in the browser.

## What to build

A game of Snake that starts when you open `index.html` in a browser. No
server, no build step.

## How to play

Open `index.html`. Pick a mode, a speed and a theme, then press **Play**.

| Key | What it does |
| --- | --- |
| Arrow keys / `W` `A` `S` `D` | steer (also starts the game from the menu) |
| the same arrow twice, quickly / `Shift` | boost on, boost off |
| `Space` / `P` | pause, resume (with a 3-2-1 countdown) |
| `Enter` | play, play again |
| `R` | restart |
| `Esc` | pause, then back to the menu |
| `M` | sound on / off |
| `T` | next theme |

On a phone: swipe on the board, or use the direction buttons under it (the
lightning button is the boost).

## What is in it

- **Two modes.** *Classic*: the walls kill. *No walls*: the snake comes back in
  on the other side.
- **Three speeds.** Every apple makes the snake a little faster, up to a limit.
- **Combo.** Eat the next apple before the combo bar runs out and the points
  are multiplied, up to ×5.
- **Boost.** Press the same direction twice quickly and the snake runs almost
  twice as fast, and every point counts double. A full tank lasts 10 seconds
  and takes a minute to refill; it needs to be at least 10% full to switch on.
- **Bonus star.** Appears after every fifth apple, worth 50 points, and
  disappears when its ring runs out.
- **Three themes.** Neon, Candy, and a Nokia 3310 style pixel screen.
- The snake slides between cells instead of jumping, looks at the apple, and
  you can see each apple travel down its body.
- Sound effects are synthesised in the browser, there are no audio files.
- A self-playing snake runs behind the menu.
- The best score is kept per mode and speed, in the browser's local storage.
  Settings are remembered too.

## Files

```
index.html      the page
css/style.css   layout and the three themes
js/core.js      the rules of the game, no browser code (and the menu's autopilot)
js/render.js    everything drawn on the canvas
js/audio.js     sound effects
js/main.js      screens, input, game loop, saved settings
```

Plain HTML, CSS and JavaScript. The only thing loaded from the internet is the
fonts, and the game works without them.
