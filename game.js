// Sunny Run — a small Phaser 3 side-scroller. Note: her sprites face LEFT, his face RIGHT.
// Goal: collect every heart, then run to him at the end of the level.
// Controls: ← / → (or A / D) to run, ↑ / W / Space to jump, R to restart.
// Phones/tablets: on-screen ◀ ▶ ▲ buttons (multi-touch, you can slide between ◀ and ▶), ⛶ for fullscreen.

const VIEW_W = 960;
const VIEW_H = 540;
const WORLD_W = 6000;
const GROUND_Y = VIEW_H - 70;           // top of the ground strip
const BOY_X = WORLD_W - 500;            // where he waits at the end of the level
const MEET_GAP = 95;                    // how close she stands to him when they meet

// All sheets share one cell size (see assets/sprites.json) so the hitbox stays put when switching.
const SPRITE = {
  frameWidth: 240,
  frameHeight: 368,
  scale: 0.55,
  sheets: {
    runner: { data: () => window.RUNNER_SHEET },
    idle: { data: () => window.IDLE_SHEET },
    boy: { data: () => window.BOY_SHEET },
    meet: { data: () => window.MEET_SHEET, frameWidth: 426, frameHeight: 489 },
  },
};

// The ending: both of them in one animation (mirrored so she comes from the left). From assets/meet.json.
const MEET = {
  boyCenterX: 338,                       // his x inside a frame, so he stays exactly where he was standing
  boyHeight: 473,                        // his height inside a frame, used to match his in-game size
  boySheetHeight: 360,                   // his height in boy.png
  runUpMs: 260,                          // per frame while she runs up and hugs him (frames 0-5)
  hugMs: 420,                            // per frame for the looping hug (frames 3-5)
};

// Idle: look around, then close eyes and a little heart pops up. Durations are in ms.
const IDLE_SEQUENCE = [
  [0, 900], [1, 250], [2, 900], [1, 250], [0, 700],
  [3, 200], [4, 300], [5, 1100], [4, 200], [3, 200],
];

// Background layers, all cut from assets/background-sheet-original.webp (see assets/bg/background.json).
const BG = {
  landscapeHeight: 263,                  // height of landscape.jpg
  landscapeScroll: 0.12,                 // far hills move slowly
  clouds: 6,                             // how many drifting clouds
  backTrees: { scroll: 0.55, scale: [0.3, 0.4], gap: [240, 420], tint: 0xc9d6e3 },   // hazy row further back
  frontTrees: { scale: [0.62, 0.78], gap: [520, 860] },                              // trees she runs past
  treeKinds: ['gulmohar', 'mango', 'pine'],
  seed: 'sunny-run',                     // same tree layout every play
};

// His waiting loop: looks around, notices something (!), closes his eyes and smiles.
const BOY_SEQUENCE = [
  [0, 900], [1, 900], [2, 700], [1, 300], [0, 700],
  [3, 1000], [4, 800], [5, 700], [4, 300],
];

const PLAYER = {
  runSpeed: 340,
  accel: 2200,
  drag: 2600,
  jumpVelocity: -760,
};

class MainScene extends Phaser.Scene {
  constructor() { super('main'); }

  create() {
    this.ready = false;
    this.won = false;
    this.celebrating = false;
    this.score = 0;
    if (!this.textures.exists('heart')) this.makeTextures();

    // Images are embedded as data URIs so the game works by double-clicking index.html.
    const load = (key, src, addTexture) => new Promise((resolve) => {
      if (this.textures.exists(key)) return resolve();   // already loaded (restart)
      const img = new Image();
      img.onload = () => { addTexture(key, img); resolve(); };
      img.src = src;
    });
    const loads = Object.entries(SPRITE.sheets).map(([key, sheet]) => load(key, sheet.data(), (k, img) =>
      this.textures.addSpriteSheet(k, img, {
        frameWidth: sheet.frameWidth || SPRITE.frameWidth,
        frameHeight: sheet.frameHeight || SPRITE.frameHeight,
      })));
    const addImage = (k, img) => this.textures.addImage(k, img);
    loads.push(load('landscape', window.BG.landscape, addImage));
    window.BG.clouds.forEach((src, i) => loads.push(load(`cloud-${i}`, src, addImage)));
    Object.entries(window.BG.trees).forEach(([name, src]) => loads.push(load(`tree-${name}`, src, addImage)));
    Promise.all(loads).then(() => this.buildWorld());
  }

  // ---------- procedural art ----------
  makeTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // ground tile
    g.clear();
    g.fillStyle(0x8a5a3b, 1).fillRect(0, 0, 128, 128);
    g.fillStyle(0x7cb342, 1).fillRect(0, 0, 128, 18);
    g.fillStyle(0x558b2f, 1).fillRect(0, 18, 128, 6);
    g.fillStyle(0x6e4630, 1);
    [[20, 50], [80, 70], [45, 100], [110, 40]].forEach(([x, y]) => g.fillCircle(x, y, 6));
    g.generateTexture('ground', 128, 128);

    // heart pickup
    g.clear();
    g.fillStyle(0xff4f7b, 1);
    g.fillCircle(12, 12, 11).fillCircle(30, 12, 11);
    g.fillTriangle(2, 17, 40, 17, 21, 38);
    g.fillStyle(0xffffff, 0.6).fillCircle(9, 9, 3.5);
    g.generateTexture('heart', 42, 40);

    // touch button
    g.clear();
    g.fillStyle(0x000000, 0.28).fillCircle(44, 44, 44);
    g.lineStyle(3, 0xffffff, 0.6).strokeCircle(44, 44, 42);
    g.generateTexture('btn', 88, 88);

    g.destroy();
  }

  // ---------- world ----------
  buildWorld() {

    this.buildBackground();

    // ground (physics)
    this.add.tileSprite(0, GROUND_Y, WORLD_W, VIEW_H - GROUND_Y, 'ground').setOrigin(0, 0);
    const groundBody = this.add.zone(WORLD_W / 2, GROUND_Y + 50, WORLD_W, 100);
    this.physics.add.existing(groundBody, true);
    this.buildFrontTrees();

    // player
    this.anims.create({
      key: 'run',
      frames: this.anims.generateFrameNumbers('runner', { start: 0, end: 5 }),
      frameRate: 14,
      repeat: -1,
    });
    this.anims.create({
      key: 'idle',
      frames: IDLE_SEQUENCE.map(([frame, duration]) => ({ key: 'idle', frame, duration })),
      frameRate: 1000,                  // per-frame durations above control the timing
      repeat: -1,
    });

    this.player = this.physics.add.sprite(420, GROUND_Y, 'idle', 0)
      .setOrigin(0.5, 1)
      .setScale(SPRITE.scale)
      .setFlipX(true);                  // face right at start (sheet faces left)
    // hitbox in unscaled frame pixels: body only, not the flowing hair or shadow
    this.player.body.setSize(110, 255).setOffset((SPRITE.frameWidth - 110) / 2, SPRITE.frameHeight - 255 - 12);
    this.player.setCollideWorldBounds(true);
    this.player.setMaxVelocity(PLAYER.runSpeed, 1400);
    this.player.setDragX(PLAYER.drag);
    this.physics.add.collider(this.player, groundBody);

    this.physics.world.setBounds(0, 0, WORLD_W, VIEW_H);
    this.cameras.main.setBounds(0, 0, WORLD_W, VIEW_H);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12, -60, 60);   // keeps her clear of the ◀ ▶ buttons

    // him, waiting at the end
    this.anims.create({
      key: 'boy-wait',
      frames: BOY_SEQUENCE.map(([frame, duration]) => ({ key: 'boy', frame, duration })),
      frameRate: 1000,
      repeat: -1,
    });
    this.boy = this.add.sprite(BOY_X, GROUND_Y + 7, 'boy', 0)
      .setOrigin(0.5, 1)
      .setScale(SPRITE.scale)
      .setFlipX(true)                   // his sheet faces right; turn him toward her
      .play('boy-wait');
    this.bubble = this.add.text(BOY_X, GROUND_Y - 230, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#1d2b3a',
      backgroundColor: '#ffffff', padding: { x: 12, y: 8 }, align: 'center',
    }).setOrigin(0.5, 1).setDepth(5).setAlpha(0);

    // hearts to collect
    this.hearts = this.physics.add.staticGroup();
    for (let x = 500; x < BOY_X - 250; x += Phaser.Math.Between(220, 380)) {
      const y = GROUND_Y - Phaser.Math.Between(50, 190);
      const h = this.hearts.create(x, y, 'heart');
      this.tweens.add({ targets: h, y: y - 10, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: Phaser.Math.Between(0, 800) });
    }
    this.totalHearts = this.hearts.getLength();
    this.physics.add.overlap(this.player, this.hearts, this.collect, null, this);

    // HUD
    const style = { fontFamily: 'system-ui, sans-serif', fontSize: '26px', color: '#ffffff', stroke: '#1d2b3a', strokeThickness: 5 };
    this.scoreText = this.add.text(20, 16, '', style).setScrollFactor(0).setDepth(10);
    this.helpText = this.add.text(VIEW_W - 20, 16, '← → run   ↑ / Space jump   R restart', { ...style, fontSize: '18px', strokeThickness: 4 })
      .setOrigin(1, 0).setScrollFactor(0).setDepth(10);
    this.updateScore();

    // input
    this.keys = this.input.keyboard.addKeys({
      left: 'LEFT', right: 'RIGHT', up: 'UP', space: 'SPACE', a: 'A', d: 'D', w: 'W',
    });
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
    this.touch = { left: false, right: false, jump: false };
    this.touchButtons = null;
    const touchCapable = this.sys.game.device.input.touch || navigator.maxTouchPoints > 0;
    if (touchCapable) this.addTouchButtons();
    // a touch on a device we didn't detect as touch still brings the buttons up
    else this.input.on('pointerdown', (ptr) => { if (ptr.wasTouch && !this.touchButtons) this.addTouchButtons(); });
    this.addFullscreenButton();

    this.ready = true;
  }

  // ---------- background ----------
  // Far to near: painted sky + hills (tiles forever), drifting clouds, a hazy row of small trees.
  buildBackground() {
    const rnd = new Phaser.Math.RandomDataGenerator([BG.seed]);

    // sky + hills: fills the screen down to just behind the ground; mirrored tile so it never ends
    const s = (GROUND_Y + 30) / BG.landscapeHeight;
    this.landscapeScale = s;
    this.landscape = this.add.tileSprite(0, 0, VIEW_W, BG.landscapeHeight * s, 'landscape')
      .setOrigin(0, 0).setScrollFactor(0);
    this.landscape.tileScaleX = this.landscape.tileScaleY = s;

    // clouds: each drifts at its own speed; bigger ones are "closer" so they move more with the camera
    this.cloudSprites = [];
    const cloudKeys = window.BG.clouds.map((_, i) => `cloud-${i}`);
    for (let i = 0; i < BG.clouds; i++) {
      const scale = rnd.realInRange(0.45, 0.85);
      const c = this.add.image(0, rnd.between(25, 170), rnd.pick(cloudKeys))
        .setOrigin(0.5, 0.5).setScale(scale).setScrollFactor(0).setAlpha(0.95);
      c.baseX = rnd.between(0, VIEW_W + 600);
      c.parallax = 0.08 + scale * 0.2;
      c.drift = rnd.realInRange(6, 16);      // px per second
      this.cloudSprites.push(c);
    }

    // hazy trees further back, scrolling slower than the ground
    const { scroll, scale, gap, tint } = BG.backTrees;
    const span = (WORLD_W - VIEW_W) * scroll + VIEW_W + 300;
    for (let x = rnd.between(0, gap[0]); x < span; x += rnd.between(gap[0], gap[1])) {
      this.add.image(x, GROUND_Y + 4, `tree-${rnd.pick(BG.treeKinds)}`)
        .setOrigin(0.5, 1).setScale(rnd.realInRange(scale[0], scale[1]))
        .setFlipX(rnd.frac() < 0.5).setTint(tint).setScrollFactor(scroll);
    }
  }

  // full-size trees standing on the ground, behind the characters and hearts
  buildFrontTrees() {
    const rnd = new Phaser.Math.RandomDataGenerator([BG.seed + '-front']);
    const { scale, gap } = BG.frontTrees;
    const tree = (x, kind, sc, flip) => this.add.image(x, GROUND_Y + 8, `tree-${kind}`)
      .setOrigin(0.5, 1).setScale(sc).setFlipX(flip);
    for (let x = rnd.between(700, 900); x < BOY_X - 300; x += rnd.between(gap[0], gap[1])) {   // start spot stays clear
      tree(x, rnd.pick(BG.treeKinds), rnd.realInRange(scale[0], scale[1]), rnd.frac() < 0.5);
    }
    tree(BOY_X + 230, 'gulmohar', 0.8, true);     // a flowering tree framing the ending
  }

  updateBackground() {
    const cx = this.cameras.main.scrollX;
    this.landscape.tilePositionX = (cx * BG.landscapeScroll) / this.landscapeScale;
    const t = this.time.now / 1000;
    const wrap = VIEW_W + 600;
    for (const c of this.cloudSprites) {
      c.x = Phaser.Math.Wrap(c.baseX - cx * c.parallax + t * c.drift, 0, wrap) - 300;
    }
  }

  // Big on-screen buttons. Instead of per-button events, every finger is checked each frame
  // (see readTouch), so several fingers work at once and sliding from ◀ to ▶ just works.
  addTouchButtons() {
    const y = VIEW_H - 82;
    this.touchButtons = [
      { prop: 'left', x: 95, y, r: 66, label: '◀' },
      { prop: 'right', x: 250, y, r: 66, label: '▶' },
      { prop: 'jump', x: VIEW_W - 105, y, r: 74, label: '▲' },
    ];
    for (const b of this.touchButtons) {
      b.img = this.add.image(b.x, b.y, 'btn').setDisplaySize(b.r * 2, b.r * 2).setScrollFactor(0).setDepth(20);
      this.add.text(b.x, b.y, b.label, { fontFamily: 'system-ui, sans-serif', fontSize: '42px', color: '#ffffff' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(21);
    }
    if (this.input.manager.pointersTotal < 4) this.input.addPointer(4 - this.input.manager.pointersTotal);
    this.helpText.setText('Hold ◀ ▶ to run  ·  ▲ to jump');
  }

  readTouch() {
    if (!this.touchButtons) return;
    const t = { left: false, right: false, jump: false };
    for (const ptr of this.input.manager.pointers) {
      if (!ptr || !ptr.isDown) continue;
      for (const b of this.touchButtons) {
        // hit area a bit larger than the drawn circle; ◀ and ▶ zones meet in the middle without overlapping
        if (Phaser.Math.Distance.Between(ptr.x, ptr.y, b.x, b.y) < b.r * 1.15) t[b.prop] = true;
      }
    }
    for (const b of this.touchButtons) b.img.setAlpha(t[b.prop] ? 0.5 : 1);
    this.touch = t;
  }

  addFullscreenButton() {
    if (!this.scale.fullscreen.available) return;
    const btn = this.add.text(VIEW_W - 20, 50, '⛶', {
      fontFamily: 'system-ui, sans-serif', fontSize: '34px', color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.28)', padding: { x: 10, y: 2 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(22).setInteractive({ useHandCursor: true });
    // pointerup counts as a user gesture for the Fullscreen API
    btn.on('pointerup', () => {
      if (this.scale.isFullscreen) { this.scale.stopFullscreen(); return; }
      this.scale.startFullscreen();
      try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* not supported */ }
    });
  }

  collect(player, heart) {
    this.hearts.remove(heart);
    this.tweens.killTweensOf(heart);
    this.tweens.add({ targets: heart, y: heart.y - 60, alpha: 0, scale: 1.8, duration: 350, onComplete: () => heart.destroy() });
    this.score++;
    this.updateScore();
  }

  updateScore() {
    const done = this.score === this.totalHearts ? (this.won ? '' : '  — now go to him →') : '';
    this.scoreText.setText(`♥ ${this.score} / ${this.totalHearts}${done}`);
  }

  say(text, holdMs = 1800) {
    this.tweens.killTweensOf(this.bubble);
    this.bubble.setText(text).setAlpha(1);
    this.tweens.add({ targets: this.bubble, alpha: 0, delay: holdMs, duration: 400 });
  }

  // she reached him: either send her back for more hearts, or end the game
  reachBoy() {
    const left = this.totalHearts - this.score;
    if (left > 0) {
      if (!this.nagCooldown) {
        this.say(left === 1 ? 'One more heart to find!' : `${left} more hearts to find!`);
        this.nagCooldown = true;
        this.time.delayedCall(2500, () => { this.nagCooldown = false; });
      }
      return;
    }
    this.win();
  }

  win() {
    this.won = true;
    this.updateScore();
    const p = this.player;
    p.setAcceleration(0, 0).setVelocity(0, 0);
    p.body.enable = false;

    // swap both characters for the two-person meeting animation
    p.setVisible(false);
    this.boy.setVisible(false).stop();
    if (!this.anims.exists('meet')) {
      this.anims.create({ key: 'meet', frames: this.anims.generateFrameNumbers('meet', { start: 0, end: 5 }), duration: MEET.runUpMs * 6 });
      this.anims.create({ key: 'hug', frames: this.anims.generateFrameNumbers('meet', { start: 3, end: 5 }), duration: MEET.hugMs * 3, repeat: -1 });
    }
    const meetScale = SPRITE.scale * MEET.boySheetHeight / MEET.boyHeight;
    const meet = this.add.sprite(BOY_X, this.boy.y, 'meet', 0)
      .setOrigin(MEET.boyCenterX / 426, 1)
      .setScale(meetScale)
      .setDepth(4)
      .play('meet');
    meet.once('animationcomplete-meet', () => meet.play('hug'));
    meet.on('animationupdate', (anim, frame) => { if (frame.index === 4 && !this.celebrating) this.celebrate(); });

    this.cameras.main.stopFollow();
    this.cameras.main.pan(BOY_X - MEET_GAP / 2, this.cameras.main.midPoint.y, 900, 'Sine.easeInOut');
    this.tweens.killTweensOf(this.bubble);
    this.bubble.setAlpha(0);              // the big title says it now
  }

  // hearts and the title, once they hug
  celebrate() {
    this.celebrating = true;
    const midX = BOY_X - MEET_GAP / 2;
    this.add.particles(midX, GROUND_Y - 200, 'heart', {
      speed: { min: 60, max: 200 }, angle: { min: 200, max: 340 }, gravityY: -20,
      scale: { start: 0.7, end: 0 }, alpha: { start: 1, end: 0 },
      lifespan: 1800, frequency: 120, quantity: 2,
    }).setDepth(6);
    const big = this.add.image(midX, GROUND_Y - 200, 'heart').setScale(0).setDepth(7);
    this.tweens.add({ targets: big, scale: 2.2, y: GROUND_Y - 270, duration: 900, ease: 'Back.out' });
    this.tweens.add({ targets: big, scale: 2.5, duration: 500, yoyo: true, repeat: -1, delay: 900, ease: 'Sine.inOut' });

    const style = { fontFamily: 'system-ui, sans-serif', color: '#ffffff', stroke: '#1d2b3a', align: 'center' };
    this.add.text(VIEW_W / 2, 95, 'Together at last!', { ...style, fontSize: '52px', strokeThickness: 8 })
      .setOrigin(0.5).setScrollFactor(0).setDepth(30);
    this.add.text(VIEW_W / 2, 145, `All ${this.totalHearts} hearts collected  ·  press R or tap to play again`, { ...style, fontSize: '20px', strokeThickness: 5 })
      .setOrigin(0.5).setScrollFactor(0).setDepth(30);
    this.time.delayedCall(800, () => this.input.once('pointerdown', () => this.scene.restart()));
  }

  update() {
    if (this.ready) this.updateBackground();
    if (!this.ready || this.won) {
      if (this.won) this.player.setVelocityX(0);
      return;
    }
    const p = this.player;
    const k = this.keys;
    this.readTouch();
    const left = k.left.isDown || k.a.isDown || this.touch.left;
    const right = k.right.isDown || k.d.isDown || this.touch.right;
    const jump = k.up.isDown || k.w.isDown || k.space.isDown || this.touch.jump;
    const onGround = p.body.blocked.down;

    if (left && !right) {
      p.setAccelerationX(-PLAYER.accel);
      p.setFlipX(false);
    } else if (right && !left) {
      p.setAccelerationX(PLAYER.accel);
      p.setFlipX(true);
    } else {
      p.setAccelerationX(0);
    }

    if (jump && onGround) p.setVelocityY(PLAYER.jumpVelocity);

    // he stands in the way: she can't run past him
    if (p.x > BOY_X - MEET_GAP) {
      p.x = BOY_X - MEET_GAP;
      if (p.body.velocity.x > 0) p.setVelocityX(0);
      if (onGround) { this.reachBoy(); if (this.won) return; }
    }

    // animation: run cycle speed follows actual speed; freeze a stride frame in the air
    const speed = Math.abs(p.body.velocity.x);
    if (!onGround) {
      p.anims.stop();
      p.setTexture('runner', 0);
    } else if (speed > 20) {
      p.play('run', true);
      p.anims.timeScale = Phaser.Math.Clamp(speed / PLAYER.runSpeed, 0.4, 1);
    } else {
      p.play('idle', true);
      p.anims.timeScale = 1;
    }
  }
}

window.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW_W,
  height: VIEW_H,
  backgroundColor: '#7ec8f5',
  physics: { default: 'arcade', arcade: { gravity: { y: 2000 }, debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: MainScene,
});
