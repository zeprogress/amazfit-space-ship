import { createWidget, widget, prop, align, text_style, event } from '@zos/ui'

const W = 432
const H = 514
const FPS = 20
const TICK = Math.floor(1000 / FPS)

// Classic-style point table by row (top = more)
const ROW_SCORE = [40, 30, 20, 20, 10]

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
    shipY: H - 58,
    shipW: 40,
    shipH: 18,
    bullets: [],
    eBullets: [],
    enemies: [],
    bunkers: [],
    enemyDir: 1,
    enemyStepDown: 14,
    fireCooldown: 0,
    enemyFireCd: 0,
    touchActive: false,
    aliveCount: 0
  },

  build() {
    createWidget(widget.FILL_RECT, {
      x: 0, y: 0, w: W, h: H, color: 0x030308
    })

    this.state.hud = createWidget(widget.TEXT, {
      x: 6,
      y: 4,
      w: W - 12,
      h: 26,
      text: '0',
      text_size: 20,
      color: 0xffffff,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: text_style.NONE
    })

    const canvas = createWidget(widget.CANVAS, {
      x: 0, y: 0, w: W, h: H
    })
    this.state.canvas = canvas

    canvas.addEventListener(event.CLICK_DOWN, (info) => {
      this.state.touchActive = true
      this.moveShip(info.x)
      if (this.state.gameOver) this.resetGame()
    })
    canvas.addEventListener(event.MOVE, (info) => {
      this.moveShip(info.x)
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
    if (nx < half + 2) nx = half + 2
    if (nx > W - half - 2) nx = W - half - 2
    this.state.shipX = nx
  },

  resetGame() {
    this.state.score = 0
    this.state.lives = 3
    this.state.wave = 1
    this.state.bullets = []
    this.state.eBullets = []
    this.state.enemyDir = 1
    this.state.fireCooldown = 0
    this.state.enemyFireCd = 20
    this.state.gameOver = false
    this.state.running = true
    this.state.shipX = W / 2
    this.spawnBunkers()
    this.spawnEnemies()
    this.updateHud()
  },

  spawnBunkers() {
    const list = []
    const bw = 52
    const bh = 28
    const n = 4
    const gap = Math.floor((W - n * bw) / (n + 1))
    const y = this.state.shipY - 70
    for (let i = 0; i < n; i++) {
      list.push({
        x: gap + i * (bw + gap),
        y: y,
        w: bw,
        h: bh,
        hp: 8
      })
    }
    this.state.bunkers = list
  },

  spawnEnemies() {
    const rows = 5
    const cols = 8
    const ew = 22
    const eh = 16
    const gapX = 8
    const gapY = 10
    const totalW = cols * ew + (cols - 1) * gapX
    const startX = Math.floor((W - totalW) / 2)
    const startY = 36
    const list = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
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
    this.state.aliveCount = rows * cols
  },

  startLoop() {
    if (this.state.timer) {
      try { clearInterval(this.state.timer) } catch (e) {}
    }
    this.state.timer = setInterval(() => this.tick(), TICK)
  },

  tick() {
    if (!this.state.running) return
    if (this.state.gameOver) {
      this.draw()
      return
    }

    // Player auto-fire — fast
    this.state.fireCooldown--
    if (this.state.fireCooldown <= 0) {
      this.fire()
      this.state.fireCooldown = 5
    }

    // Player bullets
    const bullets = this.state.bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      bullets[i].y -= 22
      if (bullets[i].y < 16) {
        bullets.splice(i, 1)
        continue
      }
      // vs bunker
      if (this.hitBunker(bullets[i].x, bullets[i].y, true)) {
        bullets.splice(i, 1)
        continue
      }
      // vs enemy
      let hit = false
      for (let j = 0; j < this.state.enemies.length; j++) {
        const e = this.state.enemies[j]
        if (!e.alive) continue
        if (
          bullets[i].x >= e.x &&
          bullets[i].x <= e.x + e.w &&
          bullets[i].y >= e.y &&
          bullets[i].y <= e.y + e.h
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

    // Enemy bullets
    const eb = this.state.eBullets
    for (let i = eb.length - 1; i >= 0; i--) {
      eb[i].y += 14 + Math.min(this.state.wave, 8)
      if (eb[i].y > H - 10) {
        eb.splice(i, 1)
        continue
      }
      if (this.hitBunker(eb[i].x, eb[i].y, false)) {
        eb.splice(i, 1)
        continue
      }
      // hit ship
      const sx = this.state.shipX
      const sy = this.state.shipY
      const hw = this.state.shipW / 2
      if (
        eb[i].x >= sx - hw &&
        eb[i].x <= sx + hw &&
        eb[i].y >= sy &&
        eb[i].y <= sy + this.state.shipH
      ) {
        eb.splice(i, 1)
        this.loseLife()
        break
      }
    }

    // Enemies reach ship line
    for (let j = 0; j < this.state.enemies.length; j++) {
      const e = this.state.enemies[j]
      if (e.alive && e.y + e.h >= this.state.shipY - 4) {
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

    this.updateHud()
    this.draw()
  },

  fire() {
    if (this.state.bullets.length >= 4) return
    this.state.bullets.push({
      x: this.state.shipX,
      y: this.state.shipY - 6,
      r: 3
    })
  },

  enemyShoot() {
    this.state.enemyFireCd--
    if (this.state.enemyFireCd > 0) return
    // chance scales with wave and remaining aliens
    const base = 18 - Math.min(this.state.wave, 10)
    this.state.enemyFireCd = base + (this.state.aliveCount > 20 ? 8 : 3)

    // pick random alive enemy from bottom-most in a column
    const candidates = []
    for (let i = 0; i < this.state.enemies.length; i++) {
      const e = this.state.enemies[i]
      if (e.alive) candidates.push(e)
    }
    if (candidates.length === 0) return
    const e = candidates[Math.floor(Math.random() * candidates.length)]
    this.state.eBullets.push({
      x: e.x + e.w / 2,
      y: e.y + e.h,
      r: 3
    })
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

    // Faster when fewer alive (classic feel)
    const haste = 1 + (40 - this.state.aliveCount) * 0.08
    const speed = (4 + this.state.wave * 0.6) * haste
    let dir = this.state.enemyDir
    let hitEdge = false
    if (dir > 0 && maxX + speed >= W - 6) hitEdge = true
    if (dir < 0 && minX - speed <= 6) hitEdge = true

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
    this.state.eBullets = []
    if (this.state.lives <= 0) {
      this.state.gameOver = true
    } else {
      this.state.shipX = W / 2
      this.spawnBunkers()
      // keep remaining enemies, slight push up if too low
      for (let i = 0; i < this.state.enemies.length; i++) {
        if (this.state.enemies[i].alive && this.state.enemies[i].y > 200) {
          this.state.enemies[i].y -= 40
        }
      }
    }
  },

  updateHud() {
    if (!this.state.hud) return
    const t = this.state.gameOver
      ? 'GAME OVER ' + this.state.score + ' TAP'
      : '' + this.state.score + '   HP' + this.state.lives + '   W' + this.state.wave
    try {
      this.state.hud.setProperty(prop.MORE, {
        x: 6, y: 4, w: W - 12, h: 26, text: t
      })
    } catch (e) {
      try { this.state.hud.setProperty(prop.TEXT, t) } catch (e2) {}
    }
  },

  draw() {
    const c = this.state.canvas
    if (!c) return
    try { c.clear({ x: 0, y: 0, w: W, h: H }) } catch (e) {}
    c.drawRect({ x1: 0, y1: 0, x2: W, y2: H, color: 0x030308 })

    // bunkers
    for (let i = 0; i < this.state.bunkers.length; i++) {
      const b = this.state.bunkers[i]
      if (b.hp <= 0) continue
      const g = 40 + b.hp * 20
      const col = (g << 8) | 0x40
      c.drawRect({
        x1: Math.floor(b.x),
        y1: Math.floor(b.y),
        x2: Math.floor(b.x + b.w),
        y2: Math.floor(b.y + b.h),
        color: col
      })
    }

    // enemies
    const colors = [0xff4466, 0xff8844, 0x44cc66, 0x44cc66, 0x44aaff]
    for (let i = 0; i < this.state.enemies.length; i++) {
      const e = this.state.enemies[i]
      if (!e.alive) continue
      const col = colors[e.row] || 0x44aaff
      c.drawRect({
        x1: Math.floor(e.x),
        y1: Math.floor(e.y),
        x2: Math.floor(e.x + e.w),
        y2: Math.floor(e.y + e.h),
        color: col
      })
    }

    // player bullets
    for (let i = 0; i < this.state.bullets.length; i++) {
      const b = this.state.bullets[i]
      c.drawCircle({
        center_x: Math.floor(b.x),
        center_y: Math.floor(b.y),
        radius: b.r,
        color: 0xffee44
      })
    }

    // enemy bullets
    for (let i = 0; i < this.state.eBullets.length; i++) {
      const b = this.state.eBullets[i]
      c.drawCircle({
        center_x: Math.floor(b.x),
        center_y: Math.floor(b.y),
        radius: b.r,
        color: 0xff3355
      })
    }

    // ship
    const sx = Math.floor(this.state.shipX)
    const sy = Math.floor(this.state.shipY)
    const hw = Math.floor(this.state.shipW / 2)
    c.drawRect({
      x1: sx - hw,
      y1: sy + 6,
      x2: sx + hw,
      y2: sy + this.state.shipH,
      color: 0x33ccff
    })
    c.drawRect({
      x1: sx - 8,
      y1: sy,
      x2: sx + 8,
      y2: sy + 10,
      color: 0xffffff
    })
  },

  onDestroy() {
    if (this.state.timer) {
      try { clearInterval(this.state.timer) } catch (e) {}
      this.state.timer = null
    }
  }
})
