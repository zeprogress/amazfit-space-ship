import { createWidget, widget, prop, align, text_style, event } from '@zos/ui'

const W = 432
const H = 514
const FPS = 12
const TICK = Math.floor(1000 / FPS)

Page({
  state: {
    canvas: null,
    hud: null,
    timer: null,
    running: false,
    gameOver: false,
    score: 0,
    lives: 3,
    wave: 1,
    shipX: W / 2,
    shipY: H - 70,
    shipW: 36,
    shipH: 22,
    bullets: [],
    enemies: [],
    enemyDir: 1,
    enemyStepDown: 18,
    fireCooldown: 0,
    touchActive: false
  },

  build() {
    createWidget(widget.FILL_RECT, {
      x: 0, y: 0, w: W, h: H, color: 0x050510
    })

    this.state.hud = createWidget(widget.TEXT, {
      x: 8,
      y: 6,
      w: W - 16,
      h: 28,
      text: 'SCORE 0   LIVES 3',
      text_size: 18,
      color: 0xa0e0ff,
      align_h: align.LEFT,
      align_v: align.CENTER_V,
      text_style: text_style.NONE
    })

    const canvas = createWidget(widget.CANVAS, {
      x: 0,
      y: 0,
      w: W,
      h: H
    })
    this.state.canvas = canvas

    canvas.addEventListener(event.CLICK_DOWN, (info) => {
      this.state.touchActive = true
      this.moveShip(info.x)
      if (this.state.gameOver) {
        this.resetGame()
      }
    })
    canvas.addEventListener(event.MOVE, (info) => {
      if (this.state.touchActive) {
        this.moveShip(info.x)
      }
    })
    canvas.addEventListener(event.CLICK_UP, () => {
      this.state.touchActive = false
    })

    this.resetGame()
    this.startLoop()
  },

  moveShip(x) {
    const half = this.state.shipW / 2
    let nx = x
    if (nx < half + 4) nx = half + 4
    if (nx > W - half - 4) nx = W - half - 4
    this.state.shipX = nx
  },

  resetGame() {
    this.state.score = 0
    this.state.lives = 3
    this.state.wave = 1
    this.state.bullets = []
    this.state.enemyDir = 1
    this.state.fireCooldown = 0
    this.state.gameOver = false
    this.state.running = true
    this.state.shipX = W / 2
    this.spawnEnemies()
    this.updateHud()
  },

  spawnEnemies() {
    const rows = 4
    const cols = 6
    const ew = 28
    const eh = 20
    const gapX = 12
    const gapY = 14
    const totalW = cols * ew + (cols - 1) * gapX
    const startX = Math.floor((W - totalW) / 2)
    const startY = 48
    const list = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        list.push({
          x: startX + c * (ew + gapX),
          y: startY + r * (eh + gapY),
          w: ew,
          h: eh,
          alive: true,
          type: r < 1 ? 2 : 1
        })
      }
    }
    this.state.enemies = list
  },

  startLoop() {
    if (this.state.timer) {
      try { clearInterval(this.state.timer) } catch (e) {}
    }
    this.state.timer = setInterval(() => {
      this.tick()
    }, TICK)
  },

  tick() {
    if (!this.state.running) return
    if (this.state.gameOver) {
      this.draw()
      return
    }

    this.state.fireCooldown--
    if (this.state.fireCooldown <= 0) {
      this.fire()
      this.state.fireCooldown = 8
    }

    const bullets = this.state.bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      bullets[i].y -= 18
      if (bullets[i].y < 20) bullets.splice(i, 1)
    }

    this.moveEnemies()

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i]
      let hit = false
      for (let j = 0; j < this.state.enemies.length; j++) {
        const e = this.state.enemies[j]
        if (!e.alive) continue
        if (b.x > e.x && b.x < e.x + e.w && b.y > e.y && b.y < e.y + e.h) {
          e.alive = false
          hit = true
          this.state.score += e.type === 2 ? 30 : 10
          break
        }
      }
      if (hit) bullets.splice(i, 1)
    }

    for (let j = 0; j < this.state.enemies.length; j++) {
      const e = this.state.enemies[j]
      if (!e.alive) continue
      if (e.y + e.h >= this.state.shipY) {
        this.loseLife()
        break
      }
    }

    let alive = 0
    for (let j = 0; j < this.state.enemies.length; j++) {
      if (this.state.enemies[j].alive) alive++
    }
    if (alive === 0) {
      this.state.wave++
      this.state.score += 100
      this.spawnEnemies()
    }

    this.updateHud()
    this.draw()
  },

  fire() {
    this.state.bullets.push({
      x: this.state.shipX,
      y: this.state.shipY - 8,
      r: 4
    })
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

    let dir = this.state.enemyDir
    const speed = 3 + Math.min(this.state.wave, 6)
    let hitEdge = false
    if (dir > 0 && maxX + speed >= W - 8) hitEdge = true
    if (dir < 0 && minX - speed <= 8) hitEdge = true

    if (hitEdge) {
      this.state.enemyDir = -dir
      for (let i = 0; i < this.state.enemies.length; i++) {
        if (this.state.enemies[i].alive) {
          this.state.enemies[i].y += this.state.enemyStepDown
        }
      }
    } else {
      for (let i = 0; i < this.state.enemies.length; i++) {
        if (this.state.enemies[i].alive) {
          this.state.enemies[i].x += dir * speed
        }
      }
    }
  },

  loseLife() {
    this.state.lives--
    this.state.bullets = []
    if (this.state.lives <= 0) {
      this.state.gameOver = true
    } else {
      this.spawnEnemies()
      this.state.shipX = W / 2
    }
  },

  updateHud() {
    if (!this.state.hud) return
    const t = this.state.gameOver
      ? 'GAME OVER  ' + this.state.score + '  tap'
      : 'S ' + this.state.score + '  L ' + this.state.lives + '  W ' + this.state.wave
    try {
      this.state.hud.setProperty(prop.MORE, {
        x: 8, y: 6, w: W - 16, h: 28, text: t
      })
    } catch (e) {
      try { this.state.hud.setProperty(prop.TEXT, t) } catch (e2) {}
    }
  },

  draw() {
    const c = this.state.canvas
    if (!c) return
    try { c.clear({ x: 0, y: 0, w: W, h: H }) } catch (e) {}
    c.drawRect({ x1: 0, y1: 0, x2: W, y2: H, color: 0x050510 })

    for (let i = 0; i < this.state.enemies.length; i++) {
      const e = this.state.enemies[i]
      if (!e.alive) continue
      const col = e.type === 2 ? 0xff5577 : 0x44dd88
      c.drawRect({
        x1: Math.floor(e.x), y1: Math.floor(e.y),
        x2: Math.floor(e.x + e.w), y2: Math.floor(e.y + e.h),
        color: col
      })
      c.drawRect({
        x1: Math.floor(e.x + 5), y1: Math.floor(e.y + 6),
        x2: Math.floor(e.x + 11), y2: Math.floor(e.y + 12),
        color: 0x050510
      })
      c.drawRect({
        x1: Math.floor(e.x + e.w - 11), y1: Math.floor(e.y + 6),
        x2: Math.floor(e.x + e.w - 5), y2: Math.floor(e.y + 12),
        color: 0x050510
      })
    }

    for (let i = 0; i < this.state.bullets.length; i++) {
      const b = this.state.bullets[i]
      c.drawCircle({
        center_x: Math.floor(b.x),
        center_y: Math.floor(b.y),
        radius: b.r,
        color: 0xffee55
      })
    }

    const sx = Math.floor(this.state.shipX)
    const sy = Math.floor(this.state.shipY)
    const hw = Math.floor(this.state.shipW / 2)
    c.drawRect({
      x1: sx - hw, y1: sy, x2: sx + hw, y2: sy + this.state.shipH, color: 0x4ecbff
    })
    c.drawRect({
      x1: sx - 6, y1: sy - 10, x2: sx + 6, y2: sy, color: 0xffffff
    })

    if (this.state.gameOver) {
      c.drawRect({
        x1: 40, y1: H / 2 - 40, x2: W - 40, y2: H / 2 + 40, color: 0x1a1020
      })
    }
  },

  onDestroy() {
    if (this.state.timer) {
      try { clearInterval(this.state.timer) } catch (e) {}
      this.state.timer = null
    }
  }
})
