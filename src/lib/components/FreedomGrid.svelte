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
  /* 当前格:呼吸动画(scale + 微辉光脉动),移植 iOS LifeGrid 呼吸格。
     纯 CSS keyframes —— 不依赖 JS,不会像 iOS repeatForever 那样冻结。
     ⚠️ 对齐 iOS:不靠 brightness 把格子刷白(iOS 是固定浅色调 + 紧凑白辉光,无亮度倍增)。
     旧版 brightness(1.75) + 14px/4px 宽白阴影会让峰值逼近全白 → 砍掉 bloom:
     亮度峰值降到 1.1、白阴影收紧到 3→7px 半径 + 低透明度,scale 保留,呼吸不刺眼。 */
  .cell.current {
    position: relative;
    z-index: 1;
    animation: breathe 2.8s ease-in-out infinite;
  }
  @keyframes breathe {
    0%,
    100% {
      filter: brightness(1);
      transform: scale(1.02);
      box-shadow: 0 0 3px 0 rgba(255, 255, 255, 0.18);
    }
    50% {
      filter: brightness(1.1);
      transform: scale(1.12);
      box-shadow: 0 0 7px 1px rgba(255, 255, 255, 0.4);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .cell.current {
      animation: none;
      filter: brightness(1.08);
      box-shadow: 0 0 6px 1px rgba(255, 255, 255, 0.32);
    }
  }
</style>
