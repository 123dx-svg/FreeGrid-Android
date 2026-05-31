<script lang="ts">
  import { store } from "./store.svelte";
  import { deriveDashboard } from "./derive";

  // 一个 now 贯穿全程,避免跨午夜漂移(与 Dashboard 同口径)
  const now = new Date();
  // 响应式:store 变(导入/记账/删除)→ vm 及所有派生量自动重算
  const vm = $derived(deriveDashboard(store, now));

  interface CheckItem {
    title: string;
    done: boolean;
  }

  // 8 项自检 — 顺序 / 阈值 / 文案 1:1 移植自 iOS CheckView
  // 全部走 deriveDashboard 的派生量;自由天数含被动,跟 Dashboard hero 一致
  const items = $derived<CheckItem[]>([
    { title: "记录天数超过 30 天", done: vm.trackDays >= 30 },
    { title: "了解自己的日均消费", done: vm.trackDays >= 7 && vm.dailyBurn > 0 },
    { title: "记录了可变现资产", done: vm.netWorth > 0 },
    { title: "自由天数超过 180 天", done: vm.freedomDays >= 180 },
    { title: "自由天数超过 365 天", done: vm.freedomDays >= 365 },
    { title: "有被动收入来源", done: store.passiveSources.length > 0 },
    { title: "被动覆盖率超过 50%", done: vm.passiveRatio >= 0.5 },
    { title: "被动收入覆盖日常消费 (≥100%)", done: vm.passiveRatio >= 1.0 },
  ]);

  const completed = $derived(items.filter((i) => i.done).length);
  const progress = $derived(completed / items.length);
  const pct = $derived(Math.round(progress * 100));
</script>

<div class="check">
  <header class="page-head">
    <p class="kicker">CHECK</p>
    <h1>自检清单</h1>
  </header>

  <div class="cols">
    <!-- ───── Hero 进度卡 ───── -->
    <section class="vault-card hi hero" class:glow={true}>
      <span class="kicker">FREEDOM CHECKLIST</span>

      <div class="hero-row">
        <span class="hero-num num">{completed}</span>
        <span class="hero-den num">/ {items.length}</span>
        <span class="hero-pct num">{pct}%</span>
      </div>

      <div class="bar">
        <div class="bar-fill" style="width: {Math.max(2, progress * 100)}%"></div>
      </div>

      <p class="hero-cap">达成项越多,离<span class="accent">财富自由</span>越近</p>
    </section>

    <!-- ───── 8 项清单卡 ───── -->
    <section class="vault-card list">
      {#each items as item, idx}
        {#if idx > 0}<hr class="hairline soft row-div" />{/if}
        <div class="row">
          <span class="mark" class:done={item.done}>
            {#if item.done}<span class="tick">✓</span>{/if}
          </span>
          <div class="row-text">
            <span class="row-title" class:done={item.done}>{idx + 1}. {item.title}</span>
            <span class="row-status" class:done={item.done}>{item.done ? "已达成" : "未达成"}</span>
          </div>
        </div>
      {/each}
    </section>
  </div>

  <p class="footnote">自检规则源自早期 web 版 · 数据从记录自动反推,不需手动勾选</p>
</div>

<style>
  .check {
    display: flex;
    flex-direction: column;
    gap: var(--sp-lg);
    max-width: 1080px;
    margin: 0 auto;
  }

  .page-head {
    margin-bottom: var(--sp-xs);
  }
  .page-head h1 {
    font-size: 30px;
    font-weight: 500;
    margin: 4px 0 0;
    letter-spacing: -0.01em;
  }

  /* 桌面双列:hero 在左,清单在右 */
  .cols {
    display: grid;
    grid-template-columns: 0.85fr 1.15fr;
    gap: var(--sp-lg);
    align-items: start;
  }

  /* ── Hero ── */
  .hero {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
    position: relative;
    overflow: hidden;
    padding: var(--sp-2xl) var(--sp-xl);
  }
  .hero.glow::before {
    content: "";
    position: absolute;
    top: -40%;
    right: -10%;
    width: 60%;
    height: 160%;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--sky) 16%, transparent), transparent);
    pointer-events: none;
  }
  .hero-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
    position: relative;
  }
  .hero-num {
    font-size: 56px;
    line-height: 1;
    font-weight: 100;
    letter-spacing: -0.02em;
    color: var(--ink);
  }
  .hero-den {
    font-size: 22px;
    font-weight: 100;
    color: var(--ink-faint);
  }
  .hero-pct {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 16px;
    color: var(--sky-deep);
  }
  .bar {
    position: relative;
    height: 4px;
    border-radius: 999px;
    background: var(--hairline);
    overflow: hidden;
  }
  .bar-fill {
    position: absolute;
    inset: 0 auto 0 0;
    height: 100%;
    border-radius: 999px;
    background: var(--sky-deep);
    transition: width 0.4s ease;
  }
  .hero-cap {
    font-size: 13px;
    color: var(--ink-faint);
    margin: 0;
  }
  .accent {
    font-family: ui-serif, Georgia, "Songti SC", "STSong", serif;
    font-style: italic;
    color: var(--sky-deep);
    padding: 0 1px;
  }

  /* ── 清单 ── */
  .list {
    padding: var(--sp-sm) var(--sp-xl);
  }
  .row {
    display: flex;
    align-items: flex-start;
    gap: var(--sp-md);
    padding: var(--sp-md) 0;
  }
  .row-div {
    /* 左缩进对齐到文字起点(mark 18 + gap 12 = 30);width:auto 让右端仍贴卡片内缘,
       不能用 .hairline 的 width:100% + margin-left —— 那会让线右溢出 30px。 */
    width: auto;
    margin: 0 0 0 30px;
  }
  .mark {
    flex: none;
    width: 18px;
    height: 18px;
    margin-top: 1px;
    border-radius: 999px;
    border: 1.2px solid color-mix(in srgb, var(--ink-faint) 60%, transparent);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .mark.done {
    border-color: var(--sky-deep);
  }
  .tick {
    font-size: 10px;
    font-weight: 600;
    line-height: 1;
    color: var(--sky-deep);
  }
  .row-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .row-title {
    font-size: 14px;
    color: var(--ink-muted);
  }
  .row-title.done {
    color: var(--ink);
    text-decoration: line-through;
    text-decoration-color: var(--ink-faint);
  }
  .row-status {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.05em;
    color: var(--ink-faint);
  }
  .row-status.done {
    color: var(--sky-deep);
  }

  /* ── footnote ── */
  .footnote {
    font-size: 12px;
    color: var(--ink-faint);
    text-align: center;
    margin: var(--sp-xs) 0 0;
  }

  @media (max-width: 820px) {
    .cols {
      grid-template-columns: 1fr;
    }
    .hero-num {
      font-size: 48px;
    }
  }
</style>
