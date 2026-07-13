// ============================================================================
// AI 配置(Svelte 5 runes)—— 独立 key `freegrid-ai-v1`,与财务数据完全分离。
// 严格 opt-in:enabled 默认 false。BYOK:每个服务商各存各的密钥,可预填多家、随时切换。
// 隐私红线:此 key 绝不进入财务备份导出(密钥不外泄)。
// ============================================================================
import { PROVIDERS, providerById, type ProviderId, type Provider } from "./providers";

const KEY = "freegrid-ai-v1";

export interface AiFeatureFlags {
  fq: boolean; // 财商结果·个性化解读
  annual: boolean; // 年报·致股东的信
  import: boolean; // 智能账单导入
}

export interface AiConfig {
  enabled: boolean; // 总开关(默认关)
  activeProvider: ProviderId;
  keys: Record<ProviderId, string>; // 各服务商密钥(BYOK)
  models: Record<ProviderId, string>; // 各服务商模型(可覆盖默认)
  features: AiFeatureFlags;
  sendRealMetrics: boolean; // 财商解读是否附带真实记账聚合(默认关)
  sendProfile: boolean; // 年报/财商解读是否附带个人档案(城市/家庭等)以贴合国情(默认关)
  monthlyCap: number; // 每月最多调用次数,0 = 不限
  usage: { month: string; calls: number }; // 自我限额计数(按月重置)
  cache: Record<string, string>; // 生成结果缓存(按输入 hash)
  cacheAt: Record<string, number>; // 各缓存 key 的生成时间(epoch ms),用于"上次生成于"
}

const emptyKeys = (): Record<ProviderId, string> =>
  PROVIDERS.reduce((o, p) => ((o[p.id] = ""), o), {} as Record<ProviderId, string>);
const defaultModels = (): Record<ProviderId, string> =>
  PROVIDERS.reduce((o, p) => ((o[p.id] = p.defaultModel), o), {} as Record<ProviderId, string>);

function defaults(): AiConfig {
  return {
    enabled: false,
    activeProvider: "deepseek",
    keys: emptyKeys(),
    models: defaultModels(),
    features: { fq: true, annual: true, import: true },
    sendRealMetrics: false,
    sendProfile: false,
    monthlyCap: 0,
    usage: { month: "", calls: 0 },
    cache: {},
    cacheAt: {},
  };
}

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function load(): AiConfig {
  const c = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o && typeof o === "object") {
        c.enabled = !!o.enabled;
        if (PROVIDERS.some((p) => p.id === o.activeProvider)) c.activeProvider = o.activeProvider;
        if (o.keys && typeof o.keys === "object") for (const p of PROVIDERS) if (typeof o.keys[p.id] === "string") c.keys[p.id] = o.keys[p.id];
        if (o.models && typeof o.models === "object") for (const p of PROVIDERS) if (typeof o.models[p.id] === "string" && o.models[p.id]) c.models[p.id] = o.models[p.id];
        if (o.features && typeof o.features === "object") {
          c.features = { fq: o.features.fq !== false, annual: o.features.annual !== false, import: o.features.import !== false };
        }
        c.sendRealMetrics = !!o.sendRealMetrics;
        c.sendProfile = !!o.sendProfile;
        if (typeof o.monthlyCap === "number" && o.monthlyCap >= 0) c.monthlyCap = Math.floor(o.monthlyCap);
        if (o.usage && typeof o.usage === "object" && typeof o.usage.calls === "number") {
          c.usage = { month: typeof o.usage.month === "string" ? o.usage.month : "", calls: Math.max(0, Math.floor(o.usage.calls)) };
        }
        if (o.cache && typeof o.cache === "object") c.cache = o.cache as Record<string, string>;
        if (o.cacheAt && typeof o.cacheAt === "object") c.cacheAt = o.cacheAt as Record<string, number>;
      }
    }
  } catch {
    /* 用默认 */
  }
  // 跨月重置计数
  if (c.usage.month !== thisMonth()) c.usage = { month: thisMonth(), calls: 0 };
  return c;
}

export const aiConfig = $state<AiConfig>(load());

// 自动持久化(任意字段变更即存;含密钥,仅存本机 WebView 沙盒)
$effect.root(() => {
  $effect(() => {
    const snap: AiConfig = {
      enabled: aiConfig.enabled,
      activeProvider: aiConfig.activeProvider,
      keys: { ...aiConfig.keys },
      models: { ...aiConfig.models },
      features: { ...aiConfig.features },
      sendRealMetrics: aiConfig.sendRealMetrics,
      sendProfile: aiConfig.sendProfile,
      monthlyCap: aiConfig.monthlyCap,
      usage: { ...aiConfig.usage },
      cache: { ...aiConfig.cache },
      cacheAt: { ...aiConfig.cacheAt },
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(snap));
    } catch {
      /* 忽略 */
    }
  });
});

// ── 便捷读取 ──
export function activeProvider(): Provider {
  return providerById(aiConfig.activeProvider);
}
export function activeKey(): string {
  return (aiConfig.keys[aiConfig.activeProvider] ?? "").trim();
}
export function activeModel(): string {
  return (aiConfig.models[aiConfig.activeProvider] || activeProvider().defaultModel).trim();
}

/** AI 是否可用于某功能:总开关 + 当前服务商已填密钥 + 该功能开启。 */
export function aiReady(feature?: keyof AiFeatureFlags): boolean {
  if (!aiConfig.enabled) return false;
  if (!activeKey()) return false;
  if (feature && !aiConfig.features[feature]) return false;
  return true;
}

/** 是否还在本月限额内(monthlyCap=0 不限)。 */
export function underCap(): boolean {
  if (!aiConfig.monthlyCap) return true;
  if (aiConfig.usage.month !== thisMonth()) return true; // 新月份
  return aiConfig.usage.calls < aiConfig.monthlyCap;
}

/** 记一次调用(跨月自动重置)。 */
export function recordCall() {
  const m = thisMonth();
  if (aiConfig.usage.month !== m) aiConfig.usage = { month: m, calls: 0 };
  aiConfig.usage.calls += 1;
}

// ── 结果缓存 ──
export function cacheGet(k: string): string | null {
  return aiConfig.cache[k] ?? null;
}
export function cacheSet(k: string, v: string) {
  aiConfig.cache = { ...aiConfig.cache, [k]: v };
  aiConfig.cacheAt = { ...aiConfig.cacheAt, [k]: Date.now() };
}
/** 读取某缓存 key 的生成时间(epoch ms);无则 null。 */
export function cacheGetAt(k: string): number | null {
  return aiConfig.cacheAt[k] ?? null;
}
export function cacheDel(k: string) {
  const c = { ...aiConfig.cache };
  delete c[k];
  aiConfig.cache = c;
}
