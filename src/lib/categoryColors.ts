// ============================================================================
// 分类调色板 —— 9 类支出固定配色 + 收入来源动态配色。
// 中等明度冷暖兼顾,在暗色(主)与浅色双主题下都可读。纯常量,零依赖。
// ============================================================================

import { EXPENSE_CATEGORIES } from "./models";

/** 支出分类固定色(与 EXPENSE_CATEGORIES 对应;保留旧三餐色以兼容历史数据) */
export const CATEGORY_COLORS: Record<string, string> = {
  饮食: "#E9C46A", // 暖琥珀
  房租: "#6E7CA8", // 石板蓝
  房贷: "#8A7FB0", // 紫蓝
  水电燃煤: "#D89A5C", // 暖橙
  物业费: "#9AA8C0", // 灰蓝
  交通: "#6FB1E0", // 天蓝
  车贷: "#5FA8A0", // 青绿
  购物: "#B49AE0", // 紫
  育儿: "#E0A0C0", // 柔粉
  保险: "#6FA8C9", // 蓝
  医疗: "#E0727A", // 玫红
  成长投资: "#8CD19E", // 苔绿
  娱乐: "#E287B0", // 品红
  人情: "#E8975C", // 橙
  其他: "#8FA3C4", // 蓝灰
  // ── 旧分类(历史数据兼容)──
  早餐: "#E9C46A",
  午餐: "#E8A35C",
  晚餐: "#E88D6B",
};

const FALLBACK_COLOR = "#8FA3C4";

/** 收入来源的轮转色板(冷色为主,与支出区分:营收偏蓝绿冷调) */
const INCOME_PALETTE = [
  "#85C7F7", // 资产蓝
  "#8CD19E", // 苔绿
  "#A6D9FF", // 浅天蓝
  "#7FB0D8", // 钢蓝
  "#9DC3A8", // 灰绿
  "#B9C4DC", // 银蓝
  "#6FC3C9", // 青
  "#C0AEE6", // 浅紫
];

/** 取某支出分类的固定色 */
export function categoryColor(name: string): string {
  return CATEGORY_COLORS[name] ?? FALLBACK_COLOR;
}

/** 按名取色的通用调色板(自定义分类 / 收入来源等未固定色者用;按名 hash → 稳定且每名唯一) */
const NAME_PALETTE = [
  "#85C7F7", "#8CD19E", "#B49AE0", "#E9C46A", "#6FC3C9", "#E287B0",
  "#E8975C", "#7FB0D8", "#9DC3A8", "#C0AEE6", "#E0727A", "#6FA8C9",
  "#D89A5C", "#5FA8A0", "#A6D9FF",
];
function hashName(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** 统一取色:已知支出分类→固定色;其余(自定义支出 / 收入来源)→按名 hash 调色板。
 *  记账色点与年报饼图共用此函数,保证配色一致且跨年稳定。 */
export function colorForName(name: string): string {
  return CATEGORY_COLORS[name] ?? NAME_PALETTE[hashName(name) % NAME_PALETTE.length];
}

/** 按顺序给收入来源分配色(同一来源列表内稳定) */
export function incomeColor(index: number): string {
  return INCOME_PALETTE[index % INCOME_PALETTE.length];
}

/** 被动收入源专用色(与营收来源区分,统一用金色系强调"睡后收入") */
export const PASSIVE_COLOR = "#EBCC73";

/** 分类的规范顺序索引(用于排序时的稳定 tie-break) */
export function categoryOrder(name: string): number {
  const i = (EXPENSE_CATEGORIES as readonly string[]).indexOf(name);
  return i === -1 ? 99 : i;
}
