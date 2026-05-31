// ============================================================================
// SimDemo —— 模拟决策「格子推演」的纯计算层,1:1 移植自 iOS SimulateSheet。
//
// 核心体感:把抽象的"−16 天"翻译成肉眼可见的格子级联熄灭(支出)/ 点亮(收入)。
// 这里只放纯函数(计时 / 包络 / 档位换算 / 一次模拟的完整结果),
// 动画驱动在 SimDemoGrid.svelte 里用 requestAnimationFrame(对齐 iOS TimelineView
// + 纯函数 elapsed 的套路,不用 repeatForever 以免 view-lifecycle 冻结)。
// ============================================================================

import {
  dailyBurn,
  freedomDays,
  GRID_UNIT_META,
  type GridUnit,
} from "./freedom-math";

// ===== 计时:级联窗口 span + 单格 envelope 时长 cellDur =====
// span 随 delta 增大而拉长并 cap,避免大 delta 拖沓。
// 方向区分:点亮(收入)刻意放慢——增格是"赚回自由"的奖励时刻,逐格慢点更有满足感;
// 熄灭(支出)保持利落。grid 渲染和落定计时器共用这一份,保证 total 一致。
export function simDemoTiming(
  delta: number,
  ignite: boolean
): { span: number; cellDur: number; total: number } {
  if (ignite) {
    const cellDur = 0.72;
    const span = Math.min(3.0, Math.max(0.5, 0.18 * delta));
    return { span, cellDur, total: span + cellDur };
  } else {
    const cellDur = 0.55;
    const span = Math.min(1.6, Math.max(0.25, 0.1 * delta));
    return { span, cellDur, total: span + cellDur };
  }
}

// ===== envelope helpers(移植 lead-wealth _eoq / _env)=====

/** ease-out quart:1-(1-t)^4,收尾绵软 */
export function easeOut(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 4);
}

/** attack-release 包络:t<attack 缓入到 1,之后按 release 指数衰减回 0。
 *  给辉光/缩放脉冲用——点亮瞬间鼓一下再落定。 */
export function envelope(t: number, attack: number, release: number): number {
  if (t >= 1) return 0;
  if (t < attack) return easeOut(t / attack);
  return Math.pow(1 - (t - attack) / (1 - attack), release);
}

// ===== freedomDays → 格子换算(沿用 FreedomMath.gridState 档位规则)=====

/** 锁定"当前态"档位渲染两态,保证格子语义在动画全程一致 */
export function gridUnitFor(freedomDaysVal: number): GridUnit {
  if (!Number.isFinite(freedomDaysVal) || freedomDaysVal >= 3650) return "year";
  if (freedomDaysVal >= 365) return "month";
  return "day";
}

export function cellCountFor(freedomDaysVal: number, unit: GridUnit): number {
  const maxCells = GRID_UNIT_META[unit].maxCells;
  if (!Number.isFinite(freedomDaysVal)) return maxCells;
  let raw: number;
  switch (unit) {
    case "day":
      raw = freedomDaysVal;
      break;
    case "month":
      raw = freedomDaysVal / 30.44;
      break;
    case "year":
      raw = freedomDaysVal / 365.25;
      break;
  }
  return Math.min(Math.max(0, Math.trunc(raw)), maxCells);
}

/** 蓝格(锁定资产)数——边界外即金格(现金)。注:命名沿用 iOS,"blue" 计数渲染成金色。 */
export function blueCellsFor(count: number, locked: number, netWorthVal: number): number {
  if (netWorthVal <= 0 || count <= 0) return 0;
  return Math.min(count, Math.round((count * Math.max(0, locked)) / netWorthVal));
}

// ===== 一次模拟的完整结果(preview 表格 + 格子推演共用一份,保证数字一致)=====

export type SimMode = "expense" | "income";

export interface SimOutcome {
  lockedAssets: number;
  currentNW: number;
  newNW: number;
  currentAvg: number;
  newAvg: number;
  currentFreedom: number;
  newFreedom: number;
}

export function simOutcome(params: {
  lockedAssets: number;
  cash: number;
  totalExpenses: number;
  trackDays: number;
  dailyPassive: number;
  amount: number;
  mode: SimMode;
}): SimOutcome {
  const { lockedAssets, cash, totalExpenses, trackDays, dailyPassive, amount, mode } = params;
  const currentNW = lockedAssets + cash;
  const currentAvg = dailyBurn(totalExpenses, trackDays);
  const currentFreedom = freedomDays(currentNW, currentAvg, dailyPassive);

  let newNW: number;
  let newAvg: number;
  if (mode === "expense") {
    newNW = currentNW - amount;
    newAvg = dailyBurn(totalExpenses + amount, trackDays);
  } else {
    newNW = currentNW + amount;
    newAvg = currentAvg; // 收入不改日均消费
  }
  const newFreedom = freedomDays(newNW, newAvg, dailyPassive);

  return { lockedAssets, currentNW, newNW, currentAvg, newAvg, currentFreedom, newFreedom };
}
