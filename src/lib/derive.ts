// Dashboard view-model:数据 → 引擎 → 派生量。所有数字都从 freedom-math 出,UI 只渲染。
import {
  trackDays,
  dailyBurn,
  dailyPassive,
  passiveRatio,
  freedomDays,
  freedomDaysDisplay,
  freedomDaysUnit,
  gridState,
  freedomDaysHistory,
  deltaSummary,
  depleteDate,
  type GridState,
  type HistoryPoint,
} from "./freedom-math";
import { netWorth, type Expense, type Income, type PassiveSource, type UserAssets } from "./models";

export interface DashboardVM {
  netWorth: number;
  lockedAssets: number;
  cash: number;
  liabilities: number;
  trackDays: number;
  dailyBurn: number;
  dailyPassive: number;
  passiveRatio: number;
  freedomDays: number;
  freedomDaysDisplay: string;
  unit: "day" | "month" | "year";
  grid: GridState;
  history: HistoryPoint[];
  delta: { start: number; end: number; delta: number } | null;
  depleteDate: Date | null;
  totalExpenses: number;
  expenseCount: number;
}

export function deriveDashboard(
  data: { expenses: Expense[]; incomes: Income[]; passiveSources: PassiveSource[]; assets: UserAssets },
  now: Date = new Date()
): DashboardVM {
  const { expenses, incomes, passiveSources, assets } = data;
  const nw = netWorth(assets);
  const td = trackDays(assets.firstRecordDate, now);
  const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
  const db = dailyBurn(totalExp, td);
  const dp = dailyPassive(passiveSources);
  const fd = freedomDays(nw, db, dp);
  const grid = gridState(assets.lockedAssets, assets.cash, db, dp, assets.liabilities ?? 0);
  const history = freedomDaysHistory(expenses, incomes, nw, assets.firstRecordDate, dp, 12, now);

  return {
    netWorth: nw,
    lockedAssets: assets.lockedAssets,
    cash: assets.cash,
    liabilities: assets.liabilities ?? 0,
    trackDays: td,
    dailyBurn: db,
    dailyPassive: dp,
    passiveRatio: passiveRatio(dp, db),
    freedomDays: fd,
    freedomDaysDisplay: freedomDaysDisplay(fd),
    unit: freedomDaysUnit(fd),
    grid,
    history,
    delta: deltaSummary(history),
    depleteDate: depleteDate(fd, now),
    totalExpenses: totalExp,
    expenseCount: expenses.length,
  };
}
