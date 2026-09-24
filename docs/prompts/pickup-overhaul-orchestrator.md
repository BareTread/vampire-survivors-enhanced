# MASTER PROMPT — Pickup & Reward Reliability Pass (orchestrator + subagents)

You are the **orchestrator** for a focused engineering pass on *Vampire Survivors — Enhanced* (vanilla JS ES modules, Canvas 2D, no build step, Jest tests). You plan, brief, integrate and judge. **Subagents write the code; you own the design contract, the merge order and the final verdict.** Never mark something done without evidence you have seen yourself.

## Mission (one sentence)

Make every pickup **reliable, truthful and worth moving for**: earned resources are never lost, rewards never punish or downgrade, and tactical pickups stay tactical decisions. **Do not add new pickup types.**

---

## Phase 0 — Ground truth (you, before spawning anyone)

1. `git fetch origin && git log --oneline -1 origin/main`. Your base **must contain `8557a72`** (PR #8). If the local HEAD (e.g. `31d3b78`) lacks it, rebase or merge onto `origin/main` first. The audit below was partly written against older code.
2. Read `CLAUDE.md` in full, especially the 2026-09-24 entries (game-feel, performance). Those rules are binding:
   - No camera shake without intent. Use trauma ceilings or `shakeAt`.
   - No `shadowBlur` or full-screen gradients in the frame loop. Bake static art.
   - Hero text goes through `Player.callout()`.
   - Bump the cache-bust string (currently `20260924-feel1`) in `index.html`, `src/vampireMain.js` and `src/systems/CanvasHUD.js` at the end.
3. Run `npm test -- --runInBand` and record the baseline (195 passing expected). Create the branch `pickups/reliability`.
4. **Known stale claims.** Main already fixed some audit items in PR #7; verify them, don't redo them:
   - Relic drops no longer use the "20% per kill after combo 20" rule. They come mostly from elites (35%), non-elites drop at 0.4%, there's a 25 s cooldown and at most 3 on the floor. See `Enemy.js` ~L1049 and `VampireSurvivorsGame.spawnPowerUpDrop`.
   - Buffs are already sprites: see `src/entities/rendering/PickupArt.js` (vial, ward, feather, burning skull, lodestone, hourglass).
   - **Still live:** streak buffs in `Player.js` ~L996–1002 (damage 1.5+, speed 1.3, fireRate 0.7).

## Phase 1 — Prove each bug (parallel, read-only + tests only)

Spawn **one verifier subagent per audit row** (all in parallel). Each one must return **either a failing Jest test that reproduces the bug on current main, or `STALE` with evidence** (file:line of the code that already handles it). No production code edits in this phase. Put the tests in `tests/pickups.test.js`, one `describe` per row, named after the row.

| # | Claim to verify | Where to look |
|---|---|---|
| R1 | Gem cap deletes XP: 61 gems → 60 remain; the oldest is `shift()`ed away | `ExperienceSystem.js` ~L174 |
| R2 | Gems within ±400 of the origin vanish (spawn heuristic), even under global magnet | `ExperienceGem.js` ~L107 |
| R3 | Gem expiry deletes XP, including mid-vacuum | `ExperienceGem.js` ~L136 |
| R4 | Timed Magnet radius is viewport-derived (~144u), weaker than max Attractorb (180u) | `VampireSurvivorsGame` magnet pickup, `ExperienceSystem.activateAreaMagnet` |
| R5 | Vacuum ignores gold | `FloorItemSystem` vacuum, `GoldSystem` |
| R6 | A weaker duplicate buff overwrites a stronger one (6×/15 s → 3×/10 s) | `Player.activatePowerUp` |
| R7 | Rosary kills an explosive elite → the player takes 33 dmg | `FloorItemSystem` rosary, `Enemy` `explodeOnDeath` |
| R8 | Boss chest is dropped silently when `items.length >= maxItems` (20) | `FloorItemSystem.js` ~L271/293, `BossSystem._onBossDeath` |
| R9 | A multi-level-up resumes `playing` at full timeScale for ~500 ms between picks | level-up flow in `VampireSurvivorsGame` |
| R10 | "+30% fire rate" is really cooldown ×0.7 (≈ +43% attacks); streak fireRate is inconsistent with the pickup | `Player`, HUD, level-up text |
| R11 | HUD magnet pill ignores the floor-Vacuum / area-magnet timer | `CanvasHUD.js` ~L511 |

**Gate:** you personally run the suite and confirm every non-STALE row is red for the stated reason. Discard any repro that fails for the wrong reason.

## Phase 2 — The Reward Contract (you write it; no code yet)

Write `docs/REWARD_CONTRACT.md`: short, numbered and testable. Every subagent receives it verbatim. Start from these decisions (they are made; don't relitigate):

1. **Conservation.** The cap limits *rendered objects*, never *value*.
   - At the cap, merge the new gem into the nearest existing gem (value adds up; tier and colour upgrade by value).
   - Delete the origin heuristic.
   - Gems don't expire. Old, far gems consolidate into a bigger gem instead.
   - Invariant: `sum(gem values on floor) + XP awarded == XP dropped`, always.
2. **Claimed means collected.** A resource targeted by Vacuum gets `claimed = true`. It homes with ramping speed, ignores expiry and magnet timers, and cannot be culled or pooled until it is collected.
3. **Vacuum scope.** Vacuum collects **XP and gold** only. Health, buffs, rosary, chests and other vacuums stay on the ground. Show the haul with one `callout`: `+420 XP · 38 gold`.
4. **Magnetic Field** (renamed timed Magnet): the radius comes from the player's *effective* pickup range, so it always beats Attractorb (e.g. `max(3 × effectiveRange, 360)`). It pulls XP and gold only.
5. **Buffs are layers.** Each buff type keeps a list of `{strength, expiresAt}` (max 3 entries); the effective strength is the max over unexpired layers. This gives both invariants for free:
   - A pickup never lowers current strength or shortens the strong layer.
   - A weak pickup never extends a strong one: it only adds its own tail.

   Put every number in **one table**, `src/data/powerUps.js` (label, colour, duration, strength, HUD wording). Pickups, streaks, wave rewards and the HUD all read it; no inline magic numbers remain.
6. **Honest wording.** Fire rate means *attacks per second*: "+30% attack speed" is cooldown ÷ 1.3. Streak versions use the same table and are never *weaker* than the pickup.
7. **Health isn't wasted.** Health pickups aren't consumed at full HP. The callout shows the HP actually restored.
8. **Rosary is safe.** Kills from the cleanse pass `cause: 'rosary'`. Hostile death effects (explosion, split, summon-on-death) don't fire for that cause. Kill credit, XP and gold stay.
9. **Guaranteed means guaranteed.** Boss and event rewards bypass `maxItems`. If the floor is full, evict the oldest *non-guaranteed* item. Bias boss chests toward build progress: a weapon level if any weapon isn't maxed, else a passive level, and gold only as a fallback. **Do not** move evolutions into chests.
10. **Level-up queue.** The game stays paused through all queued picks. Cards show "1 of 3". After the final pick, grant 0.4 s of i-frames with no flash.
11. **HUD reads effect state, not pickup state.** The Magnet pill = `max(player layer, experience.areaMagnetTimer, globalMagnetTimer)`.

Add a **property test** for the buff contract: ≥500 random pickup sequences asserting both invariants from rule 5. Add a conservation property test for rule 1: random spawns, caps and collections.

## Phase 3 — Implement (parallel, file ownership = no conflicts)

Give each workstream its **own git worktree** off `pickups/reliability`. Each owns specific files; touching another's file means stopping and reporting to you instead.

| WS | Owns | Rows |
|---|---|---|
| **A — XP economy** | `ExperienceSystem.js`, `ExperienceGem.js`, `GoldSystem.js` (vacuum/magnet hooks only) | R1–R5 |
| **B — Buff model** | `src/data/powerUps.js` (new), `Player.js` (buff + streak code only), `CanvasHUD.js` | R6, R10, R11 |
| **C — Floor items** | `FloorItemSystem.js`, `Enemy.js` (death-cause plumbing only), `BossSystem.js` (reward call only) | R7, R8 |
| **D — Game glue** | `VampireSurvivorsGame.js` (pickup handler, level-up queue, magnet activation) | R9, plus wiring for A/B |

D depends on A and B's public APIs. Have A and B **publish their API signatures to you first** (≤10 lines each); forward them to D, then run all four in parallel.

**Subagent brief template (use it for every spawn):**
- Goal (one line) and the Contract rules you own, pasted verbatim.
- Owned files (you may edit) and forbidden files (you may read).
- Red tests you must turn green. You may **add** tests; never weaken, skip or delete one.
- Constraints: match the surrounding code style; follow the CLAUDE.md rules (no `shadowBlur`, no new shake, `callout` for hero text); stay within the per-frame budget (no O(n²) merges — use the existing spatial grid).
- Done means: `npm test -- --runInBand` green in your worktree, plus `node --check` on the touched files.
- Report in ≤200 words: what changed, anything that deviates from the Contract and why, open risks. **No code dumps.**

**Integration (you):** merge A → B → C → D sequentially into `pickups/reliability`. Run the full suite after each merge and resolve conflicts yourself.

## Phase 4 — Break it (fresh eyes)

Spawn in parallel. Reviewers must **not** have written the code they review.

1. **Adversarial reviewer ×2** (split A+C and B+D). Brief: "Try to violate the Contract. For every violation, write a failing test and report it. Look for: pooled objects reused while claimed, merge value double-counting, layers never pruned, timeScale leaks, rosary cause lost through wrappers (Wraith/Demon `updateDeath`), the HUD reading stale fields." Loop any findings back to the owning workstream.
2. **Browser playtester.** Serve the game with `python -m http.server`. Drive it with Puppeteer (Chromium lives at `/opt/pw-browsers`; never run `playwright install`). Script each audit scenario against the *real* game objects and screenshot it:
   - 61 gems, then a vacuum.
   - A gem near (100, 0).
   - A 6× buff, then a 3× buff.
   - Rosary against explosive elites.
   - A boss death with 20 items on the floor.
   - A triple level-up.

   Also do a visual pass: haul callout legible, pills correct, no text overlap at 1280×720 and 390×844. Return a pass/fail table plus screenshot paths.
3. **Perf check.** Take a crowd scene (~130 enemies, 300+ gems) and compare against baseline: it must still hold 60 FPS, with gem merging keeping the count bounded.

## Phase 5 — Measure before tuning (data, then numbers)

Only once Phases 3–4 are green. Add opt-in telemetry: `debugCommands.getRewardStats()`. It reports:
- % of combat time buffed, per type.
- Pickups collected vs expired.
- Wasted healing.
- XP dropped vs awarded (this must be 0 lost).
- Damage and fire-rate overlap.

Run 3× 10-minute simulations in god mode (a scripted kiting path; the repo's old bot stands in packs and ignores pickups, so don't trust it for feel). **Only then** propose values from the table: speed +50%, damage 2× for 8–10 s, and streaks shifted toward XP/score rather than combat power. Put the before/after numbers in the report. If the data doesn't support a change, don't make it.

## Finish

- Add a CLAUDE.md dev-log entry (newest first, same style): the Contract, `powerUps.js` as the single source, and the invariants.
- Bump the cache-bust string. Run the full suite green and commit per workstream, with clear messages. Open **one PR** whose body is the final table:

| Row | Status (fixed / stale / won't fix) | Evidence (test name or screenshot) |
|---|---|---|

## Orchestrator rules

- **Parallelize anything independent; serialize only on shared files.** Spawn phase batches in a single message.
- Keep your own context lean: subagents report summaries, and you read diffs, not narratives.
- A claim without a test or screenshot is unverified. Say so; don't round it up to "done".
- When a subagent disagrees with the Contract, weigh the evidence. If you change the Contract, re-broadcast it to every active workstream.
- Scope guard: no new pickups, no evolution redesign, no shake or perf regressions, no unrelated refactors. Log anything tempting as a follow-up in the PR body.
