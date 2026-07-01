<script lang="ts">
  // 成就徽章墙 —— 分组网格,解锁=彩色+点亮时间,未解锁=灰锁。点徽章看详情+分享。
  import Sheet from "./Sheet.svelte";
  import { ACHIEVEMENTS, ACH_GROUPS, type Achievement } from "../achievements";
  import { isUnlocked, unlockTime, unlockedCount, exportBadgeMeta } from "../achievements.svelte";
  import { shareBadge, shareWall } from "../badge-share";

  const total = ACHIEVEMENTS.length;
  const done = $derived(unlockedCount());

  let selected = $state<Achievement | null>(null);
  let sharing = $state(false);

  function fmt(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(+d)) return "";
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  }

  async function doShareBadge() {
    if (!selected || sharing) return;
    sharing = true;
    try {
      await shareBadge(selected, unlockTime(selected.id));
    } catch {
      /* 取消/失败静默 */
    } finally {
      sharing = false;
    }
  }
  async function doShareWall() {
    if (sharing) return;
    sharing = true;
    try {
      await shareWall(exportBadgeMeta());
    } catch {
      /* 取消/失败静默 */
    } finally {
      sharing = false;
    }
  }

  const byGroup = $derived(ACH_GROUPS.map((g) => ({ group: g, items: ACHIEVEMENTS.filter((a) => a.group === g) })));

  // 默认收起省空间;展开看带分组的大网格
  let expanded = $state(false);
  // 收起时的紧凑图标条:已解锁在前,便于一眼总览
  const strip = $derived([...ACHIEVEMENTS].sort((a, b) => Number(isUnlocked(b.id)) - Number(isUnlocked(a.id))));
</script>

<section class="bw">
  <div class="bw-head">
    <div class="bw-count">
      <span class="bw-num num">{done}</span><span class="bw-den num">/ {total}</span>
      <span class="bw-label">枚成就已点亮</span>
    </div>
    <button class="bw-share" onclick={doShareWall} disabled={sharing}>{sharing ? "生成中…" : "分享成就墙 ↗"}</button>
  </div>

  {#if expanded}
    {#each byGroup as g (g.group)}
      <div class="bw-group">
        <p class="bw-gtitle">{g.group}</p>
        <div class="bw-grid">
          {#each g.items as a (a.id)}
            {@const on = isUnlocked(a.id)}
            <button class="badge" class:on onclick={() => (selected = a)} style="--hue:{a.hue}">
              <span class="badge-disc">
                <span class="badge-ic">{on ? a.icon : "🔒"}</span>
              </span>
              <span class="badge-name">{a.name}</span>
              {#if on}<span class="badge-date num">{fmt(unlockTime(a.id))}</span>{:else}<span class="badge-date locked">未解锁</span>{/if}
            </button>
          {/each}
        </div>
      </div>
    {/each}
    <button class="bw-toggle" onclick={() => (expanded = false)}>收起 ▴</button>
  {:else}
    <div class="bw-strip">
      {#each strip as a (a.id)}
        {@const on = isUnlocked(a.id)}
        <button class="mini" class:on onclick={() => (selected = a)} style="--hue:{a.hue}" title={a.name}>
          {on ? a.icon : "🔒"}
        </button>
      {/each}
    </div>
    <button class="bw-toggle" onclick={() => (expanded = true)}>展开全部 {total} 枚 ▾</button>
  {/if}
</section>

<!-- 徽章详情 -->
<Sheet open={selected !== null} title="成就徽章" onClose={() => (selected = null)}>
  {#if selected}
    <div class="bd" style="--hue:{selected.hue}">
      <span class="bd-disc" class:on={isUnlocked(selected.id)}>
        <span class="bd-ic">{isUnlocked(selected.id) ? selected.icon : "🔒"}</span>
      </span>
      <p class="bd-name">{selected.name}</p>
      <p class="bd-desc">{selected.desc}</p>
      {#if isUnlocked(selected.id)}
        <p class="bd-date num">{fmt(unlockTime(selected.id))} 点亮</p>
        <button class="bd-share" onclick={doShareBadge} disabled={sharing}>{sharing ? "生成卡片…" : "分享这枚徽章 ↗"}</button>
      {:else}
        <p class="bd-locked">还没达成 —— 继续加油,达标即刻点亮 ✨</p>
      {/if}
    </div>
  {/if}
</Sheet>

<style>
  .bw {
    display: flex;
    flex-direction: column;
    gap: var(--sp-lg);
  }
  .bw-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-md);
    flex-wrap: wrap;
  }
  .bw-count {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .bw-num {
    font-size: 34px;
    font-weight: 300;
    color: var(--ink);
    line-height: 1;
  }
  .bw-den {
    font-size: 16px;
    color: var(--ink-faint);
  }
  .bw-label {
    font-size: 13px;
    color: var(--ink-muted);
    margin-left: 4px;
  }
  .bw-share {
    font-family: var(--font-rounded);
    font-size: 13px;
    padding: 8px 16px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--sky-deep) 45%, var(--hairline));
    background: transparent;
    color: var(--sky-deep);
    cursor: pointer;
  }
  .bw-share:disabled {
    opacity: 0.5;
  }
  /* 收起态:紧凑图标条 + 展开按钮 */
  .bw-strip {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 2px 0;
    scrollbar-width: none;
  }
  .bw-strip::-webkit-scrollbar {
    display: none;
  }
  .mini {
    flex: 0 0 auto;
    width: 40px;
    height: 40px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    font-size: 20px;
    line-height: 1;
    border: 1.5px solid var(--hairline);
    background: var(--mist2);
    cursor: pointer;
    filter: grayscale(1) opacity(0.45);
  }
  .mini.on {
    filter: none;
    background: color-mix(in srgb, hsl(var(--hue) 60% 55%) 18%, var(--paper));
    border-color: color-mix(in srgb, hsl(var(--hue) 55% 45%) 50%, transparent);
  }
  .bw-toggle {
    align-self: center;
    margin-top: 2px;
    border: 0;
    background: transparent;
    color: var(--sky-deep);
    font-family: var(--font-rounded);
    font-size: 13px;
    cursor: pointer;
    padding: 4px;
  }
  .bw-group {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
  }
  .bw-gtitle {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--ink-faint);
    margin: 0;
  }
  .bw-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--sp-sm);
  }
  .badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 14px 6px 12px;
    border-radius: 16px;
    border: 1px solid var(--hairline);
    background: var(--mist);
    cursor: pointer;
    transition: transform 0.12s ease, border-color 0.12s ease;
  }
  .badge:active {
    transform: scale(0.96);
  }
  .badge.on {
    border-color: color-mix(in srgb, hsl(var(--hue) 60% 50%) 40%, var(--hairline));
    background: color-mix(in srgb, hsl(var(--hue) 60% 50%) 8%, var(--mist));
  }
  .badge-disc {
    width: 54px;
    height: 54px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: var(--mist2);
    border: 1.5px solid var(--hairline);
  }
  .badge.on .badge-disc {
    background: color-mix(in srgb, hsl(var(--hue) 60% 55%) 20%, var(--paper));
    border-color: color-mix(in srgb, hsl(var(--hue) 55% 45%) 55%, transparent);
  }
  .badge-ic {
    font-size: 26px;
    line-height: 1;
    filter: grayscale(1) opacity(0.4);
  }
  .badge.on .badge-ic {
    filter: none;
  }
  .badge-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-muted);
    text-align: center;
    line-height: 1.2;
  }
  .badge.on .badge-name {
    color: var(--ink);
  }
  .badge-date {
    font-size: 10px;
    color: color-mix(in srgb, hsl(var(--hue) 45% 45%) 90%, var(--ink-faint));
  }
  .badge-date.locked {
    color: var(--ink-faint);
    font-family: inherit;
  }

  /* 详情 */
  .bd {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-sm);
    padding: var(--sp-md) 0 var(--sp-sm);
    text-align: center;
  }
  .bd-disc {
    width: 96px;
    height: 96px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: var(--mist2);
    border: 2px solid var(--hairline);
    margin-bottom: var(--sp-xs);
  }
  .bd-disc.on {
    background: color-mix(in srgb, hsl(var(--hue) 60% 55%) 22%, var(--paper));
    border-color: color-mix(in srgb, hsl(var(--hue) 55% 45%) 60%, transparent);
  }
  .bd-ic {
    font-size: 48px;
    line-height: 1;
    filter: grayscale(1) opacity(0.4);
  }
  .bd-disc.on .bd-ic {
    filter: none;
  }
  .bd-name {
    font-size: 22px;
    font-weight: 700;
    color: var(--ink);
    margin: 0;
  }
  .bd-desc {
    font-size: 14px;
    color: var(--ink-muted);
    margin: 0;
  }
  .bd-date {
    font-size: 13px;
    color: color-mix(in srgb, hsl(var(--hue) 45% 45%) 85%, var(--ink));
    margin: 2px 0 0;
  }
  .bd-locked {
    font-size: 13px;
    color: var(--ink-faint);
    margin: 4px 0 0;
  }
  .bd-share {
    margin-top: var(--sp-md);
    font-family: var(--font-rounded);
    font-size: 15px;
    font-weight: 600;
    padding: 11px 26px;
    border-radius: 999px;
    border: 0;
    background: hsl(var(--hue) 55% 46%);
    color: #fff;
    cursor: pointer;
  }
  .bd-share:disabled {
    opacity: 0.55;
  }
</style>
