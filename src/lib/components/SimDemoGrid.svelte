<script lang="ts">
  // 模拟决策「格子推演」动画——1:1 移植自 iOS SimDemoGrid。
  // 把"自由天数 from→to"翻译成可见的格子级联熄灭(支出)/ 点亮(收入)。
  // 动画驱动:requestAnimationFrame 喂纯函数 elapsed(对齐 iOS TimelineView 思路),
  //   三态共用一套逐格分类逻辑:idle 停旧态(-1)/ done 停新态(9999)/ playing 真实 elapsed。
  import { simDemoTiming, easeOut, envelope } from "../sim-demo";
  import { GRID_UNIT_META, type GridUnit } from "../freedom-math";

  type Phase = "idle" | "playing" | "done";
  let {
    unit,
    oldCount,
    newCount,
    oldBlue,
    newBlue,
    phase,
  }: {
    unit: GridUnit;
    oldCount: number;
    newCount: number;
    oldBlue: number; // 旧态蓝格(锁定资产)数,边界外即金格
    newBlue: number; // 新态蓝格数
    phase: Phase;
  } = $props();

  const total = $derived(Math.max(oldCount, newCount));
  const delta = $derived(Math.abs(newCount - oldCount));
  const isIgnite = $derived(newCount > oldCount);
  const size = $derived(GRID_UNIT_META[unit].cellSize);

  // 动画进度(秒)。playing 时 rAF 每帧刷;idle/done 直接停在两端。
  let elapsed = $state(-1);

  $effect(() => {
    if (phase === "playing") {
      const start = performance.now();
      const timing = simDemoTiming(delta, isIgnite);
      let raf = 0;
      const tick = () => {
        const e = (performance.now() - start) / 1000;
        elapsed = e;
        if (e <= timing.total + 0.15) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    elapsed = phase === "done" ? 9999 : -1;
  });

  type CellVis = {
    base: "gold" | "blue";
    opacity: number;
    scale: number;
    glow: number;
    glowColor: "self" | "flame";
  };

  // 单格:稳定区直接满亮(新态配色);过渡区按 envelope 点燃/熄灭。
  // 配色沿用 Dashboard LifeGrid:前段(blue 计数=锁定资产)渲染金 incomeGold,后段(现金)渲染蓝 assetBlue。
  function cellVis(
    i: number,
    e: number,
    timing: { span: number; cellDur: number; total: number }
  ): CellVis {
    const stableCount = Math.min(oldCount, newCount);
    if (i < stableCount) {
      return { base: i < newBlue ? "gold" : "blue", opacity: 1, scale: 1, glow: 0, glowColor: "self" };
    }
    const k = isIgnite ? i - oldCount : oldCount - 1 - i;
    const startK = delta <= 1 ? 0 : (k / (delta - 1)) * timing.span;
    const lt = Math.min(1, Math.max(0, (e - startK) / timing.cellDur));

    if (isIgnite) {
      const base = (i < newBlue ? "gold" : "blue") as "gold" | "blue";
      const env = envelope(lt, 0.12, 1.4);
      const opacity = 0.14 + 0.86 * easeOut(Math.min(1, lt / 0.3));
      return { base, opacity, scale: 1 + 0.2 * env, glow: env * 0.9, glowColor: "self" };
    } else {
      const base = (i < oldBlue ? "gold" : "blue") as "gold" | "blue";
      const env = envelope(lt, 0.16, 1.4);
      const opacity = 1 - 0.86 * easeOut(Math.min(1, lt / 0.55));
      // 熄灭用 flame 焰光——贴合 App "支出 = 朱砂" 语义
      return { base, opacity, scale: 1 + 0.12 * env, glow: env * 0.8, glowColor: "flame" };
    }
  }

  const cells = $derived.by<CellVis[]>(() => {
    const timing = simDemoTiming(delta, isIgnite);
    const arr: CellVis[] = [];
    for (let i = 0; i < total; i++) arr.push(cellVis(i, elapsed, timing));
    return arr;
  });

  function cssFor(c: CellVis): string {
    const cellColor = c.base === "gold" ? "var(--income-gold)" : "var(--asset-blue)";
    const bg = `color-mix(in srgb, ${cellColor} ${Math.round(c.opacity * 100)}%, transparent)`;
    const glowColor = c.glowColor === "flame" ? "var(--flame)" : cellColor;
    const shadow =
      c.glow > 0.01
        ? `0 0 ${(size * 1.2 * c.glow).toFixed(1)}px color-mix(in srgb, ${glowColor} ${Math.round(c.glow * 90)}%, transparent)`
        : "none";
    return `background:${bg};transform:scale(${c.scale.toFixed(3)});box-shadow:${shadow};z-index:${c.glow > 0.01 ? 1 : 0}`;
  }
</script>

<div class="demo-grid" style="--cell:{size}px">
  {#each cells as c, i (i)}
    <span class="demo-cell" style={cssFor(c)}></span>
  {/each}
</div>

<style>
  .demo-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .demo-cell {
    width: var(--cell);
    height: var(--cell);
    border-radius: 3px;
    position: relative;
  }
</style>
