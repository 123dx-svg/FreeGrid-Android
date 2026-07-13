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

  // 仅可见片:value>0 且占比四舍五入 ≥1%(极小的碎片会显示成「0%」,既无意义又干扰,直接隐藏)
  const visibleSlices = $derived(slices.filter((s) => s.value > 0 && Math.round(s.pct) >= 1));
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
  let wrapEl: HTMLDivElement | undefined = $state();
  let donutEl: HTMLDivElement | undefined = $state();
  let legRefs: HTMLLIElement[] = [];
  let leaderPts = $state<string>(""); // overlay polyline points(wrap 坐标)
  let wrapW = $state(0);
  let wrapH = $state(0);

  // 意图判定:按下先不拦截滚动,长按(或未纵向滑动)才激活,避免误触打断纵向滚动
  const HOLD_MS = 180;
  const MOVE_CANCEL = 10; // 触发前纵向/横向移动超过此像素 → 判为滚动,放行
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let startX = 0;
  let startY = 0;
  let capId: number | null = null;
  let capEl: HTMLElement | null = null; // 捕获指针的元素(donut 或图例行)
  let armed = false; // 已进入激活态(可 scrub / 拦截默认)

  function clearHold() {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  }
  function release() {
    clearHold();
    armed = false;
    if (capEl && capId !== null) {
      try {
        capEl.releasePointerCapture(capId);
      } catch {
        /* ignore */
      }
    }
    capEl = null;
    capId = null;
  }

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

  // ── 扇区(donut)手势:长按/静止才激活,纵向滑动放行给页面滚动 ──
  function activateDonut(e: PointerEvent) {
    armed = true;
    capEl = donutEl ?? null;
    capId = e.pointerId;
    try {
      donutEl?.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    setActive(indexFromEvent(e));
  }
  function onDown(e: PointerEvent) {
    if (!hasData) return;
    startX = e.clientX;
    startY = e.clientY;
    clearHold();
    holdTimer = setTimeout(() => {
      holdTimer = null;
      activateDonut(e);
    }, HOLD_MS);
  }
  function onMove(e: PointerEvent) {
    if (armed) {
      const i = indexFromEvent(e);
      if (i !== null && i !== activeIndex) setActive(i);
      e.preventDefault();
      return;
    }
    // 触发前:移动过多判为滚动,取消长按,放行原生滚动
    if (holdTimer && (Math.abs(e.clientX - startX) > MOVE_CANCEL || Math.abs(e.clientY - startY) > MOVE_CANCEL)) {
      clearHold();
    }
  }
  function onUp() {
    if (armed) setActive(null);
    release();
  }

  // ── 图例(反向):按住某行 → 高亮扇区 + 反向连线;同样长按/静止才激活 ──
  function activateLeg(e: PointerEvent, i: number) {
    armed = true;
    capEl = legRefs[i] ?? null;
    capId = e.pointerId;
    try {
      legRefs[i]?.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    setActive(i);
  }
  function onLegDown(e: PointerEvent, i: number) {
    if (!hasData) return;
    startX = e.clientX;
    startY = e.clientY;
    clearHold();
    holdTimer = setTimeout(() => {
      holdTimer = null;
      activateLeg(e, i);
    }, HOLD_MS);
  }
  function onLegMove(e: PointerEvent) {
    if (armed) {
      e.preventDefault();
      return;
    }
    if (holdTimer && (Math.abs(e.clientX - startX) > MOVE_CANCEL || Math.abs(e.clientY - startY) > MOVE_CANCEL)) {
      clearHold();
    }
  }
  // 桌面端:鼠标悬停图例即预览(有 hover 能力时)
  function onLegEnter(i: number) {
    if (matchMedia("(hover: hover)").matches) setActive(i);
  }
  function onLegLeave() {
    if (!armed && matchMedia("(hover: hover)").matches) setActive(null);
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
        <span class="c-label num">{activeSlice.pct.toFixed(2)}%</span>
      {:else}
        <span class="c-val num">{centerValue}</span>
        {#if centerLabel}<span class="c-label">{centerLabel}</span>{/if}
      {/if}
    </div>
  </div>

  {#if showLegend && hasData}
    <ul class="legend">
      {#each visibleSlices as s, i (s.name)}
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <li
          class="leg-row"
          class:on={activeIndex === i}
          bind:this={legRefs[i]}
          onpointerdown={(e) => onLegDown(e, i)}
          onpointermove={onLegMove}
          onpointerup={onUp}
          onpointercancel={onUp}
          onpointerenter={() => onLegEnter(i)}
          onpointerleave={onLegLeave}
        >
          <span class="leg-dot" style="background:{s.color}"></span>
          <span class="leg-name">{s.name}{#if s.passive}<span class="leg-tag">被动</span>{/if}</span>
          <span class="leg-pct num">{s.pct.toFixed(2)}%</span>
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
    touch-action: pan-y; /* 纵向可正常滚动;长按才触发扇区读数 */
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
    touch-action: pan-y; /* 图例区纵向可滚动;长按才反向连线 */
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
