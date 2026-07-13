// ============================================================================
// AI 服务商注册表 —— 全部走 OpenAI 兼容的 /chat/completions,一套客户端通吃。
// 新增服务商 = 往下加一条。当前仅 DeepSeek 已验证,其余为「预留」(接口一致,未逐一实测)。
// 隐私:所有请求都由用户自带密钥(BYOK)直连服务商,应用本身无服务器、不中转。
// ============================================================================

export type ProviderId = "deepseek" | "qwen" | "doubao" | "hunyuan";

export interface Provider {
  id: ProviderId;
  name: string; // 显示名
  /** OpenAI 兼容基址(不含 /chat/completions)。 */
  baseUrl: string;
  defaultModel: string;
  models: string[]; // 备选模型(可自填)
  keyUrl: string; // 获取密钥的官网
  keyHint: string; // 密钥/模型填写提示
  status: "current" | "reserved"; // current=本期已验证;reserved=预留(未逐一实测)
  /** 该服务商是否在 usage 里返回缓存命中字段(仅用于成本展示)。 */
  reportsCacheTokens: boolean;
  /** 余额查询接口(GET,Bearer key);仅部分服务商支持。DeepSeek 返回 balance_infos[]。 */
  balanceUrl?: string;
  /** 约当价格(元/百万 token),仅用于「预估花费」展示,可能过时,以官网为准。 */
  price?: { inMiss: number; inHit: number; out: number };
}

export const PROVIDERS: Provider[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    keyUrl: "https://platform.deepseek.com/api_keys",
    keyHint: "在 DeepSeek 开放平台创建以 sk- 开头的 API Key",
    status: "current",
    reportsCacheTokens: true,
    balanceUrl: "https://api.deepseek.com/user/balance",
    price: { inMiss: 1, inHit: 0.1, out: 2 },
  },
  {
    id: "qwen",
    name: "通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    models: ["qwen-plus", "qwen-turbo", "qwen-max"],
    keyUrl: "https://bailian.console.aliyun.com/",
    keyHint: "阿里云百炼(DashScope)控制台创建 API Key",
    status: "reserved",
    reportsCacheTokens: false,
  },
  {
    id: "doubao",
    name: "豆包 Doubao",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-seed-1-6-250615",
    models: ["doubao-seed-1-6-250615"],
    keyUrl: "https://console.volcengine.com/ark",
    keyHint: "火山方舟控制台;模型处可填模型名或推理接入点 ID(ep- 开头)",
    status: "reserved",
    reportsCacheTokens: false,
  },
  {
    id: "hunyuan",
    name: "腾讯混元",
    baseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
    defaultModel: "hunyuan-turbos-latest",
    models: ["hunyuan-turbos-latest", "hunyuan-lite"],
    keyUrl: "https://console.cloud.tencent.com/hunyuan/api-key",
    keyHint: "腾讯云混元控制台创建 API Key",
    status: "reserved",
    reportsCacheTokens: false,
  },
];

export function providerById(id: ProviderId): Provider {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}
