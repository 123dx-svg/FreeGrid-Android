<script lang="ts">
  // 决策模拟 · 看清人生选择的真实代价。跳槽(真实时薪对比)/ 创业(烧钱跑道)。
  import Sheet from "./Sheet.svelte";
  import {
    jobStats,
    startupMonthlyBurn,
    startupRunwayMonths,
    monthlyVsEmployed,
    freedomDaysFor,
    type RestType,
  } from "../sim-life";
  import { freedomDaysDisplay, freedomDaysUnit, freedomUnitLabel } from "../freedom-math";

  let {
    open = false,
    dailyNetBurn = 0,
    netWorth = 0,
    avgMonthlyIncome = 0,
    onClose,
  }: { open?: boolean; dailyNetBurn?: number; netWorth?: number; avgMonthlyIncome?: number; onClose: () => void } = $props();

  let mode = $state<"job" | "startup">("job");

  // 跳槽:现在 / 新机会
  let s1 = $state<number | null>(null);
  let h1 = $state<number | null>(null);
  let c1 = $state<number | null>(null);
  let r1 = $state<RestType>("double");
  let s2 = $state<number | null>(null);
  let h2 = $state<number | null>(null);
  let c2 = $state<number | null>(null);
  let r2 = $state<RestType>("double");

  // 创业
  let cap = $state<number | null>(null);
  let fix = $state<number | null>(null);
  let rev = $state<number | null>(null);
  let give = $state<number | null>(null);

  let prevOpen = false;
  $effect(() => {
    if (open && !prevOpen) {
      mode = "job";
      const inc = avgMonthlyIncome > 0 ? Math.round(avgMonthlyIncome) : null;
      s1 = inc;
      h1 = c1 = s2 = h2 = c2 = null;
      r1 = r2 = "double";
      cap = fix = rev = null;
      give = inc;
    }
    prevOpen = open;
  });

  const yuan = (n: number) => "¥" + Math.round(n).toLocaleString("en-US");
  const hrs = (n: number) => Math.round(n).toLocaleString("en-US");
  const freeLabel = (d: number) => (Number.isFinite(d) ? `${freedomDaysDisplay(d)} ${freedomUnitLabel(freedomDaysUnit(d))}` : "∞");
  const REST: { v: RestType; l: string }[] = [
    { v: "double", l: "双休" },
    { v: "bigsmall", l: "大小周" },
    { v: "single", l: "单休" },
    { v: "none", l: "无休" },
  ];

  // ── 跳槽派生 ──
  const jobValid = $derived((s1 ?? 0) > 0 && (h1 ?? 0) > 0 && (s2 ?? 0) > 0 && (h2 ?? 0) > 0);
  const j1 = $derived(jobStats({ monthlySalary: s1 ?? 0, hoursPerDay: h1 ?? 0, commutePerDay: c1 ?? 0, rest: r1 }));
  const j2 = $derived(jobStats({ monthlySalary: s2 ?? 0, hoursPerDay: h2 ?? 0, commutePerDay: c2 ?? 0, rest: r2 }));
  const dIncome = $derived(j2.annualIncome - j1.annualIncome);
  const dHours = $derived(j2.annualWork + j2.annualCommute - (j1.annualWork + j1.annualCommute));
  const hourlyUp = $derived(j2.realHourly >= j1.realHourly);
  const buyDays = $derived(freedomDaysFor(Math.abs(dIncome), dailyNetBurn));

  // ── 创业派生 ──
  const monthlyExpense = $derived(dailyNetBurn * 30);
  const stValid = $derived(((cap ?? 0) > 0 || (fix ?? 0) > 0 || (rev ?? 0) > 0 || (give ?? 0) > 0));
  const burn = $derived(startupMonthlyBurn(monthlyExpense, fix ?? 0, rev ?? 0));
  const runway = $derived(startupRunwayMonths(netWorth, cap ?? 0, burn));
  const vsEmp = $derived(monthlyVsEmployed(give ?? 0, fix ?? 0, rev ?? 0));
  const burnDaysPerMonth = $derived(freedomDaysFor(Math.max(0, burn), dailyNetBurn));
</script>

<Sheet {open} title="决策模拟" {onClose}>
  <div class="fg-seg sm-top">
    <button class:on={mode === "job"} onclick={() => (mode = "job")}>跳槽</button>
    <button class:on={mode === "startup"} onclick={() => (mode = "startup")}>创业</button>
  </div>

  {#if mode === "job"}
    <!-- ═══════ 跳槽:两栏对比 ═══════ -->
    <p class="sm-note">总额高 ≠ 更值 —— 把通勤和工时都摊进去,看<b>真实时薪</b>。</p>
    {#each [{ tag: "现在", cur: true }, { tag: "新机会", cur: false }] as job (job.tag)}
      <div class="job-card">
        <span class="job-h" class:next={!job.cur}>{job.tag}</span>
        {#if job.cur}
          <input class="fg-input job-amt" type="number" min="0" step="500" inputmode="decimal" placeholder="月薪 ¥" bind:value={s1} />
          <div class="job-2">
            <input class="fg-input" type="number" min="0" step="0.5" inputmode="decimal" placeholder="工时/天 h" bind:value={h1} />
            <input class="fg-input" type="number" min="0" step="0.5" inputmode="decimal" placeholder="通勤/天 h" bind:value={c1} />
          </div>
          <div class="fg-seg rest-seg">
            {#each REST as x (x.v)}<button class:on={r1 === x.v} onclick={() => (r1 = x.v)}>{x.l}</button>{/each}
          </div>
        {:else}
          <input class="fg-input job-amt" type="number" min="0" step="500" inputmode="decimal" placeholder="月薪 ¥" bind:value={s2} />
          <div class="job-2">
            <input class="fg-input" type="number" min="0" step="0.5" inputmode="decimal" placeholder="工时/天 h" bind:value={h2} />
            <input class="fg-input" type="number" min="0" step="0.5" inputmode="decimal" placeholder="通勤/天 h" bind:value={c2} />
          </div>
          <div class="fg-seg rest-seg">
            {#each REST as x (x.v)}<button class:on={r2 === x.v} onclick={() => (r2 = x.v)}>{x.l}</button>{/each}
          </div>
        {/if}
      </div>
    {/each}

    {#if jobValid}
      <div class="sm-card">
        <span class="kicker">真实时薪(摊入通勤)</span>
        <div class="cmp-hero">
          <span class="num">¥{hrs(j1.realHourly)}</span>
          <span class="cmp-arrow">→</span>
          <span class="num" class:up={hourlyUp} class:down={!hourlyUp}>¥{hrs(j2.realHourly)}<span class="cmp-h">/h</span></span>
        </div>
        <p class="cmp-line">年总额 {yuan(j1.annualIncome)} → {yuan(j2.annualIncome)}</p>
        <p class="cmp-line">年上班 {hrs(j1.annualWork)}h → {hrs(j2.annualWork)}h · 年通勤 {hrs(j1.annualCommute)}h → {hrs(j2.annualCommute)}h</p>
        <p class="cmp-concl">新工作年{dIncome >= 0 ? "多赚" : "少赚"} <b>{yuan(Math.abs(dIncome))}</b>,每年{dHours >= 0 ? "多" : "少"}搭 <b>{hrs(Math.abs(dHours))} 小时</b>(≈{hrs(Math.abs(dHours) / 8)} 个工作日)· 真实时薪 <b class={hourlyUp ? "up" : "down"}>{hourlyUp ? "更高 👍" : "反而更低 ⚠"}</b>。</p>
        <p class="sm-free">{dIncome >= 0 ? "多赚的钱" : "少赚的钱"}≈ {freeLabel(buyDays)}自由;每年{dHours >= 0 ? "多花" : "少花"} ≈ {hrs(Math.abs(dHours) / 24)} 天在路上和工位。</p>
      </div>
      <ul class="sm-traps">
        <li><b>总额 ≠ 时薪</b>:通勤和加班会摊薄单位时间的钱。</li>
        <li><b>通勤是隐形无薪工时</b>:算进去才是真实代价。</li>
      </ul>
    {/if}
  {:else}
    <!-- ═══════ 创业:烧钱跑道 ═══════ -->
    <p class="sm-note">创业烧的是你的<b>自由跑道</b> —— 没工资 + 启动成本 + 固定支出,营收往往高估。</p>
    <div class="fg-field">
      <label class="fg-label" for="st-cap">启动资金 (元)</label>
      <input id="st-cap" class="fg-input fg-amount" type="number" min="0" step="1000" inputmode="decimal" placeholder="¥ 0" bind:value={cap} />
    </div>
    <div class="fg-field">
      <label class="fg-label" for="st-fix">每月固定成本 (元)</label>
      <input id="st-fix" class="fg-input fg-amount" type="number" min="0" step="500" inputmode="decimal" placeholder="房租/工资等" bind:value={fix} />
    </div>
    <div class="fg-field">
      <label class="fg-label" for="st-rev">预计月营收 (元)</label>
      <input id="st-rev" class="fg-input fg-amount" type="number" min="0" step="500" inputmode="decimal" placeholder="乐观估计" bind:value={rev} />
    </div>
    <div class="fg-field">
      <label class="fg-label" for="st-give">放弃的月薪 · 机会成本 (元)</label>
      <input id="st-give" class="fg-input fg-amount" type="number" min="0" step="500" inputmode="decimal" placeholder="不创业本可赚的" bind:value={give} />
    </div>

    {#if stValid}
      <div class="sm-card">
        {#if burn > 0}
          <span class="kicker">每月净烧(净值消耗)</span>
          <div class="sm-big num flame">−{yuan(burn)}<span class="cmp-h">/月</span></div>
          {#if Number.isFinite(runway)}
            <p class="cmp-line">烧钱跑道 ≈ <b class="num">{runway < 1 ? "不到 1" : Math.round(runway)}</b> 个月(净值 − 启动资金 撑到耗尽/盈利前)</p>
          {:else}
            <p class="cmp-line">已把净值烧穿:启动资金已超过现有净值。</p>
          {/if}
        {:else}
          <span class="kicker">每月净现金流</span>
          <div class="sm-big num moss">+{yuan(-burn)}<span class="cmp-h">/月</span></div>
          <p class="cmp-line">营收覆盖了成本与生活,现金流为正 —— 但机会成本仍在(见下)。</p>
        {/if}
        <p class="cmp-line">比继续打工,每月少攒 <b class="num flame">{yuan(Math.max(0, vsEmp))}</b>(放弃月薪 − 生意盈余)</p>
        {#if burn > 0}
          <p class="sm-free">这速度 = 每月烧掉 <b class="num">{freeLabel(burnDaysPerMonth)}</b>自由。</p>
        {/if}
      </div>
      <ul class="sm-traps">
        <li><b>营收多半高估</b>:把预计月营收打个对折再看跑道。</li>
        <li><b>机会成本别忘</b>:放弃的工资也是真金白银的代价。</li>
        <li><b>跑道比你想的短</b>:固定成本雷打不动,营收却要慢慢爬。</li>
      </ul>
    {/if}
  {/if}
</Sheet>

<style>
  .sm-top {
    margin-bottom: var(--sp-md);
  }
  .sm-note {
    font-size: 13px;
    line-height: 1.6;
    color: var(--ink-muted);
    margin: 0 0 var(--sp-md);
  }
  .sm-note b {
    color: var(--ink);
  }
  /* 跳槽:两张工作卡 */
  .job-card {
    background: var(--mist2);
    border: 1px solid var(--hairline);
    border-radius: 14px;
    padding: var(--sp-md);
    margin-bottom: var(--sp-sm);
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
  }
  .job-h {
    font-size: 13px;
    font-weight: 600;
    color: var(--ink-muted);
  }
  .job-h.next {
    color: var(--sky-deep);
  }
  .job-2 {
    display: flex;
    gap: var(--sp-sm);
  }
  .job-2 .fg-input {
    flex: 1;
    min-width: 0;
  }
  .job-amt {
    width: 100%;
  }
  .rest-seg button {
    font-size: 12px;
    padding: 7px 4px;
  }
  /* 结果卡 */
  .sm-card {
    background: var(--mist2);
    border: 1px solid var(--hairline);
    border-radius: 14px;
    padding: var(--sp-lg);
    margin-top: var(--sp-sm);
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .cmp-hero {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 30px;
    font-weight: 200;
    color: var(--ink);
    letter-spacing: -0.02em;
    margin: 2px 0;
  }
  .cmp-arrow {
    font-size: 18px;
    color: var(--ink-faint);
  }
  .cmp-hero .up {
    color: var(--moss);
  }
  .cmp-hero .down {
    color: var(--flame);
  }
  .cmp-h {
    font-size: 14px;
    color: var(--ink-faint);
    margin-left: 2px;
  }
  .cmp-line {
    font-size: 13px;
    color: var(--ink-muted);
    margin: 2px 0 0;
  }
  .cmp-line b {
    color: var(--ink);
  }
  .cmp-concl {
    font-size: 13px;
    line-height: 1.55;
    color: var(--ink);
    margin: 6px 0 0;
  }
  .cmp-concl b {
    color: var(--ink);
  }
  .cmp-concl .up,
  .sm-card .up {
    color: var(--moss);
  }
  .cmp-concl .down,
  .sm-card .down {
    color: var(--flame);
  }
  .sm-big {
    font-size: 34px;
    font-weight: 200;
    line-height: 1.05;
    white-space: nowrap;
    letter-spacing: -0.02em;
  }
  .sm-big.flame {
    color: var(--flame);
  }
  .sm-big.moss {
    color: var(--moss);
  }
  .sm-free {
    font-size: 14px;
    color: var(--sky-deep);
    margin: 6px 0 0;
  }
  .sm-free b {
    color: var(--sky-deep);
  }
  .sm-traps {
    margin: var(--sp-md) 0 0;
    padding-left: 1.1em;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--ink-muted);
  }
  .sm-traps b {
    color: var(--flame);
  }
</style>
