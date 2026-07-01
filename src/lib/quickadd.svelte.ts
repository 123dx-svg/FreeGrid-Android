// 桌面图标长按快捷方式 → 记一笔 的跨组件信号。
// App.svelte 解析深链后设置;Dashboard.svelte $effect 监听后打开对应记账 Sheet。
export const quickAdd = $state<{ action: "expense" | "income" | null }>({ action: null });

export function requestQuickAdd(action: "expense" | "income") {
  quickAdd.action = action;
}
