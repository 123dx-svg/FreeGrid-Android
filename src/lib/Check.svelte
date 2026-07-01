<script lang="ts">
  import { store } from "./store.svelte";
  import { deriveDashboard } from "./derive";
  import FqTest from "./components/FqTest.svelte";
  import FqEmblem from "./components/FqEmblem.svelte";
  import BadgeWall from "./components/BadgeWall.svelte";
  import Settings from "./components/Settings.svelte";
  import { hasProfile } from "./settings.svelte";
  import { loadFqResult, composeResult, type FqStored } from "./fq-test";

  // 一个 now 贯穿全程,避免跨午夜漂移(与 Dashboard 同口径)
  const now = new Date();
  const vm = $derived(deriveDashboard(store, now));

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
          <span class="fqc-title">财商人格测试 · 随机 50 题</span>
          <span class="fqc-sub">3 分钟测出你的财商人格 + 财商分</span>
        </div>
      </div>
      <button class="fqc-start" onclick={() => openTest(true)}>开始测试 →</button>
    {/if}
  </section>

  <!-- ───── 成就徽章墙 ───── -->
  <section class="vault-card hi bw-sec">
    <span class="kicker">ACHIEVEMENTS · 成就墙</span>
    <p class="bw-intro">每达成一个里程碑,点亮一枚徽章 —— 记录、储蓄、资产、自由,一步步收集你的财富勋章。</p>
    <BadgeWall />
  </section>

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

  /* ── 成就徽章墙区 ── */
  .bw-sec {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
    padding: var(--sp-xl);
  }
  .bw-intro {
    font-size: 13px;
    line-height: 1.6;
    color: var(--ink-muted);
    margin: 0;
  }
</style>
