// ============================================================================
// 通用 LLM 客户端 —— 所有服务商都是 OpenAI 兼容 /chat/completions,共用这一份。
// 走 CapacitorHttp(原生请求,绕过 WebView 的 CORS),不全局劫持 fetch(避免影响本地 data: URL)。
// 这是全应用「唯一」联网的文件。
// ============================================================================
import { CapacitorHttp } from "@capacitor/core";
import { activeProvider, activeKey, activeModel, recordCall, underCap } from "./config.svelte";
import type { Provider } from "./providers";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  json?: boolean; // 要求 JSON Output(部分模型支持)
  timeoutMs?: number;
  // 覆盖当前配置(用于「测试连接」)
  provider?: Provider;
  key?: string;
  model?: string;
  countUsage?: boolean; // 是否计入本月调用数(默认 true)
}

export interface ChatUsage {
  prompt: number;
  completion: number;
  cacheHit: number;
  costYuan: number | null;
}

export interface ChatResult {
  ok: boolean;
  content?: string;
  error?: string;
  usage?: ChatUsage;
}

function humanErr(status: number, data: any): string {
  const msg = data?.error?.message || data?.message || "";
  if (status === 401) return "密钥无效或未授权(检查 API Key)";
  if (status === 402) return "账户余额不足,请前往服务商充值";
  if (status === 429) return "调用过于频繁或额度用尽,请稍后再试";
  if (status >= 500) return "服务商暂时不可用,请稍后再试";
  return msg ? String(msg) : `请求失败(HTTP ${status})`;
}

async function rawChat(opts: ChatOptions): Promise<ChatResult> {
  const provider = opts.provider ?? activeProvider();
  const key = (opts.key ?? activeKey()).trim();
  const model = (opts.model ?? activeModel()).trim();
  if (!key) return { ok: false, error: "未填写 API 密钥" };
  if (!model) return { ok: false, error: "未指定模型" };

  const url = provider.baseUrl.replace(/\/+$/, "") + "/chat/completions";
  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    max_tokens: opts.maxTokens ?? 700,
    temperature: opts.temperature ?? 0.8,
    stream: false,
  };
  if (opts.json) body.response_format = { type: "json_object" };

  const timeout = opts.timeoutMs ?? 45000;
  try {
    const resp = await CapacitorHttp.request({
      url,
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      data: body,
      connectTimeout: timeout,
      readTimeout: timeout,
    });
    let data: any = resp.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        /* 非 JSON:原样保留在字符串里 */
      }
    }
    const status = resp.status ?? 0;
    if (status < 200 || status >= 300) {
      return { ok: false, error: humanErr(status, data) };
    }
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return { ok: false, error: "返回内容为空或格式异常" };
    }
    const u = data?.usage ?? {};
    const prompt = Number(u.prompt_tokens) || 0;
    const completion = Number(u.completion_tokens) || 0;
    const cacheHit = Number(u.prompt_cache_hit_tokens) || 0;
    const cacheMiss = Number(u.prompt_cache_miss_tokens) || Math.max(0, prompt - cacheHit);
    let costYuan: number | null = null;
    if (provider.price) {
      costYuan = (cacheHit * provider.price.inHit + cacheMiss * provider.price.inMiss + completion * provider.price.out) / 1e6;
    }
    return { ok: true, content, usage: { prompt, completion, cacheHit, costYuan } };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `网络错误:${m || "无法连接服务商"}` };
  }
}

/** 主调用:检查本月限额 → 请求 → 成功则计数。 */
export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const count = opts.countUsage !== false;
  if (count && !underCap()) {
    return { ok: false, error: "已达你设置的本月调用上限(可在 AI 设置中调整)" };
  }
  const r = await rawChat(opts);
  if (r.ok && count) recordCall();
  return r;
}

/** 测试连接:发一个极小请求,验证密钥/模型/网络。 */
export async function testConnection(provider: Provider, key: string, model: string): Promise<ChatResult> {
  return rawChat({
    provider,
    key,
    model,
    messages: [{ role: "user", content: "ping" }],
    maxTokens: 1,
    temperature: 0,
    timeoutMs: 20000,
    countUsage: false,
  });
}

export interface BalanceResult {
  ok: boolean;
  text?: string; // 友好展示,如 "¥12.34"
  error?: string;
}

/** 查询当前服务商的 key 余额(手动触发;仅部分服务商支持,如 DeepSeek)。不计入调用上限。 */
export async function fetchBalance(provider: Provider, key: string): Promise<BalanceResult> {
  if (!provider.balanceUrl) return { ok: false, error: `${provider.name} 暂不支持余额查询` };
  const k = key.trim();
  if (!k) return { ok: false, error: "未填写 API 密钥" };
  try {
    const resp = await CapacitorHttp.request({
      url: provider.balanceUrl,
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${k}` },
      connectTimeout: 20000,
      readTimeout: 20000,
    });
    let data: any = resp.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        /* 保留字符串 */
      }
    }
    const status = resp.status ?? 0;
    if (status < 200 || status >= 300) return { ok: false, error: humanErr(status, data) };
    // DeepSeek: { is_available, balance_infos: [{ currency, total_balance, ... }] }
    const info = data?.balance_infos?.[0];
    if (info && info.total_balance != null) {
      const sym = info.currency === "CNY" ? "¥" : info.currency === "USD" ? "$" : `${info.currency ?? ""} `;
      const avail = data?.is_available === false ? "(余额不足)" : "";
      return { ok: true, text: `${sym}${info.total_balance}${avail}` };
    }
    return { ok: false, error: "未返回余额信息" };
  } catch {
    return { ok: false, error: "网络错误,请稍后重试" };
  }
}

/** 分钱级成本的友好展示。 */
export function fmtCost(u?: ChatUsage): string {
  if (!u) return "";
  const tok = `${u.prompt + u.completion} tokens`;
  if (u.costYuan == null) return tok;
  const y = u.costYuan;
  const money = y < 0.01 ? `≈¥${y.toFixed(4)}` : `≈¥${y.toFixed(3)}`;
  return `${tok} · ${money}`;
}
