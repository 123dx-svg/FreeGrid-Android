// ============================================================================
// 外观解锁 —— 皮肤(按经营等级解锁)+ 称号(按徽章解锁)。少而精。
// 皮肤只覆写强调色(data-skin,见 app.css),不动 dark/light 主体。
// ============================================================================

export interface Skin {
  id: string; // "" = 默认
  name: string;
  level: number; // 解锁所需经营等级
  desc: string;
  swatch: string; // 选择器色卡
}

export const SKINS: Skin[] = [
  { id: "", name: "默认", level: 0, desc: "经典夜空蓝", swatch: "#85c7f7" },
  { id: "star", name: "星空", level: 3, desc: "青蓝紫强调色", swatch: "#9b8ceb" },
  { id: "sun", name: "暖阳", level: 5, desc: "暖橙强调色", swatch: "#f0a85c" },
];

export interface Title {
  id: string; // "" = 默认(显示当前等级名)
  name: string;
  badge: string; // 解锁所需徽章 id("" = 始终可选)
  hint: string; // 解锁条件说明
}

export const TITLES: Title[] = [
  { id: "", name: "默认(当前等级)", badge: "", hint: "" },
  { id: "记账家", name: "记账家", badge: "track100", hint: "记账满 100 天" },
  { id: "存钱狂魔", name: "存钱狂魔", badge: "save50", hint: "储蓄率 ≥ 50%" },
  { id: "百万经营者", name: "百万经营者", badge: "nw100", hint: "净值突破 100 万" },
  { id: "自由之身", name: "自由之身", badge: "free365", hint: "自由天数 ≥ 365 天" },
  { id: "识己者", name: "识己者", badge: "fq", hint: "完成财商人格测试" },
];

export function skinById(id: string): Skin {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}
export function titleById(id: string): Title | undefined {
  return TITLES.find((t) => t.id === id);
}
