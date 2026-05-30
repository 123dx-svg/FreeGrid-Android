// ============================================================================
// 数据模型层 —— 镜像 iOS 的 SwiftData @Model,并精确对齐 BackupJSON 线格式。
//
// 关键:iOS 导出 JSON 用 convertToSnakeCase,所以 wire 字段是 is_passive /
// monthly_amount / passive_sources / first_record_date / created_at / updated_at。
// web 端导入必须按 snake_case 读,才能直接吃 iOS 导出的备份。
// ============================================================================

// ---- 运行时领域模型(app 内部用,date 都是 Date 对象) ----

export interface Expense {
  id: string;
  amount: number; // 元,正数
  category: string; // canonical 9 类之一
  note: string;
  date: Date; // 消费自然日
  createdAt: Date;
}

export interface Income {
  id: string;
  amount: number;
  source: string;
  isPassive: boolean;
  note: string;
  date: Date;
  createdAt: Date;
}

export interface PassiveSource {
  id: string;
  name: string;
  monthlyAmount: number; // 元/月,日均 = /30
  createdAt: Date;
}

export interface UserAssets {
  lockedAssets: number; // 锁定资产(投资/定期)— 蓝格
  cash: number; // 可花现金 — 金格
  updatedAt: Date;
  firstRecordDate: Date | null;
}

export function netWorth(a: Pick<UserAssets, "lockedAssets" | "cash">): number {
  return a.lockedAssets + a.cash;
}

// ---- BackupJSON 线格式(snake_case,与 iOS DataIO.exportJSON 对称) ----

export interface BackupAssetsJSON {
  total: number;
  updated_at?: string | null; // ISO "2026-05-25T08:55:55.159Z"
}
export interface BackupExpenseJSON {
  amount: number;
  category: string;
  date: string; // "YYYY-MM-DD"
  note?: string | null;
  created_at?: string | null;
}
export interface BackupIncomeJSON {
  amount: number;
  source: string;
  date: string;
  note?: string | null;
  is_passive?: boolean | null;
  created_at?: string | null;
}
export interface BackupPassiveSourceJSON {
  name: string;
  monthly_amount: number;
}
export interface BackupJSON {
  assets?: BackupAssetsJSON | null;
  expenses?: BackupExpenseJSON[] | null;
  incomes?: BackupIncomeJSON[] | null;
  passive_sources?: BackupPassiveSourceJSON[] | null;
  first_record_date?: string | null; // "YYYY-MM-DD"
}

// ============================================================================
// ExpenseCategory —— 权威分类 + 导入归一(单一来源,移植自 iOS ExpenseCategory)
// 手动记账只能选 canonical;导入是唯一会混进外来分类的口子,在边界用 suggest 归一。
// ============================================================================

export const EXPENSE_CATEGORIES = [
  "早餐",
  "午餐",
  "晚餐",
  "购物",
  "交通",
  "娱乐",
  "成长投资",
  "医疗",
  "其他",
] as const;

export const CATEGORY_FALLBACK = "其他";

// 高置信别名表(只放"几乎不会错"的);拿不准的故意不放,落到 needs-review。
const CATEGORY_ALIASES: Record<string, string> = {
  transport: "交通",
  transportation: "交通",
  shopping: "购物",
  shop: "购物",
  entertainment: "娱乐",
  medical: "医疗",
  health: "医疗",
  other: "其他",
  others: "其他",
  misc: "其他",
  growth: "成长投资",
  investment: "成长投资",
  数码: "购物", // 经用户确认:电子产品并入购物
};

/** 归一建议。已是 canonical → 原样(known);命中别名 → canonical(known);都不命中 → fallback 但 known=false。 */
export function suggestCategory(raw: string): { canonical: string; known: boolean } {
  const t = raw.trim();
  if ((EXPENSE_CATEGORIES as readonly string[]).includes(t)) return { canonical: t, known: true };
  const mapped = CATEGORY_ALIASES[t] ?? CATEGORY_ALIASES[t.toLowerCase()];
  if (mapped) return { canonical: mapped, known: true };
  return { canonical: CATEGORY_FALLBACK, known: false };
}
