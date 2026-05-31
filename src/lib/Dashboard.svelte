<script lang="ts">
  import { store, addExpense, addIncome } from "./store.svelte";
  import { deriveDashboard } from "./derive";
  import { freedomUnitLabel, freedomDays, freedomDaysDisplay, freedomDaysUnit } from "./freedom-math";
  import { EXPENSE_CATEGORIES } from "./models";
  import Sheet from "./components/Sheet.svelte";
  import Sparkline from "./components/Sparkline.svelte";
  import FreedomGrid from "./components/FreedomGrid.svelte";

  const now = new Date();
  // 响应式:store 变(导入/记账/删除)→ vm 及所有派生量自动重算
  const vm = $derived(deriveDashboard(store, now));

  // ── 录入 sheet:本地状态 ──
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayYMD = () => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  // 'YYYY-MM-DD' → 本地零点 Date(对齐 store 的 parseYMD 口径)
  function ymdToDate(s: string): Date {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  // 记支出
  let showExpense = $state(false);
  let expAmount = $state<number | null>(null);
  let expCategory = $state<string>(EXPENSE_CATEGORIES[0]);
  let expNote = $state("");
  let expDate = $state(todayYMD());
  const expValid = $derived((expAmount ?? 0) > 0);
  function resetExpense() {
    expAmount = null;
    expCategory = EXPENSE_CATEGORIES[0];
    expNote = "";
    expDate = todayYMD();
  }
  function submitExpense() {
    if (!expValid) return;
    addExpense(expAmount!, expCategory, expNote.trim(), ymdToDate(expDate));
    showExpense = false;
    resetExpense();
  }

  // 记收入
  let showIncome = $state(false);
  let incAmount = $state<number | null>(null);
  let incSource = $state("");
  let incNote = $state("");
  let incDate = $state(todayYMD());
  const incValid = $derived((incAmount ?? 0) > 0 && incSource.trim().length > 0);
  function resetIncome() {
    incAmount = null;
    incSource = "";
    incNote = "";
    incDate = todayYMD();
  }
  function submitIncome() {
    if (!incValid) return;
    addIncome(incAmount!, incSource.trim(), false, incNote.trim(), ymdToDate(incDate));
    showIncome = false;
    resetIncome();
  }

  // 模拟一笔(只预览,不写账本 — 对齐 iOS SimulateSheet)
  let showSim = $state(false);
  let simMode = $state<"expense" | "income">("expense");
  let simAmount = $state<number | null>(null);
  const simValid = $derived((simAmount ?? 0) > 0);

  // 实时推演:同 iOS outcome() — 支出抬日均、降净值;收入只加净值。
  const simAfter = $derived.by(() => {
    const x = simAmount ?? 0;
    if (x <= 0) return vm.freedomDays; // 无效输入:维持现状(对齐 iOS hintCard)
    if (simMode === "expense") {
      const newDailyBurn = (vm.totalExpenses + x) / vm.trackDays;
      return freedomDays(vm.netWorth - x, newDailyBurn, vm.dailyPassive);
    }
    return freedomDays(vm.netWorth + x, vm.dailyBurn, vm.dailyPassive);
  });
  // delta:两端任一为 ∞ → "—"(对齐 iOS,floor(∞) 会算出 NaN/-Infinity)
  const simBothFinite = $derived(Number.isFinite(vm.freedomDays) && Number.isFinite(simAfter));
  const simDelta = $derived(Math.trunc(simAfter) - Math.trunc(vm.freedomDays));
  const simNegative = $derived(simBothFinite && simDelta < 0);
  // before/after 各自带正确单位标签(跟 Hero 一样,数字档位由 freedomDaysDisplay 决定,标签须跟上)
  const simBeforeUnit = $derived(freedomUnitLabel(vm.unit));
  const simAfterUnit = $derived(freedomUnitLabel(freedomDaysUnit(simAfter)));
  function resetSim() {
    simMode = "expense";
    simAmount = null;
  }

  const unitLabel = $derived(freedomUnitLabel(vm.unit));
  // 网格用它自己的档位(∞ 态 hero 单位=天,但网格档位=年,标签须跟网格走)
  const gridUnitLabel = $derived(freedomUnitLabel(vm.grid.unit));
  const kicker = $derived(
    vm.unit === "day" ? "FREEDOM DAYS" : vm.unit === "month" ? "FREEDOM MONTHS" : "FREEDOM YEARS"
  );

  const isInf = $derived(!Number.isFinite(vm.freedomDays));
  const weeks = $derived(Math.max(0, vm.history.length - 1));

  function fmtDeplete(d: Date | null): string {
    if (!d) return "";
    return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
  }

  const dailyStr = $derived(vm.dailyBurn.toFixed(1));
  const passiveStr = $derived(`${Math.round(vm.passiveRatio * 100)}%`);
</script>

<div class="dash">
  <header class="page-head">
    <p class="kicker">DASHBOARD</p>
    <h1>自由仪表盘</h1>
  </header>

  <!-- ───── Hero ───── -->
  <section class="vault-card hero" class:glow={true}>
    <!-- 暗色 hero 流星层(移植 iOS MeteorLayer),纯 CSS,亮色自动隐藏 -->
    <div class="meteors" aria-hidden="true">
      <span class="meteor" style="top:8%; left:14%; animation-duration:3.4s; animation-delay:0s"></span>
      <span class="meteor" style="top:2%; left:46%; animation-duration:4.6s; animation-delay:1.1s"></span>
      <span class="meteor" style="top:20%; left:30%; animation-duration:3.0s; animation-delay:2.3s"></span>
      <span class="meteor" style="top:-4%; left:66%; animation-duration:5.2s; animation-delay:0.7s"></span>
      <span class="meteor" style="top:14%; left:80%; animation-duration:3.8s; animation-delay:3.1s"></span>
    </div>
    <div class="hero-main">
      <span class="kicker">{kicker}</span>
      <div class="hero-number num" class:inf={isInf}>{vm.freedomDaysDisplay}</div>
      {#if isInf}
        <p class="hero-sub">你已<span class="accent">财富</span>自由</p>
        <p class="hero-caption moss">按当前日均消费,被动已覆盖</p>
      {:else}
        <p class="hero-sub">你的<span class="accent">自由</span> 还能撑这么多{unitLabel}</p>
        {#if vm.depleteDate}
          <p class="hero-caption">约 {fmtDeplete(vm.depleteDate)} 见底</p>
        {/if}
      {/if}
    </div>

    <div class="hero-side">
      {#if vm.delta}
        {@const up = vm.delta.delta >= 0}
        <div class="trend" class:up class:down={!up}>
          <span class="tri">{up ? "▲" : "▼"}</span>
          <span class="num">{up ? "+" : ""}{vm.delta.delta} d · {weeks}w</span>
        </div>
      {/if}
      {#if vm.history.length >= 3}
        <div class="spark-block">
          <div class="spark-cap">
            <span>{weeks} 周以来的自由天数</span>
            {#if vm.delta}<span class="num">{vm.delta.start} → {vm.delta.end}</span>{/if}
          </div>
          <Sparkline values={vm.history.map((h) => h.freedomDays)} height={56} />
        </div>
      {/if}
    </div>
  </section>

  <!-- ───── Freedom Grid ───── -->
  <section class="vault-card">
    <div class="card-head">
      <span class="kicker">FREEDOM GRID</span>
      <span class="muted num">{vm.grid.count} {gridUnitLabel}</span>
    </div>
    <div class="grid-wrap">
      <FreedomGrid grid={vm.grid} />
    </div>
    <div class="legend">
      <span class="lg"><i class="dot gold"></i>资产</span>
      <span class="lg"><i class="dot blue"></i>现金</span>
      <span class="muted spacer">每格 = 1 {gridUnitLabel}自由</span>
    </div>
  </section>

  <!-- ───── Stats ───── -->
  <section class="stats">
    <div class="vault-card stat">
      <div class="stat-num num">{dailyStr}</div>
      <hr class="hairline soft" />
      <span class="kicker">DAILY</span>
      <span class="stat-sub">元/天</span>
    </div>
    <div class="vault-card stat">
      <div class="stat-num num">{passiveStr}</div>
      <hr class="hairline soft" />
      <span class="kicker">PASSIVE</span>
      <span class="stat-sub">被动覆盖</span>
    </div>
    <div class="vault-card stat">
      <div class="stat-num num">{vm.trackDays}</div>
      <hr class="hairline soft" />
      <span class="kicker">TRACK</span>
      <span class="stat-sub">天追踪</span>
    </div>
  </section>

  <!-- ───── Actions ───── -->
  <section class="actions">
    <button class="vbtn flame" onclick={() => (showExpense = true)}>− 记支出</button>
    <button class="vbtn sky" onclick={() => (showIncome = true)}>+ 记收入</button>
    <button class="vbtn ghost" onclick={() => (showSim = true)}>⚡ 模拟一笔 · 看决策影响 →</button>
  </section>
</div>

<!-- ───── 记支出 sheet ───── -->
<Sheet open={showExpense} title="记支出" onClose={() => (showExpense = false)}>
  <div class="fg-field">
    <label class="fg-label" for="exp-amount">金额 (元)</label>
    <input
      id="exp-amount"
      class="fg-input fg-amount"
      type="number"
      min="0"
      step="0.01"
      inputmode="decimal"
      placeholder="¥ 0.00"
      bind:value={expAmount}
    />
  </div>
  <div class="fg-field">
    <label class="fg-label" for="exp-cat">分类</label>
    <select id="exp-cat" class="fg-select" bind:value={expCategory}>
      {#each EXPENSE_CATEGORIES as cat}
        <option value={cat}>{cat}</option>
      {/each}
    </select>
  </div>
  <div class="fg-field">
    <label class="fg-label" for="exp-note">备注 (可选)</label>
    <input id="exp-note" class="fg-input" type="text" placeholder="比如:跟朋友吃饭" bind:value={expNote} />
  </div>
  <div class="fg-field">
    <label class="fg-label" for="exp-date">日期</label>
    <input id="exp-date" class="fg-input" type="date" bind:value={expDate} />
  </div>
  <button class="fg-btn flame" disabled={!expValid} onclick={submitExpense}>记下这笔支出</button>
</Sheet>

<!-- ───── 记收入 sheet ───── -->
<Sheet open={showIncome} title="记收入" onClose={() => (showIncome = false)}>
  <div class="fg-field">
    <label class="fg-label" for="inc-amount">金额 (元)</label>
    <input
      id="inc-amount"
      class="fg-input fg-amount"
      type="number"
      min="0"
      step="0.01"
      inputmode="decimal"
      placeholder="¥ 0.00"
      bind:value={incAmount}
    />
  </div>
  <div class="fg-field">
    <label class="fg-label" for="inc-source">来源</label>
    <input id="inc-source" class="fg-input" type="text" placeholder="工资 / 副业 / 投资…" bind:value={incSource} />
  </div>
  <div class="fg-field">
    <label class="fg-label" for="inc-note">备注 (可选)</label>
    <input id="inc-note" class="fg-input" type="text" placeholder="比如:三月奖金" bind:value={incNote} />
  </div>
  <div class="fg-field">
    <label class="fg-label" for="inc-date">日期</label>
    <input id="inc-date" class="fg-input" type="date" bind:value={incDate} />
  </div>
  <button class="fg-btn" disabled={!incValid} onclick={submitIncome}>记下这笔收入</button>
</Sheet>

<!-- ───── 模拟一笔 sheet(只预览,不写账本)───── -->
<Sheet
  open={showSim}
  title="模拟决策"
  onClose={() => {
    showSim = false;
    resetSim();
  }}
>
  <p class="sim-banner">不会扣资产,不会写入账本 — 只看这一笔对自由天数的传导。</p>
  <div class="fg-field">
    <span class="fg-label">类型</span>
    <div class="fg-seg">
      <button class:on={simMode === "expense"} onclick={() => (simMode = "expense")}>模拟支出</button>
      <button class:on={simMode === "income"} onclick={() => (simMode = "income")}>模拟收入</button>
    </div>
  </div>
  <div class="fg-field">
    <label class="fg-label" for="sim-amount">{simMode === "expense" ? "假设花掉 (元)" : "假设收入 (元)"}</label>
    <input
      id="sim-amount"
      class="fg-input fg-amount"
      type="number"
      min="0"
      step="0.01"
      inputmode="decimal"
      placeholder="¥ 0.00"
      bind:value={simAmount}
    />
  </div>

  {#if simValid}
    <div class="sim-preview">
      <span class="kicker">自由天数预览</span>
      <div class="sim-row num">
        当前 {vm.freedomDaysDisplay} {simBeforeUnit} → {freedomDaysDisplay(simAfter)} {simAfterUnit}
      </div>
      <div class="sim-delta num" class:neg={simNegative}>
        {#if simBothFinite}
          Δ {simDelta > 0 ? "+" : ""}{simDelta} 天
        {:else}
          Δ —
        {/if}
      </div>
      <p class="sim-caption">
        {simMode === "expense"
          ? "一笔支出净值降、日均升 — 这就是「戴维斯三杀」的体感。"
          : "一笔收入直接给自由天数回血。"}
      </p>
    </div>
  {:else}
    <p class="sim-hint">输入金额 · 实时看决策影响</p>
  {/if}
</Sheet>

<style>
  .dash {
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

  /* ── Hero ── */
  .hero {
    display: grid;
    grid-template-columns: 1.1fr 1fr;
    gap: var(--sp-2xl);
    align-items: center;
    padding: var(--sp-2xl);
    position: relative;
    overflow: hidden;
  }
  .hero.glow::before {
    content: "";
    position: absolute;
    top: -40%;
    left: -10%;
    width: 55%;
    height: 160%;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--sky) 16%, transparent), transparent);
    pointer-events: none;
  }
  /* 流星层:暗色才显示(亮色 opacity 0) */
  .meteors {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    opacity: 0;
    z-index: 0;
  }
  :global(:root[data-theme="dark"]) .meteors {
    opacity: 1;
  }
  .meteor {
    position: absolute;
    width: 86px;
    height: 1px;
    border-radius: 999px;
    background: linear-gradient(90deg, color-mix(in srgb, var(--sky) 92%, white), transparent);
    filter: drop-shadow(0 0 3px var(--sky));
    opacity: 0;
    animation-name: shoot;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
  }
  @keyframes shoot {
    0% {
      opacity: 0;
      transform: translate(-40px, -28px) rotate(32deg);
    }
    12% {
      opacity: 0.9;
    }
    72% {
      opacity: 0.7;
    }
    100% {
      opacity: 0;
      transform: translate(300px, 188px) rotate(32deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .meteor {
      animation: none;
    }
  }
  .hero-main {
    position: relative;
  }
  .hero-number {
    font-size: 132px;
    line-height: 1;
    font-weight: 100;
    letter-spacing: -0.04em;
    margin: var(--sp-sm) 0;
    color: var(--ink);
  }
  .hero-number.inf {
    color: var(--moss);
  }
  .hero-sub {
    font-size: 22px;
    font-weight: 300;
    color: var(--ink);
    margin: var(--sp-xs) 0 0;
  }
  .accent {
    font-family: ui-serif, Georgia, "Songti SC", "STSong", serif;
    font-style: italic;
    color: var(--sky-deep);
    padding: 0 1px;
  }
  .hero-caption {
    font-size: 13px;
    color: var(--ink-faint);
    margin: var(--sp-sm) 0 0;
  }
  .hero-caption.moss {
    color: var(--moss);
  }

  .hero-side {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--sp-lg);
  }
  .trend {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 5px 11px;
    border-radius: 999px;
  }
  .trend .tri {
    font-size: 9px;
  }
  .trend.up {
    color: var(--sky-deep);
    background: color-mix(in srgb, var(--sky-deep) 12%, transparent);
  }
  .trend.down {
    color: var(--flame);
    background: color-mix(in srgb, var(--flame) 12%, transparent);
  }
  .spark-block {
    width: 100%;
  }
  .spark-cap {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: var(--ink-faint);
    margin-bottom: var(--sp-sm);
  }
  .spark-cap .num {
    color: var(--ink);
  }

  /* ── card head / grid ── */
  .card-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: var(--sp-lg);
  }
  .muted {
    color: var(--ink-faint);
    font-size: 13px;
  }
  .grid-wrap {
    margin: var(--sp-sm) 0 var(--sp-lg);
  }
  .legend {
    display: flex;
    align-items: center;
    gap: var(--sp-lg);
    font-size: 13px;
    color: var(--ink-muted);
  }
  .legend .spacer {
    margin-left: auto;
  }
  .lg {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .dot {
    width: 11px;
    height: 11px;
    border-radius: 3px;
    display: inline-block;
  }
  .dot.gold {
    background: var(--income-gold);
  }
  .dot.blue {
    background: var(--asset-blue);
  }

  /* ── stats ── */
  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--sp-lg);
  }
  .stat {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
    padding: var(--sp-lg) var(--sp-xl);
  }
  .stat-num {
    font-size: 40px;
    font-weight: 200;
    line-height: 1;
    color: var(--ink);
  }
  .stat hr {
    margin: 2px 0;
    width: 28px;
  }
  .stat-sub {
    font-size: 13px;
    color: var(--ink-muted);
  }

  /* ── actions ── */
  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr 1.4fr;
    gap: var(--sp-md);
  }
  .vbtn {
    font-family: var(--font-rounded);
    font-size: 15px;
    padding: 14px 18px;
    border-radius: 999px;
    background: transparent;
    border: 1px solid var(--hairline);
    color: var(--ink);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .vbtn:hover {
    background: var(--mist2);
  }
  .vbtn.flame {
    color: var(--flame);
    border-color: color-mix(in srgb, var(--flame) 55%, var(--hairline));
  }
  .vbtn.sky {
    color: var(--sky-deep);
    border-color: color-mix(in srgb, var(--sky-deep) 55%, var(--hairline));
  }
  .vbtn.ghost {
    color: var(--ink-muted);
  }

  /* ── 模拟 sheet ── */
  .sim-banner {
    font-size: 13px;
    color: var(--sky-deep);
    background: color-mix(in srgb, var(--sky) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--sky) 30%, transparent);
    border-radius: 12px;
    padding: 10px 12px;
    margin: 0 0 var(--sp-lg);
  }
  .sim-preview {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
    background: var(--mist2);
    border: 1px solid var(--hairline);
    border-radius: 14px;
    padding: var(--sp-lg);
    margin-top: var(--sp-sm);
  }
  .sim-row {
    font-size: 18px;
    color: var(--ink);
    font-family: var(--font-mono);
  }
  .sim-delta {
    font-size: 15px;
    font-family: var(--font-mono);
    color: var(--sky-deep);
  }
  .sim-delta.neg {
    color: var(--flame);
  }
  .sim-caption {
    font-size: 12px;
    color: var(--ink-faint);
    margin: 2px 0 0;
  }
  .sim-hint {
    text-align: center;
    font-size: 14px;
    color: var(--ink-muted);
    padding: var(--sp-xl) 0;
    margin: 0;
  }

  @media (max-width: 720px) {
    .hero {
      grid-template-columns: 1fr;
    }
    .hero-side {
      align-items: flex-start;
    }
    .stats,
    .actions {
      grid-template-columns: 1fr;
    }
    .hero-number {
      font-size: 100px;
    }
  }
</style>
