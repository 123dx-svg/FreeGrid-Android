// ============================================================================
// 省钱模拟 · 拿铁因子 —— 纯计算层。全本地,零网络零依赖零 AI。
// 基于真实记账:少花某类支出 → 每月/每年省多少 → 换算成自由天数。
// ============================================================================

/** 按百分比省:月支出 × cutPct%(cutPct 夹在 0–100)。 */
export function monthlySavingByPct(currentMonthly: number, cutPct: number): number {
  const p = Math.min(100, Math.max(0, cutPct));
  return Math.max(0, currentMonthly) * (p / 100);
}

/** 按每天少花:¥/天 × 30(粗算一个月)。 */
export function monthlySavingByPerDay(perDay: number): number {
  return Math.max(0, perDay) * 30;
}

/** 每年省 = 月省 × 12。 */
export function annualSaving(monthly: number): number {
  return Math.max(0, monthly) * 12;
}
