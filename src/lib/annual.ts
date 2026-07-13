// ============================================================================
// 个人经营年报 —— 年度聚合 + 金融评估指标 + 经营健康分 + 诙谐叙事文案。
// 纯函数,读领域模型,不碰 store / 不依赖 freedom-math 的"今"语义(自带 scope 口径)。
// 隐私:文案全部本地阈值套模板,零网络零 AI。
// ============================================================================

import type { Expense, Income, PassiveSource, UserAssets } from "./models";
import { netWorth } from "./models";
import { categoryColor, colorForName, PASSIVE_COLOR, categoryOrder } from "./categoryColors";

export type Quarter = 1 | 2 | 3 | 4;
export type QuarterScope = { y: number; q: Quarter };
export type Scope = number | "all" | QuarterScope;
export const isQuarterScope = (s: Scope): s is QuarterScope => typeof s === "object" && s !== null;

export interface AnnualData {
  expenses: Expense[];
  incomes: Income[];
  passiveSources: PassiveSource[];
  assets: UserAssets;
}

export interface Slice {
  name: string;
  value: number;
  pct: number; // 0-100
  color: string;
  passive?: boolean;
}

export interface MonthlyOps {
  month: number; // 1-12
  income: number;
  expense: number;
}

export interface HealthPart {
  label: string;
  score: number;
  max: number;
  note: string;
}
export interface HealthScore {
  score: number; // 0-100
  rating: string; // AAA..B
  parts: HealthPart[];
  verdict: string;
}

export interface AnnualReport {
  scope: Scope;
  yearLabel: string;
  isQuarter: boolean; // 季报 = true
  settled: boolean; // 过去自然年 = 已结算;当年/全部 = 未结算
  // 损益
  revenue: number; // 总营收 = 记录收入 + 年化被动源(scope 内)
  recordedIncome: number;
  passiveAnnualized: number;
  cost: number;
  net: number;
  margin: number; // net/revenue
  costIncomeRatio: number; // cost/revenue
  // 结构
  expenseSlices: Slice[];
  incomeSlices: Slice[];
  monthly: MonthlyOps[];
  // 资产造血
  passiveIncomeTotal: number; // 年化被动源 + is_passive 记录收入
  passiveShare: number; // passiveIncomeTotal / revenue
  fiProgress: number; // 日均被动/日均消费,封顶 1
  freedomDays: number;
  // 成本结构比
  engel: number; // 餐饮/总支出
  rigidRatio: number;
  flexRatio: number;
  growthRatio: number;
  // 抗风险
  monthsSpan: number;
  avgMonthlyCost: number;
  emergencyMonths: number; // 净值/月均支出
  // 健康
  health: HealthScore;
  // 其它
  expenseCount: number;
  incomeCount: number;
  netWorthNow: number;
  topExpense: Slice | null;
  maxExpense: { category: string; amount: number; note: string } | null;
  busiestMonth: MonthlyOps | null;
  leanestMonth: MonthlyOps | null;
}

// ---- 工具 ----
const FOOD = new Set(["饮食", "早餐", "午餐", "晚餐"]); // 含旧三餐以兼容历史数据
const RIGID = new Set(["其他", "交通", "医疗", "房贷", "车贷", "房租", "水电燃煤", "物业费", "保险", "育儿"]); // 刚性:固定/必需
const GROWTH = new Set(["成长投资"]);
// 弹性:余量 = 非(食/刚/成长),自动涵盖自定义分类(见 flexCost)

const sum = (xs: number[]) => xs.reduce((s, v) => s + v, 0);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const inScope = (d: Date, scope: Scope) => {
  if (scope === "all") return true;
  if (typeof scope === "number") return d.getFullYear() === scope;
  return d.getFullYear() === scope.y && Math.floor(d.getMonth() / 3) + 1 === scope.q;
};

/** 数据里出现过的年份(降序)。 */
export function availableYears(expenses: Expense[], incomes: Income[]): number[] {
  const ys = new Set<number>();
  for (const e of expenses) ys.add(e.date.getFullYear());
  for (const i of incomes) ys.add(i.date.getFullYear());
  return [...ys].sort((a, b) => b - a);
}

function sliceList(
  totals: Map<string, number>,
  total: number,
  colorOf: (name: string, idx: number) => string,
  sortByOrder = false
): Slice[] {
  const arr = [...totals.entries()].map(([name, value]) => ({ name, value }));
  arr.sort((a, b) => (b.value - a.value) || (sortByOrder ? categoryOrder(a.name) - categoryOrder(b.name) : 0));
  return arr.map((x, idx) => ({
    name: x.name,
    value: x.value,
    pct: total > 0 ? (x.value / total) * 100 : 0,
    color: colorOf(x.name, idx),
  }));
}

export function buildAnnualReport(data: AnnualData, scope: Scope, now: Date = new Date()): AnnualReport {
  const { expenses, incomes, passiveSources, assets } = data;

  const exp = expenses.filter((e) => inScope(e.date, scope));
  const inc = incomes.filter((i) => inScope(i.date, scope));

  // 月度 + 跨度
  const monthsSet = new Set<string>();
  const expByCat = new Map<string, number>();
  const incBySource = new Map<string, number>();
  const monthAgg = new Map<number, { income: number; expense: number }>();
  let minDate: Date | null = null;
  let maxDate: Date | null = null;
  let maxExp: { category: string; amount: number; note: string } | null = null;

  const touch = (d: Date) => {
    monthsSet.add(`${d.getFullYear()}-${d.getMonth()}`);
    if (!minDate || d < minDate) minDate = d;
    if (!maxDate || d > maxDate) maxDate = d;
  };
  const monthIdx = (d: Date) => d.getMonth() + 1;

  for (const e of exp) {
    expByCat.set(e.category, (expByCat.get(e.category) ?? 0) + e.amount);
    const m = monthAgg.get(monthIdx(e.date)) ?? { income: 0, expense: 0 };
    m.expense += e.amount;
    monthAgg.set(monthIdx(e.date), m);
    touch(e.date);
    if (!maxExp || e.amount > maxExp.amount) maxExp = { category: e.category, amount: e.amount, note: e.note ?? "" };
  }
  let passiveRecorded = 0;
  for (const i of inc) {
    incBySource.set(i.source, (incBySource.get(i.source) ?? 0) + i.amount);
    const m = monthAgg.get(monthIdx(i.date)) ?? { income: 0, expense: 0 };
    m.income += i.amount;
    monthAgg.set(monthIdx(i.date), m);
    if (i.isPassive) passiveRecorded += i.amount;
    touch(i.date);
  }

  const cost = sum([...expByCat.values()]);
  const recordedIncome = sum([...incBySource.values()]);

  // 跨度月数:scope=具体年用 distinct 月;all 用 distinct 月;最少 1
  const monthsSpan = Math.max(1, monthsSet.size);

  // 年化被动源:按 scope 月数比例(满年 12 个月 = monthly×12)
  const monthlyPassive = sum(passiveSources.map((p) => p.monthlyAmount));
  const passiveAnnualized = monthlyPassive * monthsSpan;

  const revenue = recordedIncome + passiveAnnualized;
  const net = revenue - cost;
  const margin = revenue > 0 ? net / revenue : 0;
  const costIncomeRatio = revenue > 0 ? cost / revenue : 0;

  // 支出环形
  const expenseSlices = sliceList(expByCat, cost, (n) => categoryColor(n), true);
  // 收入环形:记录来源 + 被动源(年化)各自成片
  const incTotalsForPie = new Map(incBySource);
  for (const p of passiveSources) {
    if (p.monthlyAmount <= 0) continue;
    incTotalsForPie.set(p.name, (incTotalsForPie.get(p.name) ?? 0) + p.monthlyAmount * monthsSpan);
  }
  const passiveNames = new Set(passiveSources.map((p) => p.name));
  const incArr = [...incTotalsForPie.entries()].map(([name, value]) => ({ name, value }));
  incArr.sort((a, b) => b.value - a.value);
  const incomeSlices: Slice[] = incArr.map((x) => ({
    name: x.name,
    value: x.value,
    pct: revenue > 0 ? (x.value / revenue) * 100 : 0,
    color: passiveNames.has(x.name) ? PASSIVE_COLOR : colorForName(x.name),
    passive: passiveNames.has(x.name),
  }));

  // 月度序列(1..12,补零;all 也按月汇总跨年合并到 1..12 —— 仅当 scope 为具体年时严格;all 时取所有年合并的月画像)
  const monthly: MonthlyOps[] = Array.from({ length: 12 }, (_, k) => {
    const m = monthAgg.get(k + 1) ?? { income: 0, expense: 0 };
    return { month: k + 1, income: m.income, expense: m.expense };
  });

  // 资产造血
  const passiveIncomeTotal = passiveAnnualized + passiveRecorded;
  const passiveShare = revenue > 0 ? passiveIncomeTotal / revenue : 0;

  // 日均口径(scope 内)
  const daysInScope =
    minDate && maxDate
      ? Math.max(1, Math.round((startOfDay(maxDate).getTime() - startOfDay(minDate).getTime()) / 86_400_000) + 1)
      : 1;
  const dailyBurn = cost / daysInScope;
  const dailyPassive = monthlyPassive / 30;
  const fiProgress = dailyBurn > 0 ? clamp01(dailyPassive / dailyBurn) : 0;

  const nwNow = netWorth(assets);
  const netBurn = Math.max(0, dailyBurn - dailyPassive);
  const freedomDays = netBurn > 0 ? Math.max(0, nwNow) / netBurn : Infinity;

  // 成本结构比
  const foodCost = sum([...expByCat.entries()].filter(([c]) => FOOD.has(c)).map(([, v]) => v));
  const rigidCost = sum([...expByCat.entries()].filter(([c]) => RIGID.has(c)).map(([, v]) => v));
  const growthCost = sum([...expByCat.entries()].filter(([c]) => GROWTH.has(c)).map(([, v]) => v));
  const flexCost = Math.max(0, cost - foodCost - rigidCost - growthCost); // 弹性=余量,含自定义分类
  const engel = cost > 0 ? foodCost / cost : 0;
  const rigidRatio = cost > 0 ? rigidCost / cost : 0;
  const flexRatio = cost > 0 ? flexCost / cost : 0;
  const growthRatio = cost > 0 ? growthCost / cost : 0;

  // 抗风险
  const avgMonthlyCost = cost / monthsSpan;
  const emergencyMonths = avgMonthlyCost > 0 ? nwNow / avgMonthlyCost : Infinity;

  // 健康分
  const health = scoreHealth(margin, fiProgress, emergencyMonths, freedomDays);

  // 结算判断:过去的年/季 = 已结算;当年/当季/all = 未结算
  const curQ = (Math.floor(now.getMonth() / 3) + 1) as Quarter;
  const isQ = isQuarterScope(scope);
  const settled = isQ
    ? scope.y < now.getFullYear() || (scope.y === now.getFullYear() && scope.q < curQ)
    : typeof scope === "number" && scope < now.getFullYear();
  const yearLabel = scope === "all" ? "全部" : isQ ? `${scope.y} Q${scope.q}` : String(scope);

  const monthsWithExpense = monthly.filter((m) => m.expense > 0);
  const busiestMonth = monthsWithExpense.length
    ? monthsWithExpense.reduce((a, b) => (b.expense > a.expense ? b : a))
    : null;
  const leanestMonth = monthsWithExpense.length
    ? monthsWithExpense.reduce((a, b) => (b.expense < a.expense ? b : a))
    : null;

  return {
    scope,
    yearLabel,
    isQuarter: isQ,
    settled,
    revenue,
    recordedIncome,
    passiveAnnualized,
    cost,
    net,
    margin,
    costIncomeRatio,
    expenseSlices,
    incomeSlices,
    monthly,
    passiveIncomeTotal,
    passiveShare,
    fiProgress,
    freedomDays,
    engel,
    rigidRatio,
    flexRatio,
    growthRatio,
    monthsSpan,
    avgMonthlyCost,
    emergencyMonths,
    health,
    expenseCount: exp.length,
    incomeCount: inc.length,
    netWorthNow: nwNow,
    topExpense: expenseSlices[0] ?? null,
    maxExpense: maxExp,
    busiestMonth,
    leanestMonth,
  };
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// ---- 经营健康分(透明加权,各分项可见)----
function scoreHealth(margin: number, fiProgress: number, emergencyMonths: number, freedomDays: number): HealthScore {
  // 储蓄率:0%→0,≥50%→40
  const sSave = clamp01(margin / 0.5) * 40;
  // 资产造血(财务自由进度):0→0,100%→25
  const sPassive = clamp01(fiProgress) * 25;
  // 应急储备:0 月→0,≥12 月→20
  const sEmer = clamp01((Number.isFinite(emergencyMonths) ? emergencyMonths : 999) / 12) * 20;
  // 自由跑道:0→0,≥3650 天(10 年)→15
  const sRun = clamp01((Number.isFinite(freedomDays) ? freedomDays : 1e9) / 3650) * 15;

  const score = Math.round(sSave + sPassive + sEmer + sRun);
  const rating =
    score >= 85 ? "AAA" : score >= 70 ? "AA" : score >= 55 ? "A" : score >= 40 ? "BBB" : score >= 25 ? "BB" : "B";

  const parts: HealthPart[] = [
    { label: "储蓄率", score: Math.round(sSave), max: 40, note: pct(margin) },
    { label: "资产造血", score: Math.round(sPassive), max: 25, note: pct(fiProgress) },
    { label: "应急储备", score: Math.round(sEmer), max: 20, note: months(emergencyMonths) },
    { label: "自由跑道", score: Math.round(sRun), max: 15, note: days(freedomDays) },
  ];

  const verdict =
    score >= 85
      ? "AAA · 现金奶牛,建议给自己发个奖"
      : score >= 70
        ? "AA · 经营稳健,被动造血已上路"
        : score >= 55
          ? "A · 攻守均衡,继续加仓自由"
          : score >= 40
            ? "BBB · 收支健康,被动收入待开荒"
            : score >= 25
              ? "BB · 流水尚可,跑道偏短需提防"
              : "B · 现金为王,先把储蓄率拉起来";

  return { score, rating, parts, verdict };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const months = (x: number) => (Number.isFinite(x) ? `${Math.round(x)} 个月` : "∞");
const days = (x: number) => (Number.isFinite(x) ? `${Math.floor(x)} 天` : "∞");

// ============================================================================
// 诙谐自嘲风叙事
// ============================================================================
export interface Narrative {
  coverTitle: string;
  coverSub: string;
  letter: string[]; // 致股东信(段落)
  comments: string[]; // 经营点评(条目)
}

const yuan = (n: number) => "¥" + Math.round(n).toLocaleString("en-US");

type Tone = "excellent" | "good" | "ok" | "poor";
function toneOf(r: AnnualReport): Tone {
  if (r.net < 0 || r.health.score < 30) return "poor";
  if (r.health.score >= 80 || r.margin >= 0.6) return "excellent";
  if (r.health.score >= 55) return "good";
  return "ok";
}

// 确定性随机:同一年(分数/利润率/最大项/笔数)稳定,不同年不同 → 既多样又不闪烁
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pickR = <T>(rng: () => number, arr: T[]): T => arr[Math.floor(rng() * arr.length)];
function shuffleR<T>(rng: () => number, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fmt(t: string, r: AnnualReport): string {
  const map: Record<string, string> = {
    y: r.yearLabel,
    rev: yuan(r.revenue),
    cost: yuan(r.cost),
    net: yuan(r.net),
    netAbs: yuan(Math.abs(r.net)),
    margin: pct(r.margin),
    pShare: pct(r.passiveShare),
    engel: pct(r.engel),
    flex: pct(r.flexRatio),
    growth: pct(r.growthRatio),
    rigid: pct(r.rigidRatio),
    emer: months(r.emergencyMonths),
    fi: pct(r.fiProgress),
    free: days(r.freedomDays),
    rating: r.health.rating,
    score: String(r.health.score),
  };
  return t.replace(/\{(\w+)\}/g, (_, k) => map[k] ?? `{${k}}`);
}

// ── 文案池(按语气档分,每档多变体)──
const SALUTE: Record<Tone, string[]> = {
  excellent: ["尊敬的董事长(您本人)钧鉴:", "致亲爱的唯一股东:", "各位股东(也就是您本人)请上座:"],
  good: ["各位股东(也就是您本人):", "董事长(您)您好:", "致掌舵人(您本人):"],
  ok: ["各位股东(也就是您本人):", "董事会(您)请坐稳:", "致这位努力的打工人股东:"],
  poor: ["各位股东(也就是您本人)请先坐下:", "董事长(您),有件事得当面汇报:", "致心脏比较强大的唯一股东:"],
};
const PNL_SURPLUS = [
  "{y} 财年共录得营收 {rev}、经营成本 {cost},净盈余 {net},账面体面收官。",
  "本财年营收 {rev}、成本 {cost},净赚 {net} 入袋,经营基本盘稳住了。",
  "{y} 年营收 {rev}、成本 {cost},年终净盈余 {net}——这一年没白忙。",
  "营收 {rev} 对阵成本 {cost},净胜 {net},贵公司(您)守住了利润线。",
];
const PNL_DEFICIT = [
  "{y} 财年营收 {rev},成本却高达 {cost},净亏损 {netAbs},董事会(您)请深呼吸。",
  "本财年入 {rev}、出 {cost},倒贴 {netAbs},属于「越努力越穷」的玄学经营。",
  "营收 {rev} 没撑住成本 {cost},净亏 {netAbs},贵公司本年主营业务疑似「烧钱」。",
  "{y} 年营收 {rev}、成本 {cost},账面赤字 {netAbs},好在贵公司不上市,不必担心退市。",
];
const MARGIN_LINES: Record<Tone, string[]> = {
  excellent: [
    "利润率高达 {margin},堪称个人版优质蓝筹——唯一遗憾是从不对外分红,股东只能精神富有。",
    "{margin} 的利润率,放公司里是要被写进招股书的,可惜您只对自己负责。",
    "利润率 {margin},这经营效率,巴菲特看了都想发来贺电。",
  ],
  good: [
    "利润率 {margin},经营稳健,离「躺着也赚」只差一笔像样的被动收入。",
    "{margin} 的利润率属于优等生水平,继续保持,别飘。",
    "利润率 {margin},攻守均衡,贵公司(您)有在好好过日子。",
  ],
  ok: [
    "利润率 {margin},算是把日子过平了,成本部门(也是您)还有优化空间。",
    "{margin} 的利润率刚够体面,离财务自由还隔着好几个早高峰。",
    "利润率 {margin},不亏就是赢,但「赢一点点」也是赢。",
  ],
  poor: [
    "利润率仅 {margin},本财年基本在为生活打工,本人已责令自己深刻反省。",
    "利润率 {margin},贵公司(您)属于「用爱发电」型经营,情怀有余、现金不足。",
    "利润率 {margin},再这么花下去,明年年报封面建议改成检讨书。",
  ],
};
const TOP_FLAVOR: Record<string, string[]> = {
  其他: ["房租水电这种刚需,躲是躲不掉的。", "固定开销稳如泰山,这是成年人的隐形枷锁。"],
  娱乐: ["为快乐买单,这钱花得明明白白。", "快乐是真的,钱包瘪也是真的。", "贵公司本年最大业务线:让自己开心。"],
  购物: ["购物车一时爽,钱包火葬场。", "剁手一时爽,账单火葬场——但谁还没个想要的呢。"],
  午餐: ["干饭人干饭魂,这是对自己最基本的尊重。", "民以食为天,这笔吃得理直气壮。"],
  晚餐: ["夜宵和晚餐,是打工人最后的倔强。", "干饭人干饭魂,这笔吃得理直气壮。"],
  早餐: ["一日之计在于早餐,这笔花得养生。", "干饭人的一天从早餐开始。"],
  交通: ["在路上的成本,也是看世界的成本。", "通勤费是打工的入场券,买票天经地义。"],
  医疗: ["健康是 1,其余都是 0,这笔不能省。", "为健康花钱是最划算的投资,别犹豫。"],
  成长投资: ["为自己升值,这是回报率最高的投资。", "肯在自己身上花钱的人,运气都不会太差。"],
  _default: ["这笔开销占了大头,值不值得只有您知道。"],
};
const PASSIVE_LINES: Record<"low" | "mid" | "high", string[]> = {
  low: [
    "被动收入占比 {pShare},资产基本在睡大觉,叫醒它们是明年第一要务。",
    "被动收入仅占 {pShare},您的钱还没学会自己赚钱,得好好培养。",
    "被动占比 {pShare},目前还是「人赚钱」模式,「钱赚钱」尚未开机。",
  ],
  mid: [
    "被动收入占比 {pShare},资产开始打零工了,可喜可贺,继续加仓。",
    "被动占比 {pShare},您的钱已经在兼职搬砖,前途可期。",
    "被动收入爬到 {pShare},睡后收入初具雏形,离躺平更近一步。",
  ],
  high: [
    "被动收入占比 {pShare},资产已正式上岗替您搬砖,财务自由的曙光隐约可见。",
    "被动占比高达 {pShare},您的钱比您还勤奋,这是好事。",
    "被动收入 {pShare},距离「不上班也饿不死」只剩临门一脚。",
  ],
};
const ENGEL_HIGH = [
  "恩格尔系数 {engel}:这一年主要在为「吃」打工,民以食为天没毛病。",
  "恩格尔系数 {engel} 偏高,嘴是真没亏待,钱也是真没剩下。",
];
const ENGEL_MID = ["恩格尔系数 {engel}:吃喝占比中规中矩,生活质量在线。"];
const ENGEL_LOW = [
  "恩格尔系数 {engel}:吃喝没拖后腿,要么自律要么……忙到忘了吃。",
  "恩格尔系数 {engel} 偏低,看来钱都花在了比吃更上头的地方。",
];
const FLEX_HIGH = [
  "弹性消费(娱乐+购物)占 {flex}:快乐买得很尽兴,这部分也最有压缩空间。",
  "弹性开销高达 {flex}:这一年活得很「松弛」,松弛是要花钱的。",
];
const FLEX_MID = ["弹性消费占 {flex}:娱乐购物适度,既没苦着自己也没放飞。"];
const GROWTH_HIGH = [
  "成长投资占 {growth}:把钱押在自己身上,这是本年最聪明的决定。",
  "成长投资高达 {growth}:愿意为升值花钱,未来会感谢现在的您。",
];
const GROWTH_SOME = ["成长投资占 {growth}:有在为自己充电,值得加码。"];
const GROWTH_NONE = [
  "成长投资为 0:这一年没给自己「升级」预算,明年记得留一笔。",
  "成长投资挂零:对自己的研发投入是 0,长期看这块不能省。",
];
const MAXEXP_TAILS = ["这一笔够吃好几个月的早餐了。", "钱包记得这一刀。", "壕气是一时的,记账是一辈子的。", "希望它带来了等价的快乐。"];
const BUSY_TAILS = ["那个月一定很快乐。", "那个月的卡刷得有声有色。", "回头看,值不值只有您知道。", "钱包在那个月瑟瑟发抖。"];
const LEAN_TAILS = ["堪称年度自律之光。", "那个月把持得住,给您颁个奖。", "省钱的快乐也是快乐。", "建议把这份克制复制到全年。"];
const EMER_LINES = [
  "应急储备约 {emer}:就算明天失业,也能体面 emo 一阵子。",
  "应急储备约 {emer}:抗风险能力在线,黑天鹅来了也不慌。",
  "手上余粮够撑 {emer},裸辞的底气大概就是它给的。",
];
const SAVE_LINES: Record<Tone, string[]> = {
  excellent: ["储蓄率亮眼,贵公司(您)的存钱能力堪称内卷之王。", "这储蓄率,放朋友圈是要被拉黑的那种优秀。"],
  good: ["储蓄率健康,会赚也会留,成年人该有的样子。", "存钱节奏稳,继续把雪球滚大。"],
  ok: ["储蓄率一般,能存下就是胜利,哪怕只存下一点点。", "存钱这事,慢慢来比较快。"],
  poor: ["储蓄率告急,钱来得快去得更快,该给消费踩踩刹车了。", "几乎没存下钱,建议把「先消费后后悔」改成「先存后花」。"],
};
const CLOSERS: Record<Tone, string[]> = {
  excellent: ["综上:这是个值得载入个人史册的丰收年,干杯。", "结语:经营优秀,唯一风险是太顺了容易飘,稳住。"],
  good: ["综上:稳中向好,明年小目标——把被动收入再喂大一圈。", "结语:这一年没毛病,继续长期主义。"],
  ok: ["综上:平稳过渡的一年,明年争取从「不亏」升级到「真赚」。", "结语:及格线之上,提升空间还很大,加油。"],
  poor: ["综上:艰难的一年,但活下来就是胜利,明年触底反弹。", "结语:这一年踩了不少坑,好在坑都记下了——记账就是为了不再掉进去。"],
};

function buildYoY(rng: () => number, r: AnnualReport, prev?: AnnualReport | null): string | null {
  if (!prev || (prev.expenseCount === 0 && prev.incomeCount === 0)) return null;
  const parts: string[] = [];
  if (r.health.rating !== prev.health.rating) {
    const up = r.health.score > prev.health.score;
    parts.push(
      up
        ? pickR(rng, [
            `经营评级从去年的 ${prev.health.rating} 升到 ${r.health.rating},士别一年当刮目相看。`,
            `评级一年内从 ${prev.health.rating} 爬到 ${r.health.rating},这进步肉眼可见。`,
          ])
        : pickR(rng, [
            `经营评级从去年的 ${prev.health.rating} 滑到 ${r.health.rating},董事会(您)该复盘了。`,
            `评级从 ${prev.health.rating} 退到 ${r.health.rating},去年的自己似乎更靠谱。`,
          ])
    );
  }
  const revPct = prev.revenue > 0 ? Math.round((r.revenue / prev.revenue - 1) * 100) : 0;
  if (Math.abs(revPct) >= 5) {
    parts.push(revPct > 0 ? `营收较去年 +${revPct}%,主营业务(您)有在认真营业。` : `营收较去年 ${revPct}%,主营业务(您)疑似摸鱼。`);
  }
  const dM = Math.round((r.margin - prev.margin) * 100);
  if (Math.abs(dM) >= 5) {
    parts.push(dM > 0 ? `利润率比去年高了 ${dM} 个百分点,越来越会过日子。` : `利润率比去年低了 ${-dM} 个百分点,钱包在悄悄变薄。`);
  }
  return parts.length ? parts.join("") : null;
}

export function buildNarrative(r: AnnualReport, prev?: AnnualReport | null): Narrative {
  const tone = toneOf(r);
  const seed = fnv1a(`${r.yearLabel}|${r.health.score}|${Math.round(r.margin * 100)}|${r.topExpense?.name ?? ""}|${r.expenseCount}`);
  const rng = makeRng(seed);

  const coverTitle = `自由日记 个人经营${r.isQuarter ? "季报" : "年报"} · ${r.yearLabel}`;
  const coverSub = r.settled
    ? `本财年已结算 · 经营评级 ${r.health.rating}（${r.health.score} 分）`
    : `本年至今 · 未结算 · 当前评级 ${r.health.rating}（${r.health.score} 分）`;

  const letter: string[] = [];
  // 1) 称呼 + 开场损益
  letter.push(`${pickR(rng, SALUTE[tone])}${fmt(pickR(rng, r.net >= 0 ? PNL_SURPLUS : PNL_DEFICIT), r)}`);
  // 2) 利润率(按 tone 池)
  letter.push(fmt(pickR(rng, MARGIN_LINES[tone]), r));
  // 3) 最大成本中心 + 分类风味
  if (r.topExpense) {
    const flavor = pickR(rng, TOP_FLAVOR[r.topExpense.name] ?? TOP_FLAVOR._default);
    letter.push(`最大成本中心是「${r.topExpense.name}」,吃掉 ${yuan(r.topExpense.value)}（占 ${Math.round(r.topExpense.pct)}%）。${flavor}`);
  }
  // 4) 被动收入(分档池)
  const pBucket = r.passiveShare < 0.05 ? "low" : r.passiveShare < 0.2 ? "mid" : "high";
  letter.push(fmt(pickR(rng, PASSIVE_LINES[pBucket]), r));
  // 5) 同比上一年
  const yoy = buildYoY(rng, r, prev);
  if (yoy) letter.push(yoy);

  // ── 经营点评:候选池 → 洗牌 → 取 N + tone 收尾 ──
  const cands: string[] = [];
  if (r.engel >= 0.4) cands.push(fmt(pickR(rng, ENGEL_HIGH), r));
  else if (r.engel >= 0.2) cands.push(fmt(pickR(rng, ENGEL_MID), r));
  else if (r.engel > 0) cands.push(fmt(pickR(rng, ENGEL_LOW), r));
  if (r.flexRatio >= 0.4) cands.push(fmt(pickR(rng, FLEX_HIGH), r));
  else if (r.flexRatio >= 0.2) cands.push(fmt(pickR(rng, FLEX_MID), r));
  if (r.growthRatio >= 0.1) cands.push(fmt(pickR(rng, GROWTH_HIGH), r));
  else if (r.growthRatio > 0) cands.push(fmt(pickR(rng, GROWTH_SOME), r));
  else cands.push(pickR(rng, GROWTH_NONE));
  if (r.maxExpense) cands.push(`本年最壕一笔:${r.maxExpense.note || r.maxExpense.category} ${yuan(r.maxExpense.amount)}。${pickR(rng, MAXEXP_TAILS)}`);
  if (r.busiestMonth) cands.push(`${r.busiestMonth.month} 月花得最猛(${yuan(r.busiestMonth.expense)}),${pickR(rng, BUSY_TAILS)}`);
  if (r.leanestMonth && r.leanestMonth.month !== r.busiestMonth?.month)
    cands.push(`${r.leanestMonth.month} 月最省(${yuan(r.leanestMonth.expense)}),${pickR(rng, LEAN_TAILS)}`);
  cands.push(Number.isFinite(r.emergencyMonths) ? fmt(pickR(rng, EMER_LINES), r) : "应急储备充裕到溢出,失业了也只是换个地方喝咖啡。");
  cands.push(fmt(pickR(rng, SAVE_LINES[tone]), r));
  if (r.expenseCount >= 300) cands.push(`全年记下 ${r.expenseCount} 笔账,这份较真劲儿,理财已经赢在起跑线。`);

  const take = tone === "poor" ? 6 : 5;
  const comments = [...shuffleR(rng, cands).slice(0, take), pickR(rng, CLOSERS[tone])];

  return { coverTitle, coverSub, letter, comments };
}
