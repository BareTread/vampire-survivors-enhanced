/**
 * Character definitions for the character selection system.
 * Each character has unique starting weapon, stat modifiers, and unlock conditions.
 */
export const CHARACTERS = [
    {
        id: 'antonio',
        name: '安东尼奥',
        title: '吸血鬼猎人',
        color: '#4A90E2',
        startingWeapon: 'whip',
        description: '均衡战士，伤害加成。',
        statModifiers: { damage: 1.10 },
        unlocked: true,
        unlockCondition: null,
        unlockDesc: null
    },
    {
        id: 'imelda',
        name: '伊梅尔达',
        title: '学者',
        color: '#B060E0',
        startingWeapon: 'magic_missile',
        description: '经验获取更快，脆弱但强力。',
        statModifiers: { luck: 1.15, health: 0.90 },
        unlocked: false,
        unlockCondition: 'maxLevel >= 15',
        unlockDesc: '单局达到15级'
    },
    {
        id: 'gennaro',
        name: '詹纳罗',
        title: '盗贼',
        color: '#E06040',
        startingWeapon: 'throwing_knife',
        description: '快速致命，开局多一发弹药。',
        statModifiers: { speed: 1.12, projectiles: 1 },
        unlocked: false,
        unlockCondition: 'highestKillCount >= 500',
        unlockDesc: '单局击杀500个敌人'
    },
    {
        id: 'mortimer',
        name: '莫蒂默',
        title: '火焰法师',
        color: '#FF6B35',
        startingWeapon: 'fire_wand',
        description: '火焰大师，爆炸范围更大但行动迟缓。',
        statModifiers: { area: 1.20, speed: 0.95 },
        unlocked: false,
        unlockCondition: 'longestSurvival >= 600',
        unlockDesc: '生存10分钟'
    },
    {
        id: 'sera',
        name: '塞拉',
        title: '守护者',
        color: '#50C878',
        startingWeapon: 'garlic_aura',
        description: '坚韧的防御者，天生强韧。',
        statModifiers: { health: 1.15, damage: 0.95 },
        unlocked: false,
        unlockCondition: 'totalKills >= 1000',
        unlockDesc: '累计击杀1000个敌人'
    },
    {
        id: 'dante',
        name: '但丁',
        title: '风暴召唤者',
        color: '#7DF9FF',
        startingWeapon: 'lightning_chain',
        description: '快速连锁闪电，伤害较低但冷却更快。',
        statModifiers: { cooldown: 0.85, damage: 0.92 },
        unlocked: false,
        unlockCondition: 'highestCombo >= 50',
        unlockDesc: '达成50连击'
    },
    {
        id: 'luna',
        name: '露娜',
        title: '女祭司',
        color: '#C084FC',
        startingWeapon: 'holy_bible',
        description: '受月亮祝福，额外弹药和幸运。',
        statModifiers: { projectiles: 1, luck: 1.10 },
        unlocked: false,
        unlockCondition: 'totalRuns >= 10',
        unlockDesc: '完成10局游戏'
    },
    {
        id: 'viktor',
        name: '维克多',
        title: '冰霜法师',
        color: '#00BFFF',
        startingWeapon: 'ice_shard',
        description: '冰冻范围更广，在寒冷中谨慎前行。',
        statModifiers: { area: 1.15, speed: 0.90 },
        unlocked: false,
        unlockCondition: 'longestSurvival >= 900',
        unlockDesc: '生存15分钟'
    },
    {
        id: 'nyx',
        name: '尼克斯',
        title: '刺客',
        color: '#7C3AED',
        startingWeapon: 'shadow_dagger',
        description: '致命精准，玻璃大炮——高伤害低血量。',
        statModifiers: { damage: 1.15, health: 0.85 },
        unlocked: false,
        unlockCondition: 'highestKillCount >= 1000',
        unlockDesc: '单局击杀1000个敌人'
    }
];
