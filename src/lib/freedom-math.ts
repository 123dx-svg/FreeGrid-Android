// ============================================================================
// FreedomMath —— 业务计算核心,1:1 移植自 iOS FreeGrid/Item.swift。
//
// 移植铁律(全部带着 iOS 已修的坑一起过来):
//  · 取整一律向下 floor(Math.trunc on 正数)—— 跟 LifeGrid 截断一致,否则 77.9
//    Hero 四舍五入显示 78、Grid 截断 77,同屏裂开。
//  · netBurn = max(0, dailyBurn − dailyPassive);netBurn=0 → 自由天数 = ∞。
//  · sparkline 历史按"自然日"归属(startOfDay 比较),不看时间戳 —— 否则当天到账
//    的收入在终点被误判成"今天之后"减掉,终点塌陷。
//  · trackDays_i = (first→weekEnd) + 1,含端点当天,跟 Hero 分母同口径。
//
// ⚠️ JS Date 地雷:绝不用裸 Date 算"天数差"(会被 UTC/时区/DST 咬)。
//    一切自然日比较都先 startOfDay(本地零点),天数差用本地零点的毫秒差 / 一天再 round。
// ============================================================================

import type { Expense, Income, PassiveSource } from "./models";

// ---- 本地零点日期工具(这是保真的地基) ----

/** 本地零点(对应 Swift Calendar.current.startOfDay) */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 本地零点 + n 天(对应 cal.date(byAdding:.day)) */
export function addDays(d: Date, n: number): Date {
  const s = startOfDay(d);
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() + n);
}

/** a→b 的整天数(对应 cal.dateComponents([.day])),按本地零点算并 round 吸收 DST */
export function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** 向下取整(对应 Swift Int() 对正数的截断) */
const floor = (x: number): number => Math.trunc(x);

// ===== 基础计量 =====

/** 记录天数 = 今天 − firstRecordDate + 1(最小 1,没记账返回 1 避免除零) */
export function trackDays(firstRecordDate: Date | null, now: Date = new Date()): number {
  if (!firstRecordDate) return 1;
  return Math.max(1, daysBetween(firstRecordDate, now) + 1); // +1 因为"今天也算一天"
}

/** 日均消费 = 总支出 ÷ 记录天数(对应 getDailyBurn) */
export function dailyBurn(totalExpenses: number, days: number): number {
  if (days <= 0) return 0;
  return totalExpenses / days;
}

/** 日均被动收入 = Σ(月被动 ÷ 30) */
export function dailyPassive(sources: Pick<PassiveSource, "monthlyAmount">[]): number {
  return sources.reduce((s, p) => s + p.monthlyAmount / 30, 0);
}

/** 被动覆盖率 = 日均被动 ÷ 日均消费(≥ 1.0 即财务自由) */
export function passiveRatio(dailyPassiveVal: number, dailyBurnVal: number): number {
  if (dailyBurnVal <= 0) return 0;
  return dailyPassiveVal / dailyBurnVal;
}

// ===== 核心:自由天数 =====

/**
 * 自由天数 = 净值 / 净每日消耗;净每日消耗 = max(0, 日均消费 − 日均被动)。
 * 被动覆盖 ≥ 100%(净每日消耗 = 0)→ Infinity(永远自由)。
 */
export function freedomDays(netWorthVal: number, dailyBurnVal: number, dailyPassiveVal = 0): number {
  const netBurn = Math.max(0, dailyBurnVal - dailyPassiveVal);
  if (netBurn <= 0) return Infinity;
  return Math.max(0, netWorthVal) / netBurn;
}

// ===== 财务状态(驱动"求生模式"的一根轴) =====

/** 临界阈值:自由天数 < 此值(且 > 0)进入「临界」预警。 */
export const WARN_DAYS = 14;

export type FinancialState = "free" | "normal" | "warning" | "survival";

/**
 * 财务状态四档:
 *  · free     被动覆盖(自由天数 = ∞)→ 财富自由
 *  · survival 净值 ≤ 0 → 自由天数见底(0),进入求生模式
 *  · warning  0 < 自由天数 < WARN_DAYS → 快见底,临界预警
 *  · normal   自由天数 ≥ WARN_DAYS
 * 注:freedomDays 已把净值 max(0,·) 兜底,所以 === 0 恒等价于「净值 ≤ 0 且有净消耗」。
 */
export function financialState(netWorthVal: number, freedomDaysVal: number): FinancialState {
  if (!Number.isFinite(freedomDaysVal)) return "free";
  if (freedomDaysVal <= 0 || netWorthVal <= 0) return "survival";
  if (freedomDaysVal < WARN_DAYS) return "warning";
  return "normal";
}

/**
 * 自由天数格式化:三档无后缀(单位由 hero KickerLabel 承载)。
 * < 365 天 → 整数天 "127";365–3649 → 整数月 days/30.44;≥ 3650 → 1 位小数年 days/365.25;∞/NaN → "∞"。
 * 取整一律 floor —— 跟 LifeGrid 截断一致。
 */
export function freedomDaysDisplay(value: number): string {
  if (!Number.isFinite(value)) return "∞";
  if (Number.isNaN(value)) return "∞";
  if (value < 365) return String(floor(value));
  if (value < 3650) return String(floor(value / 30.44));
  return (value / 365.25).toFixed(1);
}

export type FreedomUnit = "day" | "month" | "year";

/** 按 value 大小决定档位(三档跟 freedomDaysDisplay 一致) */
export function freedomDaysUnit(value: number): FreedomUnit {
  if (!Number.isFinite(value) || Number.isNaN(value)) return "day";
  if (value < 365) return "day";
  if (value < 3650) return "month";
  return "year";
}

/** 按指定档位格式化(把 to/delta 对齐到 from 档位);delta 用 abs,符号由调用方加 */
export function freedomDaysFormatted(value: number, unit: FreedomUnit): string {
  if (!Number.isFinite(value) || Number.isNaN(value)) return "∞";
  switch (unit) {
    case "day":
      return value.toFixed(0);
    case "month":
      return (value / 30.44).toFixed(0);
    case "year":
      return (value / 365.25).toFixed(1);
  }
}

export function freedomUnitLabel(unit: FreedomUnit): string {
  return unit === "day" ? "天" : unit === "month" ? "月" : "年";
}

// ============================================================================
// 生命网格(自适应单位:日/月/年)
// < 1 年(<365 天):日格,最多 365;1–10 年(365–3649):月格,最多 120;≥ 10 年:年格,最多 99。
// ============================================================================

export type GridUnit = "day" | "month" | "year";

export const GRID_UNIT_META: Record<GridUnit, { cellSize: number; spacing: number; maxCells: number; label: string }> = {
  day: { cellSize: 9, spacing: 2.5, maxCells: 365, label: "天" },
  month: { cellSize: 12, spacing: 3, maxCells: 120, label: "月" }, // 10 年
  year: { cellSize: 16, spacing: 3.5, maxCells: 99, label: "年" },
};

export interface GridState {
  unit: GridUnit;
  count: number;
  blueDays: number; // 蓝格(锁定资产)
  yellowDays: number; // 金格(现金)
  isOverflow: boolean;
}

/**
 * 根据财务状态算 grid 档位 + 格数 + 双色分配。
 * 被动完全覆盖(净每日消耗 = 0)→ 年档满格 99(永远自由)。
 */
export function gridState(
  lockedAssets: number,
  cash: number,
  dailyBurnVal: number,
  dailyPassiveVal = 0,
  liabilities = 0
): GridState {
  if (dailyBurnVal <= 0) {
    return { unit: "day", count: 0, blueDays: 0, yellowDays: 0, isOverflow: false };
  }

  const gross = Math.max(0, lockedAssets) + Math.max(0, cash);
  const netWorthVal = Math.max(0, gross - Math.max(0, liabilities)); // 扣负债
  const netBurn = Math.max(0, dailyBurnVal - dailyPassiveVal);
  const totalDays = netBurn > 0 ? netWorthVal / netBurn : Infinity;

  let unit: GridUnit;
  let count: number;
  let isOverflow: boolean;

  if (!Number.isFinite(totalDays)) {
    // 被动完全覆盖(净消耗 0)→ 年档满格,永远自由
    unit = "year";
    count = 99;
    isOverflow = true;
  } else if (totalDays < 365) {
    unit = "day";
    count = floor(totalDays);
    isOverflow = false;
  } else if (totalDays < 3650) {
    unit = "month";
    count = Math.min(floor(totalDays / 30.44), GRID_UNIT_META.month.maxCells);
    isOverflow = false;
  } else {
    unit = "year";
    const years = floor(totalDays / 365.25);
    count = Math.min(years, GRID_UNIT_META.year.maxCells);
    isOverflow = years > GRID_UNIT_META.year.maxCells;
  }

  // 双色分配:blueDays(资产→渲染金)在前,yellowDays(现金→渲染蓝)在后。
  // 关键:在所有分支统一对最终 count 切分 → blueDays + yellowDays 恒 = count,
  // 渲染层永远只画 count 个格(修掉 ∞ 态曾返回 99*365 导致画爆的 bug)。
  let blueCells = 0;
  let goldCells = 0;
  if (gross > 0 && count > 0) {
    blueCells = Math.round((count * Math.max(0, lockedAssets)) / gross);
    goldCells = count - blueCells;
  }

  return { unit, count, blueDays: blueCells, yellowDays: goldCells, isOverflow };
}

// ============================================================================
// 历史趋势(sparkline + delta + 见底日期)
// 反推过去 N 周末日的 freedomDays。trackDays<14 返回空;14–84 返回 trackDays/7 个点;≥84 返回 12 个。
// ============================================================================

export interface HistoryPoint {
  date: Date;
  freedomDays: number;
}

export function freedomDaysHistory(
  expenses: Pick<Expense, "amount" | "date">[],
  incomes: Pick<Income, "amount" | "date">[],
  currentNetWorth: number,
  firstRecordDate: Date | null,
  dailyPassiveVal = 0,
  weeks = 12,
  now: Date = new Date()
): HistoryPoint[] {
  if (!firstRecordDate) return [];
  const today = startOfDay(now);
  const trackedDays = daysBetween(firstRecordDate, today);
  if (trackedDays < 14) return [];

  const availableWeeks = Math.min(weeks, Math.floor(trackedDays / 7));
  const snapshots: HistoryPoint[] = [];

  for (let i = availableWeeks; i >= 0; i--) {
    const weekEnd = addDays(today, -7 * i);
    if (weekEnd.getTime() < startOfDay(firstRecordDate).getTime()) continue;

    // +1 跟 Hero 同口径(含端点当天),否则分母少 1、终点比 Hero 少 1。
    const trackDays_i = Math.max(1, daysBetween(firstRecordDate, weekEnd) + 1);

    // 关键:交易按"自然日"归属(startOfDay 比较),不看时间戳。
    const dayMs = (d: Date) => startOfDay(d).getTime();
    const weekEndMs = weekEnd.getTime();

    const expUntil = expenses.filter((e) => dayMs(e.date) <= weekEndMs).reduce((s, e) => s + e.amount, 0);
    const dailyBurn_i = expUntil / trackDays_i;

    const expAfter = expenses.filter((e) => dayMs(e.date) > weekEndMs).reduce((s, e) => s + e.amount, 0);
    const incAfter = incomes.filter((e) => dayMs(e.date) > weekEndMs).reduce((s, e) => s + e.amount, 0);
    const netWorth_i = currentNetWorth + expAfter - incAfter;

    const netBurn_i = Math.max(0, dailyBurn_i - dailyPassiveVal);
    let days_i: number;
    if (netBurn_i > 0) {
      days_i = Math.max(0, netWorth_i) / netBurn_i;
    } else if (dailyBurn_i > 0) {
      days_i = 1825; // 被动覆盖,cap 5 年防爆图
    } else {
      days_i = 0;
    }

    snapshots.push({ date: weekEnd, freedomDays: days_i });
  }

  return snapshots;
}

/** 12-week-ago vs 当前的 delta;两端都 floor,跟 Hero/Grid 一致 */
export function deltaSummary(history: HistoryPoint[]): { start: number; end: number; delta: number } | null {
  if (history.length < 2) return null;
  const s = floor(history[0].freedomDays);
  const e = floor(history[history.length - 1].freedomDays);
  return { start: s, end: e, delta: e - s };
}

/** 自由耗尽预计日期(今天 + round(freedomDays) 天);∞/无数据/超 5*1825 返回 null */
export function depleteDate(freedomDaysVal: number, now: Date = new Date()): Date | null {
  if (!Number.isFinite(freedomDaysVal) || freedomDaysVal <= 0 || freedomDaysVal >= 1825 * 5) return null;
  return addDays(now, Math.round(freedomDaysVal));
}
