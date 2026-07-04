# 关键函数说明文档

本文档详细列出游戏中最重要的函数及其作用。

---

## 一、游戏主类核心函数

位置：`src/core/VampireSurvivorsGame.js`

### 1. constructor(canvas, config)

**行号**：85

**功能**：游戏主类构造函数，初始化所有核心组件和系统。

**参数**：
- `canvas`：HTML Canvas 元素
- `config`：配置对象，包含 inputManager, audioManager 等

**初始化内容**：
- 创建 ECS World
- 创建 Camera, Renderer
- 初始化 30+ 游戏系统
- 加载游戏配置
- 创建 UI 组件

---

### 2. gameLoop(currentTime)

**行号**：1351

**功能**：游戏主循环，每帧执行一次（目标 60 FPS）。

**参数**：
- `currentTime`：当前时间戳（由 requestAnimationFrame 传入）

**执行流程**：
1. 计算 deltaTime 并 clamp（1ms ~ 33ms）
2. 应用 timeScale 缩放
3. 调用 `update(scaledDeltaTime)`
4. 调用 `render()`
5. 性能监控和自适应画质调整
6. 递归调用 `requestAnimationFrame(gameLoop)`

**返回值**：无（递归循环）

---

### 3. update(dt)

**行号**：1664

**功能**：更新所有游戏系统、实体和状态。

**参数**：
- `dt`：经过的时间（秒，已缩放）

**执行内容**：
- 根据 gameState 分支处理
- 'playing' 状态：更新玩家、所有系统
- 'menu/paused/summary' 状态：只更新 UI 系统
- 视觉系统（粒子、HUD）始终更新

---

### 4. render()

**行号**：1771

**功能**：渲染所有可见元素到 Canvas。

**执行内容**：
- 清空 Canvas，设置变换
- 根据 gameState 渲染不同界面
- 渲染游戏实体（世界空间）
- 渲染 HUD（屏幕空间）
- 渲染屏幕效果（震动、闪烁）

---

### 5. startGame()

**行号**：892

**功能**：开始游戏，初始化玩家和游戏状态。

**执行内容**：
- 创建 Player 实例
- 重置所有系统（enemy, projectile, experience 等）
- 加载角色数据（从 CHARACTERS）
- 给玩家装备初始武器
- 设置 `gameState = 'playing'`
- 启动主循环

---

### 6. pauseGame()

**行号**：985

**功能**：暂停游戏。

**执行内容**：
- 设置 `gameState = 'paused'`
- 暂停背景音乐

---

### 7. resumeGame()

**行号**：994

**功能**：继续游戏。

**执行内容**：
- 设置 `gameState = 'playing'`
- 恢复背景音乐

---

### 8. showLevelUpUI()

**行号**：1084

**功能**：显示升级界面。

**执行内容**：
- 设置 `gameState = 'levelUp'`
- 生成升级选项（武器、道具、属性）
- 显示 Canvas 升级界面

---

### 9. hideLevelUpUI()

**行号**：1097

**功能**：隐藏升级界面，继续游戏。

**执行内容**：
- 设置 `gameState = 'playing'`
- 清空升级选项

---

### 10. generateLevelUpOptions()

**行号**：1120

**功能**：生成升级选项列表。

**返回值**：包含武器升级、道具升级、属性提升的选项数组

**选项类型**：
- `weapon_upgrade`：现有武器升级
- `new_weapon`：获取新武器
- `passive_upgrade`：被动道具升级
- `new_passive`：新被动道具
- `stat_boost`：属性提升

---

### 11. selectLevelUpOption(index)

**行号**：1213

**功能**：处理玩家选择的升级选项。

**参数**：
- `index`：选项索引（0-4）

**执行内容**：
- 根据选项类型执行对应操作
- 武器升级 → `weapon.upgrade()`
- 新武器 → `player.addWeapon()`
- 被动道具 → `passiveItems.addItem()`
- 属性提升 → `player.applyStatBoost()`

---

### 12. triggerGameOver()

**行号**：约 1060

**功能**：触发游戏结束（玩家死亡）。

**执行内容**：
- 设置 `gameState = 'gameOver'`
- 显示结算界面
- 保存统计数据
- 记录最高记录

---

---

## 二、玩家实体函数

位置：`src/entities/Player.js`

### 1. constructor(game, x, y, characterData)

**功能**：创建玩家实体。

**参数**：
- `game`：游戏实例
- `x, y`：初始位置
- `characterData`：角色数据（属性、初始武器等）

**初始化内容**：
- 基础属性（生命、速度、伤害）
- 武器槽位
- 被动道具槽位
- 输入状态

---

### 2. update(dt)

**功能**：每帧更新玩家状态。

**执行内容**：
- 处理键盘/鼠标输入
- 更新位置（移动）
- 更新武器（自动发射）
- 检测边界碰撞
- 更新状态效果
- 检测生命值（死亡判定）

---

### 3. takeDamage(amount, source)

**功能**：玩家受到伤害。

**参数**：
- `amount`：伤害数值
- `source`：伤害来源（敌人、Boss、投射物）

**执行内容**：
- 应用护甲减伤
- 减少生命值
- 播放受伤特效
- 触发无敌帧
- 生命 ≤ 0 时触发死亡

---

### 4. levelUp()

**功能**：玩家升级。

**执行内容**：
- `level++`
- 重置 experience
- 计算 new experienceToNext
- 恢复满血（可选）
- 触发升级界面

---

### 5. gainExperience(amount)

**功能**：获取经验值。

**参数**：
- `amount`：经验值数量

**执行内容**：
- 累加到 experience
- 检查是否达到升级阈值

---

### 6. addWeapon(weaponType)

**功能**：添加武器到玩家。

**参数**：
- `weaponType`：武器类型 ID

**返回值**：成功返回 true，武器槽满返回 false

---

### 7. getEffectiveStats()

**功能**：计算玩家当前有效属性（含道具加成）。

**返回值**：包含 damage, speed, cooldown, pickupRange 等的对象

---

---

## 三、敌人系统函数

位置：`src/systems/EnemySystem.js`

### 1. constructor(game)

**功能**：创建敌人系统。

**初始化内容**：
- 敌人池
- 波次管理器
- 生成参数（间隔、最大数量）
- 变体配置

---

### 2. update(dt)

**功能**：每帧更新敌人系统。

**执行内容**：
- 检查波次触发
- 生成新敌人
- 更新所有敌人位置和行为
- 处理敌人死亡

---

### 3. spawnEnemy(type, x, y, variant)

**功能**：生成敌人。

**参数**：
- `type`：敌人类型（basic, fast, heavy, elite 等）
- `x, y`：生成位置
- `variant`：变体（champion, swift, shadow 等）

**返回值**：创建的 Enemy 实例

---

### 4. onWaveStart(waveNumber)

**功能**：新波次开始处理。

**参数**：
- `waveNumber`：波次编号

**执行内容**：
- 播放波次音效
- 显示波次通知
- 增加生成速率
- 特殊波次处理（Boss 波、里程碑波）

---

### 5. getCurrentWave()

**功能**：获取当前波次编号。

**返回值**：整数波次编号

---

### 6. getEnemyCount()

**功能**：获取当前敌人数量。

**返回值**：敌人数量整数

---

---

## 四、投射物系统函数

位置：`src/systems/ProjectileSystem.js`

### 1. constructor(game)

**功能**：创建投射物系统，初始化对象池。

**初始化内容**：
- 投射物池（预创建 250 个）
- 活动投射物列表

---

### 2. update(dt)

**功能**：每帧更新所有投射物。

**执行内容**：
- 更新投射物位置
- 检测碰撞（敌人、边界）
- 处理命中效果
- 回收投射物到池

---

### 3. fire(config)

**功能**：发射投射物。

**参数**：
- `config`：配置对象
  - `x, y`：起始位置
  - `vx, vy`：速度向量
  - `damage`：伤害值
  - `piercing`：穿透数
  - `type`：投射物类型

**返回值**：创建的 Projectile 实例

---

### 4. acquireProjectile()

**功能**：从池获取投射物实例。

**返回值**：Projectile 实例

---

### 5. releaseProjectile(proj)

**功能**：回收投射物到池。

**参数**：
- `proj`：要回收的 Projectile 实例

---

---

## 五、经验系统函数

位置：`src/systems/ExperienceSystem.js`

### 1. constructor(game)

**功能**：创建经验系统。

**初始化内容**：
- 经验宝石池
- 磁力效果状态

---

### 2. update(dt)

**功能**：每帧更新所有经验宝石。

**执行内容**：
- 更新宝石位置（磁力吸引）
- 检测玩家拾取
- 触发玩家升级

---

### 3. spawnGem(x, y, value, type)

**功能**：生成经验宝石。

**参数**：
- `x, y`：生成位置
- `value`：经验值数量
- `type`：宝石类型（common, uncommon, rare）

---

### 4. magnetizeAllGems()

**功能**：激活全局磁力效果，吸引所有宝石到玩家。

---

### 5. getActiveGemCount()

**功能**：获取当前活动宝石数量。

**返回值**：宝石数量整数

---

---

## 六、碰撞系统函数

位置：`src/systems/CollisionSystem.js`

### 1. constructor(world, name)

**功能**：创建碰撞系统（ECS-based）。

---

### 2. update()

**功能**：执行碰撞检测。

**检测类型**：
- 投射物 vs 敌人
- 敌人 vs 玩家
- 玩家 vs 经验宝石
- 玩家 vs 地上道具

---

### 3. checkCircleCollision(obj1, obj2)

**功能**：圆形碰撞检测。

**参数**：
- `obj1, obj2`：两个对象，需有 x, y, radius 属性

**返回值**：布尔值（是否碰撞）

---

---

## 七、状态效果系统函数

位置：`src/systems/StatusEffectSystem.js`

### 1. constructor(game)

**功能**：创建状态效果系统。

**支持效果**：Burn, Freeze, Poison, Stun, Bleed, Weakness, Regeneration, Rage

---

### 2. applyEffect(target, effectType, duration, intensity)

**功能**：应用状态效果到目标。

**参数**：
- `target`：目标对象（玩家或敌人）
- `effectType`：效果类型
- `duration`：持续时间（秒）
- `intensity`：强度

---

### 3. update(dt)

**功能**：每帧更新所有状态效果。

**执行内容**：
- 计算效果伤害/减速
- 检查效果到期
- 移除过期效果

---

### 4. removeEffect(target, effectType)

**功能**：移除目标的状态效果。

---

---

## 八、武器基类函数

位置：`src/entities/weapons/BaseWeapon.js`（各武器继承）

### 1. constructor(player, config)

**功能**：创建武器实例。

**参数**：
- `player`：玩家实例
- `config`：武器配置（伤害、冷却、范围等）

---

### 2. update(dt)

**功能**：每帧更新武器（冷却计时）。

---

### 3. fire()

**功能**：发射武器（创建投射物）。

**由子类实现具体逻辑**

---

### 4. upgrade()

**功能**：升级武器。

**执行内容**：
- `level++`
- 增强武器属性

---

---

## 九、主菜单系统函数

位置：`src/systems/TitleScreenSystem.js`

### 1. constructor(game)

**功能**：创建主菜单系统。

**初始化内容**：
- 菜单项列表
- 状态变量（selectedIndex, hoveredIndex）
- 界面主题配色

---

### 2. update(dt)

**功能**：每帧更新菜单动画和交互。

---

### 3. render(ctx)

**功能**：渲染主菜单界面。

**渲染内容**：
- 主菜单
- 角色选择界面
- 升级商店
- 挑战选择
- 图鉴界面
- 设置界面
- 暂停菜单

---

### 4. selectMenuItem(index)

**功能**：选择菜单项执行对应操作。

**参数**：
- `index`：菜单项索引

**执行内容**：
- 根据菜单项触发对应功能
- '开始游戏' → game.startGame()
- '角色选择' → 切换到角色界面
- '强化升级' → 切换到商店界面

---

---

## 十、HUD 系统函数

位置：`src/systems/CanvasHUD.js`

### 1. constructor(game)

**功能**：创建 HUD 系统。

---

### 2. update(dt)

**功能**：更新 HUD 状态。

---

### 3. render(ctx)

**功能**：渲染游戏内 HUD。

**渲染内容**：
- 等级、生命、经验条
- 武器列表
- 道具列表
- 连击显示
- 波次、时间、金币
- 状态效果指示器

---

---

## 十一、结算系统函数

位置：`src/systems/RunSummarySystem.js`

### 1. constructor(game)

**功能**：创建结算系统。

---

### 2. show(runData)

**功能**：显示结算界面。

**参数**：
- `runData`：本次游戏数据（时间、击杀、等级等）

---

### 3. render(ctx)

**功能**：渲染结算界面。

**渲染内容**：
- 生存时间、击杀数、等级
- 金币、伤害统计
- 最高纪录标记
- 武器列表
- 按钮（再来一局、返回主菜单）

---

---

## 十二、持久化系统函数

位置：`src/systems/PersistenceSystem.js`

### 1. constructor(game)

**功能**：创建持久化系统，管理存档数据。

---

### 2. save()

**功能**：保存游戏数据到 localStorage。

**保存内容**：
- 金币
- 最高记录
- 累计统计
- 解锁角色
- 图鉴数据
- 设置

---

### 3. load()

**功能**：从 localStorage 加载游戏数据。

---

### 4. getGold()

**功能**：获取当前金币数量。

**返回值**：金币整数

---

### 5. spendGold(amount)

**功能**：花费金币。

**参数**：
- `amount`：花费数量

**返回值**：成功返回 true，余额不足返回 false

---

---

## 十三、Boss 系统函数

位置：`src/systems/BossSystem.js`

### 1. constructor(game)

**功能**：创建 Boss 系统。

---

### 2. spawnBoss(bossType)

**功能**：生成 Boss。

**参数**：
- `bossType`：Boss 类型（vampireLord, lichKing, alphaWerewolf）

---

### 3. update(dt)

**功能**：每帧更新 Boss 行为。

---

### 4. getActiveBoss()

**功能**：获取当前活动 Boss。

**返回值**：Boss 实例或 null

---

---

## 十四、武器进化系统函数

位置：`src/systems/WeaponEvolutionSystem.js`

### 1. constructor(game)

**功能**：创建武器进化系统，管理进化配方。

---

### 2. checkEvolution(player)

**功能**：检查玩家是否满足进化条件。

**条件**：
- 武器达到最高等级
- 拥有对应的被动道具

---

### 3. evolveWeapon(weapon)

**功能**：进化武器。

**执行内容**：
- 替换为进化武器
- 更新武器属性
- 显示进化通知

---

---

## 十五、协同系统函数

位置：`src/systems/SynergySystem.js`

### 1. constructor(game)

**功能**：创建协同效果系统。

---

### 2. checkSynergies(player)

**功能**：检查玩家武器和道具组合，激活协同效果。

---

### 3. activateSynergy(synergyId)

**功能**：激活协同效果。

---

---

## 十六、图鉴系统函数

位置：`src/systems/CodexSystem.js`

### 1. constructor(game)

**功能**：创建图鉴系统，跟踪玩家发现的内容。

---

### 2. discoverEnemy(enemyType)

**功能**：记录发现敌人。

---

### 3. discoverWeapon(weaponId)

**功能**：记录发现武器。

---

### 4. discoverEvolution(evolvedName)

**功能**：记录发现进化。

---

### 5. getDiscoveries(category)

**功能**：获取某类别的发现记录。

**返回值**：Map 对象

---

---

## 十七、成就系统函数

位置：`src/systems/AchievementSystem.js`

### 1. constructor(game)

**功能**：创建成就系统。

---

### 2. checkAchievements(player)

**功能**：检查玩家是否达成成就。

---

### 3. unlock(achievementId)

**功能**：解锁成就。

---

### 4. showUnlockNotification(achievement)

**功能**：显示成就解锁通知。

---

---

## 十八、挑战系统函数

位置：`src/systems/ChallengeSystem.js`

### 1. constructor(game)

**功能**：创建挑战系统，管理挑战 Modifier。

---

### 2. toggleChallenge(challengeId)

**功能**：切换挑战激活状态。

---

### 3. applyModifiers(player)

**功能**：应用激活的挑战 Modifier 到玩家。

---

### 4. calculateGoldMultiplier()

**功能**：计算挑战带来的金币倍率加成。

**返回值**：倍率浮点数

---

---

## 十九、音频管理器函数

位置：`src/core/AudioManager.js`

### 1. constructor()

**功能**：创建音频管理器。

---

### 2. playVampireSound(soundId, volume, pitch)

**功能**：播放吸血鬼音效。

**参数**：
- `soundId`：音效 ID
- `volume`：音量（0-1）
- `pitch`：音调（1.0 为正常）

---

### 3. playLevelUp()

**功能**：播放升级音效。

---

---

## 二十、输入管理器函数

位置：`src/core/InputManager.js`

### 1. constructor(canvas)

**功能**：创建输入管理器。

---

### 2. update()

**功能**：更新输入状态（每帧调用）。

---

### 3. isKeyDown(key)

**功能**：检查按键是否按下。

**参数**：
- `key`：按键名（'w', 'a', 's', 'd' 等）

**返回值**：布尔值

---

### 4. getMousePosition()

**功能**：获取鼠标位置。

**返回值**：{x, y} 对象

---

---

## 函数调用关系图

```
┌────────────────────────────────────────────────────────────────────────────┐
│                            关键函数调用关系                                  │
└────────────────────────────────────────────────────────────────────────────┘

vampireMain.js
    └─► VampireGameBootstrap.init()
            └─► VampireSurvivorsGame.constructor()
            └─► game.start()
                    └─► gameLoop()
                            ├─► update(dt)
                            │   ├─► player.update(dt)
                            │   │   └─► weapon.update(dt)
                            │   │       └─► weapon.fire()
                            │   │           └─► projectileSystem.fire()
                            │   ├─► enemySystem.update(dt)
                            │   │   ├─► spawnEnemy()
                            │   │   └─► enemy.update(dt)
                            │   ├─► projectileSystem.update(dt)
                            │   ├─► collisionSystem.update()
                            │   ├─► experienceSystem.update(dt)
                            │   │   └─► spawnGem() / player.gainExperience()
                            │   │       └─► player.levelUp()
                            │   │           └─► game.showLevelUpUI()
                            │   │                   └─► generateLevelUpOptions()
                            │   └─► 其他系统 update(dt)
                            │
                            └─► render()
                                ├─► renderer.beginFrame()
                                ├─► titleScreen.render(ctx) / canvasHUD.render(ctx)
                                ├─► 渲染实体
                                └─► renderer.endFrame()
```

---

## 函数分类索引

| 类别 | 函数名 | 文件位置 |
|------|--------|----------|
| 主循环 | gameLoop, update, render | VampireSurvivorsGame.js |
| 游戏流程 | startGame, pauseGame, resumeGame, triggerGameOver | VampireSurvivorsGame.js |
| 升级系统 | showLevelUpUI, hideLevelUpUI, generateLevelUpOptions, selectLevelUpOption | VampireSurvivorsGame.js |
| 玩家实体 | update, takeDamage, levelUp, gainExperience, addWeapon, getEffectiveStats | Player.js |
| 敌人系统 | update, spawnEnemy, onWaveStart, getCurrentWave, getEnemyCount | EnemySystem.js |
| 投射物系统 | update, fire, acquireProjectile, releaseProjectile | ProjectileSystem.js |
| 经验系统 | update, spawnGem, magnetizeAllGems, getActiveGemCount | ExperienceSystem.js |
| 碰撞系统 | update, checkCircleCollision | CollisionSystem.js |
| 状态效果 | applyEffect, update, removeEffect | StatusEffectSystem.js |
| 武器系统 | update, fire, upgrade | BaseWeapon.js 及子类 |
| 主菜单 | update, render, selectMenuItem | TitleScreenSystem.js |
| HUD | update, render | CanvasHUD.js |
| 结算 | show, render | RunSummarySystem.js |
| 持久化 | save, load, getGold, spendGold | PersistenceSystem.js |
| Boss | spawnBoss, update, getActiveBoss | BossSystem.js |
| 进化 | checkEvolution, evolveWeapon | WeaponEvolutionSystem.js |
| 协同 | checkSynergies, activateSynergy | SynergySystem.js |
| 图鉴 | discoverEnemy, discoverWeapon, getDiscoveries | CodexSystem.js |
| 成就 | checkAchievements, unlock, showUnlockNotification | AchievementSystem.js |
| 挑战 | toggleChallenge, applyModifiers, calculateGoldMultiplier | ChallengeSystem.js |
| 音频 | playVampireSound, playLevelUp | AudioManager.js |
| 输入 | update, isKeyDown, getMousePosition | InputManager.js |