<script lang="ts">
  // 共享记账表单 —— 记支出 / 记收入 / 编辑,三处共用一份 UI。
  // 提交交给父级(onSubmit),父级决定"新增(addExpense/addIncome)"还是"编辑(updateTransaction)"。
  // 内含:金额、分类/来源(CatPicker)、备注、紧凑日期(DateField)、常用模板 + 重复上一笔(仅新增)、存为常用。
  import { store } from "../store.svelte";
  import { EXPENSE_CATEGORIES, INCOME_SOURCES } from "../models";
  import { colorForName } from "../categoryColors";
  import { settings, addCustom, addTemplate, type TxTemplate } from "../settings.svelte";
  import { deriveDashboard } from "../derive";
  import Sheet from "./Sheet.svelte";
  import CatSelect from "./CatSelect.svelte";
  import WheelDateTime from "./WheelDateTime.svelte";
  import FreedomImpact from "./FreedomImpact.svelte";

  type Values = { amount: number; name: string; note: string; dateTime: Date };

  let {
    open = false,
    kind,
    mode = "add",
    initial,
    onClose,
    onSubmit,
  }: {
    open?: boolean;
    kind: "expense" | "income";
    mode?: "add" | "edit";
    initial?: Values;
    onClose: () => void;
    onSubmit: (v: Values) => void;
  } = $props();

  const SOURCE_PRESETS = INCOME_SOURCES;

  // ── 表单本地状态 ──
  let amount = $state<number | null>(null);
  let name = $state("");
  let note = $state("");
  let dateTime = $state(new Date());
  let savedTpl = $state(false);

  function defaultName() {
    return kind === "expense" ? EXPENSE_CATEGORIES[0] : "";
  }
  function loadInitial() {
    if (initial) {
      amount = initial.amount;
      name = initial.name;
      note = initial.note;
      dateTime = new Date(initial.dateTime.getTime());
    } else {
      amount = null;
      name = defaultName();
      note = "";
      dateTime = new Date();
    }
    savedTpl = false;
  }
  // 打开那一刻(关→开边沿)载入初值
  let prevOpen = false;
  $effect(() => {
    if (open && !prevOpen) loadInitial();
    prevOpen = open;
  });

  const valid = $derived((amount ?? 0) > 0 && (kind === "income" ? name.trim().length > 0 : true));

  // 内联「自由影响」预览用:当前实时聚合(纯派生,记账即时反映)
  const vm = $derived(
    deriveDashboard({ expenses: store.expenses, incomes: store.incomes, passiveSources: store.passiveSources, assets: store.assets })
  );

  const options = $derived(
    (kind === "expense"
      ? [...EXPENSE_CATEGORIES, ...settings.customExpenseCategories]
      : [...SOURCE_PRESETS, ...settings.customIncomeSources]
    ).map((n) => ({ name: n, color: colorForName(n) }))
  );
  function countTop(vals: string[], n: number): string[] {
    const cnt = new Map<string, number>();
    for (const k of vals) if (k) cnt.set(k, (cnt.get(k) ?? 0) + 1);
    return [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
  }
  const frequent = $derived.by(() => {
    if (kind === "expense") {
      const top = countTop(store.expenses.map((e) => e.category), 6);
      const base = top.length ? top : [...EXPENSE_CATEGORIES].slice(0, 6);
      // 「保险」低频但重要(车险/寿险/意外险等),固定进常用,免得被折叠到「更多」里
      return Array.from(new Set([...base, "保险", ...settings.customExpenseCategories]));
    }
    const top = countTop(store.incomes.map((i) => i.source), 6);
    const base = top.length ? top : SOURCE_PRESETS.slice(0, 6);
    return Array.from(new Set([...base, ...settings.customIncomeSources]));
  });

  // ── 常用模板 + 重复上一笔(仅新增态)──
  const templates = $derived(settings.txTemplates.filter((t) => t.kind === kind));
  const lastTx = $derived.by(() => {
    if (kind === "expense") {
      const arr = [...store.expenses].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return arr[0] ? { name: arr[0].category, amount: arr[0].amount, note: arr[0].note } : null;
    }
    const arr = [...store.incomes].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return arr[0] ? { name: arr[0].source, amount: arr[0].amount, note: arr[0].note } : null;
  });

  function applyTemplate(t: TxTemplate) {
    name = t.name;
    if (t.amount != null) amount = t.amount;
    note = t.note;
  }
  function repeatLast() {
    if (!lastTx) return;
    name = lastTx.name;
    amount = lastTx.amount;
    note = lastTx.note;
  }
  function saveAsTemplate() {
    const n = name.trim();
    if (!n) return;
    addTemplate({ kind, name: n, amount: (amount ?? 0) > 0 ? amount! : null, note: note.trim() });
    savedTpl = true;
  }

  const title = $derived(
    mode === "edit" ? (kind === "expense" ? "编辑支出" : "编辑收入") : kind === "expense" ? "记支出" : "记收入"
  );
  const submitLabel = $derived(
    mode === "edit" ? "保存修改" : kind === "expense" ? "记下这笔支出" : "记下这笔收入"
  );

  function submit() {
    if (!valid) return;
    onSubmit({ amount: amount!, name: name.trim(), note: note.trim(), dateTime });
  }
</script>

<Sheet {open} {title} {onClose}>
  {#if mode === "add" && (templates.length > 0 || lastTx)}
    <div class="fg-field">
      <span class="fg-label">常用</span>
      <div class="tpl-row">
        {#each templates as t (t.id)}
          <button type="button" class="tpl-chip" onclick={() => applyTemplate(t)}>
            <span class="tpl-dot" style="background:{colorForName(t.name)}"></span>{t.name}{#if t.amount != null}<span class="tpl-amt num"> ¥{Math.round(t.amount).toLocaleString("en-US")}</span>{/if}
          </button>
        {/each}
        {#if lastTx}
          <button type="button" class="tpl-chip ghost" onclick={repeatLast}>↻ 重复上一笔</button>
        {/if}
      </div>
    </div>
  {/if}

  <div class="fg-field">
    <label class="fg-label" for="tx-amount">金额 (元)</label>
    <input
      id="tx-amount"
      class="fg-input fg-amount"
      type="number"
      min="0"
      step="0.01"
      inputmode="decimal"
      placeholder="¥ 0.00"
      bind:value={amount}
    />
  </div>

  <div class="fg-field">
    <span class="fg-label">{kind === "expense" ? "分类" : "来源"}</span>
    <CatSelect
      {options}
      value={name}
      onSelect={(n) => (name = n)}
      {frequent}
      allowCustom
      onAddCustom={(n) => addCustom(kind, n)}
      addLabel={kind === "expense" ? "分类" : "来源"}
      placeholder={kind === "expense" ? "新分类" : "新来源"}
    />
  </div>

  <div class="fg-field">
    <label class="fg-label" for="tx-note">备注 (可选)</label>
    <input id="tx-note" class="fg-input" type="text" placeholder={kind === "expense" ? "比如:跟朋友吃饭" : "比如:三月奖金"} bind:value={note} />
  </div>

  <div class="fg-field">
    <span class="fg-label">日期</span>
    <WheelDateTime bind:value={dateTime} />
  </div>

  {#if mode === "add"}
    <FreedomImpact {amount} mode={kind} {vm} />
  {/if}

  {#if valid}
    <button type="button" class="tpl-save" class:done={savedTpl} onclick={saveAsTemplate} disabled={savedTpl}>
      {savedTpl ? "✓ 已存为常用" : "＋ 存为常用"}
    </button>
  {/if}

  <button class="fg-btn" class:flame={kind === "expense"} disabled={!valid} onclick={submit}>{submitLabel}</button>
</Sheet>

<style>
  .tpl-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-sm);
  }
  .tpl-chip {
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
  .tpl-chip:hover {
    color: var(--ink);
    border-color: var(--ink-ghost);
  }
  .tpl-chip.ghost {
    color: var(--ink-faint);
    border-style: dashed;
  }
  .tpl-dot {
    width: 9px;
    height: 9px;
    border-radius: 3px;
    flex: 0 0 9px;
  }
  .tpl-amt {
    color: var(--ink-faint);
    font-size: 13px;
  }
  .tpl-save {
    align-self: flex-start;
    border: 0;
    background: transparent;
    color: var(--sky-deep);
    font-family: var(--font-rounded);
    font-size: 13px;
    padding: 2px 0;
    margin: calc(-1 * var(--sp-sm)) 0 0;
    cursor: pointer;
  }
  .tpl-save.done {
    color: var(--moss);
    cursor: default;
  }
</style>
