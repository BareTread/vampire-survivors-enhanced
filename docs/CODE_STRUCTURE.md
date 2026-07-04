# 代码结构文档

## 项目概述

本项目是一个基于 HTML5 Canvas 的 Vampire Survivors 类游戏，采用 ECS（Entity-Component-System）架构，使用纯 JavaScript ES Modules 实现。

---

## 目录结构

```
/workspace/
├── index.html                 # 游戏入口页面
├── src/
│   ├── vampireMain.js         # 应用启动入口
│   ├── core/                  # 核心基础模块
│   │   ├── VampireSurvivorsGame.js  # 游戏主类（主循环、状态管理）
│   │   ├── ECS.js             # Entity-Component-System 架构核心
│   │   ├── Camera.js          # 摄像机系统（视口、缩放）
│   │   ├── Renderer.js        # 渲染器（Canvas 绑定、批次渲染）
│   │   ├── InputManager.js    # 输入管理器（键盘、鼠标）
│   │   ├── AudioManager.js    # 音频管理器（音效、背景音乐）
│   │   ├── ConfigManager.js   # 配置管理器（加载 JSON 配置）
│   │   ├── TimerManager.js    # 定时器管理器（托管 setTimeout）
│   │   ├── ErrorHandler.js    # 错误处理系统
│   │   ├── DamageNumberPool.js # 伤害数字池（对象池优化）
│   │   ├── GraphicsUpgrade.js  # 图形升级系统
│   │   ├── ResponsiveCanvas.js # 响应式画布适配
│   │   └── Components.js       # ECS 组件定义
│   │
│   ├── systems/               # 游戏系统（核心逻辑）
│   │   ├── EnemySystem.js     # 敌人系统（生成、行为、波次）
│   │   ├── ProjectileSystem.js # 投射物系统（弹药池、轨迹）
│   │   ├── ExperienceSystem.js # 经验系统（宝石、升级）
│   │   ├── CollisionSystem.js  # 碰撞检测系统
│   │   ├── RenderSystem.js     # 渲染系统（实体渲染）
│   │   ├── MovementSystem.js   # 移动系统（物理更新）
│   │   ├── PlayerInputSystem.js # 玩家输入系统
│   │   ├── WeaponSystem.js     # 武器系统（发射逻辑）
│   │   ├── StatusEffectSystem.js # 状态效果系统（灼烧、冰冻等）
│   │   ├── PassiveItemSystem.js  # 被动道具系统
│   │   ├── AchievementSystem.js  # 成就系统
│   │   ├── ChallengeSystem.js    # 挑战模式系统
│   │   ├── BossSystem.js         # Boss 系统
│   │   ├── SynergySystem.js      # 协同效果系统
│   │   ├── WeaponEvolutionSystem.js # 武器进化系统
│   │   ├── RaritySystem.js       # 稀有度系统
│   │   ├── GoldSystem.js         # 金币系统
│   │   ├── PersistenceSystem.js  # 持久化系统（存档）
│   │   ├── RunTimerSystem.js     # 运行计时系统
│   │   ├── RunSummarySystem.js   # 结算界面系统
│   │   ├── TitleScreenSystem.js  # 主菜单系统
│   │   ├── CanvasHUD.js          # HUD 界面系统
│   │   ├── InventoryOverlaySystem.js # 装备库界面
│   │   ├── FloorItemSystem.js    # 地上道具系统
│   │   ├── KillMilestoneSystem.js # 击杀里程碑系统
│   │   ├── MicroChallengeSystem.js # 微型挑战系统
│   │   ├── DynamicEventSystem.js  # 动态事件系统
│   │   ├── AmbientParticleSystem.js # 环境粒子系统
│   │   ├── ScreenEffectsSystem.js  # 屏幕效果系统
│   │   ├── FlowStateSystem.js      # 流程状态系统
│   │   ├── RewardsSystem.js        # 奖励系统
│   │   ├── AdaptiveMusicSystem.js  # 自适应音乐系统
│   │   ├── TerrainSystem.js        # 地形系统
│   │   ├── ParticleSystemCore.js   # 粒子系统核心
│   │   ├── CodexSystem.js          # 图鉴系统
│   │   └── BaseSystem.js           # 系统基类
│   │
│   ├── entities/              # 游戏实体
│   │   ├── Player.js          # 玩家实体
│   │   ├── Enemy.js           # 敌人实体基类
│   │   ├── Projectile.js      # 投射物实体
│   │   ├── ExperienceGem.js   # 经验宝石实体
│   │   ├── enemies/           # 特殊敌人
│   │   │   ├── Demon.js       # 恶魔
│   │   │   └── Wraith.js      # 怨灵
│   │   └── weapons/           # 武器实体
│   │       ├── Whip.js        # 鞭子
│   │       ├── MagicMissile.js # 魔法飞弹
│   │       ├── FireWand.js    # 火焰法杖
│   │       ├── LightningChain.js # 连锁闪电
│   │       ├── GarlicAura.js  # 大蒜光环
│   │       ├── HolyBible.js   # 圣经
│   │       ├── BoneBoomerang.js # 骨头回旋镖
│   │       ├── ThrowingKnife.js # 飞刀
│   │       ├── IceShard.js    # 冰晶碎片
│   │       └── ShadowDagger.js # 暗影匕首
│   │
│   ├── data/                  # 数据定义
│   │   └── characters.js      # 角色定义数据
│   │
│   ├── ui/                    # 用户界面组件
│   │   ├── SettingsMenu.js    # 设置菜单
│   │   └── HelpOverlay.js     # 帮助 overlay
│   │
│   ├── utils/                 # 工具函数
│   │   └ MathUtils.js         # 数学工具
│   │
│   └── debug/                 # 调试工具
│   │   ├── ProjectileDebugger.js # 投射物调试器
│   │   └ ProgressionTelemetry.js # 进度遥测
│   │
├── configs/                   # JSON 配置文件
│   ├── game.json              # 游戏配置
│   ├── player.json            # 玩家配置
│   ├── enemies.json           # 敌人配置
│   ├── weapons.json           # 武器配置
│   ├── audio.json             # 音频配置
│   └ performance.json         # 性能配置
│   └ debug.json               # 调试配置
│   └ rendering.json           # 渲染配置
│
└── tests/                     # 测试文件
```

---

## 架构设计

### ECS 架构

项目采用 Entity-Component-System 架构：

```
┌─────────────────────────────────────────────────────────────┐
│                        World (ECS.js)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Entities  │  │ Components  │  │   Systems   │          │
│  │             │  │             │  │             │          │
│  │ - Player    │  │ - Position  │  │ - EnemySys  │          │
│  │ - Enemy     │  │ - Velocity  │  │ - Collision │          │
│  │ - Projectile│  │ - Health    │  │ - Movement  │          │
│  │ - Gem       │  │ - Collider  │  │ - Render    │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### 游戏主类 (VampireSurvivorsGame)

游戏主类负责：
- 初始化所有系统
- 管理 `gameState` 状态机
- 运行 `gameLoop` 主循环
- 调用 `update()` 和 `render()`

---

## 系统分类

### 核心游戏系统
| 系统 | 文件 | 功能 |
|------|------|------|
| EnemySystem | EnemySystem.js | 敌人生成、行为、波次管理 |
| ProjectileSystem | ProjectileSystem.js | 投射物池管理、轨迹计算 |
| ExperienceSystem | ExperienceSystem.js | 经验宝石、升级触发 |
| CollisionSystem | CollisionSystem.js | 碰撞检测（ECS） |
| StatusEffectSystem | StatusEffectSystem.js | 状态效果（灼烧、冰冻等） |
| WeaponSystem | WeaponSystem.js | 武器发射逻辑 |

### 进度与奖励系统
| 系统 | 文件 | 功能 |
|------|------|------|
| AchievementSystem | AchievementSystem.js | 成就解锁与显示 |
| GoldSystem | GoldSystem.js | 金币获取与统计 |
| PersistenceSystem | PersistenceSystem.js | 存档/读档（localStorage） |
| KillMilestoneSystem | KillMilestoneSystem.js | 击杀里程碑通知 |

### 界面系统
| 系统 | 文件 | 功能 |
|------|------|------|
| TitleScreenSystem | TitleScreenSystem.js | 主菜单、角色选择、设置等 |
| CanvasHUD | CanvasHUD.js | 游戏内 HUD |
| RunSummarySystem | RunSummarySystem.js | 结算界面 |
| InventoryOverlaySystem | InventoryOverlaySystem.js | 装备库界面 |

### 视觉与音频系统
| 系统 | 文件 | 功能 |
|------|------|------|
| RenderSystem | RenderSystem.js | 实体渲染 |
| ParticleSystemCore | ParticleSystemCore.js | 粒子效果 |
| ScreenEffectsSystem | ScreenEffectsSystem.js | 屏幕震动、闪烁 |
| AdaptiveMusicSystem | AdaptiveMusicSystem.js | 动态音乐切换 |
| AmbientParticleSystem | AmbientParticleSystem.js | 环境粒子 |

### 高级玩法系统
| 系统 | 文件 | 功能 |
|------|------|------|
| WeaponEvolutionSystem | WeaponEvolutionSystem.js | 武器进化 |
| SynergySystem | SynergySystem.js | 武器+道具协同效果 |
| PassiveItemSystem | PassiveItemSystem.js | 被动道具管理 |
| BossSystem | BossSystem.js | Boss 生成与行为 |
| ChallengeSystem | ChallengeSystem.js | 挑战 Modifier |
| RaritySystem | RaritySystem.js | 稀有度系统 |
| CodexSystem | CodexSystem.js | 怪物图鉴 |

---

## 游戏状态机

```
gameState 状态流转：

menu ──────────────► playing ──────────────► gameOver
  │                    │  │                     │
  │                    │  │                     │
  │  (选择角色)         │  │ (暂停)              │ (结算)
  │                    │  ▼                     │
  ├──► characters      ├──► paused ─────────────┤
  │                    │                        │
  │  (强化商店)         │  (升级)                │
  ├──► upgrades        ├──► levelUp             │
  │                    │                        │
  │  (挑战模式)         │                        │
  ├──► challenges      │                        │
  │                    │                        │
  │  (游戏统计)         │                        │
  ├──► statistics      │                        │
  │                    │                        │
  │  (怪物图鉴)         │                        │
  ├──► codex           │                        │
  │                    │                        │
  │  (游戏设置)         │                        │
  └──► settings        │                        │
                       │                        │
                       └────────────────────────► summary
```

---

## 配置系统

所有游戏参数通过 `configs/` 目录下的 JSON 文件管理：

- `game.json` - 世界边界、初始参数
- `player.json` - 玩家属性、初始武器
- `enemies.json` - 敌人类型、变体、生成参数
- `weapons.json` - 武器伤害、冷却、范围
- `audio.json` - 音效配置
- `performance.json` - 性能阈值