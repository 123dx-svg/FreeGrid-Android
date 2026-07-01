<script lang="ts">
  // 滚动轮日期时间选择器(iOS 风):三列「日期 / 时 / 分」,直接竖滑选择,无日历弹窗。
  // 纯 DOM scroll-snap,零依赖。绑定一个 Date(含到分钟的时间)。
  let { value = $bindable(new Date()) }: { value?: Date } = $props();

  const ITEM_H = 38;
  const VISIBLE = 5; // 奇数
  const PAD = ((VISIBLE - 1) / 2) * ITEM_H;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const DAYS_BACK = 365;
  const FUTURE = 7;
  const WD = ["日", "一", "二", "三", "四", "五", "六"];

  // 日期候选(时间升序:index 0 = 最早,末尾 = 未来)
  const today = sod(new Date());
  const dateItems: { d: Date; label: string }[] = [];
  for (let i = DAYS_BACK; i >= -FUTURE; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
    const label =
      diff === 0 ? "今天" : diff === -1 ? "昨天" : diff === 1 ? "明天" : `${d.getMonth() + 1}月${d.getDate()}日 周${WD[d.getDay()]}`;
    dateItems.push({ d, label });
  }
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  function dateIndexOf(v: Date): number {
    const t = sod(v).getTime();
    const i = dateItems.findIndex((it) => it.d.getTime() === t);
    return i < 0 ? DAYS_BACK : i; // 找不到落到「今天」
  }
  const selDateIdx = $derived(dateIndexOf(value));

  let dEl: HTMLDivElement | undefined = $state();
  let hEl: HTMLDivElement | undefined = $state();
  let mEl: HTMLDivElement | undefined = $state();
  let inited = false;

  function commit(dIdx: number, h: number, m: number) {
    const base = dateItems[Math.max(0, Math.min(dateItems.length - 1, dIdx))].d;
    value = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0);
  }

  let raf = 0;
  function onScroll(which: "d" | "h" | "m", el?: HTMLDivElement) {
    if (!el) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const idx = Math.max(0, Math.round(el.scrollTop / ITEM_H));
      if (which === "d") commit(idx, value.getHours(), value.getMinutes());
      else if (which === "h") commit(selDateIdx, Math.min(23, idx), value.getMinutes());
      else commit(selDateIdx, value.getHours(), Math.min(59, idx));
    });
  }

  // 初次挂载:把三列滚到当前 value 对应位置
  $effect(() => {
    if (inited || !dEl || !hEl || !mEl) return;
    inited = true;
    dEl.scrollTop = dateIndexOf(value) * ITEM_H;
    hEl.scrollTop = value.getHours() * ITEM_H;
    mEl.scrollTop = value.getMinutes() * ITEM_H;
  });
</script>

<div class="wdt">
  <div class="wdt-heads">
    <span class="wdt-h date">日期</span>
    <span class="wdt-h">时</span>
    <span class="wdt-h">分</span>
  </div>
  <div class="wdt-row" style="height:{VISIBLE * ITEM_H}px">
    <div class="wheel date" bind:this={dEl} onscroll={() => onScroll("d", dEl)}>
      <div class="spc" style="height:{PAD}px"></div>
      {#each dateItems as it, i (i)}
        <div class="w-item" class:sel={i === selDateIdx} style="height:{ITEM_H}px">{it.label}</div>
      {/each}
      <div class="spc" style="height:{PAD}px"></div>
    </div>
    <div class="wheel" bind:this={hEl} onscroll={() => onScroll("h", hEl)}>
      <div class="spc" style="height:{PAD}px"></div>
      {#each hours as h (h)}
        <div class="w-item num" class:sel={h === value.getHours()} style="height:{ITEM_H}px">{pad2(h)}</div>
      {/each}
      <div class="spc" style="height:{PAD}px"></div>
    </div>
    <div class="wheel" bind:this={mEl} onscroll={() => onScroll("m", mEl)}>
      <div class="spc" style="height:{PAD}px"></div>
      {#each minutes as m (m)}
        <div class="w-item num" class:sel={m === value.getMinutes()} style="height:{ITEM_H}px">{pad2(m)}</div>
      {/each}
      <div class="spc" style="height:{PAD}px"></div>
    </div>
    <!-- 中央选中高亮带 -->
    <div class="wdt-band" style="top:{PAD}px;height:{ITEM_H}px"></div>
  </div>
</div>

<style>
  .wdt {
    border: 1px solid var(--hairline);
    border-radius: 12px;
    background: var(--mist2);
    padding: var(--sp-sm) var(--sp-sm) 0;
    overflow: hidden;
  }
  .wdt-heads {
    display: flex;
    padding: 0 var(--sp-xs) 4px;
  }
  .wdt-h {
    flex: 1;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.05em;
    color: var(--ink-faint);
  }
  .wdt-h.date {
    flex: 2;
  }
  .wdt-row {
    position: relative;
    display: flex;
    gap: var(--sp-xs);
  }
  .wheel {
    flex: 1;
    overflow-y: scroll;
    scroll-snap-type: y mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .wheel::-webkit-scrollbar {
    display: none;
  }
  .wheel.date {
    flex: 2;
  }
  .w-item {
    display: grid;
    place-items: center;
    scroll-snap-align: center;
    font-size: 16px;
    color: var(--ink-faint);
    white-space: nowrap;
    transition: color 0.12s ease, transform 0.12s ease;
  }
  .w-item.sel {
    color: var(--ink);
    font-weight: 600;
    transform: scale(1.04);
  }
  .wdt-band {
    position: absolute;
    left: 0;
    right: 0;
    pointer-events: none;
    border-top: 1px solid var(--hairline);
    border-bottom: 1px solid var(--hairline);
    background: color-mix(in srgb, var(--sky) 9%, transparent);
    border-radius: 8px;
  }
</style>
