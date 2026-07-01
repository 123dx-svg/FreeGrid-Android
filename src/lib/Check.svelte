<script lang="ts">
  import { store } from "./store.svelte";
  import { deriveDashboard } from "./derive";
  import FqTest from "./components/FqTest.svelte";
  import FqEmblem from "./components/FqEmblem.svelte";
  import Settings from "./components/Settings.svelte";
  import { hasProfile } from "./settings.svelte";
  import { loadFqResult, composeResult, type FqStored } from "./fq-test";

  // 一个 now 贯穿全程,避免跨午夜漂移(与 Dashboard 同口径)
  const now = new Date();
  const vm = $derived(deriveDashboard(store, now));

  // 真·空态:无数据时整张清单都不该评估
  const isEmpty = $derived(store.expenses.length === 0 && store.incomes.length === 0 && vm.netWorth === 0);

  interface CheckItem {
    title: string;
    done: boolean;
  }

  // 8 项自检 — 顺序 / 阈值 / 文案 1:1 移植自 iOS CheckView
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

  // ── 折叠 8 项 ──
  let showChecks = $state(false);

  // ── 财商人格测试 ──
  let showTest = $state(false);
  let testFresh = $state(false);
  let savedStored = $state<FqStored | null>(loadFqResult());

  const totalIncome = $derived(store.incomes.reduce((s, i) => s + i.amount, 0));
  const totalExpense = $derived(store.expenses.reduce((s, e) => s + e.amount, 0));
  const metrics = $derived({
    margin: totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome : 0,
    fiProgress: Math.min(1, vm.passiveRatio),
    freedomDays: vm.freedomDays,
    trackDays: vm.trackDays,
    hasData: store.expenses.length + store.incomes.length > 0,
  });
  const savedResult = $derived(savedStored ? composeResult(savedStored, metrics) : null);

  function openTest(fresh: boolean) {
    testFresh = fresh;
    showTest = true;
  }
  function closeTest() {
    showTest = false;
    savedStored = loadFqResult(); // 测完刷新入口卡
  }

  // ── 个人档案 · 设置 ──
  let showSettings = $state(false);
</script>

<div class="check">
  <header class="page-head">
    <p class="kicker">CHECK</p>
    <h1>自检清单</h1>
  </header>

  <!-- ───── 财商人格测试入口(始终显示)───── -->
  <section class="fq-card vault-card hi">
    {#if savedResult}
      <button class="fqc-row" onclick={() => openTest(false)}>
        <span class="fqc-media"><FqEmblem code={savedResult.code} size={46} /></span>
        <div class="fqc-info">
          <span class="kicker">我的财商人格</span>
          <span class="fqc-name">{savedResult.name} · <span class="num">{savedResult.code}</span></span>
          <span class="fqc-meta num">财商分 {savedResult.fqFinal}</span>
        </div>
        <span class="fqc-go">›</span>
      </button>
    {:else}
      <div class="fqc-row">
        <span class="fqc-media"><FqEmblem code="开进远研" size={46} /></span>
        <div class="fqc-info">
          <span class="fqc-title">财商人格测试 · 50 题</span>
          <span class="fqc-sub">3 分钟测出你的财商人格 + 财商分</span>
        </div>
      </div>
      <button class="fqc-start" onclick={() => openTest(true)}>开始测试 →</button>
    {/if}
  </section>

  <!-- ───── 自检清单 ───── -->
  {#if isEmpty}
    <section class="ck-empty vault-card">
      <span class="kicker">FREEDOM CHECKLIST</span>
      <p class="ck-empty-title">先去记几笔,再来体检</p>
      <p class="ck-empty-sub">自检清单会随你的记录自动点亮 —— 现在还没有数据可评估。到「仪表盘」记下第一笔吧。</p>
    </section>
  {:else}
    <section class="vault-card hi hero" class:glow={true}>
      <span class="kicker">FREEDOM CHECKLIST</span>
      <div class="hero-row">
        <span class="hero-num num">{completed}</span>
        <span class="hero-den num">/ {items.length}</span>
        <span class="hero-pct num">{pct}%</span>
      </div>
      <div class="bar"><div class="bar-fill" style="width: {Math.max(2, progress * 100)}%"></div></div>
      <p class="hero-cap">达成项越多,离<span class="accent">财富自由</span>越近</p>
      <button class="ck-toggle" onclick={() => (showChecks = !showChecks)}>
        {showChecks ? "收起 8 项 ▴" : "展开 8 项自检 ▾"}
      </button>
    </section>

    {#if showChecks}
      <section class="vault-card list">
        {#each items as item, idx (idx)}
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
    {/if}
  {/if}

  <!-- ───── 设置入口(置底 · 低频工具)───── -->
  <button class="set-entry vault-card" onclick={() => (showSettings = true)}>
    <span class="fqc-media set-entry-ic" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M4 7h9M17 7h3M4 17h7M15 17h5" /><circle cx="14" cy="7" r="2.4" /><circle cx="10" cy="17" r="2.4" /></svg>
    </span>
    <div class="set-entry-info">
      <span class="set-entry-title">设置</span>
      <span class="set-entry-sub">{hasProfile() ? "个人档案 · 个性化 · 数据备份 · 关于" : "填档案让分析更懂你 · 个性化 · 数据备份"}</span>
    </div>
    <span class="set-entry-go">›</span>
  </button>

  <FqTest open={showTest} startFresh={testFresh} onClose={closeTest} />
  <Settings open={showSettings} onClose={() => (showSettings = false)} />
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

  /* ── 财商测试入口卡 ── */
  .fq-card {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
    padding: var(--sp-lg) var(--sp-xl);
  }
  .fqc-row {
    display: flex;
    align-items: center;
    gap: var(--sp-lg);
    width: 100%;
    border: 0;
    background: transparent;
    padding: 0;
    text-align: left;
    cursor: pointer;
    color: inherit;
  }
  .fqc-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 0;
  }
  .fqc-title {
    font-size: 17px;
    font-weight: 600;
    color: var(--ink);
  }
  .fqc-sub {
    font-size: 13px;
    color: var(--ink-muted);
    line-height: 1.5;
  }
  .fqc-name {
    font-size: 17px;
    font-weight: 600;
    color: var(--ink);
  }
  .fqc-meta {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--ink-faint);
  }
  .fqc-go {
    flex: 0 0 auto;
    color: var(--ink-faint);
    font-size: 18px;
  }
  .fqc-media {
    flex: 0 0 46px;
    width: 46px;
    height: 46px;
    display: grid;
    place-items: center;
  }
  .set-entry {
    display: flex;
    align-items: center;
    gap: var(--sp-lg);
    width: 100%;
    padding: var(--sp-lg) var(--sp-xl);
    border: 0;
    text-align: left;
    cursor: pointer;
    color: inherit;
    font-family: inherit;
  }
  .set-entry-ic {
    flex: 0 0 auto;
  }
  .set-entry-ic svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: var(--ink-muted);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .set-entry-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 0;
  }
  .set-entry-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--ink);
  }
  .set-entry-sub {
    font-size: 13px;
    color: var(--ink-muted);
    line-height: 1.5;
  }
  .set-entry-go {
    flex: 0 0 auto;
    color: var(--ink-faint);
    font-size: 18px;
  }
  .fqc-start {
    width: 100%;
    padding: 13px;
    border-radius: 999px;
    border: 1px solid var(--sky-deep);
    background: color-mix(in srgb, var(--sky) 16%, transparent);
    color: var(--sky-deep);
    font-family: var(--font-rounded);
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
  }
  .fqc-start:hover {
    background: color-mix(in srgb, var(--sky) 26%, transparent);
  }

  /* ── Hero 进度 ── */
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
    background: radial-gradient(closest-side, color-mix(in srgb, var(--sky) 13%, transparent), transparent 70%);
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
  .ck-toggle {
    align-self: flex-start;
    margin-top: var(--sp-xs);
    border: 0;
    background: transparent;
    color: var(--sky-deep);
    font-family: var(--font-rounded);
    font-size: 13px;
    cursor: pointer;
    padding: 0;
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

  /* ── 空态 ── */
  .ck-empty {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--sp-sm);
    padding: var(--sp-3xl) var(--sp-2xl);
  }
  .ck-empty-title {
    font-size: 22px;
    font-weight: 300;
    color: var(--ink);
    margin: var(--sp-sm) 0 0;
  }
  .ck-empty-sub {
    font-size: 14px;
    line-height: 1.6;
    color: var(--ink-muted);
    max-width: 44ch;
    margin: 0;
  }
</style>
