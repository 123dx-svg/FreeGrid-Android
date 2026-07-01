<script lang="ts">
  // 徽章解锁庆祝浮层(全局,挂 App.svelte)。单枚=完整庆祝;多枚=合并一张卡。
  // 纯 transform/opacity 动画,尊重 prefers-reduced-motion。自动消失或点击(点击进徽章墙)。
  import { celebrationQueue, dismissCelebration } from "../achievements.svelte";

  let { onOpenWall }: { onOpenWall?: () => void } = $props();

  const queue = $derived(celebrationQueue());
  const batch = $derived(queue[0] ?? null);
  const single = $derived(batch && batch.length === 1 ? batch[0] : null);

  let timer: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    if (batch) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => dismissCelebration(), 2800);
      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  });

  function onTap() {
    onOpenWall?.();
    dismissCelebration();
  }
</script>

{#if batch}
  {#key batch}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="bt-wrap" onclick={onTap}>
      <div class="bt-card" style={single ? `--hue:${single.hue}` : "--hue:42"}>
        {#if single}
          <div class="bt-icon-big">{single.icon}</div>
          <div class="bt-body">
            <span class="bt-kick">🎉 成就解锁</span>
            <span class="bt-name">{single.name}</span>
            <span class="bt-desc">{single.desc}</span>
          </div>
        {:else}
          <div class="bt-icons">
            {#each batch.slice(0, 6) as a (a.id)}
              <span class="bt-ic">{a.icon}</span>
            {/each}
          </div>
          <div class="bt-body">
            <span class="bt-kick">🎉 成就解锁</span>
            <span class="bt-name">解锁 {batch.length} 枚新徽章</span>
            <span class="bt-desc">点击查看你的成就墙 ›</span>
          </div>
        {/if}
      </div>
    </div>
  {/key}
{/if}

<style>
  .bt-wrap {
    position: fixed;
    top: calc(env(safe-area-inset-top, 0px) + 14px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 1200;
    max-width: 92vw;
    cursor: pointer;
  }
  .bt-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 18px 12px 14px;
    border-radius: 18px;
    background: color-mix(in srgb, hsl(var(--hue) 60% 50%) 14%, var(--mist));
    border: 1px solid color-mix(in srgb, hsl(var(--hue) 60% 50%) 45%, var(--hairline));
    box-shadow: 0 12px 30px -10px color-mix(in srgb, #000 60%, transparent);
    animation: bt-in 0.42s cubic-bezier(0.22, 1.3, 0.4, 1) both;
  }
  .bt-icon-big {
    font-size: 40px;
    line-height: 1;
    flex: 0 0 auto;
    animation: bt-pop 0.6s cubic-bezier(0.22, 1.5, 0.4, 1) 0.1s both;
  }
  .bt-icons {
    display: flex;
    flex: 0 0 auto;
  }
  .bt-ic {
    font-size: 26px;
    line-height: 1;
    margin-left: -8px;
    animation: bt-pop 0.6s cubic-bezier(0.22, 1.5, 0.4, 1) both;
  }
  .bt-ic:first-child {
    margin-left: 0;
  }
  .bt-ic:nth-child(2) {
    animation-delay: 0.06s;
  }
  .bt-ic:nth-child(3) {
    animation-delay: 0.12s;
  }
  .bt-ic:nth-child(4) {
    animation-delay: 0.18s;
  }
  .bt-ic:nth-child(5) {
    animation-delay: 0.24s;
  }
  .bt-ic:nth-child(6) {
    animation-delay: 0.3s;
  }
  .bt-body {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .bt-kick {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: color-mix(in srgb, hsl(var(--hue) 55% 42%) 90%, var(--ink));
  }
  .bt-name {
    font-size: 16px;
    font-weight: 700;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bt-desc {
    font-size: 12px;
    color: var(--ink-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  @keyframes bt-in {
    from {
      opacity: 0;
      transform: translateY(-16px) scale(0.94);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  @keyframes bt-pop {
    0% {
      transform: scale(0.2);
      opacity: 0;
    }
    70% {
      transform: scale(1.18);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .bt-card,
    .bt-icon-big,
    .bt-ic {
      animation: bt-fade 0.2s ease both;
    }
    @keyframes bt-fade {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  }
</style>
