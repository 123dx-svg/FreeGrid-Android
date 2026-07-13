// ============================================================================
// 模拟一笔 · 纯计算层(投资 + 月供)。全本地,零网络零依赖零 AI。
// 投资:把宣传年化翻译成"实得"(单利、税费前)。
// 月供:等额本息 / 等额本金 / 分期费率(含真实年化 IRR),把"月供/费率"翻译成总利息。
// ============================================================================

export type HoldUnit = "month" | "year";

export function holdYears(value: number, unit: HoldUnit): number {
  return unit === "year" ? value : value / 12;
}
export function toMonths(value: number, unit: HoldUnit): number {
  return unit === "year" ? Math.round(value * 12) : Math.round(value);
}

// ── 投资:只算实得(单利、税费前,刻意不复利)──
export function realizedGain(principal: number, annualRatePct: number, years: number): number {
  if (principal <= 0 || years <= 0) return 0;
  return principal * (annualRatePct / 100) * years;
}
export function realizedPct(annualRatePct: number, years: number): number {
  return annualRatePct * years;
}
export function extraFreedomDays(gain: number, dailyNetBurn: number): number {
  if (gain <= 0) return 0;
  if (dailyNetBurn <= 0) return Infinity;
  return gain / dailyNetBurn;
}

// ── 月供 ──
export interface LoanResult {
  monthly: number; // 恒定月供(等额本息 / 分期);等额本金取首月
  firstMonthly: number; // 首月(等额本金用)
  lastMonthly: number; // 末月(等额本金用)
  totalInterest: number; // 总利息 / 总手续费
  totalPay: number; // 总还款
  apr: number; // 真实年化%(分期费率用;其它 = 输入年利率)
  descending: boolean; // 月供是否逐月递减(等额本金)
}

/** 等额本息:月供恒定 M = P·r(1+r)ⁿ/((1+r)ⁿ−1)。 */
export function equalInstallment(P: number, annualRatePct: number, months: number): LoanResult {
  const n = Math.max(1, Math.round(months));
  const r = annualRatePct / 100 / 12;
  const monthly = r <= 0 ? P / n : (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const totalPay = monthly * n;
  const totalInterest = Math.max(0, totalPay - P);
  return { monthly, firstMonthly: monthly, lastMonthly: monthly, totalInterest, totalPay, apr: annualRatePct, descending: false };
}

/** 等额本金:每月本金 P/n + 剩余本金利息,月供逐月递减。总利息 = r·P·(n+1)/2。 */
export function equalPrincipal(P: number, annualRatePct: number, months: number): LoanResult {
  const n = Math.max(1, Math.round(months));
  const r = annualRatePct / 100 / 12;
  const mp = P / n;
  const firstMonthly = mp + P * r;
  const lastMonthly = mp + mp * r;
  const totalInterest = (r * P * (n + 1)) / 2;
  const totalPay = P + totalInterest;
  return { monthly: firstMonthly, firstMonthly, lastMonthly, totalInterest, totalPay, apr: annualRatePct, descending: true };
}

/** 分期费率:每月按初始本金收手续费 → 月供 = P/n + P·f;真实年化用 IRR 二分。 */
export function installmentFee(P: number, monthlyFeePct: number, months: number): LoanResult {
  const n = Math.max(1, Math.round(months));
  const f = monthlyFeePct / 100;
  const monthly = P / n + P * f;
  const totalInterest = P * f * n;
  const totalPay = P + totalInterest;
  const apr = installmentApr(P, monthly, n);
  return { monthly, firstMonthly: monthly, lastMonthly: monthly, totalInterest, totalPay, apr, descending: false };
}

/** 二分求月供现金流的真实年化(名义 APR = 月 IRR × 12 × 100%)。 */
function installmentApr(P: number, monthly: number, n: number): number {
  if (P <= 0 || monthly <= 0 || n <= 0) return 0;
  const npv = (i: number) => {
    const pv = i === 0 ? monthly * n : (monthly * (1 - Math.pow(1 + i, -n))) / i;
    return P - pv; // npv(0)<0(总还款>本金),npv(大)>0 → 单调,存在根
  };
  let lo = 0;
  let hi = 1; // 月利率上限 100%
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (npv(mid) > 0) hi = mid;
    else lo = mid;
  }
  return ((lo + hi) / 2) * 12 * 100;
}

/** 总利息换算成"少自由天数" = 总利息 ÷ 日均净烧;净烧 ≤ 0 → ∞。 */
export function lostFreedomDays(totalInterest: number, dailyNetBurn: number): number {
  if (totalInterest <= 0) return 0;
  if (dailyNetBurn <= 0) return Infinity;
  return totalInterest / dailyNetBurn;
}
