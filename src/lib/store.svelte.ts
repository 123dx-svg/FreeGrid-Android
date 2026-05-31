// ============================================================================
// 中央响应式数据 store(Svelte 5 runes,跨组件共享)。
// · 持久化:localStorage,序列化格式 = iOS BackupJSON(snake_case)→ 同一套编解码同时服务
//   "本地保存 / 导入 iOS 导出 / 导出备份",一份 codec 三用。
// · 首次启动无数据时种入 demo(避免空态突兀),用户可清空或导入自己的数据替换。
// · 隐私:只读写本机 localStorage,数据不离开浏览器。
// ============================================================================

import { makeDemoData } from "./demo";
import { suggestCategory } from "./models";
import type { Expense, Income, PassiveSource, UserAssets, BackupJSON } from "./models";

const KEY = "freegrid-data-v1";

// ---- 响应式 store(导出 const 对象,组件读其属性即响应) ----
export const store = $state({
  expenses: [] as Expense[],
  incomes: [] as Income[],
  passiveSources: [] as PassiveSource[],
  assets: {
    lockedAssets: 0,
    cash: 0,
    updatedAt: new Date(),
    firstRecordDate: null as Date | null,
  } as UserAssets,
  seeded: false, // 当前是否仍是 demo 种子数据(未导入/未改动)
});

let _uid = 0;
const nid = () => `w-${Date.now().toString(36)}-${_uid++}`;

// ---- 日期工具 ----
const pad = (n: number) => String(n).padStart(2, "0");
const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function parseYMD(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) {
    const d = new Date(s);
    return isNaN(+d) ? null : d;
  }
  return new Date(+m[1], +m[2] - 1, +m[3]); // 本地零点,避免 UTC 偏移
}
const parseISO = (s: string | null | undefined): Date => {
  if (!s) return new Date();
  const d = new Date(s);
  return isNaN(+d) ? new Date() : d;
};

// ============================================================================
// Codec: store ⟷ BackupJSON(与 iOS DataIO 对称)
// ============================================================================

export function toBackup(): BackupJSON {
  return {
    assets: {
      total: store.assets.lockedAssets + store.assets.cash,
      updated_at: store.assets.updatedAt.toISOString(),
    },
    expenses: store.expenses.map((e) => ({
      amount: e.amount,
      category: e.category,
      date: toYMD(e.date),
      note: e.note || undefined,
      created_at: e.createdAt.toISOString(),
    })),
    incomes: store.incomes.map((i) => ({
      amount: i.amount,
      source: i.source,
      date: toYMD(i.date),
      note: i.note || undefined,
      is_passive: i.isPassive,
      created_at: i.createdAt.toISOString(),
    })),
    passive_sources: store.passiveSources.map((p) => ({
      name: p.name,
      monthly_amount: p.monthlyAmount,
    })),
    first_record_date: store.assets.firstRecordDate ? toYMD(store.assets.firstRecordDate) : null,
  };
}

interface Parsed {
  expenses: Expense[];
  incomes: Income[];
  passiveSources: PassiveSource[];
  assets: UserAssets;
}

/** 解析 BackupJSON → 领域模型。支出分类在导入边界归一(suggestCategory),对齐 iOS。
 *  净值:iOS 导出只存 total(丢了锁定/现金分桶)→ 全部落 cash(用户可再调拨)。 */
export function fromBackup(json: BackupJSON): Parsed {
  const expenses: Expense[] = (json.expenses ?? []).map((e) => ({
    id: nid(),
    amount: e.amount,
    category: suggestCategory(e.category).canonical,
    note: e.note ?? "",
    date: parseYMD(e.date) ?? new Date(),
    createdAt: parseISO(e.created_at),
  }));
  const incomes: Income[] = (json.incomes ?? []).map((i) => ({
    id: nid(),
    amount: i.amount,
    source: i.source,
    isPassive: !!i.is_passive,
    note: i.note ?? "",
    date: parseYMD(i.date) ?? new Date(),
    createdAt: parseISO(i.created_at),
  }));
  const passiveSources: PassiveSource[] = (json.passive_sources ?? []).map((p) => ({
    id: nid(),
    name: p.name,
    monthlyAmount: p.monthly_amount,
    createdAt: new Date(),
  }));

  // firstRecordDate:优先 JSON,否则取最早交易日
  let frd = parseYMD(json.first_record_date);
  if (!frd) {
    const all = [...expenses, ...incomes].map((x) => x.date.getTime());
    if (all.length) frd = new Date(Math.min(...all));
  }
  const total = json.assets?.total ?? 0;
  const assets: UserAssets = {
    lockedAssets: 0,
    cash: total,
    updatedAt: parseISO(json.assets?.updated_at),
    firstRecordDate: frd,
  };
  return { expenses, incomes, passiveSources, assets };
}

// ============================================================================
// 持久化 + 初始化
// ============================================================================

let _ready = false;
function persist() {
  if (!_ready) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ seeded: store.seeded, data: toBackup() }));
  } catch {
    /* 配额满等忽略 */
  }
}

function apply(p: Parsed, seeded: boolean) {
  store.expenses = p.expenses;
  store.incomes = p.incomes;
  store.passiveSources = p.passiveSources;
  store.assets = p.assets;
  store.seeded = seeded;
}

/** App 启动调用一次:有存档则水合,否则种入 demo */
export function initStore() {
  let loaded = false;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      apply(fromBackup(parsed.data as BackupJSON), !!parsed.seeded);
      loaded = true;
    }
  } catch {
    /* 损坏存档忽略,落到种子 */
  }
  if (!loaded) {
    const demo = makeDemoData();
    apply(
      {
        expenses: demo.expenses,
        incomes: demo.incomes,
        passiveSources: demo.passiveSources,
        assets: demo.assets,
      },
      true
    );
  }
  _ready = true;
  persist();
}

// ============================================================================
// 变更操作(均自动持久化)
// ============================================================================

function touch() {
  store.assets.updatedAt = new Date();
  store.seeded = false;
  persist();
}

export function addExpense(amount: number, category: string, note = "", date = new Date()) {
  store.expenses.push({ id: nid(), amount, category, note, date, createdAt: new Date() });
  store.assets.cash -= amount;
  if (!store.assets.firstRecordDate) store.assets.firstRecordDate = date;
  touch();
}

export function addIncome(amount: number, source: string, isPassive = false, note = "", date = new Date()) {
  store.incomes.push({ id: nid(), amount, source, isPassive, note, date, createdAt: new Date() });
  store.assets.cash += amount;
  if (!store.assets.firstRecordDate) store.assets.firstRecordDate = date;
  touch();
}

export function deleteTransaction(id: string, kind: "expense" | "income") {
  if (kind === "expense") {
    const e = store.expenses.find((x) => x.id === id);
    if (e) {
      store.assets.cash += e.amount; // 还原现金
      store.expenses = store.expenses.filter((x) => x.id !== id);
    }
  } else {
    const i = store.incomes.find((x) => x.id === id);
    if (i) {
      store.assets.cash -= i.amount;
      store.incomes = store.incomes.filter((x) => x.id !== id);
    }
  }
  touch();
}

/** 调拨:cashToAsset = 现金→资产;否则资产→现金 */
export function transfer(amount: number, cashToAsset: boolean) {
  if (amount <= 0) return;
  if (cashToAsset) {
    const m = Math.min(amount, store.assets.cash);
    store.assets.cash -= m;
    store.assets.lockedAssets += m;
  } else {
    const m = Math.min(amount, store.assets.lockedAssets);
    store.assets.lockedAssets -= m;
    store.assets.cash += m;
  }
  touch();
}

export function updateBucket(which: "locked" | "cash", value: number) {
  if (which === "locked") store.assets.lockedAssets = Math.max(0, value);
  else store.assets.cash = Math.max(0, value);
  touch();
}

export function addPassiveSource(name: string, monthlyAmount: number) {
  store.passiveSources.push({ id: nid(), name, monthlyAmount, createdAt: new Date() });
  touch();
}

export function deletePassiveSource(id: string) {
  store.passiveSources = store.passiveSources.filter((x) => x.id !== id);
  touch();
}

/** 导入:用 BackupJSON 整体替换(对齐 iOS replace 策略) */
export function importBackup(json: BackupJSON) {
  apply(fromBackup(json), false);
  persist();
}

export function clearAll() {
  apply(
    {
      expenses: [],
      incomes: [],
      passiveSources: [],
      assets: { lockedAssets: 0, cash: 0, updatedAt: new Date(), firstRecordDate: null },
    },
    false
  );
  persist();
}

/** 导出为下载用的 JSON 字符串(pretty) */
export function exportJSONString(): string {
  return JSON.stringify(toBackup(), null, 2);
}
