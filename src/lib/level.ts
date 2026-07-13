// ============================================================================
// 经营等级 —— 纯函数(零依赖)。徽章解锁数 = 经历值(XP),落在哪个区间即为该等级。
// 与「人生经营」隐喻一致:个体户 → 上市公司。每级可解锁外观/称号/进阶(unlocks 供展示)。
// ============================================================================

export interface Level {
  index: number; // 1-based
  name: string; // 公司隐喻名 = 称号
  min: number; // 徽章数下限(达到即进入本级)
  unlocks?: string; // 本级解锁说明(展示用)
}

// 7 级(阈值可调):徽章总数 29 → 早段升级快、顶段稀有
export const LEVELS: Level[] = [
  { index: 1, name: "个体户", min: 0 },
  { index: 2, name: "小作坊", min: 2, unlocks: "记账习惯初成" },
  { index: 3, name: "工作室", min: 5, unlocks: "星空皮肤 · 季报" },
  { index: 4, name: "小公司", min: 9, unlocks: "年报进阶指标" },
  { index: 5, name: "成长企业", min: 14, unlocks: "暖阳皮肤 · 年度对比" },
  { index: 6, name: "集团", min: 19, unlocks: "财务自由在望" },
  { index: 7, name: "上市公司", min: 25, unlocks: "集大成 · 顶级称号" },
];

export const MAX_LEVEL = LEVELS[LEVELS.length - 1].index;

export interface LevelState {
  index: number;
  name: string;
  count: number; // 当前徽章数
  min: number; // 本级下限
  next: Level | null; // 下一级
  toNext: number; // 还差几枚升级
  progress: number; // 本级内进度 0–1
  unlocks?: string;
}

export function levelForCount(count: number): LevelState {
  let cur = LEVELS[0];
  for (const l of LEVELS) if (count >= l.min) cur = l;
  const next = LEVELS.find((l) => l.index === cur.index + 1) ?? null;
  const span = next ? next.min - cur.min : 1;
  const done = count - cur.min;
  const toNext = next ? Math.max(0, next.min - count) : 0;
  const progress = next ? Math.max(0, Math.min(1, done / span)) : 1;
  return { index: cur.index, name: cur.name, count, min: cur.min, next, toNext, progress, unlocks: cur.unlocks };
}

/** 某等级是否已达到(供外观/进阶门控用)。 */
export function levelReached(count: number, levelIndex: number): boolean {
  return levelForCount(count).index >= levelIndex;
}
