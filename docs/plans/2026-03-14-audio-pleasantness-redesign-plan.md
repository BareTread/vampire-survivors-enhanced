# Audio Pleasantness And Exotic Redesign Plan

## Goal

Make the game sound more exotic, fun, and pleasant over long play sessions without losing combat feedback. Prioritize ear comfort, stronger weapon identity, and a more distinctive musical world over sheer loudness or aggression.

## Current Problems

- Common sounds are synth-heavy, bright, and too closely related in tone, so repeated combat events blur together.
- Ambient layers are weak and likely not truly persistent, so the mix lacks a soft musical bed.
- Adaptive music and one-shot SFX do not share a clearly managed bus structure, which limits cohesive mix control.
- Spam events like gem pickup, enemy death, and repeated weapon fire still generate fatigue even with simple throttling.
- Some important cues are undefined or inconsistent (`bossSpawn`, `bossWarning`, `weaponFire`).

## Creative Direction

- Aim for a "moonlit occult bazaar" palette instead of pure gothic harshness.
- Use warm drones, hand-drum pulse, airy reed-like tones, glassy plucks, soft bells, breathy noise, and hollow wood/bone textures.
- Favor modal color from D harmonic minor / Phrygian dominant for music, reward cues, and some weapon accents.
- Keep danger readable by changing rhythm, density, and orchestration first; only increase brightness or volume in narrow, intentional moments.

## Rules For The Implementing Agent

- Keep the audio pass surgical; do not rewrite unrelated gameplay systems.
- Preserve current public call sites where possible; improve behavior behind `AudioManager` and `AdaptiveMusicSystem` first.
- After each landed batch, append a dated entry to the Implementation Log in this file.
- After each major milestone, append a short developer-log note to `CLAUDE.md` with behavior changes, files touched, and verification.
- Verify changes by browser playtesting at minimum; prefer adding small deterministic tests for new aggregation/state logic.

## Success Criteria

- Core combat loop sounds less sharp and less repetitive over a 10-minute run.
- Background ambience remains present and pleasant when action is low.
- High-density pickup/kill moments read as satisfying clusters instead of rapid-fire ping spam.
- Each major weapon family has a distinct sonic identity.
- Important boss/UI/progression cues are consistent and clearly audible without spiking the mix.

## Planned Fix Order

1. Mix architecture and ambient bed.
2. Event aggregation for spam-heavy sounds.
3. Weapon identity pass for the most-used weapons.
4. Adaptive music palette redesign.
5. Boss/reward/UI cue cleanup.
6. Verification pass and tuning notes.

## Phase 1 - Mix Architecture And Ambient Bed

### Objectives

- Create a more controlled, pleasant mix before redesigning individual sounds.
- Make ambience persistent and supportive instead of incidental.

### Tasks

- Add internal buses in `src/core/AudioManager.js` for `ambient`, `music`, `combat`, `rewards`, and `ui`.
- Route `AdaptiveMusicSystem` into the shared `AudioManager` chain instead of connecting straight to destination.
- Add gentle EQ shaping per bus:
    - combat: mild high-frequency taming at high intensity
    - ambient: low volume, wide, soft high rolloff
    - rewards: slightly brighter than combat, but short-lived
    - ui: consistent, clean, low-volume
- Honor loop-style ambient definitions so `heartbeat`, `windHowl`, and future beds behave like true sustained layers.
- Replace the current ambient startup with a small layered bed: wind, low drone, and sparse ritual pulse.

### Verification

- Start a run and idle for 30 seconds: ambience should remain present without sounding repetitive or harsh.
- Enter high-density combat: ambience should stay audible but not compete with hits.

## Phase 2 - Event Aggregation And Ear-Fatigue Reduction

### Objectives

- Turn repeated micro-events into smoother composite gestures.

### Tasks

- Add a short aggregation window for `experienceGain` so several gems collected together produce one rising cluster/chime instead of many individual pings.
- Add burst grouping for `enemyDeath` so kill waves produce one soft composite bloom with occasional accents.
- Add per-family concurrency caps, not just per-key throttle.
- Add dynamic softening under load: as simultaneous combat events rise, reduce brightness/noise before reducing level.
- Replace missing definitions for `bossSpawn`, `bossWarning`, and `weaponFire` with tuned, non-harsh defaults.

### Verification

- Pull a large gem pack with magnet: the result should sound like one satisfying phrase.
- Kill dense enemy clumps: no machine-gun crackle wall.

## Phase 3 - Weapon Identity Pass

### Objectives

- Make each frequently used weapon read instantly by ear.

### Priorities

- `magicMissile`
- `whip`
- `lightning`
- `fireWand`
- `boneBoomerang`
- `garlicPulse`

### Direction Per Weapon

- `magicMissile`: glassy pluck, airy tail, subtle harmonic sparkle.
- `whip`: cloth snap plus warm tom body, less brittle crack.
- `lightning`: filtered silk-tear zap, short electric sizzle, less white-noise harshness.
- `fireWand`: warm whoosh, ceramic burst, brushed flame texture.
- `boneBoomerang`: hollow flutter, playful return whistle, woody/bony timbre.
- `garlicPulse`: hypnotic shrine-bell hum, low-intensity halo rather than repetitive buzz.

### Verification

- In a run with mixed weapons, the player should be able to identify the active source by ear.

## Phase 4 - Adaptive Music Palette Redesign

### Objectives

- Make the soundtrack more exotic and less game-loop generic while staying unobtrusive.

### Tasks

- Retune melodic content away from the current plain C-minor feel toward D harmonic minor / Phrygian dominant colors.
- Replace or soften harsh triangle/high-pass tension layers that dominate at high intensity.
- Evolve intensity through density and rhythm first:
    - low intensity: drone, sparse pulse, occasional ornament
    - medium intensity: hand-drum pattern, modal ostinato
    - high intensity: denser pulse, accented low percussion, more active melodic fragments
- Add small pitch drift and phrase variation to avoid repetitive loops.
- Keep master music level below SFX, but make the timbre warmer and more emotionally rewarding.

### Verification

- Compare first minute, mid-combat, and near-overrun states; each should feel related but clearly evolved.

## Phase 5 - Boss, Reward, And UI Cue Cleanup

### Objectives

- Make milestone moments feel special without blasting the player.

### Tasks

- Create distinct boss warning/spawn cues with low-mid authority rather than shrill alarm energy.
- Redesign `levelUp`, `weaponUpgrade`, `achievementUnlock`, and `powerUpCollect` to share a coherent modal reward language.
- Ensure menu/UI sounds are short, soft, and elegant.
- Reserve the brightest/highest material for truly rare events.

### Verification

- Trigger level-up, upgrade, chest, and boss moments in sequence; each should feel celebratory but not tiring.

## Phase 6 - Tuning, Playtest Notes, And Guardrails

### Tasks

- Add debug-facing mix controls if useful for tuning bus gains and aggregation windows.
- Capture quick playtest notes for at least three scenarios: idle, normal run, heavy swarm.
- If new audio state logic is added, cover it with targeted tests where practical.
- Record any intentional compromises in the Implementation Log.

## Suggested File Touch Order

- `src/core/AudioManager.js`
- `src/systems/AdaptiveMusicSystem.js`
- `src/core/VampireSurvivorsGame.js` only if needed for better audio-state hooks
- weapon files only where current trigger behavior must be tuned
- tests for aggregation/state logic if added

## Risks

- Over-designing synth recipes before fixing bus routing and aggregation will waste time.
- More layers can sound better at low density but worse in swarms unless concurrency is managed.
- Exotic tonal choices can become distracting if reward cues and music do not share the same language.

## Implementation Log

### 2026-03-14 - Plan Created

- Created the audio redesign handoff plan focused on pleasantness, exotic musical identity, and fatigue reduction.
- Files touched: `docs/plans/2026-03-14-audio-pleasantness-redesign-plan.md`
- Verification: file created in repo.
- Remaining issues: all audio improvements still pending implementation.

### 2026-03-14 - Implementation Landed

- Completed the core redesign in `src/core/AudioManager.js` and `src/systems/AdaptiveMusicSystem.js`.
- Added shared `ambient` / `music` / `combat` / `reward` / `ui` buses, per-family concurrency caps, aggregation windows for `experienceGain` and `enemyDeath`, load-based brightness softening, persistent ambient beds, and defined defaults for `bossSpawn`, `bossWarning`, and `weaponFire`.
- Retuned the procedural music layer toward D harmonic minor / Phrygian dominant colors with warmer drone, hand-drum pulse, softer ornament layer, and shared music-bus routing through `AudioManager`.
- Revoiced major weapon/reward/UI cues toward the moonlit-occult-bazaar palette with softer synth recipes for magic missile, whip, lightning, fire wand, bone boomerang, garlic aura, boss, and progression moments.
- Added regression coverage in `tests/audio-manager.test.js` for aggregation behavior and family concurrency caps.
- Files touched: `src/core/AudioManager.js`, `src/systems/AdaptiveMusicSystem.js`, `tests/audio-manager.test.js`, `CLAUDE.md`, `docs/plans/2026-03-14-audio-pleasantness-redesign-plan.md`
- Verification: `node --check src/core/AudioManager.js`, `node --check src/systems/AdaptiveMusicSystem.js`, `node --check tests/audio-manager.test.js`, `npm test -- --runInBand tests/audio-manager.test.js`.
- Remaining issues: browser playtest / final ear-tuning still recommended before treating the mix as final-balanced.
