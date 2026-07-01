<script lang="ts">
  // 纯 SVG 环形图(donut)。stroke-dasharray 拼弧段,中心显示总额。零依赖。
  // 交互:按住区块 → 画折线连到右侧图例 + 高亮该分类 + 中心改显选中信息;滑动可切换;松手消失。
  import type { Slice } from "../annual";

  let {
    slices,
    centerValue = "",
    centerLabel = "",
    showLegend = true,
    size = 168,
  }: {
    slices: Slice[];
    centerValue?: string;
    centerLabel?: string;
    showLegend?: boolean;
    size?: number;
  } = $props();

  const R = 40;
  const C = 2 * Math.PI * R; // 251.327
  const STROKE = 15;

  // 仅可见片(value>0),区块/图例/命中索引共用,保证对齐
  const visibleSlices = $derived(slices.filter((s) => s.value > 0));
  const total = $derived(visibleSlices.reduce((s, x) => s + x.value, 0));

  // 累积起点 + dash 几何 + 起止 frac(用于命中/弧中点)
  const segs = $derived.by(() => {
    if (total <= 0) return [] as { color: string; dash: string; offset: number; start: number; frac: number }[];
    let acc = 0;
    return visibleSlices.map((s) => {
      const frac = s.value / total;
      const seg = frac * C;
      const start = acc;
      acc += frac;
      return { color: s.color, dash: `${seg.toFixed(2)} ${(C - seg).toFixed(2)}`, offset: -(start * C), start, frac };
    });
  });

  const hasData = $derived(total > 0);

  // ── 按住交互状态 ──
  let activeIndex = $state<number | null>(null);
  let pressing = false;
  let wrapEl: HTMLDivElement | undefined = $state();
  let donutEl: HTMLDivElement | undefined = $state();
  let legRefs: HTMLLIElement[] = [];
  let leaderPts = $state<string>(""); // overlay polyline points(wrap 坐标)
  let wrapW = $state(0);
  let wrapH = $state(0);

  const yuan = (n: number) => "¥" + Math.round(n).toLocaleString("en-US");

  function indexFromEvent(e: PointerEvent): number | null {
    if (!donutEl || !hasData) return null;
    const r = donutEl.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    const outer = (R + STROKE / 2) / 100 * r.width;
    if (dist > outer * 1.25) return null; // 太远不算
    // 角度 → 顶部起、顺时针的 frac
    let a = Math.atan2(dy, dx) + Math.PI / 2;
    a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const frac = a / (2 * Math.PI);
    for (let i = 0; i < segs.length; i++) {
      if (frac >= segs[i].start && frac < segs[i].start + segs[i].frac) return i;
    }
    return segs.length - 1;
  }

  function computeLeader(i: number) {
    if (!wrapEl || !donutEl || !legRefs[i]) {
      leaderPts = "";
      return;
    }
    const wr = wrapEl.getBoundingClientRect();
    wrapW = wr.width;
    wrapH = wr.height;
    const dr = donutEl.getBoundingClientRect();
    const cx = dr.left - wr.left + dr.width / 2;
    const cy = dr.top - wr.top + dr.height / 2;
    const Rpx = (R / 100) * dr.width;
    const mid = segs[i].start + segs[i].frac / 2;
    const ang = mid * 2 * Math.PI - Math.PI / 2;
    const ax = cx + Math.cos(ang) * Rpx;
    const ay = cy + Math.sin(ang) * Rpx;
    const outR = Rpx + (STROKE / 2 / 100) * dr.width + 10;
    const ox = cx + Math.cos(ang) * outR;
    const oy = cy + Math.sin(ang) * outR;
    const lr = legRefs[i].getBoundingClientRect();
    const lx = lr.left - wr.left;
    const ly = lr.top - wr.top + lr.height / 2;
    // 弧中点 → 径向外伸拐点 → 横拐到图例行高度 → 接到图例行左缘
    const kneeX = Math.max(ox, dr.right - wr.left + 6);
    leaderPts = `${ax.toFixed(1)},${ay.toFixed(1)} ${ox.toFixed(1)},${oy.toFixed(1)} ${kneeX.toFixed(1)},${oy.toFixed(1)} ${kneeX.toFixed(1)},${ly.toFixed(1)} ${(lx - 2).toFixed(1)},${ly.toFixed(1)}`;
  }

  function setActive(i: number | null) {
    activeIndex = i;
    if (i !== null) computeLeader(i);
    else leaderPts = "";
  }

  function onDown(e: PointerEvent) {
    if (!hasData) return;
    pressing = true;
    try {
      donutEl?.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    setActive(indexFromEvent(e));
    e.preventDefault();
  }
  function onMove(e: PointerEvent) {
    if (!pressing) return;
    const i = indexFromEvent(e);
    if (i !== null && i !== activeIndex) setActive(i);
    e.preventDefault();
  }
  function onUp(e: PointerEvent) {
    pressing = false;
    setActive(null);
    try {
      donutEl?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  const activeSlice = $derived(activeIndex !== null ? visibleSlices[activeIndex] : null);
</script>

<div class="donut-wrap" bind:this={wrapEl}>
  <div
    class="donut"
    bind:this={donutEl}
    style="width:{size}px;height:{size}px"
    onpointerdown={onDown}
    onpointermove={onMove}
    onpointerup={onUp}
    onpointercancel={onUp}
    role="presentation"
  >
    <svg viewBox="0 0 100 100" role="img" aria-label="占比环形图">
      <!-- 底环 -->
      <circle cx="50" cy="50" r={R} fill="none" stroke="var(--hairline-soft)" stroke-width={STROKE} />
      {#if hasData}
        <g transform="rotate(-90 50 50)">
          {#each segs as s, i (i)}
            <circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={s.color}
              stroke-width={activeIndex === i ? STROKE + 2.5 : STROKE}
              stroke-dasharray={s.dash}
              stroke-dashoffset={s.offset}
              stroke-linecap="butt"
              opacity={activeIndex === null || activeIndex === i ? 1 : 0.26}
              style="transition: opacity 0.12s ease, stroke-width 0.12s ease"
            />
          {/each}
        </g>
      {/if}
    </svg>
    <div class="center">
      {#if activeSlice}
        <span class="c-name">{activeSlice.name}</span>
        <span class="c-val num">{yuan(activeSlice.value)}</span>
        <span class="c-label num">{Math.round(activeSlice.pct)}%</span>
      {:else}
        <span class="c-val num">{centerValue}</span>
        {#if centerLabel}<span class="c-label">{centerLabel}</span>{/if}
      {/if}
    </div>
  </div>

  {#if showLegend && hasData}
    <ul class="legend">
      {#each visibleSlices as s, i (s.name)}
        <li class="leg-row" class:on={activeIndex === i} bind:this={legRefs[i]}>
          <span class="leg-dot" style="background:{s.color}"></span>
          <span class="leg-name">{s.name}{#if s.passive}<span class="leg-tag">被动</span>{/if}</span>
          <span class="leg-pct num">{Math.round(s.pct)}%</span>
        </li>
      {/each}
    </ul>
  {/if}

  <!-- 折线 leader 浮层 -->
  {#if activeIndex !== null && leaderPts}
    <svg class="leader" width={wrapW} height={wrapH} viewBox="0 0 {wrapW} {wrapH}" aria-hidden="true">
      <polyline
        points={leaderPts}
        fill="none"
        stroke={visibleSlices[activeIndex].color}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle
        cx={leaderPts.split(" ")[0].split(",")[0]}
        cy={leaderPts.split(" ")[0].split(",")[1]}
        r="2.6"
        fill={visibleSlices[activeIndex].color}
      />
    </svg>
  {/if}
</div>

<style>
  .donut-wrap {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--sp-lg);
    flex-wrap: wrap;
  }
  .donut {
    position: relative;
    flex: 0 0 auto;
    touch-action: none; /* 滑动选区块时不让外层滚动 */
    cursor: pointer;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
  .center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    pointer-events: none;
    text-align: center;
    padding: 0 8px;
  }
  .c-name {
    font-size: 12px;
    font-weight: 500;
    color: var(--ink-muted);
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .c-val {
    font-size: 19px;
    font-weight: 600;
    color: var(--ink);
    line-height: 1.05;
  }
  .c-label {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.06em;
    color: var(--ink-faint);
  }
  .legend {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-width: 130px;
  }
  .leg-row {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
    padding: 2px 6px;
    margin: 0 -6px;
    border-radius: 7px;
    transition: background 0.12s ease;
  }
  .leg-row.on {
    background: color-mix(in srgb, var(--ink) 9%, transparent);
  }
  .leg-row.on .leg-name {
    color: var(--ink);
    font-weight: 600;
  }
  .leg-dot {
    width: 9px;
    height: 9px;
    border-radius: 3px;
    flex: 0 0 9px;
  }
  .leg-name {
    font-size: 13px;
    color: var(--ink-muted);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .leg-tag {
    font-size: 9px;
    color: var(--paper);
    background: var(--income-gold);
    border-radius: 4px;
    padding: 1px 4px;
    margin-left: 5px;
    vertical-align: middle;
  }
  .leg-pct {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--ink);
    flex: 0 0 auto;
  }
  .leader {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 3;
    overflow: visible;
  }
</style>
