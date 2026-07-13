<script lang="ts">
  // 记账内联「自由影响」预览 —— 边填金额边看这笔对自由天数的传导。
  // 单行摘要(削/多 N 天自由),金额为 0 或不足 1 天时自动隐藏;点一下展开完整三行。
  // 复用 sim-demo 的 simOutcome,零新算法;纯预览、不写账本。
  import { simOutcome } from "../sim-demo";
  import { freedomDaysDisplay } from "../freedom-math";

  let {
    amount,
    mode,
    vm,
  }: {
    amount: number | null;
    mode: "expense" | "income";
    vm: {
      lockedAssets: number;
      cash: number;
      totalExpenses: number;
      trackDays: number;
      dailyPassive: number;
    };
  } = $props();

  let expanded = $state(false);

  const out = $derived(
    simOutcome({
      lockedAssets: vm.lockedAssets,
      cash: vm.cash,
      totalExpenses: vm.totalExpenses,
      trackDays: vm.trackDays,
      dailyPassive: vm.dailyPassive,
      amount: amount ?? 0,
      mode,
    })
  );

  // 自由天数变化(天,取整)。两端都需有限才有意义。
  const deltaDays = $derived.by(() => {
    const { currentFreedom, newFreedom } = out;
    if (!Number.isFinite(currentFreedom) || !Number.isFinite(newFreedom)) return null;
    return Math.round(mode === "expense" ? currentFreedom - newFreedom : newFreedom - currentFreedom);
  });

  // 显示条件:金额 > 0 且变化 ≥ 1 天
  const visible = $derived((amount ?? 0) > 0 && deltaDays != null && deltaDays >= 1);

  const yuan = (v: number, p = 0) =>
    "¥" + new Intl.NumberFormat("en-US", { minimumFractionDigits: p, maximumFractionDigits: p }).format(v);
</script>

{#if visible}
  <div class="fi" class:income={mode === "income"}>
    <button type="button" class="fi-line" onclick={() => (expanded = !expanded)} aria-expanded={expanded}>
      <span class="fi-dot"></span>
      <span class="fi-txt">
        这笔 ≈ {mode === "expense" ? "削" : "多"} <b class="num">{deltaDays}</b> 天自由
      </span>
      <span class="fi-more">{expanded ? "收起 ▴" : "详情 ▾"}</span>
    </button>

    {#if expanded}
      <div class="fi-rows">
        <div class="fi-row">
          <span class="fi-k">净值</span>
          <span class="fi-v num">{yuan(out.currentNW)} → {yuan(out.newNW)}</span>
          <span class="fi-d num">{mode === "expense" ? "−" : "+"}{yuan(amount ?? 0)}</span>
        </div>
        {#if mode === "expense"}
          <div class="fi-row">
            <span class="fi-k">日均</span>
            <span class="fi-v num">{yuan(out.currentAvg, 1)} → {yuan(out.newAvg, 2)}</span>
            <span class="fi-d num">+{yuan(out.newAvg - out.currentAvg, 2)}</span>
          </div>
        {/if}
        <div class="fi-row">
          <span class="fi-k">自由天数</span>
          <span class="fi-v num">{freedomDaysDisplay(out.currentFreedom)} → {freedomDaysDisplay(out.newFreedom)}</span>
          <span class="fi-d num">{mode === "expense" ? "−" : "+"}{deltaDays} 天</span>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .fi {
    border-radius: 12px;
    border: 1px solid color-mix(in srgb, var(--flame) 30%, transparent);
    background: color-mix(in srgb, var(--flame) 8%, transparent);
    padding: 2px 4px;
  }
  .fi.income {
    border-color: color-mix(in srgb, var(--moss) 32%, transparent);
    background: color-mix(in srgb, var(--moss) 8%, transparent);
  }
  .fi-line {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    background: transparent;
    border: 0;
    padding: 10px 10px;
    cursor: pointer;
    font-family: var(--font-rounded);
    font-size: 14px;
    color: var(--ink);
    text-align: left;
  }
  .fi-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex: none;
    background: var(--flame);
    box-shadow: 0 0 8px var(--flame);
  }
  .fi.income .fi-dot {
    background: var(--moss);
    box-shadow: 0 0 8px var(--moss);
  }
  .fi-txt {
    flex: 1;
    min-width: 0;
  }
  .fi-txt b {
    color: var(--flame);
    font-size: 16px;
  }
  .fi.income .fi-txt b {
    color: var(--moss);
  }
  .fi-more {
    font-size: 12px;
    color: var(--ink-faint);
    flex: none;
  }
  .fi-rows {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 4px 10px 10px;
  }
  .fi-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 13px;
  }
  .fi-k {
    color: var(--ink-faint);
    flex: 0 0 56px;
  }
  .fi-v {
    flex: 1;
    min-width: 0;
    color: var(--ink-muted);
  }
  .fi-d {
    color: var(--flame);
    flex: none;
  }
  .fi.income .fi-d {
    color: var(--moss);
  }
</style>
