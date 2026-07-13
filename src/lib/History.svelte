<script lang="ts">
  import { store, deleteTransaction, updateTransaction } from "./store.svelte";
  import Sheet from "./components/Sheet.svelte";
  import TxSheet from "./components/TxSheet.svelte";
  import DonutChart from "./components/DonutChart.svelte";
  import BarChart from "./components/BarChart.svelte";
  import SpendingCalendar from "./components/SpendingCalendar.svelte";
  import LevelCard from "./components/LevelCard.svelte";
  import SpendSimSheet from "./components/SpendSimSheet.svelte";
  import { reached } from "./level.svelte";
  import { buildAnnualReport, buildNarrative, availableYears, type Scope, type Quarter } from "./annual";
  import { deriveDashboard } from "./derive";
  import { markBadgeEvent } from "./achievements.svelte";
  import { aiReady, cacheGet, cacheSet, cacheGetAt, aiConfig } from "./ai/config.svelte";
  import { chat, fmtCost } from "./ai/llm";
  import { annualMessages } from "./ai/prompts";
  import { profileSummary } from "./settings.svelte";

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

  let selectedDay = $state<Date | null>(null);
  const dayTxs = $derived.by(() => {
    if (!selectedDay) return [] as typeof allTx;
    const y = selectedDay.getFullYear(), m = selectedDay.getMonth(), d = selectedDay.getDate();
    return allTx
      .filter((t) => t.date.getFullYear() === y && t.date.getMonth() === m && t.date.getDate() === d)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  });
  const dayExpense = $derived(dayTxs.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amount, 0));
  const dayIncome = $derived(dayTxs.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0));
  const fmtDayLabel = (d: Date) => `${d.getMonth() + 1} 月 ${d.getDate()} 日 周${"日一二三四五六"[d.getDay()]}`;

  // 当天同类型(同分类/同来源)合并成一行:金额相加、笔数累计、id 汇总(供整组删除)
  type DayGroup = { key: string; name: string; kind: "expense" | "income"; total: number; count: number; ids: string[]; note?: string; date: Date };
  const dayGroups = $derived.by<DayGroup[]>(() => {
    const m = new Map<string, DayGroup>();
    for (const t of dayTxs) {
      const key = `${t.kind}|${t.name}`;
      const g = m.get(key);
      if (g) {
        g.total += t.amount;
        g.count += 1;
        g.ids.push(t.id);
        if (g.note !== undefined && t.note !== g.note) g.note = undefined; // 备注不一致 → 不显示
      } else {
        m.set(key, { key, name: t.name, kind: t.kind, total: t.amount, count: 1, ids: [t.id], note: t.note || undefined, date: t.date });
      }
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  });

  // ── 消费日历 sheet(右上角日历按钮弹出)──
  let showCalendar = $state(false);

  // ── 格式化 ──
  const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 0 });

  function money(v: number): string {
    return nf.format(v);
  }
  function fmtDate(d: Date): string {
    // 中文自然日,对齐 iOS .dateTime.year().month().day() 在 zh 设备上的渲染
    return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
  }

  // ── 删除二次确认(可删单笔或整组同类型)──
  let pendingDelete = $state<DayGroup | null>(null);
  function askDelete(g: DayGroup) {
    pendingDelete = g;
  }
  function confirmDelete() {
    if (pendingDelete) for (const id of pendingDelete.ids) deleteTransaction(id, pendingDelete.kind);
    pendingDelete = null;
  }
  function cancelDelete() {
    pendingDelete = null;
  }

  // ── 编辑一笔(点行进入;合并组 count>1 先展开选单笔)──
  let expandedKey = $state<string | null>(null);
  type EditState = { id: string; kind: "expense" | "income"; initial: { amount: number; name: string; note: string; dateTime: Date } };
  let editing = $state<EditState | null>(null);
  const fmtTime = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  function groupItems(g: DayGroup) {
    return dayTxs
      .filter((t) => t.kind === g.kind && t.name === g.name)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  function openEdit(id: string, kind: "expense" | "income") {
    const t = dayTxs.find((x) => x.id === id && x.kind === kind);
    if (!t) return;
    // 以"归档自然日(date)"为准的日期,时刻沿用 createdAt —— 避免 date/createdAt 因时区/序列化分叉时把这笔挪到别的一天
    const dt = new Date(
      t.date.getFullYear(), t.date.getMonth(), t.date.getDate(),
      t.createdAt.getHours(), t.createdAt.getMinutes(), t.createdAt.getSeconds()
    );
    editing = { id, kind, initial: { amount: t.amount, name: t.name, note: t.note, dateTime: dt } };
  }
  function onRowClick(g: DayGroup) {
    if (g.count === 1) openEdit(g.ids[0], g.kind);
    else expandedKey = expandedKey === g.key ? null : g.key;
  }
  function saveEdit(v: { amount: number; name: string; note: string; dateTime: Date }) {
    if (editing) updateTransaction(editing.id, editing.kind, v);
    editing = null;
  }
  function askDeleteSingle(t: (typeof allTx)[number]) {
    pendingDelete = { key: `${t.kind}|${t.name}|${t.id}`, name: t.name, kind: t.kind, total: t.amount, count: 1, ids: [t.id], note: t.note || undefined, date: t.date };
  }

  // ════════════════ 个人经营年报(实时 $derived,读 store)════════════════
  // 年份口径(years/scope/yearOptions)已上移到顶部 allTx 之后,供明细列表共享。

  // ── 报告口径:年 / 季(季报 Lv.3 解锁)──
  let reportPeriod = $state<"year" | "quarter">("year");
  let reportQuarter = $state<Quarter>((Math.floor(new Date().getMonth() / 3) + 1) as Quarter);
  const scopeYear = $derived(typeof scope === "number" ? scope : new Date().getFullYear());
  const reportScope = $derived<Scope>(reportPeriod === "quarter" ? { y: scopeYear, q: reportQuarter } : scope);

  const report = $derived(
    buildAnnualReport(
      {
        expenses: store.expenses,
        incomes: store.incomes,
        passiveSources: store.passiveSources,
        assets: store.assets,
      },
      reportScope
    )
  );
  // 同比报表(年报:去年;季报:去年同季度)—— 年度对比 Lv.5 解锁,否则不计
  const prevReport = $derived.by(() => {
    if (!reached(5)) return null;
    const data = { expenses: store.expenses, incomes: store.incomes, passiveSources: store.passiveSources, assets: store.assets };
    if (reportPeriod === "quarter") return buildAnnualReport(data, { y: scopeYear - 1, q: reportQuarter });
    return typeof scope === "number" ? buildAnnualReport(data, scope - 1) : null;
  });
  const narrative = $derived(buildNarrative(report, prevReport));
  // AI 解读专用的往期同比(不受 Lv.5 UI 门控;供「综合分析」用)
  const aiPrevReport = $derived.by(() => {
    const data = { expenses: store.expenses, incomes: store.incomes, passiveSources: store.passiveSources, assets: store.assets };
    if (reportPeriod === "quarter") return buildAnnualReport(data, { y: scopeYear - 1, q: reportQuarter });
    return typeof scope === "number" ? buildAnnualReport(data, scope - 1) : null;
  });
  // 报表需已结算才展示:当前/未来的年·季 未到结算周期;「全部」(年报口径)= 终身汇总,不受此限
  const isAllYear = $derived(reportPeriod === "year" && scope === "all");
  const awaitingSettlement = $derived(!report.settled && !isAllYear);
  // 当前实时财务态(作 AI 解读背景:让展望呼应现实,如此刻已见底)
  const vm = $derived(
    deriveDashboard({ expenses: store.expenses, incomes: store.incomes, passiveSources: store.passiveSources, assets: store.assets })
  );
  const liveState = $derived(vm.state);
  // 省钱模拟用:日均净烧 + 各支出类目的月均金额(取自当前 scope 的年报聚合)
  const spendDailyNetBurn = $derived(Math.max(0, vm.dailyBurn - vm.dailyPassive));
  const spendCats = $derived(
    report.expenseSlices
      .filter((s) => s.value > 0)
      .map((s) => ({ name: s.name, monthly: s.value / Math.max(1, report.monthsSpan) }))
      .sort((a, b) => b.monthly - a.monthly)
      .slice(0, 5)
  );
  let showSpendSim = $state(false);

  let showReport = $state(false);
  let reportTab = $state<"data" | "story">("data");
  let advOpen = $state(false);
  // 打开年报:解锁「年度回望」徽章
  function openReport() {
    showReport = true;
    markBadgeEvent("viewed_annual");
  }
  // 关闭年报时复位到默认(数据看板 · 进阶收起)
  $effect(() => {
    if (!showReport) {
      reportTab = "data";
      advOpen = false;
      reportPeriod = "year";
    }
  });

  // ── AI · 经营解读(年报/季报;默认为空,手动生成;已生成的会常驻)──
  let aiLetter = $state("");
  let aiLetterLoading = $state(false);
  let aiLetterErr = $state("");
  let aiLetterCost = $state("");
  let aiLetterAt = $state<number | null>(null); // 上次生成时间(epoch ms)
  let regenCooldown = $state(false); // 生成后短暂冷却,防手滑连点重复生成
  let lastLetterKey = "";

  // 个人档案摘要(仅在用户 opt-in sendProfile 时发送,用于贴合国情个性化)
  const aiProfile = $derived(aiConfig.sendProfile ? profileSummary() || undefined : undefined);
  // 统一构建解读的 messages + cacheKey(genLetter 与自动常驻共用,保证 key 一致)
  const letterMsgs = $derived(
    annualMessages({
      yearLabel: report.yearLabel,
      income: report.revenue,
      expense: report.cost,
      net: report.net,
      savingRatePct: Math.round(report.margin * 100),
      topCategories: report.expenseSlices.slice(0, 4).map((s) => ({ name: s.name, pct: Math.round(s.pct) })),
      healthScore: report.health.score,
      rating: report.health.rating,
      passivePct: Math.round(report.fiProgress * 100),
      freedomDays: Number.isFinite(report.freedomDays) ? Math.round(report.freedomDays) : null,
      isQuarter: report.isQuarter,
      settled: report.settled,
      liveState,
      profile: aiProfile,
      assets: {
        netWorth: vm.netWorth,
        lockedAssets: vm.lockedAssets,
        cash: vm.cash,
        liabilities: vm.liabilities,
        passivePct: Math.round((vm.passiveRatio || 0) * 100),
      },
      prev:
        aiPrevReport && (aiPrevReport.expenseCount > 0 || aiPrevReport.incomeCount > 0)
          ? { label: aiPrevReport.yearLabel, income: aiPrevReport.revenue, expense: aiPrevReport.cost, net: aiPrevReport.net }
          : null,
    })
  );

  // 年份/季度/数据变化 → 清空上次生成的解读(下方自动常驻会按新 key 尝试恢复)
  $effect(() => {
    const k = `${report.yearLabel}:${Math.round(report.revenue)}:${Math.round(report.cost)}:${report.health.score}:${aiProfile ?? ""}`;
    if (k !== lastLetterKey) {
      lastLetterKey = k;
      aiLetter = "";
      aiLetterErr = "";
      aiLetterCost = "";
      aiLetterAt = null;
    }
  });

  // 自动常驻:打开解读 tab 且已有缓存 → 直接显示(免费、不联网),并带上次生成时间
  $effect(() => {
    if (!showReport || reportTab !== "story" || aiLetter || aiLetterLoading) return;
    if (!aiReady("annual")) return;
    const cached = cacheGet(letterMsgs.cacheKey);
    if (cached) {
      aiLetter = cached;
      aiLetterCost = "";
      aiLetterAt = cacheGetAt(letterMsgs.cacheKey);
    }
  });

  async function genLetter(force: boolean) {
    if (aiLetterLoading || (force && regenCooldown)) return;
    const { messages, cacheKey } = letterMsgs;
    aiLetterErr = "";
    if (!force) {
      const cached = cacheGet(cacheKey);
      if (cached) {
        aiLetter = cached;
        aiLetterCost = "";
        aiLetterAt = cacheGetAt(cacheKey);
        return;
      }
    }
    aiLetterLoading = true;
    const r = await chat({ messages, maxTokens: 480, temperature: 0.9 });
    aiLetterLoading = false;
    if (!r.ok || !r.content) {
      aiLetterErr = r.error ?? "生成失败";
      return;
    }
    cacheSet(cacheKey, r.content.trim());
    // 冷却 5 秒,避免连点重复消耗
    regenCooldown = true;
    setTimeout(() => (regenCooldown = false), 5000);
    aiLetter = r.content.trim();
    aiLetterCost = fmtCost(r.usage);
    aiLetterAt = Date.now();
  }

  /** 生成时间的相对/绝对显示。 */
  function fmtAgo(ts: number | null): string {
    if (!ts) return "";
    const d = Math.floor((Date.now() - ts) / 86_400_000);
    if (d <= 0) return "今天生成";
    if (d === 1) return "昨天生成";
    if (d < 30) return `${d} 天前生成`;
    const t = new Date(ts);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")} 生成`;
  }

  // 年报专用格式化
  const yuan0 = (n: number) => "¥" + Math.round(n).toLocaleString("en-US");
  const pctText = (x: number) => `${(x * 100).toFixed(2)}%`;
  const daysText = (x: number) => (Number.isFinite(x) ? `${Math.floor(x)} 天` : "∞");
  const monthsText = (x: number) => (Number.isFinite(x) ? `${Math.round(x)} 个月` : "∞");
  function netText(v: number): string {
    return (v >= 0 ? "+¥" : "−¥") + Math.round(Math.abs(v)).toLocaleString("en-US");
  }

  // 数据看板 · 速览一句大白话总结
  const heroLine = $derived.by(() => {
    const r = report;
    const period = r.isQuarter ? "本季度" : "今年";
    if (r.net >= 0) {
      const m = r.emergencyMonths;
      const tail = Number.isFinite(m) && m >= 1 ? `,大约够 ${Math.round(m)} 个月的开销` : "";
      return `${period}攒下 ${yuan0(r.net)}${tail} 👍`;
    }
    return `${period}花得比赚得多,透支了 ${yuan0(Math.abs(r.net))},得留意了`;
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
      <button class="report-btn" onclick={openReport}>
        <svg viewBox="0 0 24 24" class="rep-ic"><path d="M5 3h10l4 4v14H5zM15 3v4h4M8 13h8M8 17h5M8 9h3" /></svg>
        <span>年报</span>
      </button>
      <button class="cal-btn" aria-label="消费日历" title="消费日历" onclick={() => (showCalendar = true)}>
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

      <button class="sim-btn" onclick={() => (showSpendSim = true)}>⚡ 省钱模拟 · 拿铁因子 →</button>
    </section>
  {/if}

  <SpendSimSheet open={showSpendSim} dailyNetBurn={spendDailyNetBurn} categories={spendCats} onClose={() => (showSpendSim = false)} />

  <!-- ───── 消费日历改到右上角「日历」按钮弹出(见下方 Sheet)───── -->

  <!-- ───── 消费日历 sheet(右上角日历按钮弹出)───── -->
  <Sheet open={showCalendar} title="消费日历" wide onClose={() => (showCalendar = false)}>
    <SpendingCalendar expenses={store.expenses} bind:selected={selectedDay} />
    {#if selectedDay}
      <div class="day-detail vault-card">
        <div class="dd-head">
          <span class="dd-date">{fmtDayLabel(selectedDay)}</span>
          <span class="dd-sums num">
            {#if dayExpense > 0}<span class="dd-exp">−¥{money(dayExpense)}</span>{/if}
            {#if dayIncome > 0}<span class="dd-inc">+¥{money(dayIncome)}</span>{/if}
          </span>
        </div>
        {#if dayTxs.length === 0}
          <p class="dd-empty">这天没有记录</p>
        {:else}
          <ul class="dd-list">
            {#each dayGroups as g (g.key)}
              <li class="dd-item">
                <div class="dd-row">
                  <button class="dd-main" onclick={() => onRowClick(g)}>
                    <span class="dd-left">
                      <span class="row-name">{g.name}{#if g.count > 1}<span class="dd-count num"> ×{g.count}</span>{/if}</span>
                      {#if g.count === 1 && g.note}<span class="row-note">{g.note}</span>{/if}
                    </span>
                    <span class="row-amt num" class:income={g.kind === "income"} class:expense={g.kind === "expense"}>
                      {g.kind === "income" ? "+¥" : "−¥"}{money(g.total)}
                    </span>
                    <span class="dd-chev" class:open={expandedKey === g.key} aria-hidden="true">{g.count > 1 ? "▾" : "›"}</span>
                  </button>
                  <button class="del-btn" aria-label="删除" onclick={() => askDelete(g)}>
                    <svg viewBox="0 0 24 24" class="del-ic"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                </div>
                {#if g.count > 1 && expandedKey === g.key}
                  <ul class="dd-sub">
                    {#each groupItems(g) as t (t.id)}
                      <li class="dd-subrow">
                        <button class="dd-submain" onclick={() => openEdit(t.id, t.kind)}>
                          <span class="dd-time num">{fmtTime(t.createdAt)}</span>
                          {#if t.note}<span class="row-note">{t.note}</span>{/if}
                          <span class="row-amt num sub" class:income={t.kind === "income"} class:expense={t.kind === "expense"}>
                            {t.kind === "income" ? "+¥" : "−¥"}{money(t.amount)}
                          </span>
                        </button>
                        <button class="del-btn" aria-label="删除这一笔" onclick={() => askDeleteSingle(t)}>
                          <svg viewBox="0 0 24 24" class="del-ic"><path d="M6 6l12 12M18 6L6 18" /></svg>
                        </button>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {:else}
      <p class="cal-hint">点某一天,查看当天的每一笔</p>
    {/if}
  </Sheet>


  <!-- ───── 编辑一笔(点当天明细行进入)───── -->
  <TxSheet
    open={editing !== null}
    kind={editing?.kind ?? "expense"}
    mode="edit"
    initial={editing?.initial}
    onClose={() => (editing = null)}
    onSubmit={saveEdit}
  />


  <!-- ───── 个人经营年报 sheet ───── -->
  <Sheet open={showReport} title={reportPeriod === "quarter" ? "个人经营季报" : "个人经营年报"} wide onClose={() => (showReport = false)}>
    <!-- 年份切换 -->
    <div class="rp-years">
      {#each yearOptions as y (y.label)}
        <button class="ov-year" class:on={scope === y.value} onclick={() => (userScope = y.value)}>{y.label}</button>
      {/each}
    </div>

    <!-- 年 / 季 报告口径(季报 Lv.3 解锁)-->
    <div class="rp-period">
      <button class="rp-per-btn" class:on={reportPeriod === "year"} onclick={() => (reportPeriod = "year")}>年报</button>
      {#if reached(3)}
        <button class="rp-per-btn" class:on={reportPeriod === "quarter"} onclick={() => (reportPeriod = "quarter")}>季报</button>
      {:else}
        <button class="rp-per-btn locked" disabled>季报 · Lv.3 🔒</button>
      {/if}
    </div>
    {#if reportPeriod === "quarter"}
      <div class="rp-quarters">
        {#each [1, 2, 3, 4] as q (q)}
          <button class="rp-q" class:on={reportQuarter === q} onclick={() => (reportQuarter = q as Quarter)}>Q{q}</button>
        {/each}
      </div>
    {/if}

    {#if awaitingSettlement}
      <div class="ms-empty">
        <svg viewBox="0 0 24 24" class="ms-empty-ic"><path d="M12 7v5l3 2M4 12a8 8 0 1 0 2-5" /></svg>
        <p class="ms-empty-title">还没到结算周期</p>
        <p class="rp-await-hint">
          本{reportPeriod === "quarter" ? "季度" : "年度"}尚未结束,{reportPeriod === "quarter" ? "季报" : "年报"}会在收官后生成。<br />
          想回顾历史?切到已结束的{reportPeriod === "quarter" ? "季度(Q1/Q2…)" : "年份(2025 等)"}。
        </p>
      </div>
    {:else if report.cost === 0 && report.revenue === 0}
      <div class="ms-empty">
        <svg viewBox="0 0 24 24" class="ms-empty-ic"><path d="M5 3h10l4 4v14H5zM15 3v4h4" /></svg>
        <p class="ms-empty-title">这{reportPeriod === "quarter" ? "个季度" : "一年"}还没有可结算的经营数据</p>
      </div>
    {:else}
      <!-- 共享头部:门面 + 评级 -->
      <div class="rp-hero">
        <p class="rp-cover-kicker">{reportPeriod === "quarter" ? "QUARTERLY" : "ANNUAL"} OPERATING REPORT · {report.yearLabel}</p>
        <h2 class="rp-cover-title">{narrative.coverTitle}</h2>
        <div class="rp-hero-rating">
          <span class="rp-rating-grade num">{report.health.rating}</span>
          <span class="rp-rating-score num">{report.health.score}<span class="rp-of">/100</span></span>
        </div>
      </div>

      <!-- 两大板块 Tab -->
      <div class="rp-tabs" role="tablist">
        <button class="rp-tab" class:on={reportTab === "data"} role="tab" aria-selected={reportTab === "data"} onclick={() => (reportTab = "data")}>📊 数据看板</button>
        <button class="rp-tab" class:on={reportTab === "story"} role="tab" aria-selected={reportTab === "story"} onclick={() => (reportTab = "story")}>📖 {reportPeriod === "quarter" ? "季度解读" : "年度解读"}</button>
      </div>

      {#key reportTab}
        <div class="rp-panel">
          {#if reportTab === "data"}
            <!-- 经营等级 -->
            <LevelCard />
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
                      <span class="rp-rank-pct num">{s.pct.toFixed(2)}%</span>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- 进阶指标(Lv.4 小公司解锁 · 默认折叠) -->
            <div class="rp-adv">
              {#if reached(4)}
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
              {:else}
                <div class="rp-adv-locked">📈 进阶指标 · 到 <b>Lv.4 小公司</b> 解锁</div>
              {/if}
            </div>
          {:else}
            <!-- 解读:仅 AI,默认为空,需手动点击生成 -->
            {#if !aiReady("annual")}
              <div class="rp-adv-locked">在「设置 · AI 助手」开启后,可让 AI 结合你的数据写一份专属{report.isQuarter ? "季度" : "年度"}解读 ✨</div>
            {:else}
              <div class="rp-block rp-ai">
                <p class="rp-sec">✨ AI {report.isQuarter ? "季度" : "年度"}解读</p>
                {#if aiLetter}
                  {#each aiLetter.split(/\n+/) as para, i (i)}
                    <p class="rp-para">{para}</p>
                  {/each}
                  <div class="rp-ai-foot">
                    <span class="rp-ai-cost">{aiLetterCost || fmtAgo(aiLetterAt)}</span>
                    <button class="rp-ai-regen" onclick={() => genLetter(true)} disabled={aiLetterLoading || regenCooldown}>{aiLetterLoading ? "生成中…" : regenCooldown ? "稍候…" : "重新生成"}</button>
                  </div>
                {:else}
                  <p class="rp-ai-lead">默认不生成。点下方按钮,让 AI 结合你本{report.isQuarter ? "季度" : "年度"}的数据写一份专属解读。</p>
                  <button class="rp-ai-btn" onclick={() => genLetter(false)} disabled={aiLetterLoading}>{aiLetterLoading ? "AI 解读中…" : `✨ 生成${report.isQuarter ? "季度" : "年度"}解读`}</button>
                  {#if aiLetterErr}<p class="rp-ai-err">{aiLetterErr}</p>{/if}
                {/if}
              </div>
            {/if}
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
        <p class="dc-q">{pendingDelete.count > 1 ? `确定删除这 ${pendingDelete.count} 笔「${pendingDelete.name}」吗？` : "确定删除这笔记录吗？"}</p>
        <div class="dc-card">
          <span class="dc-name">{pendingDelete.name}{#if pendingDelete.count > 1}<span class="num"> ×{pendingDelete.count}</span>{/if}</span>
          <span class="dc-amt num" class:income={pendingDelete.kind === "income"} class:expense={pendingDelete.kind === "expense"}>
            {pendingDelete.kind === "income" ? "+¥" : "−¥"}{money(pendingDelete.total)}
          </span>
          <span class="dc-date num">{fmtDate(pendingDelete.date)}</span>
          {#if pendingDelete.count === 1 && pendingDelete.note}<span class="dc-note">{pendingDelete.note}</span>{/if}
        </div>
        <p class="dc-warn">{pendingDelete.count > 1 ? "这几笔将一并从流水移除" : "删除后该笔将从流水移除"},净值随之回滚,此操作不可撤销。</p>
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

  .cal-hint {
    text-align: center;
    font-size: 12.5px;
    color: var(--ink-faint);
    margin: var(--sp-md) 0 0;
  }
  /* ── 消费日历:当天明细 ── */
  .day-detail {
    margin-top: var(--sp-md);
    padding: var(--sp-md) var(--sp-lg);
  }
  .dd-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--sp-md);
    padding-bottom: var(--sp-sm);
    border-bottom: 1px solid var(--hairline-soft);
  }
  .dd-date {
    font-size: 14px;
    font-weight: 600;
    color: var(--ink);
  }
  .dd-sums {
    font-size: 13px;
    display: inline-flex;
    gap: 10px;
  }
  .dd-exp {
    color: var(--flame);
  }
  .dd-inc {
    color: var(--moss);
  }
  .dd-empty {
    font-size: 13px;
    color: var(--ink-faint);
    text-align: center;
    margin: var(--sp-md) 0 0;
  }
  .dd-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .dd-item {
    border-bottom: 1px solid var(--hairline-soft);
  }
  .dd-item:last-child {
    border-bottom: 0;
  }
  .dd-row {
    display: flex;
    align-items: center;
    gap: var(--sp-md);
    padding: 10px 0;
  }
  .dd-main {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--sp-md);
    min-width: 0;
    border: 0;
    background: transparent;
    padding: 0;
    cursor: pointer;
    text-align: left;
    color: inherit;
    font: inherit;
  }
  .dd-chev {
    flex: 0 0 auto;
    font-size: 12px;
    color: var(--ink-ghost);
    transition: transform 0.15s ease;
  }
  .dd-chev.open {
    transform: rotate(180deg);
  }
  @media (prefers-reduced-motion: reduce) {
    .dd-chev {
      transition: none;
    }
  }
  /* 合并组展开的单笔子列表 */
  .dd-sub {
    list-style: none;
    margin: 0 0 8px;
    padding: 0 0 0 var(--sp-md);
    border-left: 2px solid var(--hairline-soft);
  }
  .dd-subrow {
    display: flex;
    align-items: center;
    gap: var(--sp-md);
    padding: 7px 0;
  }
  .dd-submain {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--sp-md);
    min-width: 0;
    border: 0;
    background: transparent;
    padding: 0;
    cursor: pointer;
    text-align: left;
    color: inherit;
    font: inherit;
  }
  .dd-time {
    font-size: 13px;
    color: var(--ink-muted);
    flex: 0 0 auto;
  }
  .dd-submain .row-note {
    flex: 1;
  }
  .dd-submain .row-amt {
    margin-left: auto;
  }
  .row-amt.sub {
    font-size: 14px;
  }
  .dd-left {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .dd-count {
    font-size: 12px;
    color: var(--ink-faint);
    font-weight: 400;
  }

  /* ── 行文字(当天明细复用)── */
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
  /* 年 / 季 报告口径 */
  .rp-period {
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    border-radius: 999px;
    background: var(--mist2);
    border: 1px solid var(--hairline);
    margin-bottom: var(--sp-md);
  }
  .rp-per-btn {
    border: 0;
    background: transparent;
    color: var(--ink-muted);
    font-family: var(--font-rounded);
    font-size: 13px;
    padding: 6px 18px;
    border-radius: 999px;
    cursor: pointer;
  }
  .rp-per-btn.on {
    background: var(--sky-deep);
    color: var(--paper);
    font-weight: 600;
  }
  .rp-per-btn.locked {
    color: var(--ink-ghost);
    cursor: default;
  }
  .rp-quarters {
    display: flex;
    gap: 6px;
    margin-bottom: var(--sp-md);
  }
  .rp-q {
    flex: 1;
    padding: 8px 0;
    border-radius: 10px;
    border: 1px solid var(--hairline);
    background: var(--mist2);
    color: var(--ink-muted);
    font-family: var(--font-mono);
    font-size: 13px;
    cursor: pointer;
  }
  .rp-q.on {
    background: color-mix(in srgb, var(--sky) 16%, transparent);
    border-color: var(--sky);
    color: var(--sky-deep);
    font-weight: 700;
  }
  .rp-adv-locked {
    font-size: 12.5px;
    color: var(--ink-faint);
    text-align: center;
    padding: 12px;
    border-radius: 12px;
    border: 1px dashed var(--hairline);
    background: color-mix(in srgb, var(--ink) 3%, transparent);
    margin-top: var(--sp-sm);
  }
  .rp-adv-locked b {
    color: var(--sky-deep);
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
  .sim-btn {
    width: 100%;
    margin-top: var(--sp-md);
    font-family: var(--font-rounded);
    font-size: 14px;
    padding: 13px 18px;
    border-radius: 999px;
    background: transparent;
    border: 1px solid color-mix(in srgb, var(--income-gold) 45%, var(--hairline));
    color: var(--income-gold);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .sim-btn:hover {
    background: color-mix(in srgb, var(--income-gold) 8%, transparent);
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
  .rp-ai {
    border-top: 1px dashed color-mix(in srgb, var(--sky-deep) 35%, var(--hairline));
    padding-top: var(--sp-md);
  }
  .rp-await-hint {
    font-size: 13px;
    line-height: 1.7;
    color: var(--ink-faint);
    margin: var(--sp-sm) 0 0;
    text-align: center;
  }
  .rp-ai-lead {
    font-size: 13px;
    line-height: 1.6;
    color: var(--ink-faint);
    margin: 4px 0 var(--sp-md);
  }
  .rp-ai-btn {
    align-self: flex-start;
    margin-top: var(--sp-xs);
    padding: 10px 20px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--sky-deep) 55%, transparent);
    background: color-mix(in srgb, var(--sky) 13%, transparent);
    color: var(--sky-deep);
    font-family: var(--font-rounded);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  }
  .rp-ai-btn:disabled {
    opacity: 0.6;
  }
  .rp-ai-foot {
    display: flex;
    align-items: center;
    gap: var(--sp-md);
    margin-top: var(--sp-sm);
  }
  .rp-ai-cost {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--ink-ghost);
  }
  .rp-ai-regen {
    margin-left: auto;
    border: 0;
    background: transparent;
    color: var(--sky-deep);
    font-size: 12.5px;
    cursor: pointer;
    padding: 2px 0;
  }
  .rp-ai-err {
    font-size: 12.5px;
    color: var(--flame);
    margin: var(--sp-xs) 0 0;
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
