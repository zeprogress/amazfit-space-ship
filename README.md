# Space Ship

Original arcade-style space shooter for **Amazfit Bip Max** (Zepp OS).

Not affiliated with any third-party mobile game. Classic invader-genre mechanics; original code and simple vector art.

## Controls

- **Slide finger** left/right — move ship
- **Auto-fire** — continuous shooting
- **Tap** after Game Over — restart

## Gameplay

- Grid of aliens moves sideways, steps down at edges
- Clear a wave → next wave (faster)
- 3 lives, score, wave counter

## Install

```bash
git clone https://github.com/zeprogress/amazfit-space-ship.git
cd amazfit-space-ship
mkdir -p assets/bip-max
# add any 192×192 PNG:
# cp ~/icon.png assets/bip-max/icon.png
zeus preview
```

Select **Amazfit Bip Max**, scan QR in Zepp (developer mode).

## Tech

- Canvas render ~12 FPS
- Touch: `CLICK_DOWN` / `MOVE` / `CLICK_UP`
- No sound in v1.0.0
