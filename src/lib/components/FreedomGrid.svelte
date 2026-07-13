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
  /* 当前格「今天」:增强呼吸(更大 scale + 白芯 + 金/蓝同色光晕双层辉光)。
     纯 CSS keyframes,只动 transform / box-shadow / filter,不依赖 JS。
     金格用金色光晕、蓝格用蓝色光晕(--halo),让"今天"更醒目、有星光感。 */
  .cell.current {
    position: relative;
    z-index: 1;
    animation: breathe 2.6s ease-in-out infinite;
  }
  .cell.gold.current {
    --halo: 245, 196, 81;
  }
  .cell.blue.current {
    --halo: 130, 170, 255;
  }
  @keyframes breathe {
    0%,
    100% {
      filter: brightness(1.02);
      transform: scale(1.04);
      box-shadow:
        0 0 4px 0 rgba(255, 255, 255, 0.25),
        0 0 8px 1px rgba(var(--halo, 255, 255, 255), 0.28);
    }
    50% {
      filter: brightness(1.18);
      transform: scale(1.2);
      box-shadow:
        0 0 8px 1px rgba(255, 255, 255, 0.55),
        0 0 16px 4px rgba(var(--halo, 255, 255, 255), 0.6);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .cell.current {
      animation: none;
      filter: brightness(1.1);
      box-shadow:
        0 0 6px 1px rgba(255, 255, 255, 0.35),
        0 0 12px 2px rgba(var(--halo, 255, 255, 255), 0.4);
    }
  }
</style>
