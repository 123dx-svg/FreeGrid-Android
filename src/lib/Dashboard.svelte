<script lang="ts">
  import { store, addExpense, addIncome } from "./store.svelte";
  import { deriveDashboard } from "./derive";
  import { freedomUnitLabel, freedomDaysDisplay, GRID_UNIT_META } from "./freedom-math";
  import { simOutcome, gridUnitFor, cellCountFor, blueCellsFor, simDemoTiming } from "./sim-demo";
  import { EXPENSE_CATEGORIES } from "./models";
  import Sheet from "./components/Sheet.svelte";
  import Sparkline from "./components/Sparkline.svelte";
  import FreedomGrid from "./components/FreedomGrid.svelte";
  import SimDemoGrid from "./components/SimDemoGrid.svelte";

  const now = new Date();
  // 响应式:store 变(导入/记账/删除)→ vm 及所有派生量自动重算
  const vm = $derived(deriveDashboard(store, now));

  // 真·空态:无交易且净值为 0 → 引导记第一笔。
  // 必须连净值一起判 0,别只看 isInf —— "有资产、被动覆盖"也会 ∞,那是合法的财富自由态,不能误当空态。
  const isEmpty = $derived(store.expenses.length === 0 && store.incomes.length === 0 && vm.netWorth === 0);

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

  // 一次模拟的完整结果(KILL/GAIN 表 + 格子推演共用一份,保证数字一致)
  const simOut = $derived(
    simOutcome({
      lockedAssets: vm.lockedAssets,
      cash: vm.cash,
      totalExpenses: vm.totalExpenses,
      trackDays: vm.trackDays,
      dailyPassive: vm.dailyPassive,
      amount: simAmount ?? 0,
      mode: simMode,
    })
  );

  // 金额格式化(千分位 + 指定精度,对齐 iOS formatYuan)
  const yuan = (v: number, p = 0) =>
    "¥" + new Intl.NumberFormat("en-US", { minimumFractionDigits: p, maximumFractionDigits: p }).format(v);

  // 戴维斯三杀 / 自由增长 影响行(对齐 iOS expensePreview / incomePreview)
  type KillRow = { label: string; from: string; to: string; delta: string };
  const killRows = $derived.by<KillRow[]>(() => {
    const o = simOut;
    const amt = simAmount ?? 0;
    if (simMode === "expense") {
      const loss = Number.isFinite(o.currentFreedom) ? o.currentFreedom - o.newFreedom : 0;
      return [
        { label: "KILL 1 净值", from: yuan(o.currentNW), to: yuan(o.newNW), delta: "−" + yuan(amt) },
        {
          label: "KILL 2 日均",
          from: yuan(o.currentAvg, 1),
          to: yuan(o.newAvg, 2),
          delta: "+" + yuan(o.newAvg - o.currentAvg, 2),
        },
        {
          label: "KILL 3 自由天数",
          from: freedomDaysDisplay(o.currentFreedom),
          to: freedomDaysDisplay(o.newFreedom),
          delta: Number.isFinite(o.currentFreedom) ? "−" + Math.round(loss) + " 天" : "—",
        },
      ];
    }
    const gain =
      Number.isFinite(o.currentFreedom) && Number.isFinite(o.newFreedom) ? o.newFreedom - o.currentFreedom : 0;
    return [
      { label: "GAIN 1 净值", from: yuan(o.currentNW), to: yuan(o.newNW), delta: "+" + yuan(amt) },
      {
        label: "GAIN 2 自由天数",
        from: freedomDaysDisplay(o.currentFreedom),
        to: freedomDaysDisplay(o.newFreedom),
        delta:
          Number.isFinite(o.currentFreedom) && Number.isFinite(o.newFreedom) ? "+" + Math.round(gain) + " 天" : "—",
      },
    ];
  });

  // 格子推演:锁定"当前态"档位渲染两态(对齐 iOS gridDemoCard)
  const simGridUnit = $derived(gridUnitFor(simOut.currentFreedom));
  const simOldCount = $derived(cellCountFor(simOut.currentFreedom, simGridUnit));
  const simNewCount = $derived(cellCountFor(simOut.newFreedom, simGridUnit));
  const simOldBlue = $derived(blueCellsFor(simOldCount, simOut.lockedAssets, simOut.currentNW));
  const simNewBlue = $derived(blueCellsFor(simNewCount, simOut.lockedAssets, simOut.newNW));
  const simCellDelta = $derived(Math.abs(simNewCount - simOldCount));
  const simGridUnitLabel = $derived(GRID_UNIT_META[simGridUnit].label);

  // 演示三态(idle/playing/done)+ 触发
  let demoPhase = $state<"idle" | "playing" | "done">("idle");
  // 金额或模式一变 → 回到静止态,让用户重新观察这一笔(对齐 iOS .onChange)
  $effect(() => {
    void simAmount;
    void simMode;
    demoPhase = "idle";
  });
  function playDemo() {
    demoPhase = "playing";
    const total = simDemoTiming(simCellDelta, simMode === "income").total;
    setTimeout(() => {
      if (demoPhase === "playing") demoPhase = "done";
    }, (total + 0.05) * 1000);
  }
  const demoBtnLabel = $derived(
    demoPhase === "playing"
      ? "推演中…"
      : demoPhase === "done"
        ? "重播"
        : simMode === "expense"
          ? "演示这笔熄灭哪几格"
          : "演示这笔点亮哪几格"
  );

  function resetSim() {
    simMode = "expense";
    simAmount = null;
    demoPhase = "idle";
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

  {#if isEmpty}
    <!-- ───── 空态引导(无数据时,替代 hero / grid / stats)───── -->
    <section class="vault-card onboard">
      <span class="kicker">WELCOME</span>
      <h2 class="onboard-title">记下<span class="accent">第一笔</span>,点亮你的自由</h2>
      <p class="onboard-sub">FreeGrid 把你的资产换算成「还能自由多少天」。先记一笔支出或收入,仪表盘和格子就会亮起来。</p>
      <div class="onboard-actions">
        <button class="vbtn flame" onclick={() => (showExpense = true)}>− 记支出</button>
        <button class="vbtn sky" onclick={() => (showIncome = true)}>+ 记收入</button>
      </div>
      <p class="onboard-hint">已有备份?到「资产 · Assets」页可一键导入 JSON。</p>
    </section>
  {:else}

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
  {/if}
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
  wide
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
    <!-- 戴维斯三杀 / 自由增长 预览 -->
    <div class="sim-card" class:income={simMode === "income"}>
      <span class="kicker">{simMode === "expense" ? "戴维斯三杀预览" : "自由增长预览"}</span>
      <div class="kill-rows">
        {#each killRows as r (r.label)}
          <div class="kill-row">
            <span class="kicker">{r.label}</span>
            <div class="kill-body">
              <span class="kill-fromto num">{r.from} → {r.to}</span>
              <span class="kill-delta num">{r.delta}</span>
            </div>
          </div>
        {/each}
      </div>
      <p class="sim-caption">
        {simMode === "expense" ? "这笔消费对自由天数的传导效应。" : "这笔收入对自由天数的回血效应。"}
      </p>
    </div>

    <!-- 格子推演 -->
    <div class="sim-card">
      <div class="demo-head">
        <span class="kicker">格子推演</span>
        <span class="demo-range num">{simOldCount} → {simNewCount} {simGridUnitLabel}</span>
      </div>
      {#if simCellDelta === 0}
        <p class="demo-zero">
          {simMode === "expense"
            ? "不足一格 —— 还在当日预算内,这笔不削自由。"
            : "不足一格 —— 这笔还不够点亮一格自由。"}
        </p>
      {:else}
        <div class="demo-wrap">
          <SimDemoGrid
            unit={simGridUnit}
            oldCount={simOldCount}
            newCount={simNewCount}
            oldBlue={simOldBlue}
            newBlue={simNewBlue}
            phase={demoPhase}
          />
        </div>
        <div class="demo-cap">
          <span class="demo-dot" class:flame={simMode === "expense"}></span>
          {simMode === "expense"
            ? `熄灭 ${simCellDelta} 格 · 每格 1 ${simGridUnitLabel}自由`
            : `点亮 ${simCellDelta} 格 · 每格 1 ${simGridUnitLabel}自由`}
        </div>
        <button class="demo-btn" class:flame={simMode === "expense"} disabled={demoPhase === "playing"} onclick={playDemo}>
          {demoBtnLabel}
        </button>
      {/if}
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
  /* 模拟预览卡(戴维斯三杀 / 格子推演 共用底座) */
  .sim-card {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
    background: var(--mist2);
    border: 1px solid var(--hairline);
    border-radius: 14px;
    padding: var(--sp-lg);
    margin-top: var(--sp-sm);
  }
  .kill-rows {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
  }
  .kill-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .kill-body {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--sp-md);
  }
  .kill-fromto {
    font-family: var(--font-mono);
    font-size: 14px;
    color: var(--ink);
  }
  .kill-delta {
    font-family: var(--font-mono);
    font-size: 14px;
    font-weight: 500;
    color: var(--flame);
    white-space: nowrap;
  }
  .sim-card.income .kill-delta {
    color: var(--sky-deep);
  }
  .sim-caption {
    font-size: 12px;
    color: var(--ink-faint);
    margin: 2px 0 0;
  }
  /* 格子推演 */
  .demo-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  .demo-range {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.04em;
    color: var(--ink-faint);
  }
  .demo-zero {
    font-size: 14px;
    color: var(--ink-muted);
    margin: var(--sp-xs) 0;
  }
  .demo-wrap {
    padding: var(--sp-xs) 0;
  }
  .demo-cap {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    color: var(--ink-faint);
  }
  .demo-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--sky-deep);
    flex: 0 0 7px;
  }
  .demo-dot.flame {
    background: var(--flame);
  }
  .demo-btn {
    font-family: var(--font-rounded);
    font-size: 14px;
    padding: 11px 16px;
    border-radius: 999px;
    background: transparent;
    border: 1px solid color-mix(in srgb, var(--sky-deep) 55%, var(--hairline));
    color: var(--sky-deep);
    cursor: pointer;
    transition: background 0.15s ease, opacity 0.15s ease;
  }
  .demo-btn.flame {
    color: var(--flame);
    border-color: color-mix(in srgb, var(--flame) 55%, var(--hairline));
  }
  .demo-btn:hover:not(:disabled) {
    background: var(--mist);
  }
  .demo-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .sim-hint {
    text-align: center;
    font-size: 14px;
    color: var(--ink-muted);
    padding: var(--sp-xl) 0;
    margin: 0;
  }

  /* ── 空态引导 ── */
  .onboard {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--sp-md);
    padding: var(--sp-3xl) var(--sp-2xl);
  }
  .onboard-title {
    font-size: 28px;
    font-weight: 300;
    color: var(--ink);
    letter-spacing: -0.01em;
    margin: var(--sp-xs) 0 0;
  }
  .onboard-sub {
    font-size: 15px;
    line-height: 1.6;
    color: var(--ink-muted);
    max-width: 46ch;
    margin: 0;
  }
  .onboard-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-md);
    margin-top: var(--sp-sm);
  }
  .onboard-hint {
    font-size: 13px;
    color: var(--ink-faint);
    margin: var(--sp-sm) 0 0;
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
