# Notes

Vibe coded with Claude Code, with prompts only. I did not open or edit the code
by hand. Whatever I wanted changed, I described to the agent in words, and I
checked each result by playing it in the browser.

## What I asked for first

A correct, working game of classic Snake that meets the README: it runs in the
browser, starts when `index.html` is opened, and needs no server and no build
step. I asked the agent to open the game for me once it was done, so that I
could try it straight away.

## What playing found, and what I asked the agent to change

1. **Found:** the first version worked correctly, but it was very plain. The
   snake was a row of squares jumping from cell to cell on a flat board, there
   was a score, and nothing more: no sound, no animation, no settings. It met
   the requirements, but it was not a game I would want to keep playing.
   **Asked:** a considerably more polished version, in looks, in feel and in
   depth. I left the details to the agent.
   **Changed:** the agent rebuilt the game:
   - the snake slides between cells instead of jumping, has a colour gradient,
     eyes that follow the apple, and the apple visibly travels down its body;
   - particles and floating points when eating, a screen shake and a
     head-to-tail pop when dying, sound effects synthesised in the browser;
   - a combo multiplier (up to ×5) and a bonus star after every fifth apple;
   - two modes (classic walls / no walls), three speeds, three themes (Neon,
     Candy, Nokia 3310), and a menu with a self-playing snake behind it;
   - pause with a 3-2-1 countdown, a results screen, best score per mode and
     speed, and touch controls for a phone.

2. **Found:** while playing the new version I missed a way to speed up on
   purpose. I asked the agent whether the game had one; it did not.
   **Asked:** a boost that switches on when a direction is pressed twice, stays
   fast for about 10 seconds at most, and needs about a minute to recharge.
   **Changed:** pressing the same direction twice quickly (or `Shift`) switches
   the boost on and off. A full tank lasts 10 seconds and refills in one minute;
   it needs to be at least 10% full to switch on, and it neither drains nor
   refills while the game is paused. A BOOST bar above the board shows the tank,
   sparks fly off the tail while boosting, and points count double as a reward
   for the risk (that last part was the agent's suggestion). Holding a key down
   does not count as a double press.

## What the agent found while testing its own work

- When the browser window was resized, the board went blank for a moment,
  because resizing a canvas clears it. It now repaints immediately.
- One of its own rule tests was wrong, not the game: a snake may move into the
  cell its tail is just leaving, as in the classic game. The test was corrected
  and the rule kept.

## How it was checked

The agent wrote automatic tests for the rules (walls, biting itself, growing,
no 180° turn even with two quick key presses, combo, bonus star, boost timing,
winning by filling the board) and let a bot play the real game through keyboard
events in a headless browser. What a test cannot judge, how the game feels and
sounds, I checked by playing.
