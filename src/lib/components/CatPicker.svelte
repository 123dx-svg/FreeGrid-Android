<script lang="ts">
  // 共享分类/来源选择器:色点 chip 网格 + 常用+更多折叠 + ＋自定义。
  // 记支出、记收入共用它 —— 风格单一来源,必然一致。
  let {
    options,
    value,
    onSelect,
    frequent = [],
    allowCustom = false,
    onAddCustom,
    addLabel = "自定义",
    placeholder = "新分类名",
  }: {
    options: { name: string; color: string }[];
    value: string;
    onSelect: (name: string) => void;
    frequent?: string[];
    allowCustom?: boolean;
    onAddCustom?: (name: string) => void;
    addLabel?: string;
    placeholder?: string;
  } = $props();

  let expanded = $state(false);
  let adding = $state(false);
  let newName = $state("");

  const freqSet = $derived(new Set(frequent));
  const shown = $derived(
    expanded || frequent.length === 0
      ? options
      : options.filter((o) => freqSet.has(o.name) || o.name === value)
  );
  const hiddenCount = $derived(options.length - shown.length);

  function confirmAdd() {
    const n = newName.trim();
    if (n) {
      onAddCustom?.(n);
      onSelect(n);
    }
    newName = "";
    adding = false;
  }
</script>

<div class="cp">
  {#each shown as o (o.name)}
    <button type="button" class="cp-chip" class:on={value === o.name} onclick={() => onSelect(o.name)}>
      <span class="cp-dot" style="background:{o.color}"></span>{o.name}
    </button>
  {/each}

  {#if !expanded && hiddenCount > 0}
    <button type="button" class="cp-chip ghost" onclick={() => (expanded = true)}>更多 {hiddenCount} ▾</button>
  {:else if expanded && frequent.length > 0}
    <button type="button" class="cp-chip ghost" onclick={() => (expanded = false)}>收起 ▴</button>
  {/if}

  {#if allowCustom}
    {#if adding}
      <span class="cp-add">
        <input
          class="cp-input"
          {placeholder}
          bind:value={newName}
          onkeydown={(e) => e.key === "Enter" && confirmAdd()}
        />
        <button type="button" class="cp-ok" onclick={confirmAdd}>加</button>
        <button type="button" class="cp-x" onclick={() => { adding = false; newName = ""; }} aria-label="取消">✕</button>
      </span>
    {:else}
      <button type="button" class="cp-chip ghost" onclick={() => (adding = true)}>＋ {addLabel}</button>
    {/if}
  {/if}
</div>

<style>
  .cp {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-sm);
  }
  .cp-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 13px;
    border-radius: 999px;
    border: 1px solid var(--hairline);
    background: var(--mist2);
    color: var(--ink-muted);
    font-family: var(--font-rounded);
    font-size: 14px;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }
  .cp-chip:hover {
    color: var(--ink);
    border-color: var(--ink-ghost);
  }
  .cp-chip.on {
    background: color-mix(in srgb, var(--sky) 16%, transparent);
    border-color: var(--sky);
    color: var(--sky-deep);
    font-weight: 500;
  }
  .cp-chip.ghost {
    color: var(--ink-faint);
    border-style: dashed;
  }
  .cp-dot {
    width: 9px;
    height: 9px;
    border-radius: 3px;
    flex: 0 0 9px;
  }
  .cp-add {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 1px solid var(--sky);
    border-radius: 999px;
    background: var(--mist2);
    padding: 3px 4px 3px 12px;
  }
  .cp-input {
    width: 96px;
    border: 0;
    background: transparent;
    color: var(--ink);
    font-family: var(--font-rounded);
    font-size: 14px;
    outline: none;
  }
  .cp-ok {
    border: 0;
    border-radius: 999px;
    background: color-mix(in srgb, var(--sky) 22%, transparent);
    color: var(--sky-deep);
    font-size: 13px;
    font-weight: 600;
    padding: 5px 12px;
    cursor: pointer;
  }
  .cp-x {
    border: 0;
    background: transparent;
    color: var(--ink-faint);
    font-size: 13px;
    cursor: pointer;
    padding: 4px 6px;
  }
</style>
