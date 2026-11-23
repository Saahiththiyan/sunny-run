# Sunny Run

A small side-scrolling browser game built with [Phaser 3](https://phaser.io/).
Collect every heart, then run to him at the end of the level.

**Play:** https://saahiththiyan.github.io/sunny-run/

## Controls

| | Keyboard | Phone / tablet |
|---|---|---|
| Run | ← → or A D | Hold ◀ ▶ |
| Jump | ↑, W or Space | ▲ |
| Restart | R | Tap the win screen |

On phones, play in landscape. Use ⛶ for fullscreen, or on iPhone, Share → Add to Home Screen.

## Files

- `index.html`: the page (open it directly, no build step)
- `game.js`: all game code. Speeds, sizes and animation timings are at the top.
- `assets/sprites-data.js`: the sprite sheets embedded as data URIs, so the game also works by double-clicking `index.html`
- `assets/*.png`: the processed sprite sheets (transparent background, frames in a row)
- `assets/sprites.json`, `assets/meet.json`: frame sizes for those sheets
- `assets/bg/`: background layers cut from `background-sheet-original.webp`. That's the sky-and-hills strip (made to tile seamlessly), 8 clouds, and gulmohar, mango and pine trees. Sizes are in `background.json`.
- `assets/background-data.js`: those background images embedded as data URIs
- `assets/*-original.*`: the original artwork the sheets were made from

Layer settings (parallax speeds, tree spacing and sizes, cloud count) are in `BG` at the top of `game.js`.
