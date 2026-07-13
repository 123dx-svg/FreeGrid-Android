<script lang="ts">
  // 升级庆祝浮层(全局,挂 App.svelte)。监听徽章数变化 → 检测经营等级上升 → 弹卡。
  // 纯 transform/opacity,尊重 prefers-reduced-motion;自动消失或点击关闭。
  import { currentLevel, syncLevel, pendingLevelUp, dismissLevelUp } from "../level.svelte";

  let { onOpen }: { onOpen?: () => void } = $props();

  // 读 currentLevel() 建立对徽章数的响应式依赖 → 徽章变化即检测升级
  $effect(() => {
    currentLevel();
    syncLevel();
  });

  const lv = $derived(pendingLevelUp());

  let timer: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    if (lv) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => dismissLevelUp(), 3600);
      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  });

  function onTap() {
    onOpen?.();
    dismissLevelUp();
  }
</script>

{#if lv}
  {#key lv.index}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="lu-wrap" onclick={onTap}>
      <div class="lu-card">
        <div class="lu-medal num">Lv.{lv.index}</div>
        <div class="lu-body">
          <span class="lu-kick">🎉 经营等级提升</span>
          <span class="lu-name">{lv.name}</span>
          {#if lv.unlocks}<span class="lu-desc">解锁:{lv.unlocks}</span>{/if}
        </div>
      </div>
    </div>
  {/key}
{/if}

<style>
  .lu-wrap {
    position: fixed;
    top: calc(env(safe-area-inset-top, 0px) + 14px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 1200;
    max-width: 92vw;
    cursor: pointer;
  }
  .lu-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 18px 12px 12px;
    border-radius: 18px;
    background: color-mix(in srgb, var(--sky) 16%, var(--mist));
    border: 1px solid color-mix(in srgb, var(--sky-deep) 50%, var(--hairline));
    box-shadow: 0 12px 30px -10px color-mix(in srgb, #000 60%, transparent);
    animation: lu-in 0.42s cubic-bezier(0.22, 1.3, 0.4, 1) both;
  }
  .lu-medal {
    flex: 0 0 auto;
    width: 46px;
    height: 46px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    font-size: 14px;
    font-weight: 700;
    color: #fff;
    background: var(--sky-deep);
    animation: lu-pop 0.6s cubic-bezier(0.22, 1.5, 0.4, 1) 0.1s both;
  }
  .lu-body {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .lu-kick {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--sky-deep);
  }
  .lu-name {
    font-size: 16px;
    font-weight: 700;
    color: var(--ink);
  }
  .lu-desc {
    font-size: 12px;
    color: var(--ink-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  @keyframes lu-in {
    from { opacity: 0; transform: translateY(-16px) scale(0.94); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes lu-pop {
    0% { transform: scale(0.2); opacity: 0; }
    70% { transform: scale(1.18); }
    100% { transform: scale(1); opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .lu-card, .lu-medal {
      animation: lu-fade 0.2s ease both;
    }
    @keyframes lu-fade {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  }
</style>
