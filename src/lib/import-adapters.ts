// ============================================================================
// 导入适配层 —— 把外部数据统一归一成 app 的 BackupJSON,再喂给现有导入管线。
// 支持:① app 自备份(expenses/incomes,snake_case) ② AI 转换结果(精简 transactions)。
// app 本身零网络零 AI:外部 CSV/任意格式的转换由用户自己的 AI 完成(见「复制转换提示词」)。
// ============================================================================

import type { BackupJSON, BackupExpenseJSON, BackupIncomeJSON } from "./models";

export interface ParsedImport {
  ok: boolean;
  error?: string;
  backup?: BackupJSON;
  source?: "app" | "ai";
  expCount: number;
  incCount: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 各种日期格式 → "YYYY-MM-DD"(容错:ISO / YYYY-MM-DD / YYYY/M/D / 时间戳)。 */
function normDate(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    const d = new Date(v > 1e12 ? v : v * 1000); // 秒或毫秒时间戳
    return isNaN(+d) ? null : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  if (typeof v !== "string") return null;
  const s = v.trim();
  const m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  const d = new Date(s);
  return isNaN(+d) ? null : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const str = (v: unknown, fallback = ""): string => {
  const s = typeof v === "string" ? v.trim() : "";
  return s || fallback;
};

/** 解析导入文本。currentAssetTotal:AI 格式不含资产时,替换语义下保留当前净值。 */
export function parseImport(text: string, currentAssetTotal: number): ParsedImport {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    return { ok: false, error: "不是有效的 JSON 文件", expCount: 0, incCount: 0 };
  }
  if (!obj || typeof obj !== "object") {
    return { ok: false, error: "文件内容无法识别", expCount: 0, incCount: 0 };
  }
  const o = obj as Record<string, unknown>;

  // ① app 自备份
  if (Array.isArray(o.expenses) || Array.isArray(o.incomes)) {
    const expCount = Array.isArray(o.expenses) ? o.expenses.length : 0;
    const incCount = Array.isArray(o.incomes) ? o.incomes.length : 0;
    return { ok: true, backup: obj as BackupJSON, source: "app", expCount, incCount };
  }

  // ② AI 转换结果(精简 transactions)
  if (Array.isArray(o.transactions)) {
    const expenses: BackupExpenseJSON[] = [];
    const incomes: BackupIncomeJSON[] = [];
    for (const raw of o.transactions as unknown[]) {
      if (!raw || typeof raw !== "object") continue;
      const t = raw as Record<string, unknown>;
      const amount = Math.abs(Number(t.amount));
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const date = normDate(t.date);
      if (!date) continue;
      const note = str(t.note);
      const created_at = `${date}T12:00:00.000Z`; // 当日中午,排序稳定
      const type = str(t.type);
      const isIncome = type === "income" || type === "收入";
      const isExpense = type === "expense" || type === "支出" || type === "expenditure";
      if (isIncome || (!isExpense && t.source && !t.category)) {
        incomes.push({ amount, source: str(t.source ?? t.category, "其他"), date, note, is_passive: !!t.passive, created_at });
      } else {
        expenses.push({ amount, category: str(t.category ?? t.source, "其他"), date, note, created_at });
      }
    }
    if (!expenses.length && !incomes.length) {
      return { ok: false, error: "没找到可导入的交易(检查每笔的 type / amount / date)", expCount: 0, incCount: 0 };
    }
    const backup: BackupJSON = {
      assets: { total: currentAssetTotal, updated_at: new Date().toISOString() },
      expenses,
      incomes,
      passive_sources: [],
      first_record_date: null,
    };
    return { ok: true, backup, source: "ai", expCount: expenses.length, incCount: incomes.length };
  }

  return { ok: false, error: "无法识别格式(需 app 备份 JSON,或含 transactions 的 AI 转换结果)", expCount: 0, incCount: 0 };
}

/** 生成「复制给 AI」的转换提示词。传入本地支出分类清单,供 AI 映射。 */
export function buildImportPrompt(expenseCategories: readonly string[]): string {
  const cats = expenseCategories.join(" / ");
  return [
    "你是数据转换助手。请把我在末尾提供的记账数据(CSV 或任意格式)转换成严格的 JSON。规则:",
    "1. 只输出一个 JSON 对象,不要任何解释文字,不要 markdown 代码块。",
    '2. 结构:{"transactions":[ ... ]}',
    "3. 每笔交易对象字段:",
    '   - "type": "expense"(支出)或 "income"(收入)',
    '   - "amount": 正数(不带正负号、不带货币符号)',
    '   - "date": "YYYY-MM-DD"',
    '   - 支出填 "category";收入填 "source"(自由文本,如 工资/兼职/理财)',
    '   - "note": 备注,可为空字符串 ""',
    '   - 收入可加 "passive": true/false(利息/分红/租金等被动收入为 true)',
    `4. 支出的 "category" 尽量从这些里选最接近的:${cats};实在拿不准填「其他」。`,
    "5. 金额或日期缺失、无法解析的行请跳过。",
    "示例输出:",
    '{"transactions":[',
    '  {"type":"expense","date":"2024-03-05","amount":42.5,"category":"饮食","note":"午饭"},',
    '  {"type":"income","date":"2024-03-01","amount":8000,"source":"工资","passive":false}',
    "]}",
    "",
    "下面是我的数据:",
    "<在这里粘贴你的 CSV / 账单数据>",
  ].join("\n");
}
