<script lang="ts">
  // 纯 SVG 月度柱状图:每月「收入 / 支出」并排双柱。像素空间自适应(bind:clientWidth)。
  import type { MonthlyOps } from "../annual";

  let {
    data,
    height = 156,
    incomeColor = "var(--sky-deep)",
    expenseColor = "var(--flame)",
  }: {
    data: MonthlyOps[];
    height?: number;
    incomeColor?: string;
    expenseColor?: string;
  } = $props();

  let w = $state(600);
  const labelH = 20;
  const topPad = 8;

  const geo = $derived.by(() => {
    const chartH = height - labelH - topPad;
    const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)));
    const groupW = data.length > 0 ? w / data.length : w;
    const barW = Math.max(3, Math.min(14, groupW * 0.28));
    const gap = Math.max(2, groupW * 0.08);
    return data.map((d, i) => {
      const cx = i * groupW + groupW / 2;
      const incH = (d.income / max) * chartH;
      const expH = (d.expense / max) * chartH;
      const baseY = topPad + chartH;
      return {
        month: d.month,
        incX: cx - barW - gap / 2,
        expX: cx + gap / 2,
        barW,
        incY: baseY - incH,
        expY: baseY - expH,
        incH,
        expH,
        baseY,
        labelX: cx,
      };
    });
  });

  const hasData = $derived(data.some((d) => d.income > 0 || d.expense > 0));
</script>

<div class="bar-wrap">
  <div class="bar-legend">
    <span class="bl-item"><span class="bl-dot" style="background:{incomeColor}"></span>收入</span>
    <span class="bl-item"><span class="bl-dot" style="background:{expenseColor}"></span>支出</span>
  </div>
  <div class="bars" style="height:{height}px" bind:clientWidth={w}>
    <svg width={w} {height} role="img" aria-label="月度收入支出柱状图">
      {#if hasData}
        {#each geo as g (g.month)}
          {#if g.incH > 0}
            <rect x={g.incX} y={g.incY} width={g.barW} height={g.incH} rx="2" fill={incomeColor} />
          {/if}
          {#if g.expH > 0}
            <rect x={g.expX} y={g.expY} width={g.barW} height={g.expH} rx="2" fill={expenseColor} />
          {/if}
          <text x={g.labelX} y={height - 6} text-anchor="middle" class="m-label">{g.month}</text>
        {/each}
      {/if}
    </svg>
  </div>
</div>

<style>
  .bar-wrap {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
  }
  .bar-legend {
    display: flex;
    gap: var(--sp-lg);
  }
  .bl-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--ink-muted);
  }
  .bl-dot {
    width: 9px;
    height: 9px;
    border-radius: 3px;
  }
  .bars {
    width: 100%;
  }
  svg {
    display: block;
    overflow: visible;
  }
  .m-label {
    font-family: var(--font-mono);
    font-size: 9px;
    fill: var(--ink-faint);
  }
</style>
