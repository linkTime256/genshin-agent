export const ELEMENT_LABELS: Record<string, string> = {
  Fire: "火",
  Water: "水",
  Wind: "风",
  Electric: "雷",
  Grass: "草",
  Ice: "冰",
  Rock: "岩",
};

export const ELEMENT_COLORS: Record<string, string> = {
  Fire: "#d9534f",
  Water: "#2f8fd8",
  Wind: "#2fa88a",
  Electric: "#8b6bd1",
  Grass: "#57a548",
  Ice: "#4aa8c9",
  Rock: "#c99531",
};

export const WEAPON_LABELS: Record<string, string> = {
  WEAPON_SWORD_ONE_HAND: "单手剑",
  WEAPON_CLAYMORE: "双手剑",
  WEAPON_POLE: "长柄武器",
  WEAPON_CATALYST: "法器",
  WEAPON_BOW: "弓",
};

export const ELEMENT_OPTIONS = Object.entries(ELEMENT_LABELS).map(([code, label]) => ({ code, label }));

export const elementLabel = (code: string) => ELEMENT_LABELS[code] ?? (code || "未知");
export const weaponLabel = (code: string) => WEAPON_LABELS[code] ?? (code || "未知");
export const elementColor = (code: string) => ELEMENT_COLORS[code] ?? "#7a8194";
export const stars = (rank: number) => (rank > 0 ? "★".repeat(Math.min(rank, 5)) : "—");
