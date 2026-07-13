// ============================================================================
// 完整数据快照 —— 覆盖全部 `freegrid-*` localStorage 键(资产/收支/徽章/财商/等级/设置)。
// 两处复用:① native-mirror 的"升级不丢·启动自动恢复";② 设置里"换机迁移·一键导入/导出"。
// 纯 localStorage 操作,不 import 任何状态模块(保证可在 App 挂载前安全调用)。
// ============================================================================

/** 全部会持久化的应用数据键(镜像用,含 AI 配置——在本机,丢了可惜)。 */
export const APP_DATA_KEYS = [
  "freegrid-data-v1", // 资产 + 收支(主数据)
  "freegrid-badges-v1", // 成就墙徽章
  "freegrid-fq-v1", // 财商人格结果
  "freegrid-fq-progress-v1", // 财商测试进度
  "freegrid-level-v1", // 经营等级
  "freegrid-settings-v1", // 设置 / 个人档案 / 模板
  "freegrid-theme", // 旧主题(遗留)
  "freegrid-ai-v1", // AI 配置(含 API 密钥)
] as const;

/** 用户"完整备份"导出用的键:刻意**排除 AI 配置**(密钥不进明文备份文件)。 */
export const EXPORT_KEYS = APP_DATA_KEYS.filter((k) => k !== "freegrid-ai-v1");

/** 读取给定键的当前值 → 普通对象(缺失键不写入)。 */
export function snapshot(keys: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) {
    try {
      const v = localStorage.getItem(k);
      if (v != null) out[k] = v;
    } catch {
      /* 忽略单键读失败 */
    }
  }
  return out;
}

/**
 * 把快照写回 localStorage。
 * - `overwrite:false`(镜像恢复):只补 localStorage 里**缺失**的键,不动已有数据。
 * - `overwrite:true`(用户完整导入):整机替换,覆盖同名键。
 * 只接受 `freegrid-` 前缀键(防越权写其它键)。
 */
export function restore(obj: Record<string, unknown>, opts: { overwrite: boolean }): number {
  let n = 0;
  if (!obj || typeof obj !== "object") return 0;
  for (const [k, v] of Object.entries(obj)) {
    if (!k.startsWith("freegrid-")) continue;
    if (typeof v !== "string") continue;
    try {
      if (!opts.overwrite && localStorage.getItem(k) != null) continue;
      localStorage.setItem(k, v);
      n++;
    } catch {
      /* 配额/写失败忽略 */
    }
  }
  return n;
}

/** 完整备份文件外壳的类型(kind 用于导入时识别)。 */
export interface FullBackup {
  app: "freegrid";
  kind: "freegrid-full";
  version: number;
  exportedAt: string;
  keys: Record<string, string>;
}

/** 组装一份完整备份对象(不含 AI 配置)。 */
export function buildFullBackup(): FullBackup {
  return {
    app: "freegrid",
    kind: "freegrid-full",
    version: 1,
    exportedAt: new Date().toISOString(),
    keys: snapshot(EXPORT_KEYS),
  };
}

/** 解析并校验完整备份文件文本;非该格式返回 null。 */
export function parseFullBackup(text: string): FullBackup | null {
  try {
    const o = JSON.parse(text);
    if (o && o.kind === "freegrid-full" && o.keys && typeof o.keys === "object") return o as FullBackup;
  } catch {
    /* 非 JSON */
  }
  return null;
}
