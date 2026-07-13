// ============================================================================
// 中央响应式数据 store(Svelte 5 runes,跨组件共享)。
// · 持久化:localStorage,序列化格式 = iOS BackupJSON(snake_case)→ 同一套编解码同时服务
//   "本地保存 / 导入 iOS 导出 / 导出备份",一份 codec 三用。
// · 默认空白起点(无数据 → 空态引导),绝不自动种入演示数据;只有 URL 带 ?demo=1 时
//   才在内存里种 demo(截图/预览用,不写盘)。修复了"下载安装后点进去就有数据"。
// · 隐私:只读写本机 localStorage,数据不离开浏览器。
// ============================================================================

import { makeDemoData } from "./demo";
import { suggestCategory } from "./models";
import type { Expense, Income, PassiveSource, UserAssets, BackupJSON, AssetItem, LiabilityItem } from "./models";
import { exportBadgeMeta } from "./achievements.svelte";
import { loadFqResult } from "./fq-test";

const KEY = "freegrid-data-v1";

// ---- 响应式 store(导出 const 对象,组件读其属性即响应) ----
export const store = $state({
  expenses: [] as Expense[],
  incomes: [] as Income[],
  passiveSources: [] as PassiveSource[],
  assets: {
    lockedAssets: 0,
    cash: 0,
    liabilities: 0,
    assetItems: [] as AssetItem[],
    liabilityItems: [] as LiabilityItem[],
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
      liabilities: store.assets.liabilities || undefined,
      updated_at: store.assets.updatedAt.toISOString(),
      asset_items: store.assets.assetItems.length
        ? store.assets.assetItems.map((a) => ({ type: a.type, name: a.name || undefined, amount: a.amount, rate: a.rate || undefined }))
        : undefined,
      liability_items: store.assets.liabilityItems.length
        ? store.assets.liabilityItems.map((l) => ({ type: l.type, amount: l.amount, rate: l.rate || undefined }))
        : undefined,
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
  // 资产/负债明细(Android 扩展):有明细则用明细,总额由明细求和;无则回落旧逻辑(total→cash)
  const assetItems: AssetItem[] = (json.assets?.asset_items ?? []).map((a) => ({
    id: nid(),
    type: a.type || "其他",
    name: a.name ?? "",
    amount: Math.max(0, a.amount || 0),
    rate: Math.max(0, a.rate ?? 0),
  }));
  const liabilityItems: LiabilityItem[] = (json.assets?.liability_items ?? []).map((l) => ({
    id: nid(),
    type: l.type || "其他",
    amount: Math.max(0, l.amount || 0),
    rate: Math.max(0, l.rate ?? 0),
  }));
  const hasAssetItems = assetItems.length > 0;
  const hasLiabItems = liabilityItems.length > 0;
  const lockedFromItems = assetItems.reduce((s, a) => s + a.amount, 0);
  const liabFromItems = liabilityItems.reduce((s, l) => s + l.amount, 0);
  const assets: UserAssets = {
    // 有资产明细:lockedAssets = 明细和,cash = total − 明细和(还原分桶);无明细:全落 cash(旧逻辑)
    lockedAssets: hasAssetItems ? lockedFromItems : 0,
    cash: hasAssetItems ? Math.max(0, total - lockedFromItems) : total,
    liabilities: hasLiabItems ? liabFromItems : typeof json.assets?.liabilities === "number" ? Math.max(0, json.assets.liabilities) : 0,
    assetItems,
    liabilityItems,
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
    localStorage.setItem(
      KEY,
      JSON.stringify({
        seeded: store.seeded,
        data: toBackup(),
        // 本地保真:BackupJSON 只存净值 total(对齐 iOS,丢了锁定/现金分桶)。本地额外存一份
        // 分桶,刷新后按真实比例还原"资产(金)/现金(蓝)",不致全塌成现金。仅本地,不进导出/iOS 桥。
        buckets: { lockedAssets: store.assets.lockedAssets, cash: store.assets.cash },
      })
    );
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

/** 真正的空白起点(无任何交易/资产),seeded:false。clearAll 与首启共用。 */
function applyEmpty() {
  apply(
    {
      expenses: [],
      incomes: [],
      passiveSources: [],
      assets: { lockedAssets: 0, cash: 0, liabilities: 0, assetItems: [], liabilityItems: [], updatedAt: new Date(), firstRecordDate: null },
    },
    false
  );
}

/** 还原本地分桶:fromBackup 把净值全落 cash;本地存档带 buckets 时按真实比例还原资产/现金。
 *  仅本地水合用 —— iOS 导入 / 用户导入的 JSON 无此字段,保持全 cash(正确,无分桶信息)。 */
function restoreBuckets(buckets: { lockedAssets?: unknown; cash?: unknown } | null | undefined) {
  if (buckets && typeof buckets.lockedAssets === "number" && typeof buckets.cash === "number") {
    store.assets.lockedAssets = buckets.lockedAssets;
    store.assets.cash = buckets.cash;
  }
}

/** 是否显式请求演示数据(URL 带 ?demo=1)。默认——含桌面版与普通网页访问——一律不种。 */
function demoRequested(): boolean {
  try {
    return new URLSearchParams(location.search).get("demo") === "1";
  } catch {
    return false;
  }
}

/** 一次性类目改名迁移:把已存的旧类目名就地改成新名(仅本机存档,不动导出格式)。 */
function migrateCategories() {
  const RENAME: Record<string, string> = { 育儿: "日用" };
  let changed = false;
  for (const e of store.expenses) {
    const to = RENAME[e.category];
    if (to) {
      e.category = to;
      changed = true;
    }
  }
  if (changed) persist();
}

/** App 启动调用一次。有真实存档则水合;否则默认空白(只有 ?demo=1 才种演示数据)。 */
export function initStore() {
  let loaded = false;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // 旧版会在首启自动种入 demo 并标 seeded:true。用户从未改动过的种子一律视为
      // "无数据":清掉它,让 app 回到真正空白(老用户升级后残留的 demo 自动消失)。
      if (parsed && parsed.seeded) {
        localStorage.removeItem(KEY);
      } else {
        apply(fromBackup(parsed.data as BackupJSON), false);
        restoreBuckets(parsed.buckets); // 本地保真:还原资产/现金分桶(fromBackup 默认全落 cash)
        migrateCategories(); // 旧类目改名(育儿→日用)
        migrateAssetsToItems(); // 旧单值资产/负债 → 明细项
        recomputeAssetTotals(); // 总额对齐明细(有明细时权威)
        loaded = true;
      }
    }
  } catch {
    /* 损坏存档忽略,落到空白 */
  }
  if (!loaded) {
    if (demoRequested()) {
      // 仅截图/预览:演示数据只在内存,绝不写入用户存档(故不调 persist,直接 return)。
      const demo = makeDemoData();
      apply(
        { expenses: demo.expenses, incomes: demo.incomes, passiveSources: demo.passiveSources, assets: demo.assets },
        true
      );
      _ready = true;
      return;
    }
    applyEmpty();
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

export function addExpense(amount: number, category: string, note = "", date = new Date(), createdAt = new Date()) {
  const id = nid();
  store.expenses.push({ id, amount, category, note, date, createdAt });
  store.assets.cash -= amount;
  if (!store.assets.firstRecordDate) store.assets.firstRecordDate = date;
  touch();
  return id;
}

export function addIncome(amount: number, source: string, isPassive = false, note = "", date = new Date(), createdAt = new Date()) {
  const id = nid();
  store.incomes.push({ id, amount, source, isPassive, note, date, createdAt });
  store.assets.cash += amount;
  if (!store.assets.firstRecordDate) store.assets.firstRecordDate = date;
  touch();
  return id;
}

/** 编辑一笔:改 金额/分类|来源/备注/日期时间。现金按金额差修正(支出增→现金减,收入增→现金增),
 *  日期改动后重算 firstRecordDate。date 与 createdAt 同步为所选 dateTime(与新增一致)。 */
export function updateTransaction(
  id: string,
  kind: "expense" | "income",
  patch: { amount: number; name: string; note: string; dateTime: Date }
) {
  if (kind === "expense") {
    const e = store.expenses.find((x) => x.id === id);
    if (!e) return;
    store.assets.cash += e.amount - patch.amount; // 支出增 → 现金减
    e.amount = patch.amount;
    e.category = patch.name;
    e.note = patch.note;
    e.date = patch.dateTime;
    e.createdAt = patch.dateTime;
  } else {
    const i = store.incomes.find((x) => x.id === id);
    if (!i) return;
    store.assets.cash += patch.amount - i.amount; // 收入增 → 现金增
    i.amount = patch.amount;
    i.source = patch.name;
    i.note = patch.note;
    i.date = patch.dateTime;
    i.createdAt = patch.dateTime;
  }
  recomputeFirstRecordDate();
  touch();
}

/** 从现有全部交易重算最早记录日(编辑/删除改动了日期后调用)。 */
function recomputeFirstRecordDate() {
  const times = [...store.expenses, ...store.incomes].map((x) => x.date.getTime());
  store.assets.firstRecordDate = times.length ? new Date(Math.min(...times)) : null;
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

/** 资产/负债总额 = 各自明细之和(明细是权威来源;净值/自由天数用这两个总额)。 */
function recomputeAssetTotals() {
  store.assets.lockedAssets = store.assets.assetItems.reduce((s, a) => s + Math.max(0, a.amount), 0);
  store.assets.liabilities = store.assets.liabilityItems.reduce((s, l) => s + Math.max(0, l.amount), 0);
}

/** 旧版单值资产/负债 → 明细项迁移(首次:有总额但无明细 → 生成一条「其他」)。 */
function migrateAssetsToItems(): boolean {
  const a = store.assets;
  if (!Array.isArray(a.assetItems)) a.assetItems = [];
  if (!Array.isArray(a.liabilityItems)) a.liabilityItems = [];
  let changed = false;
  if (a.assetItems.length === 0 && a.lockedAssets > 0) {
    a.assetItems = [{ id: nid(), type: "其他", name: "", amount: a.lockedAssets }];
    changed = true;
  }
  if (a.liabilityItems.length === 0 && a.liabilities > 0) {
    a.liabilityItems = [{ id: nid(), type: "其他", amount: a.liabilities, rate: 0 }];
    changed = true;
  }
  return changed;
}

// ── 资产明细 CRUD ──
export function addAssetItem(type: string, amount: number, name = "", rate = 0) {
  if (amount <= 0) return;
  store.assets.assetItems.push({ id: nid(), type, name: name.trim(), amount, rate: Math.max(0, rate) });
  recomputeAssetTotals();
  touch();
}
export function updateAssetItem(id: string, patch: { type?: string; amount?: number; name?: string; rate?: number }) {
  const it = store.assets.assetItems.find((x) => x.id === id);
  if (!it) return;
  if (patch.type != null) it.type = patch.type;
  if (patch.amount != null) it.amount = Math.max(0, patch.amount);
  if (patch.name != null) it.name = patch.name.trim();
  if (patch.rate != null) it.rate = Math.max(0, patch.rate);
  recomputeAssetTotals();
  touch();
}
export function removeAssetItem(id: string) {
  store.assets.assetItems = store.assets.assetItems.filter((x) => x.id !== id);
  recomputeAssetTotals();
  touch();
}

// ── 负债明细 CRUD ──
export function addLiabilityItem(type: string, amount: number, rate = 0) {
  if (amount <= 0) return;
  store.assets.liabilityItems.push({ id: nid(), type, amount, rate: Math.max(0, rate) });
  recomputeAssetTotals();
  touch();
}
export function updateLiabilityItem(id: string, patch: { type?: string; amount?: number; rate?: number }) {
  const it = store.assets.liabilityItems.find((x) => x.id === id);
  if (!it) return;
  if (patch.type != null) it.type = patch.type;
  if (patch.amount != null) it.amount = Math.max(0, patch.amount);
  if (patch.rate != null) it.rate = Math.max(0, patch.rate);
  recomputeAssetTotals();
  touch();
}
export function removeLiabilityItem(id: string) {
  store.assets.liabilityItems = store.assets.liabilityItems.filter((x) => x.id !== id);
  recomputeAssetTotals();
  touch();
}

export function updateBucket(which: "cash", value: number) {
  if (which === "cash") store.assets.cash = Math.max(0, value);
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

/** 导入:合并进现有账本(追加 + 内容去重;被动源按名合并;资产/净值保持不变)。
 *  返回 { added, skipped }。 */
export function mergeBackup(json: BackupJSON): { added: number; skipped: number; cashDelta: number } {
  const p = fromBackup(json);
  const fp = (kind: string, amount: number, date: Date, key: string, note: string) =>
    `${kind}|${toYMD(date)}|${amount}|${key}|${note}`;
  // 只跟「已存在记录」去重 —— 本次导入内部即便有完全相同的条目(如同日两笔一样的外卖)也全部保留,
  // 避免首次导入把真·多笔相同小额误当重复而丢失。重复导入同一文件仍会跳过已存在的。
  const existing = new Set<string>();
  for (const e of store.expenses) existing.add(fp("e", e.amount, e.date, e.category, e.note));
  for (const i of store.incomes) existing.add(fp("i", i.amount, i.date, i.source, i.note));

  const newExp = p.expenses.filter((e) => !existing.has(fp("e", e.amount, e.date, e.category, e.note)));
  const newInc = p.incomes.filter((i) => !existing.has(fp("i", i.amount, i.date, i.source, i.note)));
  store.expenses = [...store.expenses, ...newExp];
  store.incomes = [...store.incomes, ...newInc];

  const pnames = new Set(store.passiveSources.map((s) => s.name));
  for (const ps of p.passiveSources) {
    if (!pnames.has(ps.name)) {
      store.passiveSources = [...store.passiveSources, ps];
      pnames.add(ps.name);
    }
  }
  const times = [...store.expenses, ...store.incomes].map((x) => x.date.getTime());
  if (times.length) store.assets.firstRecordDate = new Date(Math.min(...times));
  store.seeded = false;
  persist();

  const total = p.expenses.length + p.incomes.length;
  const added = newExp.length + newInc.length;
  // 新增流水的现金净额(收入 − 支出):供导入后可选「反映到现金」用
  const cashDelta = newInc.reduce((s, i) => s + i.amount, 0) - newExp.reduce((s, e) => s + e.amount, 0);
  return { added, skipped: total - added, cashDelta };
}

/** 按增量调整现金(导入后可选把账单净额反映到现金;允许透支为负,与记一笔一致)。 */
export function adjustCash(delta: number) {
  store.assets.cash += delta;
  touch();
}

export function clearAll() {
  applyEmpty();
  persist();
}

/** 导出为下载用的 JSON 字符串(pretty)。附带 app_meta(徽章/财商),供换机迁移;iOS/web 忽略。 */
export function exportJSONString(): string {
  const base = toBackup();
  let appMeta: { badges?: Record<string, string>; fq?: unknown } | undefined;
  try {
    const badges = exportBadgeMeta();
    const fq = loadFqResult();
    if ((badges && Object.keys(badges).length) || fq) {
      appMeta = { badges, fq: fq ?? undefined };
    }
  } catch {
    /* 忽略 */
  }
  return JSON.stringify(appMeta ? { ...base, app_meta: appMeta } : base, null, 2);
}

/** 指定自然年导出:仅含该年流水(不含资产 / 被动源)。回导建议用「合并」。 */
export function exportJSONStringForYear(year: number): string {
  const inYear = (d: Date) => d.getFullYear() === year;
  const exps = store.expenses.filter((e) => inYear(e.date));
  const incs = store.incomes.filter((i) => inYear(i.date));
  const dates = [...exps.map((e) => e.date), ...incs.map((i) => i.date)].sort((a, b) => a.getTime() - b.getTime());
  const backup: BackupJSON = {
    assets: { total: 0, updated_at: new Date().toISOString() },
    expenses: exps.map((e) => ({
      amount: e.amount,
      category: e.category,
      date: toYMD(e.date),
      note: e.note || undefined,
      created_at: e.createdAt.toISOString(),
    })),
    incomes: incs.map((i) => ({
      amount: i.amount,
      source: i.source,
      date: toYMD(i.date),
      note: i.note || undefined,
      is_passive: i.isPassive,
      created_at: i.createdAt.toISOString(),
    })),
    passive_sources: [],
    first_record_date: dates.length ? toYMD(dates[0]) : null,
  };
  return JSON.stringify(backup, null, 2);
}
