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
  /* 当前格:呼吸动画(scale + 白辉光脉动),移植 iOS LifeGrid 呼吸格。
     纯 CSS keyframes —— 不依赖 JS,不会像 iOS repeatForever 那样冻结。 */
  .cell.current {
    position: relative;
    z-index: 1;
    animation: breathe 2.6s ease-in-out infinite;
  }
  @keyframes breathe {
    0%,
    100% {
      filter: brightness(1.2);
      transform: scale(1);
      box-shadow: 0 0 5px 1px rgba(255, 255, 255, 0.35);
    }
    50% {
      filter: brightness(1.75);
      transform: scale(1.14);
      box-shadow: 0 0 14px 4px rgba(255, 255, 255, 0.7);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .cell.current {
      animation: none;
      filter: brightness(1.5);
      box-shadow: 0 0 10px 2px rgba(255, 255, 255, 0.5);
    }
  }
</style>
