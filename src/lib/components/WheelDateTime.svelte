<script lang="ts">
  // 滚轮日期时间选择器 —— 读作一个整体「7月6日(星期一)-14:58」。
  // 列:日期(含星期,一列读作"7月6日(星期一)")| 时 | 分,时/分紧贴成"14:58"。scroll-snap 竖滑,精确到分。
  // 纯 DOM,零依赖。绑定一个 Date。可滚到过去也可滚到未来。默认当前时刻(由父级初值决定)。
  let {
    value = $bindable(new Date()),
    daysBack = 365,
    daysForward = 365,
  }: { value?: Date; daysBack?: number; daysForward?: number } = $props();

  const ITEM_H = 36; // 每行高
  const VISIBLE = 3; // 可见行数(奇数,中间为选中)
  const WD = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(new Date());

  // 日期列:今天前 daysBack 天 → 后 daysForward 天(升序,今天居中)
  const dayList: Date[] = (() => {
    const arr: Date[] = [];
    for (let i = -daysBack; i <= daysForward; i++) arr.push(new Date(today.getFullYear(), today.getMonth(), today.getDate() + i));
    return arr;
  })();
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);
  const pad2 = (n: number) => String(n).padStart(2, "0");

  const dayLabel = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日(${WD[d.getDay()]})`;
  const readout = $derived(`${dayLabel(value)}-${pad2(value.getHours())}:${pad2(value.getMinutes())}`);

  const dayIdx = $derived.by(() => {
    const t = startOfDay(value).getTime();
    const i = dayList.findIndex((d) => d.getTime() === t);
    return i < 0 ? dayList.length - 1 : i;
  });

  let dayEl = $state<HTMLDivElement | null>(null);
  let hourEl = $state<HTMLDivElement | null>(null);
  let minEl = $state<HTMLDivElement | null>(null);

  let guard = false; // 程序设置 scrollTop 时忽略滚动回调
  function positionAll() {
    guard = true;
    if (dayEl) dayEl.scrollTop = dayIdx * ITEM_H;
    if (hourEl) hourEl.scrollTop = value.getHours() * ITEM_H;
    if (minEl) minEl.scrollTop = value.getMinutes() * ITEM_H;
    requestAnimationFrame(() => (guard = false));
  }

  // 挂载 & value 外部变化(重置/切日)→ 重新定位
  let lastSet = -1;
  $effect(() => {
    void dayEl; void hourEl; void minEl; // 依赖元素挂载
    if (value.getTime() !== lastSet) {
      lastSet = value.getTime();
      positionAll();
    }
  });

  let sTimer: ReturnType<typeof setTimeout> | undefined;
  function onScroll() {
    if (guard) return;
    if (sTimer) clearTimeout(sTimer);
    sTimer = setTimeout(commit, 110);
  }
  function commit() {
    const di = dayEl ? Math.round(dayEl.scrollTop / ITEM_H) : dayIdx;
    const hi = hourEl ? Math.round(hourEl.scrollTop / ITEM_H) : value.getHours();
    const mi = minEl ? Math.round(minEl.scrollTop / ITEM_H) : value.getMinutes();
    const d = dayList[Math.max(0, Math.min(dayList.length - 1, di))];
    const h = Math.max(0, Math.min(23, hi));
    const m = Math.max(0, Math.min(59, mi));
    const nv = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0);
    if (nv.getTime() === value.getTime()) return;
    lastSet = nv.getTime(); // 防止 effect 再次定位打断滚动
    value = nv;
  }
</script>

<div class="wdt">
  <p class="wdt-sel">{readout}</p>
  <div class="wheel">
    <div class="wband" aria-hidden="true"></div>
    <div class="wcol day" bind:this={dayEl} onscroll={onScroll}>
      <div class="wpad"></div>
      {#each dayList as d, i (i)}
        <div class="witem" class:on={i === dayIdx}>{dayLabel(d)}</div>
      {/each}
      <div class="wpad"></div>
    </div>
    <div class="wtime">
      <div class="wcol time" bind:this={hourEl} onscroll={onScroll}>
        <div class="wpad"></div>
        {#each hours as h (h)}
          <div class="witem" class:on={h === value.getHours()}>{pad2(h)}</div>
        {/each}
        <div class="wpad"></div>
      </div>
      <div class="wcolon" aria-hidden="true">:</div>
      <div class="wcol time" bind:this={minEl} onscroll={onScroll}>
        <div class="wpad"></div>
        {#each minutes as m (m)}
          <div class="witem" class:on={m === value.getMinutes()}>{pad2(m)}</div>
        {/each}
        <div class="wpad"></div>
      </div>
    </div>
  </div>
</div>

<style>
  .wdt {
    border: 1px solid var(--hairline);
    border-radius: 14px;
    background: var(--mist2);
    padding: 10px 12px 6px;
  }
  .wdt-sel {
    text-align: center;
    font-size: 15px;
    color: var(--sky-deep);
    font-weight: 600;
    letter-spacing: 0.01em;
    margin: 0 0 6px;
  }
  .wheel {
    position: relative;
    display: flex;
    align-items: stretch;
    justify-content: center;
    gap: 10px;
    height: 108px; /* VISIBLE(3) * ITEM_H */
  }
  .wband {
    position: absolute;
    left: 0;
    right: 0;
    top: 36px; /* (VISIBLE-1)/2 * ITEM_H */
    height: 36px; /* ITEM_H */
    border-top: 1px solid color-mix(in srgb, var(--sky-deep) 45%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--sky-deep) 45%, transparent);
    background: color-mix(in srgb, var(--sky) 8%, transparent);
    border-radius: 8px;
    pointer-events: none;
    z-index: 0;
  }
  .wcol {
    position: relative;
    z-index: 1;
    height: 108px;
    overflow-y: auto;
    scroll-snap-type: y mandatory;
    text-align: center;
    scrollbar-width: none;
    overscroll-behavior: contain;
  }
  .wcol::-webkit-scrollbar {
    display: none;
  }
  .wcol.day {
    flex: 0 1 auto;
    min-width: 150px;
  }
  .wtime {
    display: flex;
    align-items: stretch;
    gap: 0;
  }
  .wcol.time {
    width: 44px;
  }
  .wcolon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 10px;
    color: var(--ink);
    font-size: 16px;
    font-weight: 600;
    z-index: 1;
  }
  .wpad {
    height: 36px; /* (VISIBLE-1)/2 * ITEM_H */
  }
  .witem {
    height: 36px;
    line-height: 36px;
    scroll-snap-align: center;
    font-size: 15px;
    color: var(--ink-faint);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    transition: color 0.12s ease;
  }
  .witem.on {
    color: var(--ink);
    font-weight: 600;
  }
</style>
