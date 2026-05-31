<script lang="ts">
  import { makeDemoData } from "./demo";
  import { deriveDashboard } from "./derive";
  import { freedomUnitLabel } from "./freedom-math";
  import Sparkline from "./components/Sparkline.svelte";
  import FreedomGrid from "./components/FreedomGrid.svelte";

  const now = new Date();
  const vm = deriveDashboard(makeDemoData(now), now);

  const unitLabel = freedomUnitLabel(vm.unit);
  const kicker =
    vm.unit === "day" ? "FREEDOM DAYS" : vm.unit === "month" ? "FREEDOM MONTHS" : "FREEDOM YEARS";

  const isInf = !Number.isFinite(vm.freedomDays);
  const weeks = Math.max(0, vm.history.length - 1);

  function fmtDeplete(d: Date | null): string {
    if (!d) return "";
    return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
  }

  const dailyStr = vm.dailyBurn.toFixed(1);
  const passiveStr = `${Math.round(vm.passiveRatio * 100)}%`;
</script>

<div class="dash">
  <header class="page-head">
    <p class="kicker">DASHBOARD</p>
    <h1>自由仪表盘</h1>
  </header>

  <!-- ───── Hero ───── -->
  <section class="vault-card hero" class:glow={true}>
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
      <span class="muted num">{vm.grid.count} {unitLabel}</span>
    </div>
    <div class="grid-wrap">
      <FreedomGrid grid={vm.grid} />
    </div>
    <div class="legend">
      <span class="lg"><i class="dot gold"></i>资产</span>
      <span class="lg"><i class="dot blue"></i>现金</span>
      <span class="muted spacer">每格 = 1 {unitLabel}自由</span>
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
    <button class="vbtn flame">− 记支出</button>
    <button class="vbtn sky">+ 记收入</button>
    <button class="vbtn ghost">⚡ 模拟一笔 · 看决策影响 →</button>
  </section>
</div>

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
