<script lang="ts">
  import type { GridState } from "../freedom-math";

  // 注:iOS gridState 里 blueDays = 资产(渲染成金), yellowDays = 现金(渲染成蓝)。
  // 沿用同一映射:资产金格在前,现金蓝格在后,末格 = 当前(发光)。
  let { grid }: { grid: GridState } = $props();

  const SIZE: Record<string, number> = { day: 16, month: 20, year: 26 };

  let cells = $derived.by(() => {
    const arr: ("gold" | "blue")[] = [];
    for (let i = 0; i < grid.blueDays; i++) arr.push("gold");
    for (let i = 0; i < grid.yellowDays; i++) arr.push("blue");
    return arr;
  });
  let size = $derived(SIZE[grid.unit] ?? 16);
</script>

<div class="grid" style="--cell:{size}px">
  {#each cells as c, i (i)}
    <span class="cell {c}" class:current={i === cells.length - 1}></span>
  {/each}
</div>

<style>
  .grid {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .cell {
    width: var(--cell);
    height: var(--cell);
    border-radius: 4px;
    transition: transform 0.15s ease;
  }
  .cell.gold {
    background: var(--income-gold);
  }
  .cell.blue {
    background: var(--asset-blue);
  }
  /* 当前格:提亮 + 同色辉光,呼应 iOS 发光当前格 */
  .cell.current {
    filter: brightness(1.5) saturate(0.7);
    box-shadow: 0 0 10px 2px color-mix(in srgb, var(--asset-blue) 70%, white);
    position: relative;
    z-index: 1;
  }
</style>
