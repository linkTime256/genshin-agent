import { db } from "./index";
import {
  artifactRecommendations,
  artifacts,
  characters,
  weaponRecommendations,
  weapons,
} from "./schema";

// 演示用图鉴数据：一批公开的角色 / 武器 / 圣遗物与常见搭配，仅供界面展示，不是官方配装结论。
// 在线 yatta 兜底查到的新角色会继续写进同一批表，图鉴会随之变多。
// 全部用 onConflictDoNothing，重复启动不会产生重复行。

type CharacterRow = { name: string; rank: number; element: string; weaponType: string };
type WeaponRow = { name: string; rank: number; type: string };
type ArtifactRow = { name: string; effects: string[] };
type Recommendation = { characterName: string; weaponNames: string[]; artifactNames: string[] };

const POLE = "WEAPON_POLE";
const CATALYST = "WEAPON_CATALYST";
const BOW = "WEAPON_BOW";
const SWORD = "WEAPON_SWORD_ONE_HAND";
const CLAYMORE = "WEAPON_CLAYMORE";

const characterRows: CharacterRow[] = [
  // 课程 Demo 自带的虚构角色，保留下来对照第 5 节手稿。
  { name: "米提亚", rank: 5, element: "Electric", weaponType: CATALYST },
  { name: "胡桃", rank: 5, element: "Fire", weaponType: POLE },
  { name: "钟离", rank: 5, element: "Rock", weaponType: POLE },
  { name: "可莉", rank: 5, element: "Fire", weaponType: CATALYST },
  { name: "雷电将军", rank: 5, element: "Electric", weaponType: POLE },
  { name: "甘雨", rank: 5, element: "Ice", weaponType: BOW },
  { name: "纳西妲", rank: 5, element: "Grass", weaponType: CATALYST },
  { name: "枫原万叶", rank: 5, element: "Wind", weaponType: SWORD },
  { name: "神里绫华", rank: 5, element: "Ice", weaponType: SWORD },
  { name: "迪卢克", rank: 5, element: "Fire", weaponType: CLAYMORE },
  { name: "行秋", rank: 4, element: "Water", weaponType: SWORD },
];

const weaponRows: WeaponRow[] = [
  { name: "神乐之真意", rank: 5, type: CATALYST },
  { name: "天空之卷", rank: 5, type: CATALYST },
  { name: "护摩之杖", rank: 5, type: POLE },
  { name: "和璞鸢", rank: 5, type: POLE },
  { name: "薙草之稻光", rank: 5, type: POLE },
  { name: "天空之脊", rank: 5, type: POLE },
  { name: "匣里灭辰", rank: 4, type: POLE },
  { name: "阿莫斯之弓", rank: 5, type: BOW },
  { name: "冬极白星", rank: 5, type: BOW },
  { name: "雾切之回光", rank: 5, type: SWORD },
  { name: "苍古自由之誓", rank: 5, type: SWORD },
  { name: "祭礼剑", rank: 4, type: SWORD },
  { name: "天目影打刀", rank: 4, type: SWORD },
  { name: "狼的末路", rank: 5, type: CLAYMORE },
  { name: "螭骨剑", rank: 4, type: CLAYMORE },
  { name: "四风原典", rank: 5, type: CATALYST },
  { name: "千夜浮梦", rank: 5, type: CATALYST },
  { name: "流浪乐章", rank: 4, type: CATALYST },
];

const artifactRows: ArtifactRow[] = [
  {
    name: "炽烈的炎之魔女",
    effects: ["二件套：火元素伤害加成提高 15%", "四件套：超载、燃烧、烈绽放反应伤害提升；施放元素战技后 10 秒内二件套效果提高 50%，最多叠加 3 层"],
  },
  {
    name: "追忆之注连",
    effects: ["二件套：攻击力提高 18%", "四件套：施放元素战技时若元素能量不低于 15 点，流失 15 点能量，10 秒内普通攻击、重击、下落攻击伤害提高 50%"],
  },
  {
    name: "绝缘之旗印",
    effects: ["二件套：元素充能效率提高 20%", "四件套：元素爆发伤害提高，提升量基于元素充能效率的 25%，最多 75%"],
  },
  {
    name: "翠绿之影",
    effects: ["二件套：风元素伤害加成提高 15%", "四件套：扩散反应伤害提高 60%；根据扩散元素类型降低敌人对应元素抗性 40%，持续 10 秒"],
  },
  {
    name: "冰风迷途的勇士",
    effects: ["二件套：冰元素伤害加成提高 15%", "四件套：攻击处于冰元素影响下的敌人时暴击率提高 20%，攻击冻结状态下敌人时额外提高 20%"],
  },
  {
    name: "深林的记忆",
    effects: ["二件套：草元素伤害加成提高 15%", "四件套：元素战技或元素爆发命中敌人后，使命中目标的草元素抗性降低 30%，持续 8 秒"],
  },
  {
    name: "千岩牢固",
    effects: ["二件套：生命值提高 20%", "四件套：元素战技命中敌人后，队伍中附近角色攻击力提高 20%、护盾强效提高 30%，持续 3 秒"],
  },
  {
    name: "沉沦之心",
    effects: ["二件套：水元素伤害加成提高 15%", "四件套：施放元素战技后 15 秒内，普通攻击与重击造成的伤害提高 30%"],
  },
  {
    name: "昔日宗室之仪",
    effects: ["二件套：元素爆发造成的伤害提高 20%", "四件套：施放元素爆发后，队伍中所有角色攻击力提高 20%，持续 12 秒，该效果不可叠加"],
  },
];

const recommendations: Recommendation[] = [
  { characterName: "米提亚", weaponNames: ["神乐之真意", "天空之卷"], artifactNames: ["绝缘之旗印"] },
  { characterName: "胡桃", weaponNames: ["护摩之杖", "匣里灭辰"], artifactNames: ["炽烈的炎之魔女", "追忆之注连"] },
  { characterName: "钟离", weaponNames: ["护摩之杖", "天空之脊"], artifactNames: ["千岩牢固"] },
  { characterName: "可莉", weaponNames: ["四风原典", "流浪乐章"], artifactNames: ["炽烈的炎之魔女"] },
  { characterName: "雷电将军", weaponNames: ["薙草之稻光", "和璞鸢"], artifactNames: ["绝缘之旗印"] },
  { characterName: "甘雨", weaponNames: ["阿莫斯之弓", "冬极白星"], artifactNames: ["冰风迷途的勇士"] },
  { characterName: "纳西妲", weaponNames: ["千夜浮梦", "流浪乐章"], artifactNames: ["深林的记忆"] },
  { characterName: "枫原万叶", weaponNames: ["苍古自由之誓", "祭礼剑"], artifactNames: ["翠绿之影"] },
  { characterName: "神里绫华", weaponNames: ["雾切之回光", "天目影打刀"], artifactNames: ["冰风迷途的勇士"] },
  { characterName: "迪卢克", weaponNames: ["狼的末路", "螭骨剑"], artifactNames: ["炽烈的炎之魔女"] },
  { characterName: "行秋", weaponNames: ["祭礼剑", "雾切之回光"], artifactNames: ["绝缘之旗印", "昔日宗室之仪"] },
];

export function seed() {
  for (const row of characterRows) {
    db.insert(characters).values(row).onConflictDoNothing().run();
  }
  for (const row of weaponRows) {
    db.insert(weapons).values(row).onConflictDoNothing().run();
  }
  for (const row of artifactRows) {
    db.insert(artifacts).values({ name: row.name, effects: JSON.stringify(row.effects) }).onConflictDoNothing().run();
  }
  for (const rec of recommendations) {
    for (const weaponName of rec.weaponNames) {
      db.insert(weaponRecommendations)
        .values({ characterName: rec.characterName, weaponName })
        .onConflictDoNothing().run();
    }
    for (const setName of rec.artifactNames) {
      db.insert(artifactRecommendations)
        .values({ characterName: rec.characterName, setName })
        .onConflictDoNothing().run();
    }
  }
}
