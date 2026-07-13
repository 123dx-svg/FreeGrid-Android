// ============================================================================
// 演示数据(确定性种子生成)—— 复刻真机截图量级:净值 5531(资产3300+现金2231)、
// ~1805 笔支出 / ~630 天追踪、日均 ~71.9 → 自由天数 76。让真引擎驱动整个 Dashboard。
// 真实 app 不带这份数据,这只是 web 草稿期的展示种子。
// ============================================================================

import type { Expense, Income, PassiveSource, UserAssets } from "./models";

/** mulberry32 确定性 PRNG —— 同 seed 同序列,截图稳定 */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DemoData {
  expenses: Expense[];
  incomes: Income[];
  passiveSources: PassiveSource[];
  assets: UserAssets;
}

// 分类 + 典型金额区间(权重越大越常见)
const CATS: { name: string; weight: number; min: number; max: number }[] = [
  { name: "早餐", weight: 18, min: 3, max: 12 },
  { name: "午餐", weight: 22, min: 8, max: 25 },
  { name: "晚餐", weight: 22, min: 8, max: 30 },
  { name: "交通", weight: 12, min: 2, max: 20 },
  { name: "购物", weight: 9, min: 20, max: 200 },
  { name: "娱乐", weight: 6, min: 15, max: 120 },
  { name: "成长投资", weight: 4, min: 30, max: 300 },
  { name: "医疗", weight: 3, min: 20, max: 400 },
  { name: "其他", weight: 8, min: 5, max: 60 },
];
const CAT_TOTAL_WEIGHT = CATS.reduce((s, c) => s + c.weight, 0);

function pickCat(r: number) {
  let x = r * CAT_TOTAL_WEIGHT;
  for (const c of CATS) {
    if (x < c.weight) return c;
    x -= c.weight;
  }
  return CATS[CATS.length - 1];
}

let uid = 0;
const nextId = () => `demo-${uid++}`;

export function makeDemoData(now: Date = new Date()): DemoData {
  const rand = rng(20260530);
  const TRACK_DAYS = 630;
  const COUNT = 1805;
  const TARGET_DAILY = 71.9;
  const targetTotal = TARGET_DAILY * TRACK_DAYS;

  const firstRecordDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (TRACK_DAYS - 1));

  // 1) 生成原始支出(金额 + 分类 + 日期,日期偏向均匀铺满 630 天)
  const raw: { amount: number; category: string; date: Date }[] = [];
  for (let i = 0; i < COUNT; i++) {
    const c = pickCat(rand());
    const amount = c.min + rand() * (c.max - c.min);
    const dayOffset = Math.floor(rand() * TRACK_DAYS); // 0..629 天前
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset);
    raw.push({ amount, category: c.name, date: d });
  }

  // 2) 缩放到目标总额 → 日均锁定 ~71.9(净值/日均 = 76.9 → 显示 76)
  const sum = raw.reduce((s, e) => s + e.amount, 0);
  const scale = targetTotal / sum;
  const expenses: Expense[] = raw.map((e) => ({
    id: nextId(),
    amount: Math.max(1, Math.round(e.amount * scale)),
    category: e.category,
    note: "",
    date: e.date,
    createdAt: e.date,
  }));

  // 3) 几笔收入(生活费等)—— 影响 sparkline 的净值反推
  const incomeDefs = [
    { amount: 1600, source: "生活费", daysAgo: 0 },
    { amount: 1600, source: "生活费", daysAgo: 31 },
    { amount: 1600, source: "生活费", daysAgo: 61 },
    { amount: 800, source: "副业", daysAgo: 14 },
  ];
  const incomes: Income[] = incomeDefs.map((x) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - x.daysAgo);
    return { id: nextId(), amount: x.amount, source: x.source, isPassive: false, note: "", date: d, createdAt: d };
  });

  const assets: UserAssets = {
    lockedAssets: 3300,
    cash: 2231,
    liabilities: 0,
    assetItems: [{ id: "demo-a1", type: "定期", name: "", amount: 3300, rate: 2.5 }],
    liabilityItems: [],
    updatedAt: new Date(now.getTime() - 3 * 3600 * 1000), // 3 小时前
    firstRecordDate,
  };

  return { expenses, incomes, passiveSources: [], assets };
}
