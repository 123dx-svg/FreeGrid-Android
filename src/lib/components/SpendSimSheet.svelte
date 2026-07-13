<script lang="ts">
  // 省钱模拟 · 拿铁因子 —— 基于你的真实记账:少花某类支出能省多少、换算成自由,
  // 以及若把省下的钱按月定投,长期复利的「拿铁因子」。全本地,零网络零 AI。
  import Sheet from "./Sheet.svelte";
  import { monthlySavingByPct, monthlySavingByPerDay, annualSaving } from "../sim-spend";
  import { freedomDaysFor } from "../sim-life";
  import { freedomDaysDisplay, freedomDaysUnit, freedomUnitLabel } from "../freedom-math";

  let {
    open = false,
    dailyNetBurn = 0,
    categories = [],
    onClose,
  }: {
    open?: boolean;
    dailyNetBurn?: number;
    categories?: { name: string; monthly: number }[]; // 各支出类目的月均金额(来自年报聚合)
    onClose: () => void;
  } = $props();

  let selected = $state("");
  let monthly = $state<number | null>(null);
  let cutMode = $state<"percent" | "perday">("percent");
  let cutPct = $state(30);
  let perDay = $state<number | null>(null);

  // 打开时:默认选月均最大的类目,预填其月支出
  let prevOpen = false;
  $effect(() => {
    if (open && !prevOpen) {
      const top = [...categories].sort((a, b) => b.monthly - a.monthly)[0];
      selected = top?.name ?? "";
      monthly = top ? Math.round(top.monthly) : null;
      cutMode = "percent";
      cutPct = 30;
      perDay = null;
    }
    prevOpen = open;
  });

  function pickCat(c: { name: string; monthly: number }) {
    selected = c.name;
    monthly = Math.round(c.monthly);
  }

  const yuan = (n: number) => "¥" + Math.round(n).toLocaleString("en-US");
  const freeLabel = (d: number) => (Number.isFinite(d) ? `${freedomDaysDisplay(d)} ${freedomUnitLabel(freedomDaysUnit(d))}` : "∞");

  const monthlySaved = $derived(
    cutMode === "percent" ? monthlySavingByPct(monthly ?? 0, cutPct) : monthlySavingByPerDay(perDay ?? 0)
  );
  const yearlySaved = $derived(annualSaving(monthlySaved));
  const freeDays = $derived(freedomDaysFor(yearlySaved, dailyNetBurn));
  const valid = $derived(monthlySaved > 0);

  const PCT_PRESETS = [
    { v: 25, l: "少花¼" },
    { v: 50, l: "少花一半" },
    { v: 100, l: "全戒掉" },
  ];
</script>

<Sheet {open} title="省钱模拟 · 拿铁因子" {onClose}>
  <p class="sm-note">拿铁因子 —— 每天一笔小钱,长年累月很惊人。挑一类你常花的钱,看<b>少花一点每年能省多少、换成多少天自由</b>。</p>

  {#if categories.length}
    <p class="sm-lab">挑一类支出(取自你的记账)</p>
    <div class="cat-chips">
      {#each categories as c (c.name)}
        <button class="cat-chip" class:on={selected === c.name} onclick={() => pickCat(c)}>
          {c.name}<span class="cat-m num">¥{Math.round(c.monthly).toLocaleString("en-US")}/月</span>
        </button>
      {/each}
    </div>
  {/if}

  <div class="fg-field">
    <label class="fg-label" for="ss-monthly">这类每月大约花 (元)</label>
    <input id="ss-monthly" class="fg-input fg-amount" type="number" min="0" step="50" inputmode="decimal" placeholder="¥ 0" bind:value={monthly} />
  </div>

  <div class="fg-seg cut-seg">
    <button class:on={cutMode === "percent"} onclick={() => (cutMode = "percent")}>按比例少花</button>
    <button class:on={cutMode === "perday"} onclick={() => (cutMode = "perday")}>按每天少花</button>
  </div>

  {#if cutMode === "percent"}
    <div class="pct-chips">
      {#each PCT_PRESETS as p (p.v)}
        <button class="pct-chip" class:on={cutPct === p.v} onclick={() => (cutPct = p.v)}>{p.l}<span class="pct-n num">{p.v}%</span></button>
      {/each}
    </div>
    <div class="fg-field">
      <label class="fg-label" for="ss-pct">或自定义少花比例 (%)</label>
      <input id="ss-pct" class="fg-input fg-amount" type="number" min="0" max="100" step="5" inputmode="decimal" bind:value={cutPct} />
    </div>
  {:else}
    <div class="fg-field">
      <label class="fg-label" for="ss-perday">每天少花 (元)</label>
      <input id="ss-perday" class="fg-input fg-amount" type="number" min="0" step="1" inputmode="decimal" placeholder="如 每天少点 ¥15 外卖" bind:value={perDay} />
    </div>
  {/if}

  {#if valid}
    <div class="sm-card">
      <span class="kicker">少花{selected ? `「${selected}」` : ""}后</span>
      <div class="sm-big num moss">{yuan(monthlySaved)}<span class="cmp-h">/月</span></div>
      <p class="cmp-line">一年省下 <b class="num">{yuan(yearlySaved)}</b>{#if Number.isFinite(freeDays)} ≈ 多 <b class="num">{freeLabel(freeDays)}</b>自由{/if}。</p>
      <p class="sm-free">每天省一点看着不起眼,攒一年就是实打实的 {yuan(yearlySaved)}。</p>
    </div>
    <ul class="sm-traps">
      <li><b>别砍到影响生活</b>:必要开支硬省会反弹,挑真正可减的水分。</li>
      <li><b>贵在坚持</b>:每月省一点、攒一年才看得出,断断续续省不下来。</li>
    </ul>
  {/if}
</Sheet>

<style>
  .sm-note {
    font-size: 13px;
    line-height: 1.6;
    color: var(--ink-muted);
    margin: 0 0 var(--sp-md);
  }
  .sm-note b {
    color: var(--ink);
  }
  .sm-lab,
  .fg-label {
    font-size: 12px;
    color: var(--ink-muted);
  }
  .sm-lab {
    margin: 0 0 6px;
  }
  .cat-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: var(--sp-md);
  }
  .cat-chip {
    display: inline-flex;
    align-items: baseline;
    gap: 5px;
    padding: 7px 11px;
    border-radius: 999px;
    border: 1px solid var(--hairline);
    background: var(--mist2);
    color: var(--ink-muted);
    font-size: 13px;
    font-family: var(--font-rounded);
    cursor: pointer;
  }
  .cat-chip.on {
    border-color: color-mix(in srgb, var(--income-gold) 55%, var(--hairline));
    color: var(--ink);
    background: color-mix(in srgb, var(--income-gold) 10%, transparent);
  }
  .cat-m {
    font-size: 11px;
    color: var(--ink-faint);
  }
  .cut-seg {
    margin-bottom: var(--sp-sm);
  }
  .pct-chips {
    display: flex;
    gap: 6px;
    margin-bottom: var(--sp-sm);
  }
  .pct-chip {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 8px 4px;
    border-radius: 12px;
    border: 1px solid var(--hairline);
    background: var(--mist2);
    color: var(--ink-muted);
    font-size: 12.5px;
    font-family: var(--font-rounded);
    cursor: pointer;
  }
  .pct-chip.on {
    border-color: color-mix(in srgb, var(--income-gold) 55%, var(--hairline));
    color: var(--ink);
    background: color-mix(in srgb, var(--income-gold) 10%, transparent);
  }
  .pct-n {
    font-size: 11px;
    color: var(--ink-faint);
  }
  .sm-card {
    background: var(--mist2);
    border: 1px solid var(--hairline);
    border-radius: 14px;
    padding: var(--sp-lg);
    margin-top: var(--sp-md);
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .sm-big {
    font-size: 34px;
    font-weight: 200;
    line-height: 1.05;
    white-space: nowrap;
    letter-spacing: -0.02em;
  }
  .sm-big.moss {
    color: var(--moss);
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
    line-height: 1.55;
  }
  .cmp-line b {
    color: var(--ink);
  }
  .cmp-line b.moss {
    color: var(--moss);
  }
  .sm-free {
    font-size: 14px;
    color: var(--sky-deep);
    margin: 6px 0 0;
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
