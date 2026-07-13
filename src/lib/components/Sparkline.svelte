<script lang="ts">
  // 移植 iOS Sparkline:skyDeep 折线,无填充无轴。终点 = 拟星光高亮点,强调"最右侧 = 今天"。
  // 像素空间计算(bind clientWidth)→ 不被 viewBox 拉伸,圆点保持正圆。左右各留间隙,右侧多留一点给光晕。
  let {
    values,
    height = 44,
    stroke = "var(--sky-deep)",
    lineWidth = 1.6,
  }: { values: number[]; height?: number; stroke?: string; lineWidth?: number } = $props();

  let w = $state(300);
  const padY = 6;
  const padL = 12; // 左侧间隙
  const padR = 16; // 右侧间隙(给"今天"光点留出间隙 + 光晕空间)

  let pts = $derived.by(() => {
    if (!values.length) return [] as { x: number; y: number }[];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(max - min, 1);
    const usableW = Math.max(1, w - padL - padR);
    const stepX = values.length > 1 ? usableW / (values.length - 1) : 0;
    return values.map((v, i) => ({
      x: padL + i * stepX,
      y: height - padY - ((v - min) / range) * (height - 2 * padY),
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
      <!-- 今天:拟星光高亮点(外晕 twinkle + 实心 + 白色星芯) -->
      <circle class="pt-halo" cx={last.x} cy={last.y} r="8.5" fill={stroke} />
      <circle class="pt-mid" cx={last.x} cy={last.y} r="4.6" fill={stroke} />
      <circle cx={last.x} cy={last.y} r="3" fill={stroke} />
      <circle cx={last.x} cy={last.y} r="1.3" fill="#fff" opacity="0.95" />
    {/if}
  </svg>
</div>

<style>
  .spark {
    width: 100%;
    min-width: 0;
  }
  svg {
    display: block;
    overflow: visible;
  }
  .pt-halo {
    opacity: 0.22;
    transform-box: fill-box;
    transform-origin: center;
    animation: ptTwinkle 2.2s ease-in-out infinite;
  }
  .pt-mid {
    opacity: 0.45;
  }
  @keyframes ptTwinkle {
    0%,
    100% {
      opacity: 0.14;
    }
    50% {
      opacity: 0.36;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pt-halo {
      animation: none;
      opacity: 0.2;
    }
  }
</style>
