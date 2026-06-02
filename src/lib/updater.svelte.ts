// ============================================================================
// 桌面端(Tauri)自动更新。设计目标:同一份 bundle 也发到 freegrid-web.pages.dev,
// 因此**网页端必须零副作用** —— 用 __TAURI_INTERNALS__ 运行时守卫 + 动态 import,
// 浏览器里既不加载插件代码、也不调用任何 Tauri API。
// 流程:启动静默 check() → 有新版则暴露状态给 UI 横幅 → 用户点"更新并重启"下载安装并 relaunch。
// ============================================================================

export const updateState = $state<{
  available: boolean;
  version: string;
  status: "idle" | "checking" | "downloading" | "error";
  error: string;
}>({ available: false, version: "", status: "idle", error: "" });

// 保存 check() 返回的 Update 句柄,供后续 downloadAndInstall 用(any:避免在 web 端静态依赖类型)
let _update: { version: string; downloadAndInstall: () => Promise<void> } | null = null;

/** 是否运行在 Tauri 桌面壳内。版本无关的稳健判断(不依赖会随小版本漂移的 isTauri 导出)。 */
function inTauri(): boolean {
  try {
    return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  } catch {
    return false;
  }
}

/** 启动时调用一次。网页端直接 return,绝不触发任何 Tauri 行为。 */
export async function checkForUpdate(): Promise<void> {
  if (!inTauri()) return;
  try {
    updateState.status = "checking";
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (update) {
      _update = update;
      updateState.available = true;
      updateState.version = update.version;
    }
    updateState.status = "idle";
  } catch (e) {
    updateState.status = "error";
    updateState.error = String(e);
  }
}

/** 用户点「更新并重启」:下载 + 安装 + 重启。 */
export async function installUpdate(): Promise<void> {
  if (!_update || !inTauri()) return;
  try {
    updateState.status = "downloading";
    await _update.downloadAndInstall();
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch (e) {
    updateState.status = "error";
    updateState.error = String(e);
  }
}
