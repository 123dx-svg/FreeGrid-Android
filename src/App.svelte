<script lang="ts">
  import Sidebar from "./lib/Sidebar.svelte";
  import Dashboard from "./lib/Dashboard.svelte";
  import Assets from "./lib/Assets.svelte";
  import History from "./lib/History.svelte";
  import Check from "./lib/Check.svelte";
  import { initStore } from "./lib/store.svelte";
  import { checkForUpdate, installUpdate, updateState } from "./lib/updater.svelte";

  initStore(); // 水合本机存档;无数据则空白起点(不自动种演示数据,仅 ?demo=1 例外)
  checkForUpdate(); // 桌面端静默检查更新;网页端 no-op(__TAURI_INTERNALS__ 守卫)

  let theme = $state<"dark" | "light">("dark");
  let tab = $state("dashboard");

  $effect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  });

  function toggleTheme() {
    theme = theme === "dark" ? "light" : "dark";
  }
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
  <Sidebar current={tab} onNavigate={(t) => (tab = t)} {theme} onToggleTheme={toggleTheme} />
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
