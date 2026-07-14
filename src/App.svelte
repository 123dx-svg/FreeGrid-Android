<script lang="ts">
  import Sidebar from "./lib/Sidebar.svelte";
  import Dashboard from "./lib/Dashboard.svelte";
  import Assets from "./lib/Assets.svelte";
  import History from "./lib/History.svelte";
  import Check from "./lib/Check.svelte";
  import BadgeToast from "./lib/components/BadgeToast.svelte";
  import LevelUpToast from "./lib/components/LevelUpToast.svelte";
  import { store, initStore } from "./lib/store.svelte";
  import { deriveDashboard } from "./lib/derive";
  import { loadFqResult } from "./lib/fq-test";
  import { reconcileFromData } from "./lib/achievements.svelte";
  import { updateFreedomWidget } from "./lib/widget";
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
      // 省电:原生前后台切换(比 WebView visibilitychange 更可靠)→ 暂停/恢复动画
      // 显式设初始值,防因 data-idle 悬空导致 CSS 选择器误匹配
      document.documentElement.setAttribute("data-idle", "0");
      CapApp.addListener("appStateChange", ({ isActive }) => {
        document.documentElement.setAttribute("data-idle", isActive ? "0" : "1");
      });
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
  $effect(() => {
    const el = document.documentElement;
    if (settings.skin) el.setAttribute("data-skin", settings.skin);
    else el.removeAttribute("data-skin");
  });

  // ── 省电:页面隐藏(息屏 / 切后台)时暂停所有 CSS 装饰动画,避免仪表盘星空 /
  //    流星 / 辉光在没人看时白烧 GPU;`data-idle` 由 app.css 一键 paused,恢复无缝续播。
  //    原生用 appStateChange(见下方 CapApp 块,可靠);web 用 visibilitychange。
  //    ⚠ 原生 WebView 的 visibilitychange 在 resume 后可能仍报 hidden → 会把动画卡死,故原生不用它。
  $effect(() => {
    if (Capacitor.isNativePlatform()) return;
    const onVis = () => {
      document.documentElement.setAttribute("data-idle", document.hidden ? "1" : "0");
    };
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  });

  // ── 财务状态模式(求生 / 临界)：驱动全局 data-mode + 顶部警戒条 ──
  const dashVm = $derived(deriveDashboard(store));
  const appMode = $derived(dashVm.state); // free | normal | warning | survival
  const warnDays = $derived(Math.floor(dashVm.freedomDays));
  $effect(() => {
    const el = document.documentElement;
    if (appMode === "survival" || appMode === "warning") el.setAttribute("data-mode", appMode);
    else el.removeAttribute("data-mode");
  });

  // ── 成就徽章:全局对账(随 store 变化 → 记账/改资产/导入等任何入口解锁都即时触发)──
  $effect(() => {
    const vm = deriveDashboard(store);
    reconcileFromData({
      trackDays: vm.trackDays,
      netWorth: vm.netWorth,
      freedomDays: vm.freedomDays,
      passiveRatio: vm.passiveRatio,
      expenses: store.expenses,
      incomes: store.incomes,
      passiveCount: store.passiveSources.length,
      fqDone: loadFqResult() != null,
    });
    // 桌面小部件:把最新自由时间快照推给原生(记账/改资产/导入后刷新)
    updateFreedomWidget(vm, store.expenses.length + store.incomes.length > 0 || vm.netWorth !== 0);
  });

  // ── 流水页悬浮:回顶 + 当前年月胶囊(main 是滚动容器)──
  let mainEl: HTMLElement | undefined = $state();
  let showTop = $state(false); // 滚过阈值 → 显示回顶
  let curMonth = $state(""); // 当前视口顶部所属年月
  let capsuleOn = $state(false);
  let rafPending = false;
  let capsuleTimer: ReturnType<typeof setTimeout> | null = null;

  function onMainScroll() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      if (!mainEl || tab !== "history") return;
      const st = mainEl.scrollTop;
      showTop = st > 600;
      if (st > 200) {
        // 探测视口顶部附近那一行(O(1),不遍历上百行)
        const el = document.elementFromPoint(Math.round(window.innerWidth / 2), 132) as HTMLElement | null;
        const row = el?.closest?.("[data-month]") as HTMLElement | null;
        const m = row?.getAttribute("data-month");
        if (m) {
          curMonth = m;
          capsuleOn = true;
          if (capsuleTimer) clearTimeout(capsuleTimer);
          capsuleTimer = setTimeout(() => (capsuleOn = false), 1000);
        }
      } else {
        capsuleOn = false;
      }
    });
  }
  function scrollMainTop() {
    mainEl?.scrollTo({ top: 0, behavior: "smooth" });
  }
  $effect(() => {
    if (tab !== "history") {
      showTop = false;
      capsuleOn = false;
    }
  });

</script>

{#if appMode === "survival" || appMode === "warning"}
  <div class="mode-bar" class:survival={appMode === "survival"} class:warning={appMode === "warning"} role="status">
    <span class="mode-bar-dot"></span>
    {#if appMode === "survival"}
      求生模式 · 净值已见底,先回正
    {:else}
      临界 · 自由跑道只剩 {warnDays} 天
    {/if}
  </div>
{/if}

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

  <main bind:this={mainEl} onscroll={onMainScroll}>
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

  <!-- 流水页:当前年月胶囊 + 回到顶部(仅 history) -->
  {#if tab === "history"}
    <div class="hist-capsule" class:on={capsuleOn} aria-hidden="true">{curMonth}</div>
    <button class="hist-top" class:on={showTop} onclick={scrollMainTop} aria-label="回到顶部">
      <svg viewBox="0 0 24 24"><path d="M12 19V6M6 12l6-6 6 6" /></svg>
    </button>
  {/if}

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

<!-- 徽章解锁庆祝浮层(全局) -->
<BadgeToast onOpenWall={() => (tab = "check")} />
<LevelUpToast onOpen={() => (tab = "check")} />

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

  /* ── 流水悬浮:回顶 + 年月胶囊 ── */
  .hist-top {
    position: fixed;
    right: 18px;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 78px);
    z-index: 900;
    width: 46px;
    height: 46px;
    border-radius: 999px;
    border: 1px solid var(--hairline);
    background: color-mix(in srgb, var(--mist) 88%, transparent);
    backdrop-filter: blur(8px);
    color: var(--ink);
    display: grid;
    place-items: center;
    cursor: pointer;
    box-shadow: 0 6px 18px -6px color-mix(in srgb, #000 55%, transparent);
    opacity: 0;
    transform: translateY(14px) scale(0.9);
    pointer-events: none;
    transition: opacity 0.2s ease, transform 0.2s ease;
  }
  .hist-top.on {
    opacity: 1;
    transform: translateY(0) scale(1);
    pointer-events: auto;
  }
  .hist-top svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .hist-capsule {
    position: fixed;
    top: calc(env(safe-area-inset-top, 0px) + 8px);
    left: 50%;
    z-index: 900;
    padding: 6px 16px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--ink) 82%, transparent);
    color: var(--paper);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
    box-shadow: 0 6px 18px -6px color-mix(in srgb, #000 60%, transparent);
    opacity: 0;
    transform: translate(-50%, -8px);
    pointer-events: none;
    transition: opacity 0.2s ease, transform 0.2s ease;
  }
  .hist-capsule.on {
    opacity: 1;
    transform: translate(-50%, 0);
  }
  @media (prefers-reduced-motion: reduce) {
    .hist-top,
    .hist-capsule {
      transition: opacity 0.2s ease;
      transform: none;
    }
    .hist-top.on,
    .hist-capsule.on {
      transform: none;
    }
    .hist-capsule,
    .hist-capsule.on {
      transform: translateX(-50%);
    }
  }
</style>
