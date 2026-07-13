// ============================================================================
// 桌面小部件桥接 —— 把「自由时间」快照发给原生 FreedomWidget 插件。
// 所有格式化都在 JS(单一来源),原生 provider 只渲染。仅原生平台生效。
// ============================================================================
import { Capacitor, registerPlugin } from "@capacitor/core";
import { freedomUnitLabel } from "./freedom-math";
import type { DashboardVM } from "./derive";

interface FreedomWidgetPlugin {
  update(data: {
    state: string; // "normal" | "inf" | "empty"
    kicker: string;
    number: string;
    unit: string;
    sub: string;
  }): Promise<void>;
}

const FreedomWidget = registerPlugin<FreedomWidgetPlugin>("FreedomWidget");

function kickerFor(unit: DashboardVM["unit"]): string {
  return unit === "day" ? "FREEDOM DAYS" : unit === "month" ? "FREEDOM MONTHS" : "FREEDOM YEARS";
}

function fmtDeplete(d: Date | null): string {
  if (!d) return "";
  return `约 ${d.getMonth() + 1} 月 ${d.getDate()} 日见底`;
}

/** 把当前仪表盘的自由时间推给桌面小部件(快照式)。 */
export function updateFreedomWidget(vm: DashboardVM, hasData: boolean): void {
  if (!Capacitor.isNativePlatform()) return;
  const isInf = !Number.isFinite(vm.freedomDays);
  let payload: { state: string; kicker: string; number: string; unit: string; sub: string };
  if (!hasData) {
    payload = { state: "empty", kicker: "FREEDOM", number: "—", unit: "", sub: "打开 App 记一笔" };
  } else if (isInf) {
    payload = { state: "inf", kicker: "FREEDOM", number: "∞", unit: "", sub: "你已财富自由" };
  } else if (vm.state === "survival") {
    const num = vm.shortfall > 0 ? "¥" + Math.round(vm.shortfall).toLocaleString("en-US") : "见底";
    payload = { state: "survival", kicker: "求生模式", number: num, unit: "", sub: "净值见底 · 先回正" };
  } else if (vm.state === "warning") {
    payload = {
      state: "warning",
      kicker: kickerFor(vm.unit),
      number: vm.freedomDaysDisplay,
      unit: freedomUnitLabel(vm.unit),
      sub: `⚠ 只够撑 ${vm.freedomDaysDisplay} 天`,
    };
  } else {
    payload = {
      state: "normal",
      kicker: kickerFor(vm.unit),
      number: vm.freedomDaysDisplay,
      unit: freedomUnitLabel(vm.unit),
      sub: fmtDeplete(vm.depleteDate) || "还能自由这么久",
    };
  }
  try {
    void FreedomWidget.update(payload);
  } catch {
    /* 插件缺失/旧壳:忽略 */
  }
}
