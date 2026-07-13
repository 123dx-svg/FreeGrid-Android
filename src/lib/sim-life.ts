// ============================================================================
// 决策模拟 · 纯计算层(跳槽 / 创业)。全本地,零网络零依赖零 AI。
// 跳槽:把两份工作按"真实时薪"(摊入通勤与工时)对比——总额高≠更值。
// 创业:烧的是自由跑道——没工资 + 启动成本 + 固定支出,营收往往高估。
// ============================================================================

// ── 跳槽:真实时薪对比 ──
export type RestType = "double" | "bigsmall" | "single" | "none"; // 双休/大小周/单休/无休
const WEEKS_PER_YEAR = 48; // 扣掉法定假/年假的粗算工作周

export function daysPerWeek(rest: RestType): number {
  switch (rest) {
    case "double": return 5;
    case "bigsmall": return 5.5;
    case "single": return 6;
    case "none": return 7;
  }
}

export interface JobInput {
  monthlySalary: number; // 月薪(¥)
  hoursPerDay: number; // 每天工时(h)
  commutePerDay: number; // 每天通勤·往返(h)
  rest: RestType;
}
export interface JobStats {
  annualIncome: number; // 年总额
  workDays: number; // 年工作日
  annualWork: number; // 年上班小时
  annualCommute: number; // 年通勤小时
  realHourly: number; // 真实时薪 = 年总额 ÷ (年上班+年通勤)
}

export function jobStats(j: JobInput): JobStats {
  const workDays = daysPerWeek(j.rest) * WEEKS_PER_YEAR;
  const annualWork = Math.max(0, j.hoursPerDay) * workDays;
  const annualCommute = Math.max(0, j.commutePerDay) * workDays;
  const annualIncome = Math.max(0, j.monthlySalary) * 12;
  const totalHours = annualWork + annualCommute;
  const realHourly = totalHours > 0 ? annualIncome / totalHours : 0;
  return { annualIncome, workDays, annualWork, annualCommute, realHourly };
}

// ── 创业:烧钱跑道 & 机会成本 ──
/** 每月净烧(净值消耗速度)= 个人月消费 + (固定成本 − 营收);可负(=盈利,不烧)。 */
export function startupMonthlyBurn(monthlyExpense: number, fixedCost: number, revenue: number): number {
  return monthlyExpense + (fixedCost - revenue);
}
/** 烧钱跑道(月)=(净值 − 启动资金)÷ 月净烧;净烧 ≤ 0(盈利)→ ∞。 */
export function startupRunwayMonths(netWorth: number, startup: number, monthlyBurn: number): number {
  if (monthlyBurn <= 0) return Infinity;
  const avail = netWorth - startup;
  return avail <= 0 ? 0 : avail / monthlyBurn;
}
/** 比继续打工每月少攒 = 放弃月薪 − (营收 − 固定成本)。 */
export function monthlyVsEmployed(giveUpSalary: number, fixedCost: number, revenue: number): number {
  return giveUpSalary - (revenue - fixedCost);
}

// ── 通用:金额换算成自由天数 = 金额 ÷ 日均净烧;净烧 ≤ 0 → ∞。 ──
export function freedomDaysFor(amount: number, dailyNetBurn: number): number {
  if (amount <= 0) return 0;
  if (dailyNetBurn <= 0) return Infinity;
  return amount / dailyNetBurn;
}
