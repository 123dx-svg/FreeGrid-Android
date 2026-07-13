<script lang="ts">
  // 紧凑分类/来源选择器(下拉式)—— 收起时只占 1 行触发器,点开弹出带色点的选项面板。
  // 对齐 iOS 的下拉 Picker,替代占竖向空间的 chip 网格。记支出/记收入共用。
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

  let open = $state(false);
  let adding = $state(false);
  let newName = $state("");

  // 常用置顶,其余按原顺序;当前值确保出现
  const ordered = $derived.by(() => {
    const freq = frequent.filter((n) => options.some((o) => o.name === n));
    const rest = options.filter((o) => !freq.includes(o.name)).map((o) => o.name);
    const names = [...freq, ...rest];
    return names.map((n) => options.find((o) => o.name === n)!).filter(Boolean);
  });
  const current = $derived(options.find((o) => o.name === value));

  function pick(name: string) {
    onSelect(name);
    open = false;
    adding = false;
  }
  function confirmAdd() {
    const n = newName.trim();
    if (n) {
      onAddCustom?.(n);
      onSelect(n);
    }
    newName = "";
    adding = false;
    open = false;
  }
</script>

<div class="cs">
  <button type="button" class="cs-trigger" class:open onclick={() => (open = !open)} aria-expanded={open}>
    {#if current}
      <span class="cs-dot" style="background:{current.color}"></span>
      <span class="cs-name">{current.name}</span>
    {:else}
      <span class="cs-name placeholder">选择{addLabel === "自定义" ? "分类" : addLabel}</span>
    {/if}
    <svg class="cs-chev" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6" /></svg>
  </button>

  {#if open}
    <div class="cs-panel">
      <div class="cs-grid">
        {#each ordered as o (o.name)}
          <button type="button" class="cs-opt" class:on={value === o.name} onclick={() => pick(o.name)}>
            <span class="cs-dot" style="background:{o.color}"></span>{o.name}
          </button>
        {/each}
      </div>
      {#if allowCustom}
        {#if adding}
          <div class="cs-add">
            <input class="cs-input" {placeholder} bind:value={newName} onkeydown={(e) => e.key === "Enter" && confirmAdd()} />
            <button type="button" class="cs-ok" onclick={confirmAdd}>加</button>
            <button type="button" class="cs-x" onclick={() => { adding = false; newName = ""; }} aria-label="取消">✕</button>
          </div>
        {:else}
          <button type="button" class="cs-addbtn" onclick={() => (adding = true)}>＋ {addLabel}</button>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .cs {
    position: relative;
  }
  .cs-trigger {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 11px 14px;
    border-radius: 12px;
    border: 1px solid var(--hairline);
    background: var(--mist2);
    color: var(--ink);
    font-family: var(--font-rounded);
    font-size: 15px;
    cursor: pointer;
    text-align: left;
  }
  .cs-trigger.open {
    border-color: var(--sky);
  }
  .cs-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .cs-name.placeholder {
    color: var(--ink-faint);
  }
  .cs-chev {
    color: var(--ink-faint);
    transition: transform 0.2s ease;
    flex: none;
  }
  .cs-trigger.open .cs-chev {
    transform: rotate(180deg);
  }
  .cs-dot {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    flex: 0 0 10px;
  }
  .cs-panel {
    margin-top: 8px;
    padding: 10px;
    border-radius: 12px;
    border: 1px solid var(--hairline);
    background: var(--mist2);
  }
  .cs-grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-sm);
  }
  .cs-opt {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 13px;
    border-radius: 999px;
    border: 1px solid var(--hairline);
    background: var(--surface, transparent);
    color: var(--ink-muted);
    font-family: var(--font-rounded);
    font-size: 14px;
    cursor: pointer;
  }
  .cs-opt.on {
    background: color-mix(in srgb, var(--sky) 16%, transparent);
    border-color: var(--sky);
    color: var(--sky-deep);
    font-weight: 500;
  }
  .cs-add {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 10px;
    border: 1px solid var(--sky);
    border-radius: 999px;
    background: var(--mist2);
    padding: 3px 4px 3px 12px;
  }
  .cs-input {
    width: 110px;
    border: 0;
    background: transparent;
    color: var(--ink);
    font-family: var(--font-rounded);
    font-size: 14px;
    outline: none;
  }
  .cs-ok {
    border: 0;
    border-radius: 999px;
    background: color-mix(in srgb, var(--sky) 22%, transparent);
    color: var(--sky-deep);
    font-size: 13px;
    font-weight: 600;
    padding: 5px 12px;
    cursor: pointer;
  }
  .cs-x {
    border: 0;
    background: transparent;
    color: var(--ink-faint);
    font-size: 13px;
    cursor: pointer;
    padding: 4px 6px;
  }
  .cs-addbtn {
    margin-top: 10px;
    border: 1px dashed var(--hairline);
    border-radius: 999px;
    background: transparent;
    color: var(--ink-faint);
    font-family: var(--font-rounded);
    font-size: 14px;
    padding: 8px 13px;
    cursor: pointer;
  }
</style>
