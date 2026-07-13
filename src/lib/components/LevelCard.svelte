<script lang="ts">
  // 经营等级卡 —— 自检页展示当前等级 + 进度 + 下一级解锁;点开看完整阶梯。
  import Sheet from "./Sheet.svelte";
  import { currentLevel } from "../level.svelte";
  import { LEVELS } from "../level";
  import { settings } from "../settings.svelte";
  import { titleById } from "../appearance";
  import { isUnlocked } from "../achievements.svelte";

  const lv = $derived(currentLevel());
  let showLadder = $state(false);
  // 展示称号(设置里选定且徽章已解锁)
  const title = $derived.by(() => {
    const t = titleById(settings.title);
    if (!t || !t.id) return "";
    if (t.badge && !isUnlocked(t.badge)) return "";
    return t.name;
  });
</script>

<button class="lc vault-card hi" onclick={() => (showLadder = true)}>
  <span class="lc-medal">
    <span class="lc-lv num">Lv.{lv.index}</span>
  </span>
  <div class="lc-info">
    <span class="kicker">经营等级</span>
    <span class="lc-name">{lv.name}{#if title}<span class="lc-title">{title}</span>{/if}</span>
    <div class="lc-bar"><div class="lc-fill" style="width:{lv.progress * 100}%"></div></div>
    <span class="lc-next">
      {#if lv.next}
        再点亮 <b class="num">{lv.toNext}</b> 枚徽章 → {lv.next.name}
      {:else}
        已达顶级 · 上市公司 🎉
      {/if}
    </span>
  </div>
  <span class="lc-go">›</span>
</button>

<Sheet open={showLadder} title="经营等级" onClose={() => (showLadder = false)}>
  <p class="ld-lead">每点亮一枚成就徽章 = 一份经营资历。资历累积,公司(你)一步步长大。</p>
  <div class="ld-list">
    {#each LEVELS as l (l.index)}
      {@const done = lv.index >= l.index}
      {@const isCur = lv.index === l.index}
      <div class="ld-row" class:done class:cur={isCur}>
        <span class="ld-lv num">Lv.{l.index}</span>
        <div class="ld-mid">
          <span class="ld-name">{l.name}{#if isCur}<span class="ld-tag">当前</span>{/if}</span>
          {#if l.unlocks}<span class="ld-unlock">{l.unlocks}</span>{/if}
        </div>
        <span class="ld-min num">{l.min}+ 枚</span>
      </div>
    {/each}
  </div>
</Sheet>

<style>
  .lc {
    display: flex;
    align-items: center;
    gap: var(--sp-lg);
    width: 100%;
    padding: var(--sp-lg) var(--sp-xl);
    border: 0;
    text-align: left;
    cursor: pointer;
    color: inherit;
    font-family: inherit;
  }
  .lc-medal {
    flex: 0 0 auto;
    width: 52px;
    height: 52px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--sky) 30%, var(--paper)), var(--mist2));
    border: 1.5px solid color-mix(in srgb, var(--sky-deep) 55%, transparent);
  }
  .lc-lv {
    font-size: 14px;
    font-weight: 700;
    color: var(--sky-deep);
  }
  .lc-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .lc-name {
    font-size: 17px;
    font-weight: 600;
    color: var(--ink);
  }
  .lc-title {
    display: inline-block;
    margin-left: 8px;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 9px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--sky) 18%, transparent);
    color: var(--sky-deep);
    vertical-align: middle;
  }
  .lc-bar {
    height: 5px;
    border-radius: 999px;
    background: var(--hairline);
    overflow: hidden;
    margin: 2px 0;
  }
  .lc-fill {
    height: 100%;
    border-radius: 999px;
    background: var(--sky-deep);
    transition: width 0.3s ease;
  }
  .lc-next {
    font-size: 12px;
    color: var(--ink-faint);
  }
  .lc-next b {
    color: var(--sky-deep);
  }
  .lc-go {
    flex: 0 0 auto;
    color: var(--ink-faint);
    font-size: 18px;
  }

  /* 阶梯 sheet */
  .ld-lead {
    font-size: 12.5px;
    line-height: 1.55;
    color: var(--ink-faint);
    margin: 0 0 var(--sp-md);
  }
  .ld-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .ld-row {
    display: flex;
    align-items: center;
    gap: var(--sp-md);
    padding: 12px var(--sp-sm);
    border-radius: 12px;
    opacity: 0.5;
  }
  .ld-row.done {
    opacity: 1;
  }
  .ld-row.cur {
    background: color-mix(in srgb, var(--sky) 12%, transparent);
  }
  .ld-lv {
    flex: 0 0 auto;
    width: 46px;
    font-size: 14px;
    font-weight: 700;
    color: var(--ink-muted);
  }
  .ld-row.done .ld-lv {
    color: var(--sky-deep);
  }
  .ld-mid {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .ld-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--ink);
  }
  .ld-tag {
    font-size: 10px;
    margin-left: 6px;
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--sky-deep);
    color: #fff;
    font-weight: 500;
    vertical-align: middle;
  }
  .ld-unlock {
    font-size: 12px;
    color: var(--ink-faint);
  }
  .ld-min {
    flex: 0 0 auto;
    font-size: 12px;
    color: var(--ink-faint);
  }
</style>
