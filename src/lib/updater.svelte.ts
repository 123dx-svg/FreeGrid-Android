// ============================================================================
// 桌面端(Tauri)更新。设计目标:同一份 bundle 也发到 freegrid-web.pages.dev,
// 因此**网页端必须零副作用** —— 用 __TAURI_INTERNALS__ 运行时守卫 + 动态 import,
// 浏览器里既不加载插件代码、也不调用任何 Tauri API。
// 流程:启动静默 check() + Assets 页手动「检查更新」按钮,有新版则下载安装并 relaunch。
// ============================================================================

export const updateState = $state<{
  available: boolean;
  version: string;
  status: "idle" | "checking" | "downloading" | "uptodate" | "error";
  error: string;
}>({ available: false, version: "", status: "idle", error: "" });

// 保存 check() 返回的 Update 句柄,供后续 downloadAndInstall 用
let _update: { version: string; downloadAndInstall: () => Promise<void> } | null = null;

function detectTauri(): boolean {
  try {
    return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  } catch {
    return false;
  }
}

/** 是否运行在 Tauri 桌面壳内(模块加载时定一次)。UI 据此决定是否显示「检查更新」。 */
export const isTauri = detectTauri();

/** 检查更新。启动时静默调一次,Assets 页按钮也调它。网页端直接 return,绝不触发 Tauri 行为。 */
export async function checkForUpdate(): Promise<void> {
  if (!isTauri) return;
  try {
    updateState.status = "checking";
    updateState.error = "";
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (update) {
      _update = update;
      updateState.available = true;
      updateState.version = update.version;
      updateState.status = "idle";
    } else {
      updateState.status = "uptodate"; // 检查成功且无新版 → 按钮显示"已是最新"
    }
  } catch (e) {
    updateState.status = "error"; // 连不上更新服务器(墙/离线)→ 按钮显式报错,不再静默
    updateState.error = String(e);
  }
}

/** 下载 + 安装 + 重启。 */
export async function installUpdate(): Promise<void> {
  if (!_update || !isTauri) return;
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
