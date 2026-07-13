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
  liabilities: number; // 负债总额(房贷/车贷/信用卡等)— 从净值扣减
  updatedAt: Date;
  firstRecordDate: Date | null;
}

export function netWorth(a: { lockedAssets: number; cash: number; liabilities?: number }): number {
  return a.lockedAssets + a.cash - (a.liabilities ?? 0);
}

// ---- BackupJSON 线格式(snake_case,与 iOS DataIO.exportJSON 对称) ----

export interface BackupAssetsJSON {
  total: number;
  liabilities?: number | null;
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
export interface BackupAppMetaJSON {
  badges?: Record<string, string> | null; // 徽章 id → 解锁 ISO 时间
  fq?: unknown; // 财商测试存档(FqStored)
}
export interface BackupJSON {
  assets?: BackupAssetsJSON | null;
  expenses?: BackupExpenseJSON[] | null;
  incomes?: BackupIncomeJSON[] | null;
  passive_sources?: BackupPassiveSourceJSON[] | null;
  first_record_date?: string | null; // "YYYY-MM-DD"
  // 可选:app 自有元数据(徽章/财商)。iOS/web 忽略未知字段 → 向后兼容,不影响 AI 提示词。
  app_meta?: BackupAppMetaJSON | null;
}

// ============================================================================
// ExpenseCategory —— 权威分类 + 导入归一(单一来源,移植自 iOS ExpenseCategory)
// 手动记账只能选 canonical;导入是唯一会混进外来分类的口子,在边界用 suggest 归一。
// ============================================================================

export const EXPENSE_CATEGORIES = [
  "饮食",
  "房租",
  "房贷",
  "水电燃煤",
  "物业费",
  "交通",
  "车贷",
  "购物",
  "育儿",
  "保险",
  "医疗",
  "成长投资",
  "娱乐",
  "人情",
  "其他",
] as const;

// 收入来源权威预设(与「记一笔·记收入」一致,单一来源)。导入时约束 AI 归一到这些,
// 避免同义来源被拆成多种(如「工作收入 / 工资」)。用户自定义来源另经 settings 追加。
export const INCOME_SOURCES = ["工资", "奖金", "副业", "投资", "利息", "红包", "其他"] as const;

// 分类分组(用于录入弹窗的分区展示;顺序即展示顺序)
export const CATEGORY_GROUPS: { label: string; items: string[] }[] = [
  { label: "饮食", items: ["饮食"] },
  { label: "居住", items: ["房租", "房贷", "水电燃煤", "物业费"] },
  { label: "出行", items: ["交通", "车贷"] },
  { label: "生活", items: ["购物", "育儿", "保险", "医疗"] },
  { label: "成长社交", items: ["成长投资", "娱乐", "人情"] },
  { label: "其他", items: ["其他"] },
];

export const CATEGORY_FALLBACK = "其他";

// 高置信别名表(只放"几乎不会错"的);拿不准的故意不放,落到 needs-review。
const CATEGORY_ALIASES: Record<string, string> = {
  // 旧版三餐合并到「饮食」(老数据/iOS 导出兼容)
  早餐: "饮食",
  午餐: "饮食",
  晚餐: "饮食",
  餐饮: "饮食",
  吃饭: "饮食",
  food: "饮食",
  meal: "饮食",
  transport: "交通",
  transportation: "交通",
  shopping: "购物",
  shop: "购物",
  entertainment: "娱乐",
  medical: "医疗",
  health: "医疗",
  mortgage: "房贷",
  carloan: "车贷",
  人情往来: "人情",
  随礼: "人情",
  红包: "人情",
  水费: "水电燃煤",
  电费: "水电燃煤",
  燃气费: "水电燃煤",
  煤气费: "水电燃煤",
  水电: "水电燃煤",
  物业: "物业费",
  保费: "保险",
  保险费: "保险",
  孩子: "育儿",
  教育: "育儿",
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
