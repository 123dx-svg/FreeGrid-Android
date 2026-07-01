<script lang="ts">
  let {
    current,
    onNavigate,
    theme,
    onToggleTheme,
  }: {
    current: string;
    onNavigate: (tab: string) => void;
    theme: string;
    onToggleTheme: () => void;
  } = $props();

  const nav = [
    { id: "dashboard", label: "Dashboard", zh: "仪表盘" },
    { id: "assets", label: "Assets", zh: "资产" },
    { id: "history", label: "History", zh: "流水" },
    { id: "check", label: "Check", zh: "自检" },
  ];

  const version = __APP_VERSION__; // 构建期注入,单一源 tauri.conf.json

  // 极简 inline 图标(stroke 风,跟 silverline 线条语言一致)
  const icons: Record<string, string> = {
    dashboard: "M3 17l5-5 3 3 7-8",
    assets: "M3 7h18v10H3zM3 11h18",
    history: "M12 7v5l3 2M4 12a8 8 0 1 0 2-5",
    check: "M4 6h10M4 12h10M4 18h10M18 6l2 2 3-3",
  };
</script>

<aside class="sidebar">
  <div class="brand">
    <button class="theme-dot" onclick={onToggleTheme} aria-label="切换主题">
      {#if theme === "dark"}
        <svg viewBox="0 0 24 24" class="ic"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      {:else}
        <span class="sun"></span>
      {/if}
    </button>
    <div class="word">
      <div class="name">自由日记</div>
      <div class="tag">通往财富自由之路</div>
    </div>
  </div>

  <nav>
    {#each nav as item (item.id)}
      <button class="nav-item" class:active={current === item.id} onclick={() => onNavigate(item.id)}>
        <svg viewBox="0 0 24 24" class="nav-ic"><path d={icons[item.id]} /></svg>
        <span class="nav-label">{item.label}</span>
        <span class="nav-zh">{item.zh}</span>
      </button>
    {/each}
  </nav>

  <div class="foot">
    <span class="dot-on"></span>
    本地存储 · 零网络
    <span class="ver num">v{version}</span>
  </div>
</aside>

<style>
  .sidebar {
    width: 248px;
    flex: 0 0 248px;
    height: 100%;
    border-right: 1px solid var(--hairline);
    background: var(--mist);
    display: flex;
    flex-direction: column;
    padding: var(--sp-xl) var(--sp-lg);
    gap: var(--sp-2xl);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
    padding: 0 var(--sp-sm);
  }
  .theme-dot {
    width: 30px;
    height: 30px;
    flex: 0 0 30px;
    border-radius: 999px;
    border: 1px solid var(--ink);
    background: transparent;
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--sky);
  }
  .theme-dot .ic {
    width: 14px;
    height: 14px;
    fill: var(--sky);
  }
  .sun {
    width: 11px;
    height: 11px;
    border-radius: 999px;
    background: var(--sky);
  }
  .word .name {
    font-size: 18px;
    font-weight: 600;
    color: var(--ink);
  }
  .word .tag {
    font-size: 11px;
    color: var(--ink-faint);
    margin-top: 1px;
  }

  nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .nav-item {
    display: flex;
    align-items: center;
    gap: var(--sp-md);
    padding: 11px var(--sp-md);
    border-radius: 12px;
    border: 0;
    background: transparent;
    color: var(--ink-muted);
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .nav-item:hover {
    background: var(--mist2);
    color: var(--ink);
  }
  .nav-item.active {
    background: color-mix(in srgb, var(--sky) 14%, transparent);
    color: var(--sky-deep);
  }
  .nav-ic {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
    flex: 0 0 18px;
  }
  .nav-label {
    font-size: 15px;
    font-weight: 500;
  }
  .nav-zh {
    font-size: 11px;
    color: var(--ink-faint);
    margin-left: auto;
  }
  .nav-item.active .nav-zh {
    color: color-mix(in srgb, var(--sky-deep) 70%, transparent);
  }

  .foot {
    margin-top: auto;
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11px;
    color: var(--ink-faint);
    padding: 0 var(--sp-sm);
  }
  .dot-on {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: var(--moss);
  }
  .ver {
    margin-left: auto;
    font-size: 10px;
    letter-spacing: 0.02em;
    color: var(--ink-ghost);
  }
</style>
