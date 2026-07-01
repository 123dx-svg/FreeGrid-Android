// 一次性:复刻 src/lib/demo.ts 的 makeDemoData,输出 app 备份格式 JSON,供 adb push + 导入。
import { writeFileSync } from "node:fs";

function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const CATS = [
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
const CAT_TOTAL = CATS.reduce((s, c) => s + c.weight, 0);
function pickCat(r) {
  let x = r * CAT_TOTAL;
  for (const c of CATS) {
    if (x < c.weight) return c;
    x -= c.weight;
  }
  return CATS[CATS.length - 1];
}
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const now = new Date();
const rand = rng(20260530);
const TRACK_DAYS = 630;
const COUNT = 1805;
const TARGET_DAILY = 71.9;
const targetTotal = TARGET_DAILY * TRACK_DAYS;
const firstRecordDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (TRACK_DAYS - 1));

const raw = [];
for (let i = 0; i < COUNT; i++) {
  const c = pickCat(rand());
  const amount = c.min + rand() * (c.max - c.min);
  const dayOffset = Math.floor(rand() * TRACK_DAYS);
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset);
  raw.push({ amount, category: c.name, date: d });
}
const sum = raw.reduce((s, e) => s + e.amount, 0);
const scale = targetTotal / sum;
const expenses = raw.map((e) => ({
  amount: Math.max(1, Math.round(e.amount * scale)),
  category: e.category,
  date: ymd(e.date),
  created_at: e.date.toISOString(),
}));

const incomeDefs = [
  { amount: 1600, source: "生活费", daysAgo: 0 },
  { amount: 1600, source: "生活费", daysAgo: 31 },
  { amount: 1600, source: "生活费", daysAgo: 61 },
  { amount: 800, source: "副业", daysAgo: 14 },
];
const incomes = incomeDefs.map((x) => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - x.daysAgo);
  return { amount: x.amount, source: x.source, date: ymd(d), is_passive: false, created_at: d.toISOString() };
});

const backup = {
  assets: { total: 3300 + 2231, updated_at: new Date(now.getTime() - 3 * 3600 * 1000).toISOString() },
  expenses,
  incomes,
  passive_sources: [{ name: "股票分红", monthly_amount: 1000 }],
  first_record_date: ymd(firstRecordDate),
};

writeFileSync("tools/freegrid-demo.json", JSON.stringify(backup, null, 2), "utf8");
console.log(`wrote tools/freegrid-demo.json  expenses=${expenses.length} incomes=${incomes.length}`);
