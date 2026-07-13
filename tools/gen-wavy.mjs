// 生成"波动大"的测试备份 JSON —— 让仪表盘 sparkline(过去12周自由天数)明显起伏。
// 手法:近 12 周里每隔约一周交替放"大额收入 / 大额支出",
//       大额收入拉低更早周的历史净值、大额支出抬高更早周的历史净值 → 折线锯齿状。
// 输出 app 备份格式(snake_case),用「导入 → 替换」载入。
import { writeFileSync } from "node:fs";

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const iso = (d) => d.toISOString();

// 以模拟器"今天"为基准
const today = new Date(2026, 6, 9); // 2026-07-09(月份 0-based)
const dayOff = (n) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n, 12, 0, 0);

// 简单可复现 RNG
let seed = 20260709;
const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

const FIRST_OFF = -99; // 记录起点(约 99 天前 → 满 12 周)
const expenses = [];
const incomes = [];

const CATS = ["饮食", "交通", "购物", "娱乐", "医疗", "成长投资", "人情", "其他"];

// 日常小额支出(带噪声),铺满整段
for (let off = FIRST_OFF; off <= 0; off++) {
  const d = dayOff(off);
  const amt = Math.round(20 + rng() * 70); // 20~90
  expenses.push({ amount: amt, category: CATS[Math.floor(rng() * CATS.length)], date: ymd(d), created_at: iso(d) });
}

// 近 12 周:每约 7 天交替一笔大额(收入 / 支出),制造历史净值锯齿
const bigs = [
  { off: -82, type: "e", amt: 3200 },
  { off: -74, type: "i", amt: 4500 },
  { off: -66, type: "e", amt: 2800 },
  { off: -58, type: "i", amt: 3800 },
  { off: -49, type: "e", amt: 3600 },
  { off: -41, type: "i", amt: 5200 },
  { off: -33, type: "e", amt: 2600 },
  { off: -25, type: "i", amt: 4200 },
  { off: -17, type: "e", amt: 3400 },
  { off: -9, type: "i", amt: 3000 },
  { off: -4, type: "e", amt: 2200 },
];
for (const b of bigs) {
  const d = dayOff(b.off);
  if (b.type === "e") {
    expenses.push({ amount: b.amt, category: "购物", date: ymd(d), created_at: iso(d) });
  } else {
    incomes.push({ amount: b.amt, source: "副业", date: ymd(d), is_passive: false, created_at: iso(d) });
  }
}

const backup = {
  assets: { total: 9000, updated_at: iso(today) }, // 当前净值 9000
  expenses,
  incomes,
  passive_sources: [], // 无被动,曲线更纯粹
  first_record_date: ymd(dayOff(FIRST_OFF)),
};

writeFileSync(new URL("./freegrid-wavy.json", import.meta.url), JSON.stringify(backup, null, 2));
console.log(`wrote freegrid-wavy.json: ${expenses.length} expenses, ${incomes.length} incomes, first=${backup.first_record_date}`);
