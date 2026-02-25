# Title Screen + Run Summary + Game Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a complete game flow loop: Title Screen → Gameplay → Run Summary → Title Screen, replacing the current prototype menu and DOM game-over overlay with polished canvas-rendered screens.

**Architecture:** Two new system files (TitleScreenSystem.js, RunSummarySystem.js) plus modifications to VampireSurvivorsGame.js for state routing. All screens are canvas-rendered for visual consistency. New game states: 'summary' (post-death stats) and 'upgrades' (shop sub-screen of title). PersistenceSystem already has purchaseUpgrade(), getUpgradeInfo(), records — we just need the UI.

**Tech Stack:** Vanilla JS, HTML5 Canvas 2D, existing PersistenceSystem/GoldSystem APIs.

---

### Task 1: TitleScreenSystem.js — Core Rendering

**Files:**
- Create: `src/systems/TitleScreenSystem.js`

Create the title screen system with atmospheric background, title, and menu navigation.

**Implementation:**

```js
// TitleScreenSystem.js — Canvas-rendered title screen with menu navigation
//
// Renders: animated dark gradient bg, floating particles, glowing title,
// menu items (PLAY/UPGRADES/SETTINGS), keyboard+mouse nav, personal records.
// Also renders upgrade shop sub-view when 'upgrades' state is active.
//
// API:
//   constructor(game) — stores game ref, initializes particles and menu state
//   update(dt) — animate particles, title glow, button hover effects
//   render(ctx) — draw full title screen (called from renderMenu())
//   renderUpgrades(ctx) — draw upgrade shop overlay
//   handleInput(key) — arrow keys, enter, escape for menu navigation
//   handleClick(x, y) — mouse click on menu items
//   handleMouseMove(x, y) — hover detection for menu items
//   reset() — reset to default menu state (selected=0, no sub-view)
```

Key rendering layers:
1. **Background**: Dark gradient (#0a0a1a → #1a0a2e) with slow hue shift
2. **Particles**: 60 floating embers/wisps, low alpha, long lifetime, gentle drift
3. **Title**: "VAMPIRE SURVIVORS" in large bold font, red-gold glow pulse. "ENHANCED" smaller below in purple.
4. **Menu items**: 3 items vertically centered below title. Selected item has glow + slight scale. Items: PLAY, UPGRADES (shows gold balance), SETTINGS.
5. **Personal records**: Bottom of screen, small text, showing best time/kills/level from PersistenceSystem.data.records
6. **Version/credit**: Tiny bottom-right corner text

Menu state:
- `this.selectedIndex` (0-2) for keyboard nav
- `this.menuItems` array with { label, y, width, height } for hit testing
- `this.particles` array for ambient effects
- `this.titleGlow` oscillating 0-1 for pulse effect
- `this.subView` — null or 'upgrades' for shop overlay

**Step 1:** Write the full TitleScreenSystem.js file with all methods.

**Step 2:** Verify syntax: `node --check src/systems/TitleScreenSystem.js`

---

### Task 2: RunSummarySystem.js — Post-Death Stats Screen

**Files:**
- Create: `src/systems/RunSummarySystem.js`

Canvas-rendered run summary shown after death. Staggered stat reveals, record badges, gold animation.

**Implementation:**

```js
// RunSummarySystem.js — Canvas-rendered post-death stats screen
//
// API:
//   constructor(game)
//   show(runData) — initialize with run stats, start reveal animations
//     runData: { kills, survivalTime, level, goldEarned, combo, weaponsUsed, damageDealt, score, wave }
//   update(dt) — animate stat reveals, gold counter, button hover
//   render(ctx) — draw summary screen
//   handleInput(key) — R=play again, M/Escape=menu, Enter=selected button
//   handleClick(x, y) — click PLAY AGAIN or MAIN MENU buttons
//   handleMouseMove(x, y) — hover detection
//   reset() — clear state
```

Key features:
1. **Background**: Semi-transparent dark overlay over frozen game scene
2. **Header**: "FALLEN IN BATTLE" with skull motif, red glow
3. **Stats panel**: 6 stats revealed one at a time (0.3s stagger):
   - Time Survived, Enemies Slain, Level Reached, Best Combo, Gold Earned, Damage Dealt
4. **Record badges**: Compare each stat to PersistenceSystem records. If beaten, show "NEW RECORD!" in gold with sparkle
5. **Gold counter**: Animated count-up from 0 to goldEarned over 1.5s
6. **Buttons**: PLAY AGAIN (green) and MAIN MENU (purple), keyboard hints below
7. **Weapons used**: Small row of weapon names at bottom

State:
- `this.runData` — stats from the run
- `this.revealTimer` — tracks staggered reveal progress
- `this.goldCounter` — animated gold display value
- `this.selectedButton` — 0 or 1 for keyboard nav
- `this.newRecords` — set of stat names that beat previous records
- `this.active` — whether summary is showing

**Step 1:** Write the full RunSummarySystem.js file.

**Step 2:** Verify syntax: `node --check src/systems/RunSummarySystem.js`

---

### Task 3: Wire Systems into VampireSurvivorsGame.js

**Files:**
- Modify: `src/core/VampireSurvivorsGame.js`

Add imports, instantiate systems, route game states.

**Changes:**

1. **Imports** (after line 23, BossSystem import):
```js
import { TitleScreenSystem } from '../systems/TitleScreenSystem.js';
import { RunSummarySystem } from '../systems/RunSummarySystem.js';
```

2. **Systems init** (in constructor, after `this.systems.boss = ...`):
```js
this.systems.titleScreen = new TitleScreenSystem(this);
this.systems.runSummary = new RunSummarySystem(this);
```

3. **Remove DOM game-over UI**: In `createUIElements()`, remove the call to `this.createGameOverUI(uiContainer)` (line 271). Remove the `createGameOverUI()` method entirely (lines 404-480). Remove `showGameOverUI()`, `hideGameOverUI()`, `updateFinalStats()` methods.

4. **Remove DOM menu message**: Remove `showMenuMessage()` and `hideMenuMessage()` methods (lines 1277-1307). Remove calls to them in `start()`, `startGame()`, `returnToMenu()`.

5. **Modify gameOver()** (line 904):
```js
gameOver() {
    this.gameState = 'gameOver';
    this.timeScale = 0;

    if (this.systems.adaptiveMusic) {
        this.systems.adaptiveMusic.stop();
    }

    // Collect run stats
    const runData = {
        kills: this.systems.killMilestone ? this.systems.killMilestone.totalKills : 0,
        survivalTime: this.gameTime,
        level: this.player ? this.player.level : 1,
        goldEarned: this.systems.gold ? this.systems.gold.runGold : 0,
        combo: this.player && this.player.combo ? this.player.combo.best : 0,
        weaponsUsed: this.player ? Array.from(this.player.weapons.keys()) : [],
        damageDealt: this.score || 0,
        score: this.score || 0,
        wave: this.systems.enemy.getCurrentWave()
    };

    // Persist run stats
    if (this.systems.persistence && this.player) {
        this.systems.persistence.recordRunEnd(runData);
    }

    // Transition to summary after brief delay
    managedSetTimeout(() => {
        this.gameState = 'summary';
        this.systems.runSummary.show(runData);
    }, 1500); // 1.5s death pause before summary
}
```

6. **Modify restartGame()** (line 871):
```js
restartGame() {
    this.systems.runSummary.reset();
    this.startGame();
}
```

7. **Modify returnToMenu()** (line 877):
```js
returnToMenu() {
    this.gameState = 'menu';
    this.timeScale = 1.0;
    this.systems.runSummary.reset();
    this.systems.titleScreen.reset();
    // ... existing cleanup code stays ...
    // Remove: this.showMenuMessage();
    this.updateUIVisibility();
}
```

8. **Modify render()** — add summary state handling (after line 1712):
```js
if (this.gameState === 'menu' || this.gameState === 'upgrades') {
    this.renderMenu();
    return;
}

if (this.gameState === 'summary') {
    // Render frozen game scene behind summary
    // ... existing game render code ...
    // Then overlay summary
    this.systems.runSummary.render(this.ctx);
    return;
}
```

Actually — for the summary, we want the frozen game visible behind it. So the summary render should happen AFTER the normal game render, as an overlay. Change the render flow:

```js
// In render(), line 1710:
if (this.gameState === 'menu' || this.gameState === 'upgrades') {
    this.systems.titleScreen.render(this.ctx);
    return;
}

// ... existing game rendering ...

// After all game rendering (line ~1825), before endFrame:
if (this.gameState === 'summary') {
    this.systems.runSummary.render(this.ctx);
}
if (this.gameState === 'gameOver') {
    // Render a darkening overlay during the 1.5s death pause
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
}
```

9. **Modify handleClick()** (line 785):
```js
handleClick(e) {
    if (this.levelUpActive) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.gameState === 'menu' || this.gameState === 'upgrades') {
        this.systems.titleScreen.handleClick(x, y);
    } else if (this.gameState === 'summary') {
        this.systems.runSummary.handleClick(x, y);
    }
}
```

10. **Modify handleKeyDown()** — route to title/summary systems:
- Space/Enter on 'menu' → `this.systems.titleScreen.handleInput(key)` instead of direct `startGame()`
- Arrow keys on 'menu'/'upgrades' → `this.systems.titleScreen.handleInput(key)`
- R/M on 'summary' → `this.systems.runSummary.handleInput(key)` (which calls game.restartGame/returnToMenu)
- Remove the gameOver R/M handlers (summary replaces them)
- Remove the space→startGame shortcut (title screen handles it)

11. **Add mouse move routing** in setupInput():
```js
this.canvas.addEventListener('mousemove', (e) => {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (this.gameState === 'menu' || this.gameState === 'upgrades') {
        this.systems.titleScreen.handleMouseMove(x, y);
    } else if (this.gameState === 'summary') {
        this.systems.runSummary.handleMouseMove(x, y);
    }
});
```

12. **Update update()** — add title screen update:
```js
// Before the playing/levelUp guard (line 1611):
if (this.gameState === 'menu' || this.gameState === 'upgrades') {
    this.systems.titleScreen.update(dt);
    return;
}
if (this.gameState === 'summary') {
    this.systems.runSummary.update(dt);
    // Don't return — let particles/damage numbers decay
}
```

13. **Modify startGame()** — remove `this.hideMenuMessage()` call (line 803).

14. **updateUIVisibility()** — add summary state hides HUD:
```js
updateUIVisibility() {
    const hud = document.getElementById('game-hud');
    if (hud) {
        hud.style.display = (this.gameState === 'playing' || this.gameState === 'paused' || this.gameState === 'levelUp')
            ? 'block' : 'none';
    }
}
```
(This already works — 'summary', 'menu', 'upgrades' all hide the HUD.)

**Step 1:** Apply all modifications to VampireSurvivorsGame.js.

**Step 2:** Verify syntax: `node --check src/core/VampireSurvivorsGame.js`

---

### Task 4: Verify & Polish

**Step 1:** Run `node --check` on all three files.

**Step 2:** Update `CLAUDE.md` — add TitleScreenSystem and RunSummarySystem to the file listings, document new game states, update developer log.

**Step 3:** Update `GAME_EVOLUTION_MASTERPLAN.md` — mark Title Screen + Game Flow [M] and Run Summary Screen [M] as complete, write Agent #7 handoff.

---

## Execution Notes

- **No TDD**: This is a vanilla JS browser game with no test framework. Verification = `node --check` + manual browser testing.
- **Canvas-only screens**: Both new screens render entirely to canvas. No new DOM elements for menus.
- **PersistenceSystem API**: Already has `getUpgradeInfo()`, `purchaseUpgrade(id)`, `getGold()`, `data.records` — all we need for the upgrade shop and record display.
- **Upgrade shop**: Rendered as a sub-view of the title screen when gameState='upgrades'. Shows 8 upgrades with costs, levels, gold balance, buy with click/Enter.
- **Death pause**: 1.5s between player death and summary appearing, with a darkening overlay. This gives the death moment room to breathe.
