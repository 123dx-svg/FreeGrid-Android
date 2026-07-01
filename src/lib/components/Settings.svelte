<script lang="ts">
  import Sheet from "./Sheet.svelte";
  import DataTools from "./DataTools.svelte";
  import { store } from "../store.svelte";
  import { deriveDashboard } from "../derive";
  import { loadFqResult } from "../fq-test";
  import { isTauri, checkForUpdate, installUpdate, updateState } from "../updater.svelte";
  import { Capacitor } from "@capacitor/core";
  import {
    settings,
    removeCustom,
    hasProfile,
    currentAge,
    yearsToRetire,
    emergencyTargetMonths,
    fiTargetNetWorth,
  } from "../settings.svelte";
  import { colorForName } from "../categoryColors";

  let { open = false, onClose }: { open?: boolean; onClose?: () => void } = $props();

  // 子页开合(抽屉式:点顶层行滑入)
  let view = $state({ profile: false, personal: false, cats: false, data: false });

  const appVersion = __APP_VERSION__;
  let nativeVer = $state("");
  if (Capacitor.isNativePlatform()) {
    import("@capacitor/app")
      .then(({ App }) => App.getInfo())
      .then((i) => (nativeVer = `${i.version} (${i.build})`))
      .catch(() => {});
  }

  const vm = $derived(deriveDashboard(store));
  const actualEmergencyMonths = $derived(vm.netWorth > 0 && vm.dailyBurn > 0 ? vm.netWorth / (vm.dailyBurn * 30) : null);

  const fqRisk = $derived.by(() => {
    const r = loadFqResult();
    if (!r) return null;
    return r.code[1] === "进" ? "进取" : "稳健";
  });

  const age = $derived(currentAge());
  const y2r = $derived(yearsToRetire());
  const emTarget = $derived(emergencyTargetMonths());
  const fiTarget = $derived(fiTargetNetWorth());

  const INCOME = [
    { v: "lt5k", l: "<5千" }, { v: "5-10k", l: "5–10千" }, { v: "10-20k", l: "1–2万" },
    { v: "20-50k", l: "2–5万" }, { v: "gt50k", l: "5万+" },
  ];
  const CITY = [
    { v: "t1", l: "一线" }, { v: "nt1", l: "新一线" }, { v: "t2", l: "二线" },
    { v: "t3", l: "三四线" }, { v: "town", l: "县城乡镇" },
  ];
  const FAMILY = [
    { v: "single", l: "单身" }, { v: "couple", l: "情侣" }, { v: "married", l: "已婚无孩" },
    { v: "kids", l: "已婚有孩" }, { v: "other", l: "其他" },
  ];
  const RISK = [
    { v: "", l: "跟随财商" }, { v: "aggressive", l: "进取" }, { v: "neutral", l: "中性" }, { v: "conservative", l: "稳健" },
  ];
  const THEME = [
    { v: "system", l: "跟随系统" }, { v: "dark", l: "深色" }, { v: "light", l: "浅色" },
  ];
  const STARTTAB = [
    { v: "dashboard", l: "仪表盘" }, { v: "assets", l: "资产" }, { v: "history", l: "流水" }, { v: "check", l: "自检" },
  ];

  const themeLabel = $derived(THEME.find((t) => t.v === settings.theme)?.l ?? "跟随系统");
  const customCount = $derived(settings.customExpenseCategories.length + settings.customIncomeSources.length);

  const nowYear = new Date().getFullYear();
  const yuan0 = (n: number) => "¥" + Math.round(n).toLocaleString("en-US");

  function stepBirth(d: number) {
    const cur = settings.profile.birthYear ?? nowYear - 30;
    settings.profile.birthYear = Math.min(nowYear, Math.max(1940, cur + d));
  }
  function stepRetire(d: number) {
    const cur = settings.profile.retireAge ?? 60;
    settings.profile.retireAge = Math.min(90, Math.max(40, cur + d));
  }
  function stepCount(which: "elderCount" | "childCount", d: number) {
    settings.profile[which] = Math.min(10, Math.max(0, settings.profile[which] + d));
  }
</script>

<!-- ════════ 顶层:设置列表 ════════ -->
<Sheet {open} title="设置" {onClose}>
  <div class="setlist">
    <button class="srow" onclick={() => (view.profile = true)}>
      <svg class="srow-ic" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4.5 20c0.5-4 4-6 7.5-6s7 2 7.5 6" /></svg>
      <span class="srow-title">个人档案</span>
      <span class="srow-val">{hasProfile() ? "已填" : "未填"}</span>
      <span class="srow-chev">›</span>
    </button>

    <button class="srow" onclick={() => (view.personal = true)}>
      <svg class="srow-ic" viewBox="0 0 24 24"><path d="M4 7h8M16 7h4M4 17h4M12 17h8" /><circle cx="14" cy="7" r="2.3" /><circle cx="8" cy="17" r="2.3" /></svg>
      <span class="srow-title">APP 个性化</span>
      <span class="srow-val">{themeLabel}</span>
      <span class="srow-chev">›</span>
    </button>

    {#if customCount > 0}
      <button class="srow" onclick={() => (view.cats = true)}>
        <svg class="srow-ic" viewBox="0 0 24 24"><path d="M3 3h8l10 10-8 8L3 11z" /><circle cx="7.5" cy="7.5" r="1.4" /></svg>
        <span class="srow-title">分类管理</span>
        <span class="srow-val">{customCount} 项</span>
        <span class="srow-chev">›</span>
      </button>
    {/if}

    <button class="srow" onclick={() => (view.data = true)}>
      <svg class="srow-ic" viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" /></svg>
      <span class="srow-title">数据 · 备份与导入</span>
      <span class="srow-chev">›</span>
    </button>

    <div class="srow static">
      <svg class="srow-ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.6h0.01" /></svg>
      <span class="srow-title">关于</span>
      <span class="srow-val num">v{nativeVer || appVersion}</span>
    </div>

    {#if isTauri}
      {#if updateState.available}
        <button class="about-btn" disabled={updateState.status === "downloading"} onclick={installUpdate}>
          {updateState.status === "downloading" ? "下载安装中…" : `更新到 v${updateState.version}`}
        </button>
      {:else}
        <button class="about-btn" disabled={updateState.status === "checking"} onclick={checkForUpdate}>
          {updateState.status === "checking" ? "检查中…" : updateState.status === "uptodate" ? "已是最新版本 ✓" : "检查更新"}
        </button>
      {/if}
    {/if}

    <p class="setlist-foot">纯本地 · 零网络 · 数据只存本机</p>
  </div>
</Sheet>

<!-- ════════ 子页:个人档案 ════════ -->
<Sheet open={view.profile} title="个人档案" wide onClose={() => (view.profile = false)}>
  <div class="set">
    <p class="set-lead">这些只存在你手机里,永不上传。填得越全,自由分析越懂你。</p>

    <div class="set-row">
      <span class="set-label">出生年份</span>
      <div class="set-step">
        <button onclick={() => stepBirth(-1)} aria-label="减">−</button>
        <span class="set-step-val num">{settings.profile.birthYear ?? "—"}{#if age != null}<span class="set-sub"> · {age}岁</span>{/if}</span>
        <button onclick={() => stepBirth(1)} aria-label="加">+</button>
      </div>
    </div>

    <div class="set-row">
      <span class="set-label">目标退休年龄</span>
      <div class="set-step">
        <button onclick={() => stepRetire(-1)} aria-label="减">−</button>
        <span class="set-step-val num">{settings.profile.retireAge ?? "—"}{#if settings.profile.retireAge != null}<span class="set-sub"> 岁</span>{/if}</span>
        <button onclick={() => stepRetire(1)} aria-label="加">+</button>
      </div>
    </div>

    <div class="set-row">
      <span class="set-label">期望退休后月开销</span>
      <div class="set-inputwrap">
        <span class="set-yen">¥</span>
        <input class="set-input num" type="number" inputmode="numeric" placeholder="如 6000" min="0" bind:value={settings.profile.retireMonthlySpend} />
      </div>
    </div>

    <div class="set-row">
      <span class="set-label">需赡养老人</span>
      <div class="set-step">
        <button onclick={() => stepCount("elderCount", -1)} aria-label="减">−</button>
        <span class="set-step-val num">{settings.profile.elderCount} 位</span>
        <button onclick={() => stepCount("elderCount", 1)} aria-label="加">+</button>
      </div>
    </div>

    <div class="set-row">
      <span class="set-label">抚养子女</span>
      <div class="set-step">
        <button onclick={() => stepCount("childCount", -1)} aria-label="减">−</button>
        <span class="set-step-val num">{settings.profile.childCount} 位</span>
        <button onclick={() => stepCount("childCount", 1)} aria-label="加">+</button>
      </div>
    </div>

    <div class="set-block">
      <span class="set-label">月收入档</span>
      <div class="set-chips">
        {#each INCOME as o (o.v)}
          <button class="set-chip" class:on={settings.profile.incomeBand === o.v} onclick={() => (settings.profile.incomeBand = settings.profile.incomeBand === o.v ? "" : o.v)}>{o.l}</button>
        {/each}
      </div>
    </div>

    <div class="set-block">
      <span class="set-label">城市生活成本</span>
      <div class="set-chips">
        {#each CITY as o (o.v)}
          <button class="set-chip" class:on={settings.profile.city === o.v} onclick={() => (settings.profile.city = settings.profile.city === o.v ? "" : o.v)}>{o.l}</button>
        {/each}
      </div>
    </div>

    <div class="set-block">
      <span class="set-label">家庭结构</span>
      <div class="set-chips">
        {#each FAMILY as o (o.v)}
          <button class="set-chip" class:on={settings.profile.family === o.v} onclick={() => (settings.profile.family = settings.profile.family === o.v ? "" : o.v)}>{o.l}</button>
        {/each}
      </div>
    </div>

    <div class="set-block">
      <span class="set-label">风险偏好{#if fqRisk}<span class="set-sub"> · 财商测试:{fqRisk}</span>{/if}</span>
      <div class="set-chips">
        {#each RISK as o (o.v)}
          <button class="set-chip" class:on={settings.profile.riskPref === o.v} onclick={() => (settings.profile.riskPref = o.v)}>{o.l}</button>
        {/each}
      </div>
    </div>

    {#if age != null || y2r != null || fiTarget != null || settings.profile.elderCount || settings.profile.childCount}
      <p class="set-mini">档案洞察</p>
      <div class="set-insights">
        {#if y2r != null}
          <div class="ins-row"><span class="ins-k">距目标退休</span><span class="ins-v num">{y2r} 年</span></div>
        {/if}
        <div class="ins-row">
          <span class="ins-k">应急储备目标</span>
          <span class="ins-v num">{emTarget} 个月{#if actualEmergencyMonths != null}<span class="ins-sub"> · 现有 {actualEmergencyMonths >= 99 ? "99+" : Math.round(actualEmergencyMonths)} 个月</span>{/if}</span>
        </div>
        {#if fiTarget != null}
          <div class="ins-row"><span class="ins-k">财务自由目标净值</span><span class="ins-v num">{yuan0(fiTarget)}</span></div>
        {/if}
      </div>
      <p class="set-note">目标按赡养/抚养人数上调;财务自由目标 = 退休后月开销 × 12 × 25(4% 法则)。仅供参考。</p>
    {/if}
  </div>
</Sheet>

<!-- ════════ 子页:APP 个性化 ════════ -->
<Sheet open={view.personal} title="APP 个性化" onClose={() => (view.personal = false)}>
  <div class="set">
    <div class="set-block">
      <span class="set-label">主题</span>
      <div class="set-chips">
        {#each THEME as o (o.v)}
          <button class="set-chip" class:on={settings.theme === o.v} onclick={() => (settings.theme = o.v as typeof settings.theme)}>{o.l}</button>
        {/each}
      </div>
    </div>
    <div class="set-block">
      <span class="set-label">默认起始页</span>
      <div class="set-chips">
        {#each STARTTAB as o (o.v)}
          <button class="set-chip" class:on={settings.startTab === o.v} onclick={() => (settings.startTab = o.v)}>{o.l}</button>
        {/each}
      </div>
    </div>
  </div>
</Sheet>

<!-- ════════ 子页:分类管理 ════════ -->
{#if customCount > 0}
  <Sheet open={view.cats} title="分类管理" onClose={() => (view.cats = false)}>
    <div class="set">
      {#if settings.customExpenseCategories.length}
        <div class="set-block">
          <span class="set-label">自定义支出分类</span>
          <div class="set-chips">
            {#each settings.customExpenseCategories as c (c)}
              <span class="cm-tag">
                <span class="cm-dot" style="background:{colorForName(c)}"></span>{c}
                <button class="cm-x" onclick={() => removeCustom("expense", c)} aria-label="删除">✕</button>
              </span>
            {/each}
          </div>
        </div>
      {/if}
      {#if settings.customIncomeSources.length}
        <div class="set-block">
          <span class="set-label">自定义收入来源</span>
          <div class="set-chips">
            {#each settings.customIncomeSources as c (c)}
              <span class="cm-tag">
                <span class="cm-dot" style="background:{colorForName(c)}"></span>{c}
                <button class="cm-x" onclick={() => removeCustom("income", c)} aria-label="删除">✕</button>
              </span>
            {/each}
          </div>
        </div>
      {/if}
      <p class="set-note">删除自定义分类不会影响已记录的流水,只是不再出现在快捷选项里。</p>
    </div>
  </Sheet>
{/if}

<!-- ════════ 子页:数据 · 备份与导入 ════════ -->
<Sheet open={view.data} title="数据 · 备份与导入" wide onClose={() => (view.data = false)}>
  <DataTools />
</Sheet>

<style>
  /* ── 顶层设置列表 ── */
  .setlist {
    display: flex;
    flex-direction: column;
  }
  .srow {
    display: flex;
    align-items: center;
    gap: var(--sp-md);
    width: 100%;
    min-height: 54px;
    padding: 13px 2px;
    border: 0;
    border-bottom: 1px solid var(--hairline-soft);
    background: transparent;
    color: inherit;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition: background 0.12s ease;
  }
  .srow:hover {
    background: var(--mist2);
  }
  .srow.static {
    cursor: default;
  }
  .srow.static:hover {
    background: transparent;
  }
  .srow-ic {
    flex: 0 0 22px;
    width: 22px;
    height: 22px;
    fill: none;
    stroke: var(--ink-muted);
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .srow-title {
    flex: 1;
    font-size: 15px;
    color: var(--ink);
  }
  .srow-val {
    font-size: 13px;
    color: var(--ink-faint);
  }
  .srow-chev {
    font-size: 18px;
    color: var(--ink-ghost);
    margin-left: 2px;
  }
  .setlist-foot {
    font-size: 11px;
    color: var(--ink-ghost);
    text-align: center;
    margin: var(--sp-lg) 0 0;
    letter-spacing: 0.02em;
  }
  .about-btn {
    align-self: stretch;
    margin-top: var(--sp-md);
    padding: 11px 18px;
    border-radius: 999px;
    border: 1px solid var(--hairline);
    background: transparent;
    color: var(--ink-muted);
    font-family: var(--font-rounded);
    font-size: 14px;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .about-btn:hover {
    background: var(--mist2);
    color: var(--ink);
  }
  .about-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  /* ── 子页通用 ── */
  .set {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
  }
  .set-lead {
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--ink-faint);
    margin: 0 0 var(--sp-xs);
  }
  .set-mini {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.08em;
    color: var(--ink-faint);
    margin: var(--sp-sm) 0 2px;
  }
  .set-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-md);
    min-height: 40px;
  }
  .set-block {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .set-label {
    font-size: 14px;
    color: var(--ink);
  }
  .set-sub {
    font-size: 12px;
    color: var(--ink-faint);
  }
  .set-step {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    border: 1px solid var(--hairline);
    border-radius: 999px;
    background: var(--mist2);
    padding: 2px;
  }
  .set-step button {
    width: 30px;
    height: 30px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--ink-muted);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
  }
  .set-step button:hover {
    background: var(--mist);
    color: var(--ink);
  }
  .set-step-val {
    min-width: 78px;
    text-align: center;
    font-size: 14px;
    color: var(--ink);
  }
  .set-inputwrap {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 1px solid var(--hairline);
    border-radius: 10px;
    background: var(--mist2);
    padding: 6px 12px;
  }
  .set-yen {
    color: var(--ink-faint);
    font-size: 14px;
  }
  .set-input {
    width: 96px;
    border: 0;
    background: transparent;
    color: var(--ink);
    font-size: 15px;
    text-align: right;
    outline: none;
  }
  .set-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .set-chip {
    font-size: 13px;
    padding: 7px 14px;
    border-radius: 999px;
    border: 1px solid var(--hairline);
    background: var(--mist2);
    color: var(--ink-muted);
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
  }
  .set-chip:hover {
    color: var(--ink);
  }
  .set-chip.on {
    background: color-mix(in srgb, var(--sky) 16%, transparent);
    border-color: var(--sky);
    color: var(--sky-deep);
    font-weight: 600;
  }
  .cm-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--ink);
    padding: 6px 6px 6px 11px;
    border-radius: 999px;
    border: 1px solid var(--hairline);
    background: var(--mist2);
  }
  .cm-dot {
    width: 9px;
    height: 9px;
    border-radius: 3px;
    flex: 0 0 9px;
  }
  .cm-x {
    border: 0;
    background: transparent;
    color: var(--ink-faint);
    font-size: 12px;
    cursor: pointer;
    padding: 2px 4px;
    line-height: 1;
  }
  .cm-x:hover {
    color: var(--flame);
  }
  .set-insights {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--sp-md);
    border-radius: 12px;
    background: color-mix(in srgb, var(--sky) 7%, var(--mist2));
    border: 1px solid var(--hairline-soft);
  }
  .ins-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 5px 0;
  }
  .ins-k {
    font-size: 13px;
    color: var(--ink-muted);
  }
  .ins-v {
    font-size: 16px;
    font-weight: 600;
    color: var(--ink);
  }
  .ins-sub {
    font-size: 12px;
    font-weight: 400;
    color: var(--ink-faint);
  }
  .set-note {
    font-size: 12px;
    line-height: 1.5;
    color: var(--ink-ghost);
    margin: 0;
  }
</style>
