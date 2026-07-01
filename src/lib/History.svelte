<script lang="ts">
  import { store, deleteTransaction } from "./store.svelte";
  import Sheet from "./components/Sheet.svelte";
  import DonutChart from "./components/DonutChart.svelte";
  import BarChart from "./components/BarChart.svelte";
  import { buildAnnualReport, buildNarrative, availableYears, type Scope } from "./annual";

  // ── 数据:中央响应式 store,本屏只做合并/排序/分组,不碰任何 freedom-math ──
  // 归一成扁平交易形状,行模板单分支即可
  type Tx = {
    id: string;
    kind: "expense" | "income";
    name: string; // 支出=分类 / 收入=来源
    note: string;
    date: Date;
    createdAt: Date; // 含时间(到分),用于行内显示具体时间
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
      createdAt: e.createdAt,
      amount: e.amount,
      category: e.category,
    })),
    ...store.incomes.map((i) => ({
      id: i.id,
      kind: "income" as const,
      name: i.source,
      note: i.note,
      date: i.date,
      createdAt: i.createdAt,
      amount: i.amount,
    })),
  ]);

  // ── 财年口径(经营概览 + 明细列表共享)──
  const years = $derived(availableYears(store.expenses, store.incomes));
  // 默认口径 = 最近有数据的年;用户切换后以用户选择为准
  let userScope = $state<Scope | null>(null);
  const scope = $derived<Scope>(userScope ?? (years.length ? years[0] : "all"));
  const yearOptions = $derived<{ value: Scope; label: string }[]>([
    { value: "all", label: "全部" },
    ...years.map((y) => ({ value: y as Scope, label: String(y) })),
  ]);

  // ── 筛选状态 ──
  type Filter = "all" | "expense" | "income";
  let filter = $state<Filter>("all");
  let selectedCategory = $state<string | null>(null);
  type SortBy = "date" | "amount";
  let sortBy = $state<SortBy>("date");

  // 切出支出 tab 时分类二级筛选自动失效 —— 派生「有效分类」,免 $effect 的 rune 顺序坑
  const effectiveCategory = $derived(filter === "expense" ? selectedCategory : null);

  // 财年口径过滤:跟随经营概览选中的财年(scope 定义于下方年报块;闭包内引用,渲染时已初始化)
  const txInScope = $derived(allTx.filter((t) => scope === "all" || t.date.getFullYear() === scope));

  // ── 派生:分类汇总(降序),只统计支出,按选中财年过滤 ──
  const expenseCategoryTotals = $derived.by(() => {
    const g = new Map<string, number>();
    for (const t of txInScope) {
      if (t.kind === "expense" && t.category) g.set(t.category, (g.get(t.category) ?? 0) + t.amount);
    }
    return [...g.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  });
  const categoryGrandTotal = $derived(expenseCategoryTotals.reduce((s, c) => s + c.total, 0));

  // ── 派生:财年 → 分段筛选 → 排序(按日期降序 / 按金额降序)——
  const filteredTransactions = $derived.by(() => {
    let list = txInScope;
    if (filter === "expense") {
      list = list.filter((t) => t.kind === "expense");
      if (effectiveCategory) list = list.filter((t) => t.category === effectiveCategory);
    } else if (filter === "income") {
      list = list.filter((t) => t.kind === "income");
    }
    const sorted = list.slice();
    if (sortBy === "amount") sorted.sort((a, b) => b.amount - a.amount);
    else sorted.sort((a, b) => b.date.getTime() - a.date.getTime());
    return sorted;
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

  // 流水行:日期 + 周几 + 具体时间(时间取 createdAt,因 date 持久化后会被截成零点)
  const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
  const pad2 = (n: number) => String(n).padStart(2, "0");
  function fmtRowDateTime(tx: Tx): string {
    const d = tx.date;
    const t = tx.createdAt ?? d;
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} 周${WEEKDAYS[d.getDay()]} ${pad2(t.getHours())}:${pad2(t.getMinutes())}`;
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

  // ── 删除二次确认 ──
  let pendingDelete = $state<Tx | null>(null);
  function askDelete(tx: Tx) {
    pendingDelete = tx;
  }
  function confirmDelete() {
    if (pendingDelete) deleteTransaction(pendingDelete.id, pendingDelete.kind);
    pendingDelete = null;
  }
  function cancelDelete() {
    pendingDelete = null;
  }

  // ════════════════ 个人经营年报(实时 $derived,读 store)════════════════
  // 年份口径(years/scope/yearOptions)已上移到顶部 allTx 之后,供明细列表共享。

  const report = $derived(
    buildAnnualReport(
      {
        expenses: store.expenses,
        incomes: store.incomes,
        passiveSources: store.passiveSources,
        assets: store.assets,
      },
      scope
    )
  );
  // 上一年报表(用于年报同比叙事);仅当 scope 为具体年时计算
  const prevReport = $derived(
    typeof scope === "number"
      ? buildAnnualReport(
          {
            expenses: store.expenses,
            incomes: store.incomes,
            passiveSources: store.passiveSources,
            assets: store.assets,
          },
          scope - 1
        )
      : null
  );
  const narrative = $derived(buildNarrative(report, prevReport));

  let showReport = $state(false);
  let reportTab = $state<"data" | "story">("data");
  let advOpen = $state(false);
  // 关闭年报时复位到默认(数据看板 · 进阶收起)
  $effect(() => {
    if (!showReport) {
      reportTab = "data";
      advOpen = false;
    }
  });

  // 年报专用格式化
  const yuan0 = (n: number) => "¥" + Math.round(n).toLocaleString("en-US");
  const pctText = (x: number) => `${Math.round(x * 100)}%`;
  const daysText = (x: number) => (Number.isFinite(x) ? `${Math.floor(x)} 天` : "∞");
  const monthsText = (x: number) => (Number.isFinite(x) ? `${Math.round(x)} 个月` : "∞");
  function netText(v: number): string {
    return (v >= 0 ? "+¥" : "−¥") + Math.round(Math.abs(v)).toLocaleString("en-US");
  }

  // 数据看板 · 全年速览一句大白话总结
  const heroLine = $derived.by(() => {
    const r = report;
    if (r.net >= 0) {
      const m = r.emergencyMonths;
      const tail = Number.isFinite(m) && m >= 1 ? `,大约够 ${Math.round(m)} 个月的开销` : "";
      return `今年攒下 ${yuan0(r.net)}${tail} 👍`;
    }
    return `今年花得比赚得多,透支了 ${yuan0(Math.abs(r.net))},得留意了`;
  });

  // 数据看板 · 折叠「进阶指标」+ 大白话注解
  const advMetrics = $derived([
    { label: "利润率", val: pctText(report.margin), hint: `每赚 100 元,攒下 ${Math.round(report.margin * 100)} 元` },
    { label: "被动收入占比", val: pctText(report.passiveShare), hint: "不上班也能自动来的钱,占总收入的比例" },
    { label: "财务自由进度", val: pctText(report.fiProgress), hint: "被动收入覆盖日常开销的进度,到 100% 就财务自由了" },
    { label: "自由现金跑道", val: daysText(report.freedomDays), hint: "如果现在起不再赚钱,手上的钱还能撑多久" },
    { label: "应急储备", val: monthsText(report.emergencyMonths), hint: "万一失业,能靠存款撑几个月" },
    { label: "恩格尔系数", val: pctText(report.engel), hint: "吃饭开销占总花销的比例,越低通常越宽裕" },
    { label: "刚性成本", val: pctText(report.rigidRatio), hint: "房租房贷等每月必须花、省不掉的部分" },
    { label: "弹性成本", val: pctText(report.flexRatio), hint: "娱乐购物等想省就能省的部分" },
    { label: "成长投资", val: pctText(report.growthRatio), hint: "花在学习/健康等投资自己上的部分" },
  ]);
</script>

<div class="hist">
  <!-- ───── Header ───── -->
  <header class="page-head">
    <div class="head-text">
      <p class="kicker">HISTORY</p>
      <h1>收支流水</h1>
    </div>
    <div class="head-actions">
      <button class="report-btn" onclick={() => (showReport = true)}>
        <svg viewBox="0 0 24 24" class="rep-ic"><path d="M5 3h10l4 4v14H5zM15 3v4h4M8 13h8M8 17h5M8 9h3" /></svg>
        <span>年报</span>
      </button>
      <button class="cal-btn" aria-label="月度汇总" title="月度汇总" onclick={() => (showMonthly = true)}>
        <svg viewBox="0 0 24 24" class="cal-ic">
          <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
          <path d="M3 9h18M8 2.5v4M16 2.5v4" />
          <path d="M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2" />
        </svg>
      </button>
    </div>
  </header>

  <!-- ───── 经营概览卡(实时)───── -->
  {#if report.cost > 0 || report.revenue > 0}
    <section class="ov vault-card">
      <div class="ov-head">
        <p class="kicker">经营概览 · {report.settled ? "已结算" : "实时"}</p>
        <div class="ov-years">
          {#each yearOptions as y (y.label)}
            <button class="ov-year" class:on={scope === y.value} onclick={() => (userScope = y.value)}>{y.label}</button>
          {/each}
        </div>
      </div>

      <div class="ov-kpis">
        <div class="kpi">
          <span class="kpi-label">营收</span>
          <span class="kpi-val income num">{yuan0(report.revenue)}</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">经营成本</span>
          <span class="kpi-val expense num">{yuan0(report.cost)}</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">净盈余</span>
          <span class="kpi-val num">{netText(report.net)}</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">利润率</span>
          <span class="kpi-val num">{pctText(report.margin)}</span>
        </div>
      </div>

      <div class="ov-donuts">
        <div class="ov-donut">
          <p class="ov-sub">成本结构</p>
          <DonutChart slices={report.expenseSlices} centerValue={yuan0(report.cost)} centerLabel="总成本" size={150} />
        </div>
        <div class="ov-donut">
          <p class="ov-sub">营收构成</p>
          <DonutChart slices={report.incomeSlices} centerValue={yuan0(report.revenue)} centerLabel="总营收" size={150} />
        </div>
      </div>

      <button class="ov-more" onclick={() => (showReport = true)}>查看完整年报 →</button>
    </section>
  {/if}

  <!-- ───── Segmented filter + 排序 ───── -->
  <div class="filter-row">
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
    <div class="sort" aria-label="排序">
      <button class="sort-btn" class:on={sortBy === "date"} onclick={() => (sortBy = "date")}>
        <svg viewBox="0 0 24 24" class="sort-ic"><path d="M7 4v16M7 20l-3-3M7 20l3-3M13 6h8M13 12h6M13 18h4" /></svg>
        按日期
      </button>
      <button class="sort-btn" class:on={sortBy === "amount"} onclick={() => (sortBy = "amount")}>
        <svg viewBox="0 0 24 24" class="sort-ic"><path d="M7 4v16M7 20l-3-3M7 20l3-3M13 6h3M13 12h6M13 18h9" /></svg>
        按金额
      </button>
    </div>
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
            <span class="row-date num">{fmtRowDateTime(tx)}</span>
          </div>
          <span class="row-amt num" class:income={tx.kind === "income"} class:expense={tx.kind === "expense"}>
            {tx.kind === "income" ? "+¥" : "−¥"}{money(tx.amount)}
          </span>
          <button class="del-btn" aria-label="删除这笔" title="删除这笔" onclick={() => askDelete(tx)}>
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

  <!-- ───── 个人经营年报 sheet ───── -->
  <Sheet open={showReport} title="个人经营年报" wide onClose={() => (showReport = false)}>
    {#if report.cost === 0 && report.revenue === 0}
      <div class="ms-empty">
        <svg viewBox="0 0 24 24" class="ms-empty-ic"><path d="M5 3h10l4 4v14H5zM15 3v4h4" /></svg>
        <p class="ms-empty-title">这一年还没有可结算的经营数据</p>
      </div>
    {:else}
      <!-- 年份切换 -->
      <div class="rp-years">
        {#each yearOptions as y (y.label)}
          <button class="ov-year" class:on={scope === y.value} onclick={() => (userScope = y.value)}>{y.label}</button>
        {/each}
      </div>

      <!-- 共享头部:门面 + 评级 -->
      <div class="rp-hero">
        <p class="rp-cover-kicker">ANNUAL OPERATING REPORT · {report.yearLabel}</p>
        <h2 class="rp-cover-title">{narrative.coverTitle}</h2>
        <div class="rp-hero-rating">
          <span class="rp-rating-grade num">{report.health.rating}</span>
          <span class="rp-rating-score num">{report.health.score}<span class="rp-of">/100</span></span>
        </div>
      </div>

      <!-- 两大板块 Tab -->
      <div class="rp-tabs" role="tablist">
        <button class="rp-tab" class:on={reportTab === "data"} role="tab" aria-selected={reportTab === "data"} onclick={() => (reportTab = "data")}>📊 数据看板</button>
        <button class="rp-tab" class:on={reportTab === "story"} role="tab" aria-selected={reportTab === "story"} onclick={() => (reportTab = "story")}>📖 年度解读</button>
      </div>

      {#key reportTab}
        <div class="rp-panel">
          {#if reportTab === "data"}
            <!-- 全年速览 -->
            <div class="rp-glance">
              <div class="rp-gl">
                <svg class="rp-gl-ic income" viewBox="0 0 24 24"><path d="M12 19V6M6 12l6-6 6 6" /></svg>
                <span class="rp-gl-label">赚</span>
                <span class="rp-gl-val income num">{yuan0(report.revenue)}</span>
              </div>
              <div class="rp-gl">
                <svg class="rp-gl-ic expense" viewBox="0 0 24 24"><path d="M12 5v13M6 12l6 6 6-6" /></svg>
                <span class="rp-gl-label">花</span>
                <span class="rp-gl-val expense num">{yuan0(report.cost)}</span>
              </div>
              <div class="rp-gl">
                <svg class="rp-gl-ic" viewBox="0 0 24 24"><path d="M4 12a6 4 0 0 1 12 0v3H4zM16 11h3v3M9 8.5a3 2 0 0 1 5 0" /></svg>
                <span class="rp-gl-label">{report.net >= 0 ? "攒下" : "透支"}</span>
                <span class="rp-gl-val num" class:pos={report.net >= 0} class:neg={report.net < 0}>{yuan0(Math.abs(report.net))}</span>
              </div>
            </div>
            <p class="rp-glance-sum">{heroLine}</p>

            <!-- 钱花在哪 / 钱从哪来 -->
            <div class="rp-charts">
              <div class="rp-chart">
                <p class="rp-sec">钱花在哪</p>
                <DonutChart slices={report.expenseSlices} centerValue={yuan0(report.cost)} centerLabel="总花销" size={160} />
              </div>
              <div class="rp-chart">
                <p class="rp-sec">钱从哪来</p>
                <DonutChart slices={report.incomeSlices} centerValue={yuan0(report.revenue)} centerLabel="总收入" size={160} />
              </div>
            </div>

            <!-- 每月进出 -->
            <div class="rp-block">
              <p class="rp-sec">每月进出 · 收入 × 支出</p>
              <BarChart data={report.monthly} />
            </div>

            <!-- 钱主要花在这几处 -->
            {#if report.expenseSlices.length > 0}
              {@const maxV = report.expenseSlices[0].value}
              <div class="rp-block">
                <p class="rp-sec">钱主要花在这几处</p>
                <div class="rp-rank">
                  {#each report.expenseSlices as s (s.name)}
                    <div class="rp-rank-row">
                      <span class="rp-rank-name">{s.name}</span>
                      <span class="rp-rank-track">
                        <span class="rp-rank-fill" style="width:{maxV > 0 ? `max(4px, ${(s.value / maxV) * 100}%)` : '4px'};background:{s.color}"></span>
                      </span>
                      <span class="rp-rank-amt num">{yuan0(s.value)}</span>
                      <span class="rp-rank-pct num">{Math.round(s.pct)}%</span>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- 进阶指标(默认折叠) -->
            <div class="rp-adv">
              <button class="rp-adv-toggle" onclick={() => (advOpen = !advOpen)} aria-expanded={advOpen}>
                <span>进阶指标 · 展开细看</span>
                <span class="rp-adv-chev" class:open={advOpen}>▾</span>
              </button>
              {#if advOpen}
                <div class="rp-adv-body">
                  {#each advMetrics as m (m.label)}
                    <div class="rp-adv-row">
                      <div class="rp-adv-head">
                        <span class="rp-adv-label">{m.label}</span>
                        <span class="rp-adv-val num">{m.val}</span>
                      </div>
                      <p class="rp-adv-hint">{m.hint}</p>
                    </div>
                  {/each}
                  <div class="rp-adv-health">
                    <p class="rp-adv-label">经营健康分构成</p>
                    {#each report.health.parts as p (p.label)}
                      <div class="rp-part">
                        <span class="rp-part-head">
                          <span class="rp-part-label">{p.label}</span>
                          <span class="rp-part-note num">{p.note}</span>
                        </span>
                        <span class="rp-part-track">
                          <span class="rp-part-fill" style="width:{(p.score / p.max) * 100}%"></span>
                        </span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {:else}
            <!-- 年度解读 -->
            <p class="rp-cover-sub">{narrative.coverSub}</p>
            <p class="rp-verdict-card">{report.health.verdict}</p>
            <div class="rp-block">
              <p class="rp-sec">致股东的一封信</p>
              {#each narrative.letter as para, i (i)}
                <p class="rp-para">{para}</p>
              {/each}
            </div>
            <div class="rp-block">
              <p class="rp-sec">经营点评</p>
              {#each narrative.comments as c, i (i)}
                <p class="rp-comment">· {c}</p>
              {/each}
            </div>
          {/if}
        </div>
      {/key}
    {/if}
  </Sheet>

  <!-- ───── 删除二次确认 ───── -->
  <Sheet open={pendingDelete !== null} title="删除确认" onClose={cancelDelete}>
    {#if pendingDelete}
      <div class="del-confirm">
        <div class="dc-icon">
          <svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6" /></svg>
        </div>
        <p class="dc-q">确定删除这笔记录吗？</p>
        <div class="dc-card">
          <span class="dc-name">{pendingDelete.name}</span>
          <span class="dc-amt num" class:income={pendingDelete.kind === "income"} class:expense={pendingDelete.kind === "expense"}>
            {pendingDelete.kind === "income" ? "+¥" : "−¥"}{money(pendingDelete.amount)}
          </span>
          <span class="dc-date num">{fmtDate(pendingDelete.date)}</span>
          {#if pendingDelete.note}<span class="dc-note">{pendingDelete.note}</span>{/if}
        </div>
        <p class="dc-warn">删除后该笔将从流水移除,净值随之回滚,此操作不可撤销。</p>
        <div class="dc-actions">
          <button class="dc-btn cancel" onclick={cancelDelete}>取消</button>
          <button class="dc-btn confirm" onclick={confirmDelete}>确认删除</button>
        </div>
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

  /* ── 筛选行 + 排序 ── */
  .filter-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-md);
    flex-wrap: wrap;
  }
  .sort {
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    border-radius: 999px;
    border: 1px solid var(--hairline);
    background: var(--mist);
  }
  .sort-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: var(--font-rounded);
    font-size: 13px;
    font-weight: 500;
    padding: 6px 12px;
    border-radius: 999px;
    border: 0;
    background: transparent;
    color: var(--ink-muted);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .sort-btn:hover {
    color: var(--ink);
  }
  .sort-btn.on {
    background: color-mix(in srgb, var(--sky) 14%, transparent);
    color: var(--sky-deep);
  }
  .sort-ic {
    width: 15px;
    height: 15px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
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

  /* ── 删除二次确认 ── */
  .del-confirm {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--sp-md);
  }
  .dc-icon {
    width: 48px;
    height: 48px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--flame) 14%, transparent);
  }
  .dc-icon svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: var(--flame);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .dc-q {
    font-size: 17px;
    font-weight: 600;
    color: var(--ink);
    margin: 0;
  }
  .dc-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: var(--sp-md) var(--sp-lg);
    border-radius: 12px;
    background: var(--mist2);
    border: 1px solid var(--hairline-soft);
  }
  .dc-name {
    font-size: 15px;
    font-weight: 500;
    color: var(--ink);
  }
  .dc-amt {
    font-size: 22px;
    font-weight: 600;
  }
  .dc-amt.income {
    color: var(--sky-deep);
  }
  .dc-amt.expense {
    color: var(--flame);
  }
  .dc-date {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-faint);
  }
  .dc-note {
    font-size: 12px;
    color: var(--ink-faint);
  }
  .dc-warn {
    font-size: 12px;
    color: var(--ink-faint);
    line-height: 1.5;
    margin: 0;
  }
  .dc-actions {
    display: flex;
    gap: var(--sp-md);
    width: 100%;
    margin-top: var(--sp-xs);
  }
  .dc-btn {
    flex: 1;
    padding: 12px;
    border-radius: 999px;
    font-family: var(--font-rounded);
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .dc-btn.cancel {
    border: 1px solid var(--hairline);
    background: transparent;
    color: var(--ink-muted);
  }
  .dc-btn.cancel:hover {
    background: var(--mist2);
    color: var(--ink);
  }
  .dc-btn.confirm {
    border: 1px solid var(--flame);
    background: color-mix(in srgb, var(--flame) 14%, transparent);
    color: var(--flame);
  }
  .dc-btn.confirm:hover {
    background: color-mix(in srgb, var(--flame) 24%, transparent);
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

  /* ── 经营概览卡 + 年报 ── */
  .head-actions {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
  }
  .report-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 38px;
    padding: 0 14px;
    border-radius: 999px;
    border: 1px solid var(--hairline);
    background: var(--mist);
    color: var(--ink-muted);
    font-family: var(--font-rounded);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }
  .report-btn:hover {
    background: var(--mist2);
    color: var(--ink);
    border-color: var(--ink-ghost);
  }
  .rep-ic {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .ov {
    display: flex;
    flex-direction: column;
    gap: var(--sp-lg);
    padding: var(--sp-xl);
  }
  .ov-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-md);
    flex-wrap: wrap;
  }
  .ov-years,
  .rp-years {
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    border-radius: 999px;
    border: 1px solid var(--hairline);
    background: var(--mist2);
    flex-wrap: nowrap;
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .ov-years::-webkit-scrollbar,
  .rp-years::-webkit-scrollbar {
    display: none;
  }
  .rp-years {
    margin-bottom: var(--sp-lg);
  }
  .ov-year {
    flex-shrink: 0;
    white-space: nowrap;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 500;
    padding: 5px 12px;
    border-radius: 999px;
    border: 0;
    background: transparent;
    color: var(--ink-muted);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .ov-year:hover {
    color: var(--ink);
  }
  .ov-year.on {
    background: var(--ink);
    color: var(--paper);
  }
  .ov-kpis {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--sp-md);
  }
  .kpi {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .kpi-label {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.05em;
    color: var(--ink-faint);
  }
  .kpi-val {
    font-size: 21px;
    font-weight: 600;
    color: var(--ink);
    letter-spacing: -0.01em;
  }
  .kpi-val.income {
    color: var(--sky-deep);
  }
  .kpi-val.expense {
    color: var(--flame);
  }
  .ov-donuts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-xl);
    padding-top: var(--sp-sm);
    border-top: 1px solid var(--hairline-soft);
  }
  .ov-donut {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
  }
  .ov-sub,
  .rp-sec {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.06em;
    color: var(--ink-faint);
    margin: 0;
  }
  .ov-more {
    align-self: flex-start;
    border: 0;
    background: transparent;
    color: var(--sky-deep);
    font-family: var(--font-rounded);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    padding: 0;
  }
  .ov-more:hover {
    text-decoration: underline;
  }

  .rp-hero {
    text-align: center;
    padding: var(--sp-md) 0 var(--sp-lg);
  }
  .rp-cover-kicker {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.22em;
    color: var(--ink-faint);
    margin: 0 0 var(--sp-sm);
  }
  .rp-cover-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--ink);
    margin: 0;
    letter-spacing: -0.01em;
  }
  .rp-cover-sub {
    font-size: 13px;
    color: var(--ink-muted);
    margin: 0 0 var(--sp-md);
    text-align: center;
  }
  .rp-hero-rating {
    display: inline-flex;
    align-items: baseline;
    gap: var(--sp-md);
    margin-top: var(--sp-md);
  }
  .rp-rating-grade {
    font-size: 34px;
    font-weight: 700;
    color: var(--sky-deep);
    line-height: 1;
    letter-spacing: 0.02em;
  }
  .rp-rating-score {
    font-size: 15px;
    color: var(--ink-muted);
  }
  .rp-of {
    color: var(--ink-faint);
    font-size: 11px;
  }
  /* 两大板块 Tab */
  .rp-tabs {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 999px;
    border: 1px solid var(--hairline);
    background: var(--mist);
    margin: var(--sp-sm) 0 var(--sp-xl);
  }
  .rp-tab {
    flex: 1;
    font-family: var(--font-rounded);
    font-size: 14px;
    font-weight: 600;
    padding: 9px;
    border-radius: 999px;
    border: 0;
    background: transparent;
    color: var(--ink-muted);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .rp-tab.on {
    background: color-mix(in srgb, var(--sky) 14%, transparent);
    color: var(--sky-deep);
  }
  .rp-panel {
    animation: rp-fade 0.28s ease;
  }
  @keyframes rp-fade {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .rp-panel { animation: none; }
  }
  /* 全年速览 */
  .rp-glance {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--sp-md);
    margin-bottom: var(--sp-md);
  }
  .rp-gl {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: var(--sp-lg) var(--sp-sm);
    border-radius: 14px;
    background: var(--mist2);
    border: 1px solid var(--hairline-soft);
  }
  .rp-gl-ic {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: var(--ink-faint);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .rp-gl-ic.income {
    stroke: var(--sky-deep);
  }
  .rp-gl-ic.expense {
    stroke: var(--flame);
  }
  .rp-gl-label {
    font-size: 12px;
    color: var(--ink-muted);
  }
  .rp-gl-val {
    font-size: 17px;
    font-weight: 700;
    color: var(--ink);
    letter-spacing: -0.01em;
  }
  .rp-gl-val.income {
    color: var(--sky-deep);
  }
  .rp-gl-val.expense {
    color: var(--flame);
  }
  .rp-gl-val.neg {
    color: var(--flame);
  }
  .rp-glance-sum {
    text-align: center;
    font-size: 14px;
    font-weight: 500;
    color: var(--ink);
    margin: 0 0 var(--sp-xl);
    padding: var(--sp-md);
    border-radius: 12px;
    background: color-mix(in srgb, var(--sky) 8%, var(--mist2));
  }
  /* 年度解读 · 健康点评卡 */
  .rp-verdict-card {
    font-size: 15px;
    font-weight: 500;
    line-height: 1.6;
    color: var(--ink);
    margin: 0 0 var(--sp-xl);
    padding: var(--sp-lg);
    border-radius: 14px;
    background: var(--mist2);
    border: 1px solid var(--hairline-soft);
    border-left: 3px solid var(--sky-deep);
  }
  /* 进阶指标(折叠) */
  .rp-adv {
    margin-bottom: var(--sp-xl);
    border-top: 1px solid var(--hairline-soft);
    padding-top: var(--sp-md);
  }
  .rp-adv-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: var(--sp-sm) 0;
    border: 0;
    background: transparent;
    color: var(--ink-muted);
    font-family: var(--font-rounded);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .rp-adv-chev {
    transition: transform 0.2s ease;
    color: var(--ink-faint);
  }
  .rp-adv-chev.open {
    transform: rotate(180deg);
  }
  .rp-adv-body {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
    margin-top: var(--sp-sm);
  }
  .rp-adv-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .rp-adv-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--sp-md);
  }
  .rp-adv-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--ink);
  }
  .rp-adv-val {
    font-size: 16px;
    font-weight: 700;
    color: var(--sky-deep);
  }
  .rp-adv-hint {
    font-size: 12px;
    line-height: 1.5;
    color: var(--ink-faint);
    margin: 0;
  }
  .rp-adv-health {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
    margin-top: var(--sp-sm);
    padding-top: var(--sp-md);
    border-top: 1px solid var(--hairline-soft);
  }
  .rp-part {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .rp-part-head {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
  }
  .rp-part-label {
    color: var(--ink-muted);
  }
  .rp-part-note {
    color: var(--ink-faint);
    font-family: var(--font-mono);
  }
  .rp-part-track {
    height: 5px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--ink) 8%, transparent);
    overflow: hidden;
  }
  .rp-part-fill {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: var(--sky);
  }
  .rp-block {
    margin-bottom: var(--sp-xl);
  }
  .rp-para {
    font-size: 14px;
    line-height: 1.7;
    color: var(--ink-muted);
    margin: var(--sp-sm) 0 0;
  }
  .rp-charts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-xl);
    margin-bottom: var(--sp-xl);
  }
  .rp-chart {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
  }
  .rp-rank {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
    margin-top: var(--sp-md);
  }
  .rp-rank-row {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
  }
  .rp-rank-name {
    font-size: 13px;
    color: var(--ink-muted);
    flex: 0 0 56px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rp-rank-track {
    flex: 1;
    height: 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--ink) 8%, transparent);
    overflow: hidden;
  }
  .rp-rank-fill {
    display: block;
    height: 100%;
    border-radius: 999px;
  }
  .rp-rank-amt {
    font-size: 13px;
    color: var(--ink);
    flex: 0 0 70px;
    text-align: right;
  }
  .rp-rank-pct {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-faint);
    flex: 0 0 34px;
    text-align: right;
  }
  .rp-comment {
    font-size: 13px;
    line-height: 1.6;
    color: var(--ink-muted);
    margin: var(--sp-sm) 0 0;
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
    .ov-kpis {
      grid-template-columns: repeat(2, 1fr);
    }
    .ov-donuts {
      grid-template-columns: 1fr;
    }
    .rp-charts {
      grid-template-columns: 1fr;
    }
  }
</style>
