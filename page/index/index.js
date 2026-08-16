import { createWidget, widget, prop, align, text_style, event, setStatusBarVisible } from '@zos/ui'
import { setScrollLock } from '@zos/page'
import { onGesture, GESTURE_RIGHT, GESTURE_LEFT, GESTURE_UP, GESTURE_DOWN } from '@zos/interaction'
import { setPageBrightTime, pauseDropWristScreenOff, pausePalmScreenOff } from '@zos/display'

const W = 432
const H = 514
const FPS = 30
const TICK = Math.floor(1000 / FPS)

const ROWS = 4
const COLS = 7
const MAX_ENEMY = ROWS * COLS
const MAX_PB = 5
const MAX_EB = 6
const MAX_BUNKER = 4

const ROW_SCORE = [40, 30, 20, 10]
const ROW_COLOR = [0xff4466, 0xff8844, 0x44cc66, 0x44aaff]

Page({
  state: {
    hud: null,
    timer: null,
    running: false,
    gameOver: false,
    score: 0,
    lives: 3,
    wave: 1,
    shipX: W / 2,
    shipY: H - 50,
    shipW: 40,
    shipH: 16,
    shipWidgets: null,
    bullets: [],
    eBullets: [],
    enemies: [],
    bunkers: [],
    enemyDir: 1,
    enemyStepDown: 18,
    fireCooldown: 0,
    enemyFireCd: 0,
    aliveCount: 0,
    enemyViews: [],
    pbViews: [],
    ebViews: [],
    bunkerViews: [],
    hudTick: 0
  },

  build() {
    try { setStatusBarVisible(false) } catch (e) {}
    try { setPageBrightTime({ brightTime: 2147483000 }) } catch (e) {}
    try { pauseDropWristScreenOff({ duration: 0 }) } catch (e) {}
    try { pausePalmScreenOff({ duration: 0 }) } catch (e) {}
    try { setScrollLock({ lock: true }) } catch (e) {}
    try {
      onGesture({
        callback: () => true
      })
    } catch (e) {}

    // background
    createWidget(widget.FILL_RECT, {
      x: 0, y: 0, w: W, h: H, color: 0x030308
    })

    this.state.hud = createWidget(widget.TEXT, {
      x: 4, y: 2, w: W - 8, h: 22,
      text: '0',
      text_size: 18,
      color: 0xcccccc,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: text_style.NONE
    })

    // pool: enemies
    this.state.enemyViews = []
    for (let i = 0; i < MAX_ENEMY; i++) {
      const v = createWidget(widget.FILL_RECT, {
        x: -100, y: -100, w: 22, h: 16, color: 0x44aaff
      })
      this.state.enemyViews.push(v)
    }

    // pool: bunkers
    this.state.bunkerViews = []
    for (let i = 0; i < MAX_BUNKER; i++) {
      const v = createWidget(widget.FILL_RECT, {
        x: -200, y: -200, w: 52, h: 26, color: 0x228844
      })
      this.state.bunkerViews.push(v)
    }

    // pool: player bullets
    this.state.pbViews = []
    for (let i = 0; i < MAX_PB; i++) {
      const v = createWidget(widget.FILL_RECT, {
        x: -50, y: -50, w: 4, h: 12, color: 0xffee44
      })
      this.state.pbViews.push(v)
    }

    // pool: enemy bullets
    this.state.ebViews = []
    for (let i = 0; i < MAX_EB; i++) {
      const v = createWidget(widget.FILL_RECT, {
        x: -50, y: -50, w: 4, h: 12, color: 0xff3355
      })
      this.state.ebViews.push(v)
    }

    // ship (body + cockpit)
    this.state.shipWidgets = {
      body: createWidget(widget.FILL_RECT, {
        x: W / 2 - 20, y: H - 44, w: 40, h: 12, color: 0x33ccff
      }),
      nose: createWidget(widget.FILL_RECT, {
        x: W / 2 - 8, y: H - 52, w: 16, h: 10, color: 0xffffff
      })
    }

    // full-screen touch catcher on top (alpha 0 if supported)
    const touch = createWidget(widget.FILL_RECT, {
      x: 0, y: 0, w: W, h: H, color: 0x000000
    })
    try {
      touch.setProperty(prop.MORE, { x: 0, y: 0, w: W, h: H, color: 0x000000, alpha: 0 })
    } catch (e) {
      // if alpha fails, move touch behind by not covering - use body events only
    }
    // Prefer listening on ship body area via whole screen - recreate transparent approach:
    // use CLICK on a top invisible layer; if alpha not work, still use it with setEnable false on bg

    touch.addEventListener(event.CLICK_DOWN, (info) => {
      this.moveShip(info.x)
      if (this.state.gameOver) this.resetGame()
    })
    touch.addEventListener(event.MOVE, (info) => {
      this.moveShip(info.x)
    })

    // If alpha not supported, touch is black - hide by putting enemies after touch... 
    // Better: don't use black overlay. Attach MOVE to first created bg is blocked.
    // Zepp: transparent FILL_RECT alpha works on API 3+.

    this.resetGame()
    this.startLoop()
  },

  moveShip(x) {
    const half = this.state.shipW / 2
    let nx = x
    if (nx < half + 2) nx = half + 2
    if (nx > W - half - 2) nx = W - half - 2
    this.state.shipX = nx
    const sx = Math.floor(nx)
    const sy = this.state.shipY
    const hw = Math.floor(this.state.shipW / 2)
    try {
      this.state.shipWidgets.body.setProperty(prop.MORE, {
        x: sx - hw, y: sy + 6, w: this.state.shipW, h: 12, color: 0x33ccff
      })
      this.state.shipWidgets.nose.setProperty(prop.MORE, {
        x: sx - 8, y: sy, w: 16, h: 10, color: 0xffffff
      })
    } catch (e) {}
  },

  resetGame() {
    this.state.score = 0
    this.state.lives = 3
    this.state.wave = 1
    this.state.bullets = []
    this.state.eBullets = []
    this.state.enemyDir = 1
    this.state.fireCooldown = 0
    this.state.enemyFireCd = 12
    this.state.gameOver = false
    this.state.running = true
    this.state.shipX = W / 2
    this.moveShip(W / 2)
    this.spawnBunkers()
    this.spawnEnemies()
    this.syncViews()
    this.updateHud(true)
  },

  spawnBunkers() {
    const list = []
    const bw = 52
    const bh = 26
    const n = MAX_BUNKER
    const gap = Math.floor((W - n * bw) / (n + 1))
    const y = this.state.shipY - 64
    for (let i = 0; i < n; i++) {
      list.push({ x: gap + i * (bw + gap), y: y, w: bw, h: bh, hp: 8 })
    }
    this.state.bunkers = list
  },

  spawnEnemies() {
    const ew = 22
    const eh = 16
    const gapX = 10
    const gapY = 12
    const totalW = COLS * ew + (COLS - 1) * gapX
    const startX = Math.floor((W - totalW) / 2)
    const startY = 28
    const list = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        list.push({
          x: startX + c * (ew + gapX),
          y: startY + r * (eh + gapY),
          w: ew,
          h: eh,
          alive: true,
          row: r,
          score: ROW_SCORE[r] || 10
        })
      }
    }
    this.state.enemies = list
    this.state.aliveCount = ROWS * COLS
  },

  startLoop() {
    if (this.state.timer) {
      try { clearInterval(this.state.timer) } catch (e) {}
    }
    this.state.timer = setInterval(() => this.tick(), TICK)
  },

  tick() {
    if (!this.state.running) return
    if (this.state.gameOver) return

    this.state.fireCooldown--
    if (this.state.fireCooldown <= 0) {
      this.fire()
      this.state.fireCooldown = 5
    }

    // player bullets
    const bullets = this.state.bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      bullets[i].y -= 26
      if (bullets[i].y < 6) {
        bullets.splice(i, 1)
        continue
      }
      if (this.hitBunker(bullets[i].x, bullets[i].y, true)) {
        bullets.splice(i, 1)
        continue
      }
      let hit = false
      for (let j = 0; j < this.state.enemies.length; j++) {
        const e = this.state.enemies[j]
        if (!e.alive) continue
        if (
          bullets[i].x >= e.x && bullets[i].x <= e.x + e.w &&
          bullets[i].y >= e.y && bullets[i].y <= e.y + e.h
        ) {
          e.alive = false
          this.state.aliveCount--
          this.state.score += e.score
          hit = true
          break
        }
      }
      if (hit) bullets.splice(i, 1)
    }

    this.moveEnemies()
    this.enemyShoot()

    // enemy bullets
    const eb = this.state.eBullets
    for (let i = eb.length - 1; i >= 0; i--) {
      eb[i].y += 14 + Math.min(this.state.wave, 6)
      if (eb[i].y > H - 6) {
        eb.splice(i, 1)
        continue
      }
      if (this.hitBunker(eb[i].x, eb[i].y, false)) {
        eb.splice(i, 1)
        continue
      }
      const sx = this.state.shipX
      const sy = this.state.shipY
      const hw = this.state.shipW / 2
      if (
        eb[i].x >= sx - hw && eb[i].x <= sx + hw &&
        eb[i].y >= sy && eb[i].y <= sy + this.state.shipH
      ) {
        eb.splice(i, 1)
        this.loseLife()
        break
      }
    }

    for (let j = 0; j < this.state.enemies.length; j++) {
      const e = this.state.enemies[j]
      if (e.alive && e.y + e.h >= this.state.shipY - 2) {
        this.loseLife()
        break
      }
    }

    if (this.state.aliveCount <= 0) {
      this.state.wave++
      this.state.score += 50 * this.state.wave
      this.state.bullets = []
      this.state.eBullets = []
      this.spawnBunkers()
      this.spawnEnemies()
    }

    this.syncViews()
    this.state.hudTick++
    if (this.state.hudTick >= 6) {
      this.state.hudTick = 0
      this.updateHud(false)
    }
  },

  fire() {
    if (this.state.bullets.length >= MAX_PB) return
    this.state.bullets.push({ x: this.state.shipX, y: this.state.shipY - 4 })
  },

  enemyShoot() {
    this.state.enemyFireCd--
    if (this.state.enemyFireCd > 0) return
    if (this.state.eBullets.length >= MAX_EB) return
    const base = 10 - Math.min(this.state.wave, 7)
    this.state.enemyFireCd = base + (this.state.aliveCount > 16 ? 5 : 2)
    const candidates = []
    for (let i = 0; i < this.state.enemies.length; i++) {
      if (this.state.enemies[i].alive) candidates.push(this.state.enemies[i])
    }
    if (candidates.length === 0) return
    const e = candidates[Math.floor(Math.random() * candidates.length)]
    this.state.eBullets.push({ x: e.x + e.w / 2, y: e.y + e.h })
  },

  hitBunker(x, y, fromPlayer) {
    for (let i = 0; i < this.state.bunkers.length; i++) {
      const b = this.state.bunkers[i]
      if (b.hp <= 0) continue
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        b.hp -= fromPlayer ? 1 : 2
        return true
      }
    }
    return false
  },

  moveEnemies() {
    let minX = 9999
    let maxX = 0
    let any = false
    for (let i = 0; i < this.state.enemies.length; i++) {
      const e = this.state.enemies[i]
      if (!e.alive) continue
      any = true
      if (e.x < minX) minX = e.x
      if (e.x + e.w > maxX) maxX = e.x + e.w
    }
    if (!any) return

    const haste = 1 + (MAX_ENEMY - this.state.aliveCount) * 0.07
    const speed = (5.5 + this.state.wave * 0.9) * haste
    let dir = this.state.enemyDir
    let hitEdge = false
    if (dir > 0 && maxX + speed >= W - 6) hitEdge = true
    if (dir < 0 && minX - speed <= 6) hitEdge = true

    if (hitEdge) {
      this.state.enemyDir = -dir
      for (let i = 0; i < this.state.enemies.length; i++) {
        if (this.state.enemies[i].alive) this.state.enemies[i].y += this.state.enemyStepDown
      }
    } else {
      for (let i = 0; i < this.state.enemies.length; i++) {
        if (this.state.enemies[i].alive) this.state.enemies[i].x += dir * speed
      }
    }
  },

  loseLife() {
    this.state.lives--
    this.state.bullets = []
    this.state.eBullets = []
    if (this.state.lives <= 0) {
      this.state.gameOver = true
      this.updateHud(true)
    } else {
      this.moveShip(W / 2)
      this.spawnBunkers()
      for (let i = 0; i < this.state.enemies.length; i++) {
        if (this.state.enemies[i].alive && this.state.enemies[i].y > 180) {
          this.state.enemies[i].y -= 36
        }
      }
      this.updateHud(true)
    }
  },

  // Move pre-created widgets — no full-screen redraw
  syncViews() {
    const enemies = this.state.enemies
    for (let i = 0; i < MAX_ENEMY; i++) {
      const v = this.state.enemyViews[i]
      const e = enemies[i]
      try {
        if (!e || !e.alive) {
          v.setProperty(prop.MORE, { x: -100, y: -100, w: 22, h: 16, color: 0x000000 })
        } else {
          v.setProperty(prop.MORE, {
            x: Math.floor(e.x),
            y: Math.floor(e.y),
            w: e.w,
            h: e.h,
            color: ROW_COLOR[e.row] || 0x44aaff
          })
        }
      } catch (err) {}
    }

    for (let i = 0; i < MAX_BUNKER; i++) {
      const v = this.state.bunkerViews[i]
      const b = this.state.bunkers[i]
      try {
        if (!b || b.hp <= 0) {
          v.setProperty(prop.MORE, { x: -200, y: -200, w: 52, h: 26, color: 0x000000 })
        } else {
          const g = 40 + b.hp * 18
          v.setProperty(prop.MORE, {
            x: Math.floor(b.x),
            y: Math.floor(b.y),
            w: b.w,
            h: b.h,
            color: (g << 8) | 0x40
          })
        }
      } catch (err) {}
    }

    for (let i = 0; i < MAX_PB; i++) {
      const v = this.state.pbViews[i]
      const b = this.state.bullets[i]
      try {
        if (!b) {
          v.setProperty(prop.MORE, { x: -50, y: -50, w: 4, h: 12, color: 0xffee44 })
        } else {
          v.setProperty(prop.MORE, {
            x: Math.floor(b.x) - 2,
            y: Math.floor(b.y),
            w: 4,
            h: 12,
            color: 0xffee44
          })
        }
      } catch (err) {}
    }

    for (let i = 0; i < MAX_EB; i++) {
      const v = this.state.ebViews[i]
      const b = this.state.eBullets[i]
      try {
        if (!b) {
          v.setProperty(prop.MORE, { x: -50, y: -50, w: 4, h: 12, color: 0xff3355 })
        } else {
          v.setProperty(prop.MORE, {
            x: Math.floor(b.x) - 2,
            y: Math.floor(b.y),
            w: 4,
            h: 12,
            color: 0xff3355
          })
        }
      } catch (err) {}
    }
  },

  updateHud(force) {
    if (!this.state.hud) return
    const t = this.state.gameOver
      ? 'GAME OVER ' + this.state.score + ' TAP'
      : '' + this.state.score + '  HP' + this.state.lives + '  W' + this.state.wave
    try {
      this.state.hud.setProperty(prop.MORE, {
        x: 4, y: 2, w: W - 8, h: 22, text: t
      })
    } catch (e) {
      try { this.state.hud.setProperty(prop.TEXT, t) } catch (e2) {}
    }
  },

  onDestroy() {
    if (this.state.timer) {
      try { clearInterval(this.state.timer) } catch (e) {}
      this.state.timer = null
    }
  }
})
