<script lang="ts">
  // 共享弹窗底座:遮罩 + 居中 silverline 卡片。父组件传 open + onClose,内容走 children snippet。
  // 点遮罩 / 按 ESC 关闭。所有录入 sheet 复用它,保证视觉一致。
  import type { Snippet } from "svelte";

  let {
    open = false,
    title = "",
    onClose,
    children,
  }: { open?: boolean; title?: string; onClose?: () => void; children?: Snippet } = $props();

  function backdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose?.();
  }

  $effect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
</script>

{#if open}
  <div class="backdrop" onclick={backdropClick} role="presentation">
    <div class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-head">
        <span class="kicker">{title}</span>
        <button class="close" onclick={() => onClose?.()} aria-label="关闭">✕</button>
      </div>
      <div class="sheet-body">
        {@render children?.()}
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, var(--paper) 78%, transparent);
    backdrop-filter: blur(6px);
    display: grid;
    place-items: center;
    z-index: 100;
    padding: var(--sp-lg);
    animation: fade 0.15s ease;
  }
  .sheet {
    width: 100%;
    max-width: 440px;
    background: var(--mist);
    border: 1px solid var(--hairline);
    border-radius: var(--radius-card);
    padding: var(--sp-xl);
    box-shadow: 0 24px 60px color-mix(in srgb, #000 35%, transparent);
    animation: rise 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
    max-height: 88vh;
    overflow-y: auto;
  }
  .sheet-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--sp-lg);
  }
  .close {
    border: 0;
    background: transparent;
    color: var(--ink-faint);
    font-size: 16px;
    cursor: pointer;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    line-height: 1;
  }
  .close:hover {
    background: var(--mist2);
    color: var(--ink);
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.99);
    }
  }
</style>
