# 游戏核心循环流程图

## 启动流程

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              游戏启动流程                                   │
└──────────────────────────────────────────────────────────────────────────┘

index.html 加载
       │
       ▼
vampireMain.js ──► VampireGameBootstrap.init()
       │
       ├─► setupCanvas()            # 创建/获取 Canvas
       │
       ├─► initializeSystems()      # 初始化 InputManager, AudioManager
       │
       ├─► initializeGame()         # 创建 VampireSurvivorsGame 实例
       │        │
       │        └─► VampireSurvivorsGame.constructor()
       │                │
       │                ├─► 创建 World (ECS)
       │                ├─► 创建 Camera, Renderer
       │                ├─► 初始化 30+ Systems
       │                ├─► 加载配置 (ConfigManager)
       │                └─► 初始化 UI (HUD, 菜单)
       │
       └─► game.start()             # 启动主循环
              │
              └─► requestAnimationFrame(gameLoop)
```

---

## 主循环 (gameLoop)

位置：`src/core/VampireSurvivorsGame.js` 第 1351 行

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              主循环 gameLoop                               │
│                        (每帧执行，60 FPS 目标)                              │
└──────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────┐
                    │ requestAnimationFrame│
                    │     (gameLoop)       │
                    └─────────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────────┐
            │         计算 deltaTime              │
            │  rawDeltaTime = (currentTime -      │
            │     lastTime) * 0.001               │
            │  clamp: 0.001 ~ 0.033 (1ms~33ms)    │
            └─────────────────────────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────────┐
            │         应用 timeScale              │
            │  scaledDeltaTime = deltaTime *      │
            │                       timeScale     │
            └─────────────────────────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────────┐
            │           update(dt)                │
            │   (更新所有系统、实体、状态)          │
            └─────────────────────────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────────┐
            │           render()                  │
            │   (渲染所有可见元素到 Canvas)        │
            └─────────────────────────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────────┐
            │      性能监控 & 自适应画质           │
            │  - 计算 FPS                         │
            │  - entityCount > 500 → 清理         │
            │  - avgFrameTime > 18ms → 降画质     │
            └─────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ requestAnimationFrame│
                    │     (gameLoop)       │◄─── 循环
                    └─────────────────────┘
```

---

## update() 详细流程

位置：`src/core/VampireSurvivorsGame.js` 第 1664 行

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           update(dt) 详细流程                              │
└──────────────────────────────────────────────────────────────────────────┘

update(dt)
    │
    ├─► 根据 gameState 分支处理
    │
    ├─► gameState === 'menu' / 'paused' / 'summary'
    │       │
    │       └─► 只更新 UI 系统（TitleScreen, RunSummary, HUD）
    │           不更新游戏实体
    │
    ├─► gameState === 'playing' 或 'levelUp'
    │       │
    │       ├─► player.update(dt)         # 玩家移动、输入、碰撞
    │       │       │
    │       │       ├─► 处理键盘/鼠标输入
    │       │       ├─► 更新位置 (x, y)
    │       │       ├─► 更新武器（自动发射）
    │       │       ├─► 检测碰撞
    │       │       └─► 更新状态效果
    │       │
    │       ├─► systems.terrain.update(dt)      # 地形更新
    │       ├─► systems.enemy.update(dt)        # 敌人更新
    │       │       │
    │       │       ├─► 生成新敌人（波次逻辑）
    │       │       ├─► 更新敌人位置
    │       │       ├─► 敌人 AI（追踪玩家）
    │       │       ├─► 敌人攻击判定
    │       │       └─► 死亡处理（掉落经验）
    │       │
    │       ├─► systems.projectile.update(dt)   # 投射物更新
    │       │       │
    │       │       ├─► 更新投射物位置
    │       │       ├─► 碰撞检测（敌人/边界）
    │       │       ├─► 命中处理（伤害、特效）
    │       │       └─► 回收投射物到池
    │       │
    │       ├─► systems.experience.update(dt)   # 经验系统更新
    │       │       │
    │       │       ├─► 更新宝石位置（磁力吸引）
    │       │       ├─► 检测玩家拾取
    │       │       └─► 经验累积 → levelUp 触发
    │       │
    │       ├─► systems.statusEffect.update(dt) # 状态效果更新
    │       │       │
    │       │       ├─► 灼烧伤害、冰冻减速
    │       │       ├─► 中毒、眩晕计时
    │       │       └─► 效果到期移除
    │       │
    │       ├─► systems.boss.update(dt)         # Boss 更新
    │       ├─► systems.weaponEvolution.update(dt) # 进化检测
    │       ├─► systems.synergy.update(dt)      # 协同效果
    │       ├─► systems.gold.update(dt)         # 金币统计
    │       ├─► systems.achievement.update(dt)  # 成就检测
    │       ├─► systems.microChallenge.update(dt) # 微型挑战
    │       ├─► systems.floorItems.update(dt)   # 地上道具
    │       └─► systems.runTimer.update(dt)     # 计时器
    │
    ├─► 视觉系统（即使暂停也更新）
    │       ├─► systems.canvasHUD.update(dt)
    │       ├─► systems.particle.update(dt)
    │       └─► globalDamageNumberPool.update(dt)
    │
    └─► memory cleanup（每 30 秒）
```

---

## render() 详细流程

位置：`src/core/VampireSurvivorsGame.js` 第 1771 行

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           render() 详细流程                                │
└──────────────────────────────────────────────────────────────────────────┘

render()
    │
    ├─► 开始帧 (renderer.beginFrame())
    │       └─► 清空 Canvas，设置变换
    │
    ├─► 根据 gameState 渲染不同界面
    │
    ├─► gameState === 'menu' / 'characters' / 'upgrades' 等
    │       └─► systems.titleScreen.render(ctx)
    │           （主菜单 Canvas 渲染）
    │
    ├─► gameState === 'playing' / 'levelUp' / 'paused'
    │       │
    │       ├─► 渲染背景
    │       │       └─► renderBackground()
    │       │           ├─► 世界边界渐变
    │       │           └─► 地形障碍
    │       │
    │       ├─► 渲染游戏实体（世界空间）
    │       │       ├─► systems.terrain.render()
    │       │       ├─► systems.ambientParticles.render()
    │       │       ├─► systems.experience.render()  # 经验宝石
    │       │       ├─► 渲染敌人（EnemyRenderer）
    │       │       ├─► 渲染投射物（ProjectileRenderer）
    │       │       ├─► 渲染玩家
    │       │       ├─► systems.boss.render()        # Boss 特效
    │       │       └─► 渲染粒子效果
    │       │
    │       ├─► 渲染 HUD（屏幕空间）
    │       │       ├─► systems.canvasHUD.render()
    │       │       │   ├─► 等级、生命、经验条
    │       │       │   ├─► 武器列表、道具列表
    │       │       │   ├─► 连击、波次、时间
    │       │       │   └─► 状态效果指示器
    │       │       │
    │       │       ├─► 升级界面 (levelUp 状态)
    │       │       │   └─► renderLevelUpOverlay()
    │       │       │       ├─► "升级！" 标题
    │       │       │       ├─► 选项卡片（武器/道具）
    │       │       │       └─► 稀有度标签
    │       │       │
    │       │       └─► 小地图（边界警告）
    │       │
    │       └─► 渲染屏幕效果
    │               ├─► systems.screenEffects.render()
    │               └─► 震动、闪烁、暗化
    │
    ├─► gameState === 'summary'
    │       └─► systems.runSummary.render(ctx)
    │           （结算界面 Canvas 渲染）
    │
    ├─► 渲染调试信息（可选）
    │       ├─► projectileDebugger.render()
    │       └─► performanceDashboard.render()
    │
    └─► 结束帧 (renderer.endFrame())
```

---

## 玩家升级流程

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           玩家升级流程                                     │
└──────────────────────────────────────────────────────────────────────────┘

收集经验宝石
       │
       ▼
player.experience >= experienceToNext
       │
       ▼
player.levelUp()  [Player.js]
       │
       ├─► level++
       ├─► 重置 experience
       ├─► 计算 new experienceToNext
       └─► 触发升级界面
       │
       ▼
game.showLevelUpUI()  [VampireSurvivorsGame.js]
       │
       ├─► gameState = 'levelUp'
       └─► generateLevelUpOptions()
       │       │
       │       ├─► 武器升级选项
       │       │   ├─► 现有武器升级
       │       │   └─► 新武器获取
       │       │
       │       ├─► 被动道具选项
       │       │   ├─► 现有道具升级
       │       │   └─► 新道具获取
       │       │
       │       └─► 属性提升选项
       │           （伤害、速度、生命等）
       │
       ▼
显示升级界面 (renderLevelUpOverlay)
       │
       ▼
玩家选择选项（点击/按键）
       │
       ▼
game.selectLevelUpOption(index)
       │
       ├─► 武器升级 → weapon.upgrade()
       ├─► 新武器 → player.addWeapon()
       ├─► 被动道具 → passiveItems.addItem()
       └─► 属性提升 → player.applyStatBoost()
       │
       ▼
game.hideLevelUpUI()
       │
       └─► gameState = 'playing'
```

---

## 敌人生成流程

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           敌人生成流程                                     │
└──────────────────────────────────────────────────────────────────────────┘

EnemySystem.update(dt)
       │
       ├─► 检查波次时间
       │       │
       │       └─► 每 N 秒触发新波次
       │           │
       │           └─► onWaveStart(waveNumber)
       │                   │
       │                   ├─► 播放波次音效
       │                   ├─► 波次通知 UI
       │                   ├─► 增加生成速率
       │                   └─► 特殊波次奖励
       │                   （Boss 波、里程碑波）
       │
       ├─► 生成敌人逻辑
       │       │
       │       ├─► spawnTimer累加
       │       │       │
       │       │       └─► spawnTimer >= spawnInterval
       │       │               │
       │       │               ▼
       │       │       spawnEnemy()
       │       │               │
       │       │               ├─► 选择敌人类型
       │       │               │   （根据波次、难度）
       │       │               │
       │       │               ├─► 选择生成位置
       │       │               │   （屏幕外随机方向）
       │       │               │
       │       │               ├─► 应用变体
       │       │               │   （精英、迅捷、暗影等）
       │       │               │
       │       │               ├─► 创建 Enemy 实例
       │       │               │
       │       │               └─► 添加到 World
       │       │
       │       └─► 限制最大数量
       │           （entityCount > cap → 停止生成）
       │
       └─► 更新所有敌人
               │
               ├─► enemy.update(dt)
               │       │
               │       ├─► AI 行为
               │       │   ├─► 追踪玩家
               │       │   ├─► 攻击判定
               │       │   └─► 特殊行为（Demon、Wraith）
               │       │
               │       ├─► 位置更新
               │       ├─► 状态效果更新
               │       └─► 死亡检测
               │
               └─► 死亡处理
                       │
                       ├─► 掉落经验宝石
                       ├─► 掉落金币
                       ├─► 触发成就
                       └─► 从 World 移除
```

---

## 碰撞检测流程

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           碰撞检测流程                                     │
└──────────────────────────────────────────────────────────────────────────┘

CollisionSystem.update()
       │
       ├─► 投射物 vs 敌人
       │       │
       │       └─► 遍历所有投射物
       │               │
       │               ├─► 遍历所有敌人
       │               │       │
       │               │       └─► 圆形碰撞检测
       │               │               │
       │               │               └─► distance < hitRadius
       │               │                       │
       │               │                       ├─► enemy.takeDamage()
       │               │                       │       │
       │               │                       │       ├─► 应用伤害
       │               │                       │       ├─► 触发状态效果
       │               │                       │       └─► 播放命中特效
       │               │                       │
       │               │                       ├─► 投射物穿透检测
       │               │                       └─► 投射物回收
       │               │
       │               └─► 优化：空间分区
       │
       ├─► 敌人 vs 玩家
       │       │
       │       └─► 遍历所有敌人
       │               │
       │               └─► 碰撞检测
       │                       │
       │                       └─► enemy.attackPlayer()
       │                               │
       │                               ├─► player.takeDamage()
       │                               ├─► 击退效果
       │                               └─► 屏幕震动
       │
       └─► 玩家 vs 经验宝石
               │
               └─► pickupRadius 检测
                       │
                       ├─► 磁力吸引（加速度）
                       └─► 拾取判定
                               │
                               └─► player.gainExperience()
```

---

## 武器发射流程

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           武器发射流程                                     │
└──────────────────────────────────────────────────────────────────────────┘

player.update(dt)  [Player.js]
       │
       └─► 遍历所有武器
               │
               └─► weapon.update(dt)
                       │
                       ├─► cooldownTimer累加
                       │       │
                       │       └─► cooldownTimer >= cooldown
                       │               │
                       │               └─► reset cooldownTimer
                       │                       │
                       │                       ▼
                       │               weapon.fire()
                       │                       │
                       │                       ├─► 选择目标
                       │                       │   ├─► 自动模式：最近敌人
                       │                       │   └─► 手动模式：鼠标方向
                       │                       │
                       │                       ├─► 创建投射物
                       │                       │   ├─► 从池获取 projectile
                       │                       │   ├─► 设置位置、速度
                       │                       │   ├─► 设置伤害、穿透
                       │                       │   └─► 设置特效（轨迹）
                       │                       │
                       │                       ├─► 添加到 ProjectileSystem
                       │                       │
                       │                       └─► 播放发射音效
                       │
                       └─► 特殊武器逻辑
                               ├─► Whip: 弧形挥击
                               ├─► GarlicAura: 区域持续伤害
                               ├─► HolyBible: 环绕轨道
                               └─► LightningChain: 连锁跳跃
```

---

## 状态流转总结

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         游戏状态流转完整图                                  │
└──────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────┐
                    │     menu         │◄───── 游戏启动
                    └──────────────────┘
                           │  │
           ┌───────────────┤  ├───────────────┐
           │               │  │               │
           ▼               ▼  ▼               ▼
    ┌──────────┐    ┌──────────┐      ┌──────────┐
    │characters│    │ upgrades │      │ settings │
    └──────────┘    └──────────┘      └──────────┘
           │               │               │
           └─► 选择角色 ────┴───────────────┤
                                          │
                    ┌─────────────────────┤
                    │                     │
                    ▼                     │
            ┌──────────────┐              │
            │   playing    │◄─────────────┘ (设置完成)
            └──────────────┘
                    │  │
        ┌──────────┤  ├──────────┐
        │          │  │          │
        ▼          ▼  ▼          ▼
 ┌──────────┐ ┌──────────┐ ┌───────────┐
 │ levelUp  │ │  paused  │ │ gameOver  │
 └──────────┘ └──────────┘ └───────────┘
        │          │          │
        └─► 选择 ──┤          │
                    │          │
                    │          ▼
                    │   ┌───────────┐
                    │   │  summary  │
                    │   └───────────┘
                    │          │
                    └─► 继续 ──┤
                               │
                               ▼
                    ┌──────────────────┐
                    │     menu         │◄── 返回主菜单
                    └──────────────────┘
```

---

## 性能优化策略

主循环中包含以下性能优化：

1. **deltaTime Clamp**：限制在 1ms~33ms，防止帧率波动
2. **自适应画质**：FPS < 50 时自动降画质
3. **实体池化**：投射物、伤害数字使用对象池
4. **内存清理**：每 30 秒执行内存清理
5. **紧急清理**：实体数 > 500 时强制清理
6. **批次渲染**：Renderer 支持批次合并
7. **空间分区**：碰撞检测使用空间分区优化