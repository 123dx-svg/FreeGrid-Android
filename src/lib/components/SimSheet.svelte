<script lang="ts">
  // 模拟一笔 · 看清金融陷阱。极简双模式:投资(收益没宣传的香)/ 月供(成本比宣传的狠)。
  import Sheet from "./Sheet.svelte";
  import {
    holdYears,
    toMonths,
    realizedGain,
    realizedPct,
    extraFreedomDays,
    equalInstallment,
    equalPrincipal,
    installmentFee,
    lostFreedomDays,
    type HoldUnit,
  } from "../sim-finance";
  import { freedomDaysDisplay, freedomDaysUnit, freedomUnitLabel } from "../freedom-math";

  let {
    open = false,
    dailyNetBurn = 0,
    onClose,
  }: { open?: boolean; dailyNetBurn?: number; onClose: () => void } = $props();

  let mode = $state<"invest" | "loan">("invest");

  // 投资
  let principal = $state<number | null>(null);
  let annualRate = $state<number | null>(null);
  let holdValue = $state<number | null>(null);
  let holdUnit = $state<HoldUnit>("year");

  // 月供
  let loanP = $state<number | null>(null);
  let termVal = $state<number | null>(null);
  let termUnit = $state<HoldUnit>("year");
  let rateType = $state<"annual" | "fee">("annual");
  let repay = $state<"ei" | "ep">("ei"); // 等额本息 / 等额本金
  let loanRate = $state<number | null>(null); // 年利率 %
  let feeRate = $state<number | null>(null); // 分期费率 %/月
  let useLpr = $state(false);
  let lpr = $state<number | null>(3.95);
  let addBp = $state<number | null>(null); // 加点 bp

  let prevOpen = false;
  $effect(() => {
    if (open && !prevOpen) {
      mode = "invest";
      principal = annualRate = holdValue = null;
      holdUnit = "year";
      loanP = termVal = loanRate = feeRate = addBp = null;
      termUnit = "year";
      rateType = "annual";
      repay = "ei";
      useLpr = false;
      lpr = 3.95;
    }
    prevOpen = open;
  });

  const yuan = (n: number) => "¥" + Math.round(n).toLocaleString("en-US");
  const freeLabel = (d: number) => (Number.isFinite(d) ? `${freedomDaysDisplay(d)} ${freedomUnitLabel(freedomDaysUnit(d))}` : "∞");

  // ── 投资派生 ──
  const invValid = $derived((principal ?? 0) > 0 && (annualRate ?? 0) > 0 && (holdValue ?? 0) > 0);
  const invYears = $derived(holdYears(holdValue ?? 0, holdUnit));
  const gain = $derived(realizedGain(principal ?? 0, annualRate ?? 0, invYears));
  const gainPct = $derived(realizedPct(annualRate ?? 0, invYears));
  const invDays = $derived(extraFreedomDays(gain, dailyNetBurn));
  const invHold = $derived(`${holdValue ?? 0}${holdUnit === "year" ? " 年" : " 个月"}`);

  // ── 月供派生 ──
  const months = $derived(toMonths(termVal ?? 0, termUnit));
  const composedRate = $derived(useLpr ? (lpr ?? 0) + (addBp ?? 0) / 100 : loanRate ?? 0);
  const loanValid = $derived((loanP ?? 0) > 0 && months > 0 && (rateType === "fee" ? (feeRate ?? 0) > 0 : composedRate > 0));
  const loanRes = $derived.by(() => {
    if (!loanValid) return null;
    if (rateType === "fee") return installmentFee(loanP!, feeRate!, months);
    return repay === "ep" ? equalPrincipal(loanP!, composedRate, months) : equalInstallment(loanP!, composedRate, months);
  });
  // 另一种还款方式(仅年利率)的总利息对比
  const loanOther = $derived.by(() => {
    if (!loanValid || rateType === "fee") return null;
    return repay === "ep" ? equalInstallment(loanP!, composedRate, months) : equalPrincipal(loanP!, composedRate, months);
  });
  const lostDays = $derived(loanRes ? lostFreedomDays(loanRes.totalInterest, dailyNetBurn) : 0);
  const feeNominal = $derived((feeRate ?? 0) * 12); // 宣传费率×12
  const feeMultiple = $derived(loanRes && feeNominal > 0 ? loanRes.apr / feeNominal : 0);
  const termLabel = $derived(`${termVal ?? 0}${termUnit === "year" ? " 年" : " 个月"}`);
  const costWord = $derived(rateType === "fee" ? "总手续费" : "总利息");
</script>

<Sheet {open} title="模拟一笔" {onClose}>
  <div class="fg-seg sm-top">
    <button class:on={mode === "invest"} onclick={() => (mode = "invest")}>投资</button>
    <button class:on={mode === "loan"} onclick={() => (mode = "loan")}>月供</button>
  </div>

  {#if mode === "invest"}
    <!-- ═══════ 投资 ═══════ -->
    <div class="fg-field">
      <label class="fg-label" for="sm-p">本金 (元)</label>
      <input id="sm-p" class="fg-input fg-amount" type="number" min="0" step="100" inputmode="decimal" placeholder="¥ 0" bind:value={principal} />
    </div>
    <div class="fg-field">
      <label class="fg-label" for="sm-r">宣传年化 (%)</label>
      <input id="sm-r" class="fg-input fg-amount" type="number" min="0" step="0.1" inputmode="decimal" placeholder="比如 7" bind:value={annualRate} />
    </div>
    <div class="fg-field">
      <span class="fg-label">打算持有</span>
      <div class="sm-row">
        <input class="fg-input sm-num" type="number" min="0" step="1" inputmode="numeric" placeholder="时长" bind:value={holdValue} />
        <div class="fg-seg sm-unit">
          <button class:on={holdUnit === "month"} onclick={() => (holdUnit = "month")}>月</button>
          <button class:on={holdUnit === "year"} onclick={() => (holdUnit = "year")}>年</button>
        </div>
      </div>
    </div>

    {#if invValid}
      <div class="sm-card">
        <span class="kicker">销售话术 年化 {annualRate}% · 你实得</span>
        <div class="sm-big num moss">+{yuan(gain)}</div>
        <p class="sm-sub">持有 {invHold} · 约本金 {gainPct.toFixed(1)}%(单利·税费前)</p>
        {#if !Number.isFinite(invDays)}
          <p class="sm-free">≈ 你已财富自由,锦上添花。</p>
        {:else if gain > 0 && invDays < 1}
          <p class="sm-free">≈ 还不够多买 <b>1 天</b>自由。</p>
        {:else}
          <p class="sm-free">≈ 多自由 <b class="num">{freeLabel(invDays)}</b>。</p>
        {/if}
      </div>
      <ul class="sm-traps">
        <li><b>年化 ≠ 到手</b>:按一年算,你只持有 {invHold}。</li>
        <li><b>年化 ≠ 承诺</b>:历史/预期,会波动甚至亏。</li>
        <li><b>年化 ≠ 净收益</b>:税费前,扣完更少。</li>
      </ul>
    {/if}
  {:else}
    <!-- ═══════ 月供 ═══════ -->
    <div class="fg-field">
      <label class="fg-label" for="sm-lp">贷款本金 (元)</label>
      <input id="sm-lp" class="fg-input fg-amount" type="number" min="0" step="1000" inputmode="decimal" placeholder="¥ 0" bind:value={loanP} />
    </div>
    <div class="fg-field">
      <span class="fg-label">贷款期限</span>
      <div class="sm-row">
        <input class="fg-input sm-num" type="number" min="0" step="1" inputmode="numeric" placeholder="时长" bind:value={termVal} />
        <div class="fg-seg sm-unit">
          <button class:on={termUnit === "month"} onclick={() => (termUnit = "month")}>月</button>
          <button class:on={termUnit === "year"} onclick={() => (termUnit = "year")}>年</button>
        </div>
      </div>
    </div>

    <div class="fg-field">
      <span class="fg-label">利率类型</span>
      <div class="fg-seg">
        <button class:on={rateType === "annual"} onclick={() => (rateType = "annual")}>年利率</button>
        <button class:on={rateType === "fee"} onclick={() => (rateType = "fee")}>分期费率·每月</button>
      </div>
    </div>

    {#if rateType === "annual"}
      <div class="fg-field">
        <span class="fg-label">还款方式</span>
        <div class="fg-seg">
          <button class:on={repay === "ei"} onclick={() => (repay = "ei")}>等额本息</button>
          <button class:on={repay === "ep"} onclick={() => (repay = "ep")}>等额本金</button>
        </div>
      </div>
      {#if !useLpr}
        <div class="fg-field">
          <label class="fg-label" for="sm-ar">年利率 (%)</label>
          <input id="sm-ar" class="fg-input fg-amount" type="number" min="0" step="0.05" inputmode="decimal" placeholder="比如 4.9" bind:value={loanRate} />
        </div>
      {:else}
        <div class="fg-field">
          <span class="fg-label">LPR + 加点 = 年利率 {composedRate.toFixed(2)}%</span>
          <div class="sm-lpr">
            <input class="fg-input sm-num" type="number" min="0" step="0.05" inputmode="decimal" placeholder="LPR" bind:value={lpr} />
            <span class="sm-plus">+</span>
            <input class="fg-input sm-num" type="number" min="0" step="5" inputmode="numeric" placeholder="加点 bp" bind:value={addBp} />
          </div>
        </div>
      {/if}
      <label class="sm-check">
        <input type="checkbox" bind:checked={useLpr} />
        <span>用 LPR + 加点算(房贷)</span>
      </label>
    {:else}
      <div class="fg-field">
        <label class="fg-label" for="sm-fr">分期费率 (%/月)</label>
        <input id="sm-fr" class="fg-input fg-amount" type="number" min="0" step="0.05" inputmode="decimal" placeholder="比如 0.6" bind:value={feeRate} />
      </div>
    {/if}

    {#if loanValid && loanRes}
      <div class="sm-card">
        {#if loanRes.descending}
          <span class="kicker">月供(逐月递减)</span>
          <div class="sm-big num flame">{yuan(loanRes.firstMonthly)}<span class="sm-arrow">→ {yuan(loanRes.lastMonthly)}</span></div>
          <p class="sm-sub">首月 → 末月 · 共 {months} 期</p>
        {:else}
          <span class="kicker">月供</span>
          <div class="sm-big num flame">{yuan(loanRes.monthly)}<span class="sm-arrow">/月</span></div>
          <p class="sm-sub">共 {months} 期</p>
        {/if}
        <p class="sm-cost">{costWord} <b class="num">{yuan(loanRes.totalInterest)}</b> · 总还款 {yuan(loanRes.totalPay)}</p>
        {#if rateType === "fee"}
          <p class="sm-apr">真实年化 ≈ <b class="num flame">{loanRes.apr.toFixed(1)}%</b>{#if feeMultiple > 0}(约宣传 {feeNominal.toFixed(1)}% 的 {feeMultiple.toFixed(1)} 倍){/if}</p>
        {:else if loanOther}
          <p class="sm-apr">换{repay === "ei" ? "等额本金" : "等额本息"}:{costWord} {yuan(loanOther.totalInterest)}(差 {yuan(Math.abs(loanRes.totalInterest - loanOther.totalInterest))})</p>
        {/if}
        {#if !Number.isFinite(lostDays)}
          <p class="sm-free">≈ 你已财富自由,利息对自由天数影响有限。</p>
        {:else}
          <p class="sm-free">这笔{costWord} = 少自由 <b class="num">{freeLabel(lostDays)}</b>。</p>
        {/if}
      </div>
      <ul class="sm-traps">
        <li><b>月供 ≠ 总成本</b>:月供看着不多,{costWord} {yuan(loanRes.totalInterest)}。</li>
        {#if rateType === "fee"}
          <li><b>「费率」≠ 年化</b>:每月 {feeRate}% 听着低,真实年化 ≈ {loanRes.apr.toFixed(1)}%。</li>
        {:else}
          <li><b>LPR 会浮动</b>:房贷利率=LPR+加点,当前月供不锁定 {termUnit === "year" ? (termVal ?? 0) + " 年" : "整个期限"}。</li>
        {/if}
        <li><b>借越久,利息越多</b>:期限拉长,总{rateType === "fee" ? "手续费" : "利息"}成倍涨。</li>
      </ul>
    {/if}
  {/if}
</Sheet>

<style>
  .sm-top {
    margin-bottom: var(--sp-lg);
  }
  .sm-row {
    display: flex;
    gap: var(--sp-sm);
  }
  .sm-num {
    flex: 1;
    min-width: 0;
  }
  .sm-unit {
    flex: 0 0 auto;
  }
  .sm-lpr {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
  }
  .sm-plus {
    color: var(--ink-faint);
    font-size: 16px;
  }
  .sm-check {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--ink-muted);
    margin: calc(-1 * var(--sp-sm)) 0 0;
    cursor: pointer;
  }
  .sm-check input {
    width: 16px;
    height: 16px;
    accent-color: var(--sky-deep);
  }
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
  .sm-big {
    font-size: 36px;
    font-weight: 200;
    line-height: 1.05;
    white-space: nowrap;
    letter-spacing: -0.02em;
  }
  .sm-big.moss {
    color: var(--moss);
  }
  .sm-big.flame {
    color: var(--flame);
  }
  .sm-arrow {
    font-size: 15px;
    color: var(--ink-faint);
    margin-left: 6px;
    letter-spacing: 0;
  }
  .sm-sub {
    font-size: 12.5px;
    color: var(--ink-faint);
    margin: 0;
  }
  .sm-cost {
    font-size: 13.5px;
    color: var(--ink);
    margin: 4px 0 0;
  }
  .sm-cost b {
    color: var(--flame);
  }
  .sm-apr {
    font-size: 13px;
    color: var(--ink-muted);
    margin: 2px 0 0;
  }
  .sm-apr b {
    color: var(--flame);
  }
  .sm-free {
    font-size: 14px;
    color: var(--sky-deep);
    margin: 4px 0 0;
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
