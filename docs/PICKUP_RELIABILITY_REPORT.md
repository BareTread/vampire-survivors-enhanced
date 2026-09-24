# Pickup reliability report

Base: `7489914` (includes required `8557a72`). Branch: `pickups/reliability`.

All eleven audit rows reproduced on the base; none were stale. The reproduction gate had 20 failures and one control pass. Behavior is governed by the [Reward Contract](REWARD_CONTRACT.md); timed reward profiles, labels and strength semantics live in `src/data/powerUps.js`.

## Audit disposition

Tests below are in [`tests/pickups.test.js`](../tests/pickups.test.js), unless another file is named.

| Row | Status | Evidence |
|---|---|---|
| R1 — gem cap destroys XP | fixed | `spawning past the cap conserves every dropped XP point`; [61-gem vacuum](verification/pickups/vacuum-haul.webp). Cap 60 now retains 305/305 XP. |
| R2 — origin heuristic removes valid gems | fixed | `legitimate world-space gem near origin survives while player is far away`; [origin gem](verification/pickups/origin-gem.webp). |
| R3 — expiry loses XP during attraction | fixed | `a gem claimed by vacuum is not destroyed by age expiry and still pays out`; `expired gem XP is conserved instead of vanishing`. |
| R4 — timed magnet weaker than pickup range | fixed | `timed Magnet radius follows pickup range, not the viewport`; world radius is max(3 × effective pickup range, 360). |
| R5 — Vacuum ignores gold | fixed | `vacuum pickup collects a gold coin far beyond magnetRange`; [305 XP / 50 gold haul](verification/pickups/vacuum-haul.webp). |
| R6 — weaker pickup replaces stronger buff | fixed | `effective strength stays 6x after a 3x duplicate`; `strong duration stays 15s after a 10s duplicate`; [6× pill](verification/pickups/strong-buff.webp). |
| R7 — rosary triggers hostile death effects | fixed | `rosary kill of a nearby explosive elite does not damage the player`; [safe cleanse](verification/pickups/rosary.webp). Phased/pooled Wraith regressions are in `pickups-adversarial-economy.test.js`. |
| R8 — full floor discards guaranteed boss chest | fixed | `BossSystem._onBossDeath reward path delivers the chest on a full floor`; [boss rewards](verification/pickups/boss-rewards.webp). |
| R9 — queued picks briefly resume combat | fixed | `a double XP level-up never resumes gameplay during the 500ms gap`; [pick 1](verification/pickups/level-up-1.webp), [pick 2](verification/pickups/level-up-2.webp), [pick 3](verification/pickups/level-up-3.webp). |
| R10 — attack-speed wording disagrees with cooldown | fixed | `the "+30% fire rate" pickup grants +30% attack speed, not cooldown x0.7 (~+43%)`; actual Garlic Aura cadence covered in `pickups-adversarial-buffs.test.js`. |
| R11 — magnet HUD omits system timers | fixed | `floor Vacuum (globalMagnetTimer only, no player power-up) renders its remaining time`; `rendered timer is the max of player boost, area and global timers`. |

## Additional adversarial findings

- Expiry of a strong layer now refreshes weapon caches even while a weaker tail remains.
- Garlic Aura uses the effective attack-speed cooldown instead of an independent untuned timer.
- Opening a level-up during recovery or a weapon kill stops subsequent weapon/system ticks in that frame.
- Rosary passes through Wraith phase immunity; pooled Wraith reset clears phase state.
- Sparse expired-gem consolidation visits occupied grid buckets, not empty rings across world space. Claimed gems cannot be merge victims or return to the pool prematurely.
- Health stays on the floor at full HP or under `no_heals`; partial heals announce actual restored HP. Guaranteed rewards evict ordinary drops, never another guaranteed reward.

The independent-review findings had failing-before/passing-after regressions. Deterministic property coverage includes 500 buff sequences and 500 gem spawn/cap/collection sequences. Redundant wiring/default-copy assertions were removed rather than pinned to implementation details.

## Browser acceptance

Six real-object scenarios passed, with zero browser errors. Initial screenshot review rejected stale scenario captures and found a phone-only run-timer overlap; controlled recaptures and the narrow-layout correction passed inspection. [Structured results](verification/pickups/browser.json).

| CSS viewport | HUD | Queued upgrade cards |
|---|---|---|
| 1280×720 | [Pass](verification/pickups/desktop-hud.webp) | [Pass](verification/pickups/desktop-level-up.webp) |
| 390×844 | [Pass](verification/pickups/phone-hud.webp) | [Pass](verification/pickups/phone-level-up.webp) |

The UI integrity detector reported no findings on the changed HUD, run timer and level-up overlay. The cache-bust cutover is `20260924-pickups2` across the affected production import graph, including intermediate enemy/system imports—not just the entry script.

## Crowd performance

Actual requestAnimationFrame loop, 1280×720, ~130 spawned enemies, 360 five-XP drops, gem cap 60. Separate fresh tabs, 60 warmup frames and 300 measured frame intervals. [Measured data and limitations](verification/pickups/performance.json).

| Metric | Base `7489914` | Corrected `37a878f`, two runs |
|---|---:|---:|
| FPS | 60.001 | 60.002 / 60.002 |
| Frame median / p95 | 16.7 / 16.7 ms | 16.7 / 16.7–16.8 ms |
| Update median / p95 | 0.6 / 0.9 ms | 0.5–0.6 / 1.0 ms |
| Render median / p95 | 1.4 / 1.9 ms | 1.3–1.4 / 1.8–2.0 ms |
| Gem objects | 60 | 60 |
| XP dropped / retained | 1,800 / 300 | 1,800 / 1,800 |
| XP lost | 1,500 | 0 |

A separate stress probe raised the cap to 5,000 and retained all 3,000 XP in 600 far gems: cleanup took 0.2 ms over a ~120,000-unit sparse span versus 1.0 ms in the denser arrangement. This is a boundedness smoke check, not a statistical microbenchmark. Headless Chromium is limited to a 60 Hz RAF ceiling; these results do not establish performance on every device.

Final instrumented build `3359608` was exercised again after telemetry and the clock correction: **60.002 FPS**, 16.7 ms median / 16.8 ms p95 frame interval, 0.5/0.9 ms update median/p95 and 1.4/2.2 ms render median/p95. All 1,800 XP remained in 60 gems; zero browser errors.

## Opt-in reward telemetry

```js
debugCommands.setRewardTelemetry(true); // enable and start a fresh measurement window
debugCommands.getRewardStats();         // serializable snapshot; never enables implicitly
debugCommands.setRewardTelemetry(false); // stop collection and freeze the result
```

Starting a new run resets the window while preserving the opt-in setting. Returned snapshots cannot mutate the recorder, including frozen results. Disabled collection does not advance counters or allocate per frame.

- `combatSeconds`, `buffs[type].seconds/percent`: combat-clock coverage of any live layer, including weaker tails; Magnetic Field also includes area/global timers. Debug god mode does not count as an invincibility buff.
- `overlaps['damageBoost+fireRate']`: simultaneous coverage in seconds and percent.
- `pickups.collected/expired`: counts grouped by `relic`, `floorItem`, `gem`, and `coin`, then type. Only natural expiry counts; resets, merges and guaranteed-item eviction do not. Gems and tactical floor items do not naturally expire.
- `healing.requested/actual/wasted`: consumed health pickups only. Partial overheal counts as waste; rejected full-HP or `no_heals` pickups are not repeatedly counted.
- `xp.openingFloor/dropped/awardedBase/currentFloor/lost/bonus`: loss is `openingFloor + dropped - awardedBase - currentFloor`. Opening balance prevents false loss when enabling mid-run. `bonus` is total player XP granted minus base gem XP: it includes direct grants and multiplier effects, and can be negative under an XP penalty.
- `gold` uses the same base-value accounting and additionally reports `awarded` after collection multipliers. Ordinary expired coins can legitimately appear as gold loss; claimed coins cannot expire.

Main's real-browser smoke measured one combat second: 0.4 seconds damage coverage, 0.6 fire-rate coverage, 0.4 overlap, zero god-mode invincibility-buff coverage, and 9 dropped / 9 awarded base XP / 0 lost. Disabling froze both time and resource ledgers; mutating a returned snapshot did not change the next result. Zero browser errors.

## Post-selection clock correction

The first measurement harness was rejected: it forcibly resumed stalled clocks and omitted exception frames from its combat counter. Investigation exposed another R9 failure: selecting an evolution while paused started a camera hit-stop that saved `timeScale = 0`; its later expiry overwrote the final selection's resume with zero.

`Camera` now preserves a gameplay resume scale for hit-stop begun during selection and does not resume the clock while another pick remains open. Three real-class regressions cover final-selection resume, queued-selection pause and preservation of an existing playing slowdown. The new failure was reproduced before the fix; all three now pass.

## Verification and scoped follow-ups

- Full suite on `3359608`: **308 tests / 21 suites passing**. Baseline: 195 / 12. Syntax checks passed for the clock, main game and telemetry modules.
- **Pre-existing upgraded-Garlic error:** `GarlicAura` calls `statusEffect.applyEffect`, while `StatusEffectSystem` exposes `applyStatusEffect` and typed helpers. Both calls are present in baseline `7489914`. Actual game-loop recovery must remain in simulations; errors are not suppressed or presented as error-free play.
- **Pre-existing slow-motion recovery:** after slow-motion expiry, `ScreenEffectsSystem` performs one recovery interpolation and stops. A real-class probe remained at approximately `timeScale = 0.335` after 120 updates. This is a positive slowdown, not the R9 zero-clock stall. Left unchanged; simulation duration is measured in combat seconds rather than assuming wall time.
- Neither issue above is justification for changing pickup strength. They are separate follow-ups, not hidden changes in this PR.

## Three seeded ten-minute measurements

Accepted runs drive the **real `gameLoop`** with a virtual clock and fixed 1/60-second input ticks. Real error recovery, periodic cleanup, hit-stop, slow motion and timer callbacks remain active. Rendering/audio/visual effects are stubbed; this is a reward simulation, not an FPS measurement. Antonio starts without shop upgrades or challenge modifiers. A seeded controller keeps moving, retreats from dense enemies, approaches nearby rewards and selects real upgrades. God mode protects health without creating an invincibility buff.

The independent external collector and official telemetry agreed on every reported field within 0.000001. No forced clock resumes. [Full per-type counters, ledgers, checkpoints and limitations](verification/pickups/simulations.json).

| Seed | Baseline combat duration | Corrected combat seconds | Corrected XP dropped | Base XP awarded | XP still on floor | XP lost | Path travelled |
|---|---|---:|---:|---:|---:|---:|---:|
| 1729 | Stalled at 271.08s | 600.01474 | 129,472 | 126,822 | 2,650 | **0** | 94,059 px |
| 2718 | Completed 600.01s | 600.00264 | 131,504 | 125,840 | 5,664 | **0** | 87,715 px |
| 31415 | Stalled at 380.92s | 600.01180 | 113,611 | 107,303 | 6,308 | **0** | 83,716 px |

All corrected runs reached 600 combat seconds within one simulation tick. Baseline stalls had `playing` state, zero time scale and no remaining hit-stop—the R9 failure. Those partial controls are not presented as ten-minute runs. Their corrected checkpoints use the same combat horizon:

| Seed / matched horizon | Baseline XP lost | Corrected XP lost | Damage coverage before → after | Attack-speed coverage before → after |
|---|---:|---:|---|---|
| 1729 / 271.1s | 1,427 | 0 | 61.6% → 82.6% | 16.6% → 19.6% |
| 2718 / 600s | 65,661 | 0 | 85.7% → 85.7% | 12.5% → 16.3% |
| 31415 / 380.9s | 22,205 | 0 | 82.4% → 64.3% | 15.8% → 13.9% |

Baseline has no raw dropped-XP ledger; its external accounting may slightly undercount losses. Corrected conservation is exact. Matching seeds and durations does not hold combat outcomes constant once reward flow changes.

| Corrected seed | Damage buff | Speed buff | Attack-speed buff | Magnetic Field | Invincibility buff | Damage + attack-speed overlap |
|---|---:|---:|---:|---:|---:|---:|
| 1729 | 91.2% | 5.5% | 8.8% | 7.0% | 16.9% | 8.3% |
| 2718 | 85.7% | 8.0% | 16.3% | 2.1% | 16.1% | 13.6% |
| 31415 | 77.3% | 6.9% | 11.3% | 2.1% | 15.1% | 9.3% |

No corrected run consumed health at full HP, so measured healing waste was zero. The completed baseline seed consumed two orbs and two health relics at full HP: **148 requested, 0 restored, 148 wasted**. Ordinary coin expiry remains intentional: the completed control expired 967 coins versus 686 after correction; unclaimed gold loss is not mislabeled as XP loss. Per-family/type collected and expired counts are preserved in the linked data.

The upgraded-Garlic error occurred in both builds. Corrected runs invoked real throttled error recovery 26, 5 and 83 times respectively; these were **not error-free playthroughs**. Engine error-log counts cap at ten entries and are not total exception counts. Together with god mode, this limits balance conclusions; it does not invalidate the independently matched XP ledgers or completion clocks.

### Tuning decision

**No additional strength/duration or streak tuning shipped.**

| Proposal | Existing pickup profile | Decision from measurements |
|---|---|---|
| Speed +50% | ×2 for 8s | Decline. Coverage was only 5.5–8.0%; no human-control/feel evidence supports weakening the burst. |
| Damage ×2 for 8–10s | ×3 for 10s | Decline. Damage coverage was high, but god mode and existing weapon errors cannot establish that the peak multiplier is too strong. |
| Shift streaks toward XP/score | Shared table profiles | Decline. Direct grants and multiplier bonuses already supplied roughly 7–8× base gem XP. Adding XP is unsupported; a score-only redesign needs separate evidence. |

The attack-speed correction to +30% was required for truthful semantics, not speculative balance tuning. Human playtests after the documented weapon/slow-motion follow-ups are the appropriate basis for further tuning.
