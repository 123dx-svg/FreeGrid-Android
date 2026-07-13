// ============================================================================
// 原生持久化镜像 —— 把全部 `freegrid-*` localStorage 键镜像到 App 私有目录的一份 JSON,
// 并在启动时把 localStorage 里"缺失"的键自动补回。目标:即便系统清掉 WebView 存储,
// `install -r` 升级后数据也不丢(升级本就保留,这是双保险 + 抗 WebView 清理)。
// 仅原生平台生效;web/桌面为 no-op。全程本机、不联网、不进任何导出。
// ============================================================================
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { App } from "@capacitor/app";
import { APP_DATA_KEYS, snapshot, restore } from "./backup-full";

const FILE = "freegrid-mirror.json";
const isNative = Capacitor.isNativePlatform();

/** 立即把当前全部数据写入镜像文件。 */
export async function mirrorNow(): Promise<void> {
  if (!isNative) return;
  try {
    await Filesystem.writeFile({
      path: FILE,
      directory: Directory.Data,
      data: JSON.stringify(snapshot(APP_DATA_KEYS)),
      encoding: Encoding.UTF8,
    });
  } catch {
    /* 写盘失败忽略,不影响使用 */
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
function scheduleMirror(): void {
  if (!isNative) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void mirrorNow(), 800);
}

/**
 * 启动时调用一次(在挂载 App、任何状态模块读 localStorage 之前 await)。
 * 读镜像 → 只补 localStorage 缺失的键(不覆盖已有数据)。
 */
export async function bootRestore(): Promise<void> {
  if (!isNative) return;
  try {
    const res = await Filesystem.readFile({ path: FILE, directory: Directory.Data, encoding: Encoding.UTF8 });
    const raw = typeof res.data === "string" ? res.data : "";
    if (!raw) return;
    const obj = JSON.parse(raw);
    restore(obj, { overwrite: false }); // 只补缺失,绝不覆盖
  } catch {
    /* 无镜像文件(首次)或解析失败:跳过 */
  }
}

let installed = false;
/**
 * 给 localStorage 写入打补丁:凡 `freegrid-*` 键变更 → 防抖同步镜像;
 * 并在 App 退到后台时立即写一次;启动补写一次当前态。
 */
export function installMirror(): void {
  if (!isNative || installed) return;
  installed = true;
  try {
    const rawSet = localStorage.setItem.bind(localStorage);
    const rawRemove = localStorage.removeItem.bind(localStorage);
    localStorage.setItem = (key: string, value: string) => {
      rawSet(key, value);
      if (typeof key === "string" && key.startsWith("freegrid-")) scheduleMirror();
    };
    localStorage.removeItem = (key: string) => {
      rawRemove(key);
      if (typeof key === "string" && key.startsWith("freegrid-")) scheduleMirror();
    };
  } catch {
    /* 某些环境不允许改写 localStorage 方法:退化为仅 pause + 启动镜像 */
  }
  App.addListener("pause", () => {
    void mirrorNow();
  }).catch(() => {});
  scheduleMirror();
}
