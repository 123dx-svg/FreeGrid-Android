<script lang="ts">
  // 月历日期选择器 —— 只选日期(时间沿用 value 的当前时刻)。月网格,直观翻月,最多到今天。
  // 纯 DOM,零依赖。绑定一个 Date。
  let { value = $bindable(new Date()) }: { value?: Date } = $props();

  const WD = ["日", "一", "二", "三", "四", "五", "六"];
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const now = new Date();
  const today = startOfDay(now);

  let viewYear = $state(value.getFullYear());
  let viewMonth = $state(value.getMonth()); // 0-11

  // 外部重置 value(如打开记账面板 → new Date())时,视图跟随跳到 value 所在月;
  // 而"点日/翻月"不会让 value 跨月(点日只改本月的日),故不会打断翻月导航。
  let lastSet = value.getTime();
  $effect(() => {
    if (value.getTime() !== lastSet) {
      viewYear = value.getFullYear();
      viewMonth = value.getMonth();
      lastSet = value.getTime();
    }
  });

  const cells = $derived.by(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startWD = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < startWD; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  });

  const canNext = $derived(viewYear < now.getFullYear() || (viewYear === now.getFullYear() && viewMonth < now.getMonth()));
  const monthLabel = $derived(`${viewYear}年${viewMonth + 1}月`);

  function prevMonth() {
    if (viewMonth === 0) {
      viewYear -= 1;
      viewMonth = 11;
    } else viewMonth -= 1;
  }
  function nextMonth() {
    if (!canNext) return;
    if (viewMonth === 11) {
      viewYear += 1;
      viewMonth = 0;
    } else viewMonth += 1;
  }

  function isFuture(d: number): boolean {
    return new Date(viewYear, viewMonth, d).getTime() > today.getTime();
  }
  function isToday(d: number): boolean {
    return viewYear === today.getFullYear() && viewMonth === today.getMonth() && d === today.getDate();
  }
  const isSelected = (d: number) => value.getFullYear() === viewYear && value.getMonth() === viewMonth && value.getDate() === d;

  function pick(d: number | null) {
    if (d == null || isFuture(d)) return;
    value = new Date(viewYear, viewMonth, d, value.getHours(), value.getMinutes(), value.getSeconds());
    lastSet = value.getTime();
  }
  function jumpToday() {
    viewYear = today.getFullYear();
    viewMonth = today.getMonth();
    pick(today.getDate());
  }
</script>

<div class="cal">
  <div class="cal-head">
    <button class="cal-nav" onclick={prevMonth} aria-label="上一月">‹</button>
    <button class="cal-title" onclick={jumpToday}>{monthLabel}</button>
    <button class="cal-nav" onclick={nextMonth} disabled={!canNext} aria-label="下一月">›</button>
  </div>
  <div class="cal-wd">
    {#each WD as w (w)}<span class="cal-wd-c">{w}</span>{/each}
  </div>
  <div class="cal-grid">
    {#each cells as d, i (i)}
      {#if d == null}
        <span class="cal-cell empty"></span>
      {:else}
        <button
          class="cal-cell"
          class:sel={isSelected(d)}
          class:today={isToday(d)}
          disabled={isFuture(d)}
          onclick={() => pick(d)}
        >
          <span class="num">{d}</span>
        </button>
      {/if}
    {/each}
  </div>
</div>

<style>
  .cal {
    border: 1px solid var(--hairline);
    border-radius: 14px;
    background: var(--mist2);
    padding: var(--sp-sm) var(--sp-sm) 10px;
  }
  .cal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  .cal-nav {
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
  .cal-nav:hover {
    background: var(--mist);
    color: var(--ink);
  }
  .cal-nav:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .cal-title {
    border: 0;
    background: transparent;
    color: var(--ink);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    padding: 4px 12px;
    border-radius: 999px;
  }
  .cal-title:hover {
    background: var(--mist);
  }
  .cal-wd {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    margin-bottom: 2px;
  }
  .cal-wd-c {
    text-align: center;
    font-size: 11px;
    color: var(--ink-faint);
    padding: 2px 0;
  }
  .cal-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
  }
  .cal-cell {
    aspect-ratio: 1;
    display: grid;
    place-items: center;
    border: 0;
    background: transparent;
    color: var(--ink);
    font-size: 14px;
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease;
  }
  .cal-cell.empty {
    pointer-events: none;
  }
  .cal-cell:not(.sel):not(:disabled):hover {
    background: var(--mist);
  }
  .cal-cell:disabled {
    color: var(--ink-ghost);
    cursor: default;
  }
  .cal-cell.today:not(.sel) {
    box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--sky-deep) 55%, transparent);
    color: var(--sky-deep);
  }
  .cal-cell.sel {
    background: var(--sky-deep);
    color: #fff;
    font-weight: 600;
  }
</style>
