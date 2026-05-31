<script lang="ts">
  // 移植 iOS Sparkline:skyDeep 折线,无填充无轴,终点小圆强调"现在"。
  // 像素空间计算(bind clientWidth)→ 不被 viewBox 拉伸,圆点保持正圆。
  let {
    values,
    height = 44,
    stroke = "var(--sky-deep)",
    lineWidth = 1.6,
  }: { values: number[]; height?: number; stroke?: string; lineWidth?: number } = $props();

  let w = $state(600);
  const pad = 5;

  let pts = $derived.by(() => {
    if (!values.length) return [] as { x: number; y: number }[];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(max - min, 1);
    const stepX = values.length > 1 ? w / (values.length - 1) : 0;
    return values.map((v, i) => ({
      x: i * stepX,
      y: height - pad - ((v - min) / range) * (height - 2 * pad),
    }));
  });

  let path = $derived(
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
  );
  let last = $derived(pts.length ? pts[pts.length - 1] : null);
</script>

<div class="spark" style="height:{height}px" bind:clientWidth={w}>
  <svg width={w} {height}>
    {#if pts.length >= 2}
      <path
        d={path}
        fill="none"
        {stroke}
        stroke-width={lineWidth}
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    {/if}
    {#if last}
      <circle cx={last.x} cy={last.y} r="2.6" fill={stroke} />
    {/if}
  </svg>
</div>

<style>
  .spark {
    width: 100%;
  }
  svg {
    display: block;
    overflow: visible;
  }
</style>
