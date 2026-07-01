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

export interface Settings {
  theme: Theme;
  startTab: string; // 默认起始页
  profile: Profile;
  customExpenseCategories: string[]; // 用户自定义支出分类
  customIncomeSources: string[]; // 用户自定义收入来源
}

const KEY = "freegrid-settings-v1";
const LEGACY_THEME_KEY = "freegrid-theme";

function defaults(): Settings {
  return {
    theme: "system",
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
