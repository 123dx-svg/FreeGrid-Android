<script lang="ts">
  import Sidebar from "./lib/Sidebar.svelte";
  import Dashboard from "./lib/Dashboard.svelte";
  import Assets from "./lib/Assets.svelte";
  import History from "./lib/History.svelte";
  import Check from "./lib/Check.svelte";
  import { initStore } from "./lib/store.svelte";
  import { checkForUpdate, installUpdate, updateState } from "./lib/updater.svelte";
  import { settings, resolvedTheme, toggleThemeManual } from "./lib/settings.svelte";
  import { closeTopOverlay } from "./lib/overlay";
  import { requestQuickAdd } from "./lib/quickadd.svelte";
  import { Capacitor } from "@capacitor/core";

  initStore(); // 水合本机存档;无数据则空白起点(不自动种演示数据,仅 ?demo=1 例外)
  checkForUpdate(); // 桌面端静默检查更新;网页端 no-op(__TAURI_INTERNALS__ 守卫)

  let tab = $state(settings.startTab || "dashboard");

  // ── 桌面图标长按快捷方式(深链 freegrid://record/expense|income)──
  function handleQuickUrl(url?: string | null) {
    if (!url) return;
    if (url.includes("record/expense")) {
      tab = "dashboard";
      requestQuickAdd("expense");
    } else if (url.includes("record/income")) {
      tab = "dashboard";
      requestQuickAdd("income");
    }
  }

  // ── 物理返回键(Android):有弹层先关最上层 → 否则非首页回首页 → 首页才退出 ──
  if (Capacitor.isNativePlatform()) {
    import("@capacitor/app").then(({ App: CapApp }) => {
      CapApp.addListener("backButton", () => {
        if (closeTopOverlay()) return;
        if (tab !== "dashboard") {
          tab = "dashboard";
          return;
        }
        CapApp.exitApp();
      });
      // 冷启动(经快捷方式打开)+ 热启动(app 在后台时点快捷方式)
      CapApp.getLaunchUrl().then((r) => handleQuickUrl(r?.url));
      CapApp.addListener("appUrlOpen", (e) => handleQuickUrl(e.url));
    });
  }

  // 移动端底部 tab 栏导航项(与 Sidebar 保持一致)
  const mobileNav = [
    { id: "dashboard", label: "仪表盘" },
    { id: "assets", label: "资产" },
    { id: "history", label: "流水" },
    { id: "check", label: "自检" },
  ];
  const mobileIcons: Record<string, string> = {
    dashboard: "M3 17l5-5 3 3 7-8",
    assets: "M3 7h18v10H3zM3 11h18",
    history: "M12 7v5l3 2M4 12a8 8 0 1 0 2-5",
    check: "M4 6h10M4 12h10M4 18h10M18 6l2 2 3-3",
  };

  $effect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme());
  });
</script>

{#if updateState.available}
  <!-- 仅桌面端会出现(网页端 updateState.available 恒 false,此节点不渲染) -->
  <div class="update-banner" role="status">
    <span class="ub-text">发现新版本 <b>v{updateState.version}</b></span>
    {#if updateState.status === "downloading"}
      <span class="ub-status">下载中,请稍候…</span>
    {:else if updateState.status === "error"}
      <button class="ub-btn" onclick={installUpdate}>更新失败 · 重试</button>
    {:else}
      <button class="ub-btn" onclick={installUpdate}>更新并重启</button>
    {/if}
  </div>
{/if}

<div class="shell">
  <Sidebar current={tab} onNavigate={(t) => (tab = t)} theme={resolvedTheme()} onToggleTheme={toggleThemeManual} />

  <main>
    {#if tab === "dashboard"}
      <Dashboard />
    {:else if tab === "assets"}
      <Assets />
    {:else if tab === "history"}
      <History />
    {:else if tab === "check"}
      <Check />
    {/if}
  </main>

  <!-- 移动端底部 tab 栏(窄屏才显示) -->
  <nav class="mobile-tabs">
    {#each mobileNav as item (item.id)}
      <button class="m-tab" class:active={tab === item.id} onclick={() => (tab = item.id)}>
        <svg viewBox="0 0 24 24" class="m-tab-ic"><path d={mobileIcons[item.id]} /></svg>
        <span class="m-tab-label">{item.label}</span>
      </button>
    {/each}
  </nav>
</div>

<style>
  .shell {
    display: flex;
    height: 100%;
    background: var(--paper);
  }
  main {
    flex: 1;
    overflow-y: auto;
    padding: var(--sp-2xl) var(--sp-2xl) var(--sp-3xl);
  }

  /* 移动端栏默认隐藏(桌面/宽屏不显示) */
  .mobile-tabs {
    display: none;
  }

  /* ============ 移动端布局(窄屏) ============ */
  @media (max-width: 640px) {
    .shell {
      flex-direction: column;
    }
    /* 隐藏桌面侧栏 */
    .shell :global(.sidebar) {
      display: none;
    }

    /* 正文占满全宽;顶部承接状态栏安全区(品牌栏已移除) */
    main {
      padding: calc(env(safe-area-inset-top, 0px) + var(--sp-lg)) var(--sp-lg) var(--sp-xl);
    }

    /* 底部 tab 栏:固定底部,4 等分,贴手势条安全区 */
    .mobile-tabs {
      display: flex;
      flex: 0 0 auto;
      background: var(--mist);
      border-top: 1px solid var(--hairline);
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }
    .m-tab {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      padding: 8px 0 7px;
      border: 0;
      background: transparent;
      color: var(--ink-faint);
      cursor: pointer;
    }
    .m-tab-ic {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.6;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .m-tab-label {
      font-size: 11px;
      font-weight: 500;
    }
    .m-tab.active {
      color: var(--sky-deep);
    }
  }

  /* 自动更新横幅(桌面端;position:fixed 不挤压既有布局,网页端根本不渲染) */
  .update-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: var(--sp-md);
    padding: 9px 16px;
    background: var(--sky-deep);
    color: #fff;
    font-size: 13px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.22);
  }
  .ub-text {
    font-weight: 500;
  }
  .ub-status {
    margin-left: auto;
    opacity: 0.85;
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .ub-btn {
    margin-left: auto;
    font-family: var(--font-rounded);
    font-size: 13px;
    font-weight: 500;
    padding: 5px 14px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.7);
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .ub-btn:hover {
    background: rgba(255, 255, 255, 0.26);
  }
</style>
