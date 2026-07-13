<script lang="ts">
  // 消费日历 —— 月历热力:每日格按当日总支出深浅上色 + 金额;点某天选中(bindable)。可翻月,最多到当月。
  let {
    expenses = [],
    selected = $bindable<Date | null>(null),
  }: { expenses?: { amount: number; date: Date }[]; selected?: Date | null } = $props();

  const WD = ["日", "一", "二", "三", "四", "五", "六"];
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const now = new Date();
  const today = startOfDay(now);

  let viewYear = $state((selected ?? now).getFullYear());
  let viewMonth = $state((selected ?? now).getMonth());

  // 当前视图月的「每日总支出」
  const dailyTotals = $derived.by(() => {
    const m = new Map<number, number>();
    for (const e of expenses) {
      const d = e.date;
      if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
        m.set(d.getDate(), (m.get(d.getDate()) ?? 0) + e.amount);
      }
    }
    return m;
  });
  const maxDaily = $derived(Math.max(1, ...dailyTotals.values()));
  const monthTotal = $derived([...dailyTotals.values()].reduce((s, v) => s + v, 0));

  const cells = $derived.by(() => {
    const startWD = new Date(viewYear, viewMonth, 1).getDay();
    const days = new Date(viewYear, viewMonth + 1, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < startWD; i++) arr.push(null);
    for (let d = 1; d <= days; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  });

  const canNext = $derived(viewYear < now.getFullYear() || (viewYear === now.getFullYear() && viewMonth < now.getMonth()));
  const monthLabel = $derived(`${viewYear}年${viewMonth + 1}月`);

  function prevMonth() {
    if (viewMonth === 0) { viewYear -= 1; viewMonth = 11; } else viewMonth -= 1;
  }
  function nextMonth() {
    if (!canNext) return;
    if (viewMonth === 11) { viewYear += 1; viewMonth = 0; } else viewMonth += 1;
  }

  const isFuture = (d: number) => new Date(viewYear, viewMonth, d).getTime() > today.getTime();
  const isToday = (d: number) => viewYear === today.getFullYear() && viewMonth === today.getMonth() && d === today.getDate();
  const isSel = (d: number) => !!selected && selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === d;

  function intensity(d: number): number {
    const v = dailyTotals.get(d) ?? 0;
    if (v <= 0) return 0;
    // 0.12–0.5 之间按占比映射,弱值也可见
    return 0.12 + (v / maxDaily) * 0.4;
  }
  function fmtAmt(v: number): string {
    if (v >= 10000) return (v / 10000).toFixed(1) + "w";
    if (v >= 1000) return (v / 1000).toFixed(1) + "k";
    return String(Math.round(v));
  }

  function pick(d: number | null) {
    if (d == null || isFuture(d)) return;
    const cand = new Date(viewYear, viewMonth, d);
    selected = isSel(d) ? null : cand; // 再点一次取消选中
  }
</script>

<div class="sc">
  <div class="sc-head">
    <button class="sc-nav" onclick={prevMonth} aria-label="上一月">‹</button>
    <div class="sc-title">
      <span class="sc-month">{monthLabel}</span>
      <span class="sc-total num">支出 ¥{Math.round(monthTotal).toLocaleString("en-US")}</span>
    </div>
    <button class="sc-nav" onclick={nextMonth} disabled={!canNext} aria-label="下一月">›</button>
  </div>
  <div class="sc-wd">
    {#each WD as w (w)}<span class="sc-wd-c">{w}</span>{/each}
  </div>
  <div class="sc-grid">
    {#each cells as d, i (i)}
      {#if d == null}
        <span class="sc-cell empty"></span>
      {:else}
        {@const amt = dailyTotals.get(d) ?? 0}
        <button
          class="sc-cell"
          class:sel={isSel(d)}
          class:today={isToday(d)}
          class:has={amt > 0}
          disabled={isFuture(d)}
          style="--fill:{intensity(d)}"
          onclick={() => pick(d)}
        >
          <span class="sc-day num">{d}</span>
          {#if amt > 0}<span class="sc-amt num">{fmtAmt(amt)}</span>{/if}
        </button>
      {/if}
    {/each}
  </div>
</div>

<style>
  .sc {
    border: 1px solid var(--hairline);
    border-radius: 14px;
    background: var(--mist);
    padding: var(--sp-sm) var(--sp-sm) 10px;
  }
  .sc-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  .sc-nav {
    width: 34px;
    height: 34px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--ink-muted);
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
  }
  .sc-nav:hover { background: var(--mist2); color: var(--ink); }
  .sc-nav:disabled { opacity: 0.3; cursor: default; }
  .sc-title {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
  }
  .sc-month {
    font-size: 15px;
    font-weight: 600;
    color: var(--ink);
  }
  .sc-total {
    font-size: 11px;
    color: var(--ink-faint);
  }
  .sc-wd {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    margin-bottom: 3px;
  }
  .sc-wd-c {
    text-align: center;
    font-size: 11px;
    color: var(--ink-faint);
    padding: 2px 0;
  }
  .sc-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 3px;
  }
  .sc-cell {
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    border: 1px solid transparent;
    background: color-mix(in srgb, var(--flame) calc(var(--fill, 0) * 100%), transparent);
    color: var(--ink);
    border-radius: 9px;
    cursor: pointer;
    padding: 0;
    transition: border-color 0.12s ease, transform 0.1s ease;
  }
  .sc-cell.empty { pointer-events: none; background: transparent; }
  .sc-cell:disabled { color: var(--ink-ghost); cursor: default; background: transparent; }
  .sc-cell:not(.sel):not(:disabled):active { transform: scale(0.94); }
  .sc-day { font-size: 13px; line-height: 1; }
  .sc-cell.has .sc-day { font-weight: 600; }
  .sc-cell:not(.has) .sc-day { color: var(--ink-faint); }
  .sc-amt {
    font-size: 9.5px;
    line-height: 1;
    color: var(--flame);
  }
  .sc-cell.today:not(.sel) {
    box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--sky-deep) 55%, transparent);
  }
  .sc-cell.sel {
    border-color: var(--sky-deep);
    box-shadow: 0 0 0 1px var(--sky-deep);
  }
  .sc-cell.sel .sc-day { color: var(--sky-deep); }
</style>
