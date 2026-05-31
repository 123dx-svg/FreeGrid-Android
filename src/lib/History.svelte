<script lang="ts">
  import { store, deleteTransaction } from "./store.svelte";
  import Sheet from "./components/Sheet.svelte";

  // ── 数据:中央响应式 store,本屏只做合并/排序/分组,不碰任何 freedom-math ──
  // 归一成扁平交易形状,行模板单分支即可
  type Tx = {
    id: string;
    kind: "expense" | "income";
    name: string; // 支出=分类 / 收入=来源
    note: string;
    date: Date;
    amount: number; // 正数,符号由 kind 决定
    category?: string; // 仅支出,用于二级筛选
  };

  const allTx: Tx[] = $derived([
    ...store.expenses.map((e) => ({
      id: e.id,
      kind: "expense" as const,
      name: e.category,
      note: e.note,
      date: e.date,
      amount: e.amount,
      category: e.category,
    })),
    ...store.incomes.map((i) => ({
      id: i.id,
      kind: "income" as const,
      name: i.source,
      note: i.note,
      date: i.date,
      amount: i.amount,
    })),
  ]);

  // ── 筛选状态 ──
  type Filter = "all" | "expense" | "income";
  let filter = $state<Filter>("all");
  let selectedCategory = $state<string | null>(null);

  // 切出支出 tab 时分类二级筛选自动失效 —— 派生「有效分类」,免 $effect 的 rune 顺序坑
  const effectiveCategory = $derived(filter === "expense" ? selectedCategory : null);

  // ── 派生:分类汇总(降序),只统计支出 ──
  const expenseCategoryTotals = $derived.by(() => {
    const g = new Map<string, number>();
    for (const e of store.expenses) {
      g.set(e.category, (g.get(e.category) ?? 0) + e.amount);
    }
    return [...g.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  });
  const categoryGrandTotal = $derived(expenseCategoryTotals.reduce((s, c) => s + c.total, 0));

  // ── 派生:筛选 + 排序(日期降序,新的在上)——
  const filteredTransactions = $derived.by(() => {
    let list = allTx;
    if (filter === "expense") {
      list = list.filter((t) => t.kind === "expense");
      if (effectiveCategory) list = list.filter((t) => t.category === effectiveCategory);
    } else if (filter === "income") {
      list = list.filter((t) => t.kind === "income");
    }
    return list.slice().sort((a, b) => b.date.getTime() - a.date.getTime());
  });

  // ── 月度汇总 sheet ──
  let showMonthly = $state(false);

  // 按 YYYY-MM 分组聚合(支出/收入/净),新月在前;月内全量支出分类(降序)。
  // 对齐 iOS MonthlySummaryView.monthlyStats:展开看占比条 + 百分比(本屏再叠加逐笔明细)。
  type MonthlyStat = {
    key: string; // "2026-05"
    label: string; // "2026 年 5 月"
    totalExpense: number;
    totalIncome: number;
    net: number;
    categories: { category: string; total: number }[]; // 月内支出全量分类,降序
  };
  const monthlyStats = $derived.by<MonthlyStat[]>(() => {
    const monthKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const expByMonth = new Map<string, Map<string, number>>(); // 月 → (分类 → 额)
    const incByMonth = new Map<string, number>();
    const keys = new Set<string>();

    for (const e of store.expenses) {
      const k = monthKey(e.date);
      keys.add(k);
      const cats = expByMonth.get(k) ?? new Map<string, number>();
      cats.set(e.category, (cats.get(e.category) ?? 0) + e.amount);
      expByMonth.set(k, cats);
    }
    for (const i of store.incomes) {
      const k = monthKey(i.date);
      keys.add(k);
      incByMonth.set(k, (incByMonth.get(k) ?? 0) + i.amount);
    }

    // YYYY-MM 字符串降序 = 新月在前
    return [...keys]
      .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
      .map((k) => {
        const cats = expByMonth.get(k) ?? new Map<string, number>();
        const totalExpense = [...cats.values()].reduce((s, v) => s + v, 0);
        const totalIncome = incByMonth.get(k) ?? 0;
        const categories = [...cats.entries()]
          .map(([category, total]) => ({ category, total }))
          .sort((a, b) => b.total - a.total);
        const [y, m] = k.split("-");
        return {
          key: k,
          label: `${y} 年 ${Number(m)} 月`,
          totalExpense,
          totalIncome,
          net: totalIncome - totalExpense,
          categories,
        };
      });
  });

  // 月份下钻:点击某月展开,看该月明细交易(日期降序)
  let expandedMonth = $state<string | null>(null);
  const mKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  function monthTxs(key: string): Tx[] {
    return allTx
      .filter((t) => mKey(t.date) === key)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }
  function toggleMonth(key: string) {
    expandedMonth = expandedMonth === key ? null : key;
  }

  // ── 派生:汇总行 ──
  const count = $derived(filteredTransactions.length);
  const net = $derived(
    filteredTransactions.reduce(
      (s, t) => (t.kind === "income" ? s + t.amount : s - t.amount),
      0
    )
  );

  // ── 格式化 ──
  const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

  function money(v: number): string {
    return nf.format(v);
  }
  function netDisplay(v: number): string {
    // 净额始终 --ink,只用 +/− 前缀表方向(对齐 iOS netDisplay)
    return (v >= 0 ? "+¥" : "−¥") + money(Math.abs(v));
  }
  function netDisplay0(v: number): string {
    // 月卡专用:总支出/总收入用 nf0(整数),净额跟齐整数口径才能对账(对齐 iOS signed() 的 0 位小数)
    return (v >= 0 ? "+¥" : "−¥") + nf0.format(Math.abs(v));
  }
  function fmtDate(d: Date): string {
    // 中文自然日,对齐 iOS .dateTime.year().month().day() 在 zh 设备上的渲染
    // 同 Dashboard.svelte 的「M 月 D 日」口径(此处带年份)
    return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
  }

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "全部" },
    { id: "expense", label: "支出" },
    { id: "income", label: "收入" },
  ];

  function setFilter(f: Filter) {
    filter = f;
    if (f !== "expense") selectedCategory = null;
  }

  function toggleCategory(c: string) {
    selectedCategory = selectedCategory === c ? null : c;
  }
</script>

<div class="hist">
  <!-- ───── Header ───── -->
  <header class="page-head">
    <div class="head-text">
      <p class="kicker">HISTORY · 流水</p>
      <h1>History</h1>
    </div>
    <button class="cal-btn" aria-label="月度汇总" title="月度汇总" onclick={() => (showMonthly = true)}>
      <svg viewBox="0 0 24 24" class="cal-ic">
        <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
        <path d="M3 9h18M8 2.5v4M16 2.5v4" />
        <path d="M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2" />
      </svg>
    </button>
  </header>

  <!-- ───── Segmented filter ───── -->
  <div class="seg" role="tablist" aria-label="筛选">
    {#each filters as f (f.id)}
      <button
        class="seg-btn"
        class:active={filter === f.id}
        role="tab"
        aria-selected={filter === f.id}
        onclick={() => setFilter(f.id)}
      >
        {f.label}
      </button>
    {/each}
  </div>

  <!-- ───── Summary row ───── -->
  <div class="summary">
    <span class="sum-count num">共 {nf0.format(count)} 笔</span>
    <span class="sum-net num">净 {netDisplay(net)}</span>
  </div>

  <!-- ───── Category chips (支出 tab only) ───── -->
  {#if filter === "expense" && expenseCategoryTotals.length > 0}
    <div class="chips" aria-label="分类汇总">
      <button
        class="chip"
        class:on={effectiveCategory === null}
        onclick={() => (selectedCategory = null)}
      >
        <span class="chip-label">全部</span>
        <span class="chip-amt num">¥{nf0.format(categoryGrandTotal)}</span>
      </button>
      {#each expenseCategoryTotals as c (c.category)}
        <button
          class="chip"
          class:on={effectiveCategory === c.category}
          onclick={() => toggleCategory(c.category)}
        >
          <span class="chip-label">{c.category}</span>
          <span class="chip-amt num">¥{nf0.format(c.total)}</span>
        </button>
      {/each}
    </div>
  {/if}

  <!-- ───── Transaction list ───── -->
  {#if filteredTransactions.length === 0}
    <div class="empty vault-card">
      <svg viewBox="0 0 24 24" class="empty-ic">
        <path d="M12 7v5l3 2M4 12a8 8 0 1 0 2-5" />
      </svg>
      <p class="empty-title">还没有记录</p>
      <p class="empty-sub">回 Dashboard 添加第一笔支出或收入</p>
    </div>
  {:else}
    <ul class="list vault-card">
      {#each filteredTransactions as tx (tx.id)}
        <li class="row">
          <div class="row-left">
            <span class="row-name">{tx.name}</span>
            {#if tx.note}<span class="row-note">{tx.note}</span>{/if}
            <span class="row-date num">{fmtDate(tx.date)}</span>
          </div>
          <span class="row-amt num" class:income={tx.kind === "income"} class:expense={tx.kind === "expense"}>
            {tx.kind === "income" ? "+¥" : "−¥"}{money(tx.amount)}
          </span>
          <button class="del-btn" aria-label="撤销这笔" title="撤销这笔" onclick={() => deleteTransaction(tx.id, tx.kind)}>
            <svg viewBox="0 0 24 24" class="del-ic"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <!-- ───── 月度汇总 sheet(只读) ───── -->
  <Sheet open={showMonthly} title="月度汇总" wide onClose={() => (showMonthly = false)}>
    {#if monthlyStats.length === 0}
      <div class="ms-empty">
        <svg viewBox="0 0 24 24" class="ms-empty-ic">
          <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
          <path d="M3 9h18M8 2.5v4M16 2.5v4" />
        </svg>
        <p class="ms-empty-title">还没有可汇总的记录</p>
      </div>
    {:else}
      <p class="ms-hint">点任意月份展开,查看当月每一笔明细</p>
      <div class="ms-list">
        {#each monthlyStats as ms (ms.key)}
          {@const isOpen = expandedMonth === ms.key}
          <div class="ms-card" class:open={isOpen}>
            <button class="ms-head" type="button" onclick={() => toggleMonth(ms.key)} aria-expanded={isOpen}>
              <span class="ms-month">{ms.label}</span>
              <span class="ms-grow"></span>
              <span class="ms-net num">净 {netDisplay0(ms.net)}</span>
              <svg class="ms-chev" class:rot={isOpen} viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
            </button>
            <div class="ms-stats">
              <div class="ms-stat">
                <span class="ms-stat-label">总支出</span>
                <span class="ms-stat-amt num expense">¥{nf0.format(ms.totalExpense)}</span>
              </div>
              <div class="ms-stat">
                <span class="ms-stat-label">总收入</span>
                <span class="ms-stat-amt num income">¥{nf0.format(ms.totalIncome)}</span>
              </div>
            </div>
            {#if !isOpen && ms.categories.length > 0}
              <div class="ms-cats num">
                {#each ms.categories.slice(0, 2) as c (c.category)}
                  <span class="ms-cat">{c.category} ¥{nf0.format(c.total)}</span>
                {/each}
              </div>
            {/if}
            {#if isOpen}
              {#if ms.categories.length > 0}
                {@const maxCat = ms.categories[0].total}
                <div class="ms-breakdown">
                  {#each ms.categories as c (c.category)}
                    <div class="ms-bar-row">
                      <span class="ms-bar-name">{c.category}</span>
                      <span class="ms-bar-track">
                        <span
                          class="ms-bar-fill"
                          style="width:{maxCat > 0 ? `max(4px, ${(c.total / maxCat) * 100}%)` : '4px'}"
                        ></span>
                      </span>
                      <span class="ms-bar-amt num">¥{nf0.format(c.total)}</span>
                      <span class="ms-bar-pct num">
                        {ms.totalExpense > 0 ? Math.round((c.total / ms.totalExpense) * 100) : 0}%
                      </span>
                    </div>
                  {/each}
                </div>
              {/if}
              <div class="ms-detail">
                {#each monthTxs(ms.key) as t (t.id)}
                  <div class="ms-tx">
                    <div class="ms-tx-l">
                      <span class="ms-tx-name">{t.name}</span>
                      {#if t.note}<span class="ms-tx-note">{t.note}</span>{/if}
                      <span class="ms-tx-date">{fmtDate(t.date)}</span>
                    </div>
                    <span class="ms-tx-amt num {t.kind}">{t.kind === "income" ? "+" : "−"}¥{nf0.format(t.amount)}</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </Sheet>
</div>

<style>
  .hist {
    display: flex;
    flex-direction: column;
    gap: var(--sp-lg);
    max-width: 1080px;
    margin: 0 auto;
  }

  /* ── Header ── */
  .page-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--sp-lg);
    margin-bottom: var(--sp-xs);
  }
  .page-head h1 {
    font-size: 30px;
    font-weight: 500;
    margin: 4px 0 0;
    letter-spacing: -0.01em;
  }
  .cal-btn {
    width: 38px;
    height: 38px;
    flex: 0 0 38px;
    border-radius: 999px;
    border: 1px solid var(--hairline);
    background: var(--mist);
    color: var(--ink-muted);
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }
  .cal-btn:hover {
    background: var(--mist2);
    color: var(--ink);
    border-color: var(--ink-ghost);
  }
  .cal-ic {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* ── Segmented filter ── */
  .seg {
    display: inline-flex;
    align-self: flex-start;
    gap: 2px;
    padding: 3px;
    border-radius: 999px;
    border: 1px solid var(--hairline);
    background: var(--mist);
  }
  .seg-btn {
    font-family: var(--font-rounded);
    font-size: 14px;
    font-weight: 500;
    padding: 7px 22px;
    border-radius: 999px;
    border: 0;
    background: transparent;
    color: var(--ink-muted);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .seg-btn:hover {
    color: var(--ink);
  }
  .seg-btn.active {
    background: color-mix(in srgb, var(--sky) 14%, transparent);
    color: var(--sky-deep);
  }

  /* ── Summary row ── */
  .summary {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 0 var(--sp-xs);
  }
  .sum-count {
    font-size: 13px;
    color: var(--ink-faint);
  }
  .sum-net {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--ink);
  }

  /* ── Category chips ── */
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-sm);
  }
  .chip {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid var(--hairline-soft);
    background: var(--mist);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .chip:hover {
    background: var(--mist2);
  }
  .chip-label {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.05em;
    color: var(--ink-muted);
  }
  .chip-amt {
    font-size: 15px;
    font-weight: 500;
    color: var(--ink);
  }
  .chip.on {
    background: var(--ink);
    border-color: var(--ink);
  }
  .chip.on .chip-label,
  .chip.on .chip-amt {
    color: var(--paper);
  }

  /* ── Transaction list ── */
  .list {
    list-style: none;
    margin: 0;
    padding: var(--sp-xs) var(--sp-xl);
  }
  .row {
    display: flex;
    align-items: flex-start;
    gap: var(--sp-md);
    padding: var(--sp-md) 0;
    border-bottom: 1px solid var(--hairline-soft);
  }
  .row:last-child {
    border-bottom: 0;
  }
  .row-left {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
    flex: 1;
  }
  .row-name {
    font-size: 15px;
    font-weight: 500;
    color: var(--ink);
  }
  .row-note {
    font-size: 12px;
    color: var(--ink-faint);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  .row-date {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.03em;
    color: var(--ink-faint);
  }
  .row-amt {
    font-size: 15px;
    font-weight: 400;
    white-space: nowrap;
    margin-top: 1px;
  }
  .row-amt.income {
    color: var(--sky-deep);
  }
  .row-amt.expense {
    color: var(--flame);
  }
  .del-btn {
    width: 22px;
    height: 22px;
    flex: 0 0 22px;
    border-radius: 999px;
    border: 1px solid var(--hairline-soft);
    background: transparent;
    color: var(--ink-faint);
    display: grid;
    place-items: center;
    cursor: pointer;
    margin-top: 1px;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }
  .del-btn:hover {
    color: var(--flame);
    border-color: color-mix(in srgb, var(--flame) 55%, var(--hairline));
  }
  .del-ic {
    width: 10px;
    height: 10px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }

  /* ── Empty state ── */
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-sm);
    padding: var(--sp-3xl) var(--sp-xl);
    text-align: center;
  }
  .empty-ic {
    width: 40px;
    height: 40px;
    fill: none;
    stroke: var(--ink-faint);
    stroke-width: 1.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .empty-title {
    font-size: 18px;
    font-weight: 300;
    color: var(--ink);
    margin: var(--sp-sm) 0 0;
  }
  .empty-sub {
    font-size: 14px;
    color: var(--ink-muted);
    margin: 0;
  }

  /* ── 月度汇总 sheet ── */
  .ms-list {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
  }
  .ms-card {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
    padding: var(--sp-md) var(--sp-lg);
    border-radius: 12px;
    border: 1px solid var(--hairline-soft);
    background: var(--mist2);
  }
  .ms-head {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
    width: 100%;
    border: 0;
    background: transparent;
    padding: 4px 0;
    cursor: pointer;
    font-family: inherit;
    color: inherit;
    text-align: left;
  }
  .ms-grow {
    flex: 1;
  }
  .ms-chev {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: var(--ink-faint);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform 0.18s ease;
    flex: 0 0 16px;
  }
  .ms-chev.rot {
    transform: rotate(90deg);
  }
  .ms-month {
    font-size: 15px;
    font-weight: 500;
    color: var(--ink);
  }
  .ms-net {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--ink);
  }
  .ms-stats {
    display: flex;
    gap: var(--sp-2xl);
  }
  .ms-stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .ms-stat-label {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.05em;
    color: var(--ink-faint);
  }
  .ms-stat-amt {
    font-size: 20px;
    font-weight: 500;
  }
  .ms-stat-amt.expense {
    color: var(--flame);
  }
  .ms-stat-amt.income {
    color: var(--sky-deep);
  }
  .ms-cats {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-md);
    padding-top: var(--sp-xs);
    border-top: 1px solid var(--hairline-soft);
  }
  .ms-cat {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.03em;
    color: var(--ink-muted);
  }
  /* 月内分类占比条(移植 iOS MonthlySummaryView.categoryRow):名 / 横条 / 额 / % */
  .ms-breakdown {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
    margin-top: var(--sp-sm);
    padding-top: var(--sp-md);
    border-top: 1px solid var(--hairline-soft);
  }
  .ms-bar-row {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
  }
  .ms-bar-name {
    font-size: 13px;
    color: var(--ink-muted);
    flex: 0 0 56px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ms-bar-track {
    flex: 1;
    height: 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--ink) 8%, transparent);
    overflow: hidden;
  }
  .ms-bar-fill {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: var(--asset-blue);
  }
  .ms-bar-amt {
    font-size: 13px;
    color: var(--ink);
    flex: 0 0 64px;
    text-align: right;
  }
  .ms-bar-pct {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-faint);
    flex: 0 0 36px;
    text-align: right;
  }
  .ms-hint {
    font-size: 12px;
    color: var(--ink-faint);
    margin: 0 0 var(--sp-md);
  }
  .ms-detail {
    margin-top: var(--sp-sm);
    padding-top: var(--sp-xs);
    border-top: 1px solid var(--hairline-soft);
    display: flex;
    flex-direction: column;
  }
  .ms-tx {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-md);
    padding: 9px 0;
    border-bottom: 1px solid var(--hairline-soft);
  }
  .ms-tx:last-child {
    border-bottom: 0;
  }
  .ms-tx-l {
    display: flex;
    align-items: baseline;
    gap: var(--sp-sm);
    flex-wrap: wrap;
  }
  .ms-tx-name {
    font-size: 14px;
    color: var(--ink);
  }
  .ms-tx-note,
  .ms-tx-date {
    font-size: 12px;
    color: var(--ink-faint);
  }
  .ms-tx-amt {
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
  }
  .ms-tx-amt.expense {
    color: var(--flame);
  }
  .ms-tx-amt.income {
    color: var(--sky-deep);
  }
  .ms-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-sm);
    padding: var(--sp-2xl) 0;
    text-align: center;
  }
  .ms-empty-ic {
    width: 32px;
    height: 32px;
    fill: none;
    stroke: var(--ink-faint);
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .ms-empty-title {
    font-size: 14px;
    color: var(--ink-muted);
    margin: 0;
  }

  @media (max-width: 720px) {
    .page-head h1 {
      font-size: 26px;
    }
    .seg-btn {
      padding: 7px 16px;
    }
    .list {
      padding: var(--sp-xs) var(--sp-lg);
    }
  }
</style>
