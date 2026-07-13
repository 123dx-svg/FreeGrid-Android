// ============================================================================
// 设置 / 个人档案 —— 纯本地,独立 key(不混进财务备份)。
// 含:主题、基础个性化、个人档案(分析用参数)+ 若干派生洞察。
// 隐私红线:全部只存本机,绝不离设备。
// ============================================================================

export type Theme = "system" | "dark" | "light";

export interface Profile {
  birthYear: number | null; // 出生年份
  retireAge: number | null; // 目标退休年龄
  retireMonthlySpend: number | null; // 期望退休后月开销(¥)
  elderCount: number; // 需赡养老人数
  childCount: number; // 抚养子女数
  incomeBand: string; // 月收入档(代号)
  city: string; // 城市/生活成本档(代号)
  family: string; // 家庭结构(代号)
  riskPref: string; // 风险偏好:"" 跟随财商 / "aggressive" / "neutral" / "conservative"
}

export interface TxTemplate {
  id: string;
  kind: "expense" | "income";
  name: string; // 分类(支出)/来源(收入)
  amount: number | null; // 预填金额;null = 不预填
  note: string;
}

export interface Settings {
  theme: Theme;
  startTab: string; // 默认起始页
  profile: Profile;
  customExpenseCategories: string[]; // 用户自定义支出分类
  customIncomeSources: string[]; // 用户自定义收入来源
  dashboardOrder: string[]; // 仪表盘卡片顺序(hero 之下的可重排块)
  skin: string; // 外观皮肤(按经营等级解锁);"" = 默认
  title: string; // 展示称号(按徽章解锁);"" = 默认(等级名)
  txTemplates: TxTemplate[]; // 常用记账模板(房租/订阅/工资等)
  lastBackupAt: string; // 上次导出备份时间(ISO);"" = 从未
}

const KEY = "freegrid-settings-v1";
const LEGACY_THEME_KEY = "freegrid-theme";

function defaults(): Settings {
  return {
    theme: "dark",
    startTab: "dashboard",
    profile: {
      birthYear: null,
      retireAge: null,
      retireMonthlySpend: null,
      elderCount: 0,
      childCount: 0,
      incomeBand: "",
      city: "",
      family: "",
      riskPref: "",
    },
    customExpenseCategories: [],
    customIncomeSources: [],
    dashboardOrder: ["grid", "stats", "actions", "today"],
    skin: "",
    title: "",
    txTemplates: [],
    lastBackupAt: "",
  };
}

function loadInitial(): Settings {
  const s = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o && typeof o === "object") {
        if (o.theme === "system" || o.theme === "dark" || o.theme === "light") s.theme = o.theme;
        if (typeof o.startTab === "string") s.startTab = o.startTab;
        const strList = (v: unknown) =>
          Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
        s.customExpenseCategories = strList(o.customExpenseCategories);
        s.customIncomeSources = strList(o.customIncomeSources);
        if (Array.isArray(o.dashboardOrder)) {
          const arr = strList(o.dashboardOrder);
          if (arr.length) s.dashboardOrder = arr;
        }
        if (typeof o.skin === "string") s.skin = o.skin;
        if (typeof o.title === "string") s.title = o.title;
        if (typeof o.lastBackupAt === "string") s.lastBackupAt = o.lastBackupAt;
        if (Array.isArray(o.txTemplates)) {
          s.txTemplates = o.txTemplates
            .filter((t: unknown): t is Record<string, unknown> => !!t && typeof t === "object")
            .map((t: Record<string, unknown>) => ({
              id: typeof t.id === "string" ? t.id : `tpl-${Math.random().toString(36).slice(2)}`,
              kind: t.kind === "income" ? ("income" as const) : ("expense" as const),
              name: typeof t.name === "string" ? t.name : "",
              amount: typeof t.amount === "number" && Number.isFinite(t.amount) ? t.amount : null,
              note: typeof t.note === "string" ? t.note : "",
            }))
            .filter((t: TxTemplate) => t.name.length > 0);
        }
        if (o.profile && typeof o.profile === "object") {
          const p = o.profile;
          const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
          const int0 = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);
          const str = (v: unknown) => (typeof v === "string" ? v : "");
          s.profile = {
            birthYear: num(p.birthYear),
            retireAge: num(p.retireAge),
            retireMonthlySpend: num(p.retireMonthlySpend),
            elderCount: int0(p.elderCount),
            childCount: int0(p.childCount),
            incomeBand: str(p.incomeBand),
            city: str(p.city),
            family: str(p.family),
            riskPref: str(p.riskPref),
          };
        }
      }
      return s;
    }
    // 首次:迁移旧主题选择(freegrid-theme: "dark"|"light")→ settings.theme
    const legacy = localStorage.getItem(LEGACY_THEME_KEY);
    if (legacy === "dark" || legacy === "light") s.theme = legacy;
  } catch {
    /* localStorage 不可用:用默认 */
  }
  return s;
}

export const settings = $state<Settings>(loadInitial());

// 自动持久化(任意字段变更即存)
$effect.root(() => {
  $effect(() => {
    const snap: Settings = {
      theme: settings.theme,
      startTab: settings.startTab,
      profile: { ...settings.profile },
      customExpenseCategories: [...settings.customExpenseCategories],
      customIncomeSources: [...settings.customIncomeSources],
      dashboardOrder: [...settings.dashboardOrder],
      skin: settings.skin,
      title: settings.title,
      txTemplates: settings.txTemplates.map((t) => ({ ...t })),
      lastBackupAt: settings.lastBackupAt,
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(snap));
    } catch {
      /* 配额满等忽略 */
    }
  });
});

// ── 主题解析(system → 跟随系统媒体查询)──
export function resolvedTheme(): "dark" | "light" {
  if (settings.theme === "dark" || settings.theme === "light") return settings.theme;
  try {
    if (window.matchMedia?.("(prefers-color-scheme: light)").matches) return "light";
  } catch {
    /* 兜底暗色 */
  }
  return "dark";
}

/** 桌面侧栏用:在 深/浅 间切换(会写死为手动选择)。 */
export function toggleThemeManual() {
  settings.theme = resolvedTheme() === "dark" ? "light" : "dark";
}

// ── 派生洞察(少量露出用;纯计算)──
export function currentAge(now = new Date()): number | null {
  const y = settings.profile.birthYear;
  if (!y) return null;
  const age = now.getFullYear() - y;
  return age >= 0 && age < 130 ? age : null;
}

export function yearsToRetire(now = new Date()): number | null {
  const age = currentAge(now);
  const ra = settings.profile.retireAge;
  if (age == null || ra == null) return null;
  return Math.max(0, ra - age);
}

/** 应急储备目标月数:基线 6 + 每位需赡养老人 +3 + 每位抚养子女 +2(封顶 24)。 */
export function emergencyTargetMonths(): number {
  const p = settings.profile;
  return Math.min(24, 6 + 3 * (p.elderCount || 0) + 2 * (p.childCount || 0));
}

/** 财务自由目标净值:期望退休后月开销 × 12 × 25(4% 法则)。无数据返回 null。 */
export function fiTargetNetWorth(): number | null {
  const m = settings.profile.retireMonthlySpend;
  return m && m > 0 ? Math.round(m * 12 * 25) : null;
}

export function hasProfile(): boolean {
  const p = settings.profile;
  return !!(p.birthYear || p.retireAge || p.retireMonthlySpend || p.elderCount || p.childCount || p.incomeBand || p.city || p.family || p.riskPref);
}

// ── 自定义分类 / 来源 增删 ──
export type CatKind = "expense" | "income";

/** 添加自定义分类/来源。返回规范化后的名字(去空白);重复/空则不加。 */
export function addCustom(kind: CatKind, raw: string): string {
  const name = raw.trim();
  if (!name) return "";
  const list = kind === "expense" ? settings.customExpenseCategories : settings.customIncomeSources;
  if (!list.includes(name)) list.push(name);
  return name;
}

export function removeCustom(kind: CatKind, name: string): void {
  if (kind === "expense") {
    settings.customExpenseCategories = settings.customExpenseCategories.filter((c) => c !== name);
  } else {
    settings.customIncomeSources = settings.customIncomeSources.filter((c) => c !== name);
  }
}

// ── 常用记账模板 增删 ──
/** 添加/更新常用模板。同 kind+name+amount 视为同一条(避免重复)。返回模板 id。 */
export function addTemplate(t: Omit<TxTemplate, "id">): string {
  const name = t.name.trim();
  if (!name) return "";
  const amount = t.amount != null && t.amount > 0 ? t.amount : null;
  const dup = settings.txTemplates.find((x) => x.kind === t.kind && x.name === name && x.amount === amount);
  if (dup) return dup.id;
  const id = `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  settings.txTemplates.push({ id, kind: t.kind, name, amount, note: t.note?.trim() ?? "" });
  return id;
}

export function removeTemplate(id: string): void {
  settings.txTemplates = settings.txTemplates.filter((t) => t.id !== id);
}

// ── 备份时间戳 ──
/** 导出成功后调用,记下"上次备份"时间。 */
export function markBackupNow(): void {
  settings.lastBackupAt = new Date().toISOString();
}

/** 距上次备份的天数;从未备份返回 null。 */
export function daysSinceBackup(now = new Date()): number | null {
  if (!settings.lastBackupAt) return null;
  const t = new Date(settings.lastBackupAt).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((now.getTime() - t) / 86_400_000);
}

// ── 个人档案摘要(供 AI 解读个性化,opt-in 才发送)──
const CITY_L: Record<string, string> = { t1: "一线", nt1: "新一线", t2: "二线", t3: "三四线", town: "县城乡镇" };
const FAMILY_L: Record<string, string> = { single: "单身", couple: "情侣", married: "已婚无孩", kids: "已婚有孩", other: "其他" };
const INCOME_L: Record<string, string> = { lt5k: "<5千", "5-10k": "5–10千", "10-20k": "1–2万", "20-50k": "2–5万", gt50k: "5万+" };
const RISK_L: Record<string, string> = { aggressive: "进取", neutral: "中性", conservative: "稳健" };

/** 人类可读的个人档案摘要(用于 AI 贴合国情个性化);无档案返回 ""。 */
export function profileSummary(now = new Date()): string {
  const p = settings.profile;
  const parts: string[] = [];
  if (p.birthYear && p.birthYear > 1900) parts.push(`${now.getFullYear() - p.birthYear} 岁`);
  if (CITY_L[p.city]) parts.push(`${CITY_L[p.city]}城市`);
  if (FAMILY_L[p.family]) parts.push(FAMILY_L[p.family]);
  if (p.elderCount > 0) parts.push(`赡养老人 ${p.elderCount} 位`);
  if (p.childCount > 0) parts.push(`抚养子女 ${p.childCount} 个`);
  if (INCOME_L[p.incomeBand]) parts.push(`月收入档 ${INCOME_L[p.incomeBand]}`);
  if (p.retireAge && p.retireAge > 0) parts.push(`目标退休 ${p.retireAge} 岁`);
  if (RISK_L[p.riskPref]) parts.push(`风险偏好 ${RISK_L[p.riskPref]}`);
  return parts.join(";");
}
