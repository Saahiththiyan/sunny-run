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
- `assets/*-original.*`: the original artwork the sheets were made from
