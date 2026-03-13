# Runtime Stabilization And Remediation Plan

## Goal

Fix the verified runtime, progression, pooling, and tooling defects from the March 13 review without broad refactors. Prioritize correctness first, then lifecycle stability, then regression coverage and docs.

## Scope

- Normalize click/input payload handling.
- Stop player input listeners and player-owned timers from leaking across runs.
- Fix banked gold, combo record persistence, permanent upgrade application, and jackpot XP.
- Make projectile/gem pooling single-owner and remove duplicate kill accounting.
- Stop live runtime queries from depending on the dormant collision system.
- Restore working Jest execution and add targeted regression tests.

## Rules For The Implementing Agent

- Keep changes surgical; do not do repo-wide lint cleanup.
- Append a dated entry to the Implementation Log after each completed batch.
- Append a dated entry to `CLAUDE.md` after major milestones land.
- Each log entry should include changed behavior, files touched, verification run, and any remaining issues.

## Planned Fix Order

1. Input contract and player lifecycle cleanup.
2. Progression and persistence correctness.
3. Pooling ownership and kill event centralization.
4. Runtime query cleanup for enemy/projectile systems.
5. Jest/tooling repair and regression coverage.
6. Final verification and docs updates.

## Implementation Log

### 2026-03-13 - Plan Created

- Created the remediation handoff doc for the current stabilization pass.
- Files touched: `docs/plans/2026-03-13-runtime-stabilization-remediation.md`
- Verification: file created in repo.
- Remaining issues: all runtime fixes still pending.

### 2026-03-13 - Runtime Stabilization Batch 1

- Fixed normalized click handling in `VampireSurvivorsGame`, moved title/summary/level-up hover tracking onto `InputManager`, and added `Player.destroy()` plus managed timer cleanup to stop stale listeners and callbacks across runs.
- Fixed progression correctness in `GoldSystem`, `PersistenceSystem`, `Player`, and `RewardsSystem`: run gold now banks once at run end, combo records use `combo.maxCombo`, permanent upgrades now affect live max health/xp gain/armor/revival, and jackpot XP uses a real runtime XP API.
- Fixed pooling and kill accounting in `ProjectileSystem`, `ExperienceSystem`, `Projectile`, `ExperienceGem`, `Enemy`, and direct-damage weapons: systems now own pool returns, inactive entities are compacted after update, enemy death side effects are single-source, and runtime queries no longer rely on the dormant collision system.
- Fixed tooling and regression coverage in `package.json` and `tests/`: Jest now runs under the repo's ESM setup and regression tests cover click payloads, player cleanup, progression banking, jackpot XP, and projectile/gem pooling.
- Files touched: `package.json`, `tests/setup.js`, `tests/projectile.test.js`, `tests/runtime-regressions.test.js`, `tests/pooling-regressions.test.js`, `src/core/VampireSurvivorsGame.js`, `src/entities/Player.js`, `src/entities/Projectile.js`, `src/entities/ExperienceGem.js`, `src/entities/Enemy.js`, `src/entities/weapons/FireWand.js`, `src/entities/weapons/LightningChain.js`, `src/entities/weapons/GarlicAura.js`, `src/entities/weapons/BoneBoomerang.js`, `src/systems/GoldSystem.js`, `src/systems/PersistenceSystem.js`, `src/systems/RewardsSystem.js`, `src/systems/ExperienceSystem.js`, `src/systems/EnemySystem.js`, `src/systems/ProjectileSystem.js`
- Verification: `node --check` on all touched runtime files; `npm test -- --runInBand`
- Remaining issues: targeted ESLint on touched source still surfaces a large pre-existing formatting/style backlog in heavyweight files like `src/core/VampireSurvivorsGame.js` and `src/entities/Enemy.js`; not addressed in this stabilization pass.
