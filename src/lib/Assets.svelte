<script lang="ts">
  // Assets 屏 —— 1:1 移植 iOS AssetsView,reflow 桌面。
  // 数据全走真引擎(deriveDashboard),数字只渲染不重算。
  // 数据源 = 中央响应式 store;所有派生量 $derived,store 变更后屏即时刷新。
  // 交互:调拨写库、导出 CSV/JSON、从 JSON 导入、清空 —— 均落真实 store 操作。
  import { deriveDashboard } from "./derive";
  import Sheet from "./components/Sheet.svelte";
  import InvestSimSheet from "./components/SimSheet.svelte";
  import CatSelect from "./components/CatSelect.svelte";
  import { ASSET_TYPES, LIABILITY_TYPES } from "./models";
  import { assetTypeColor, liabilityTypeColor } from "./categoryColors";
  import { settings, type AssetSort } from "./settings.svelte";
import { imeSafe } from "./ime";
  import {
    store,
    updateBucket,
    addPassiveSource,
    deletePassiveSource,
    addAssetItem,
    updateAssetItem,
    removeAssetItem,
    addLiabilityItem,
    updateLiabilityItem,
    removeLiabilityItem,
  } from "./store.svelte";

  const vm = $derived(deriveDashboard(store));
  // 模拟投资:日均净烧 = 日均消费 − 日均被动(≤0 表示被动已覆盖)
  const dailyNetBurn = $derived(Math.max(0, vm.dailyBurn - vm.dailyPassive));
  let showInvest = $state(false);

  const yuan = (n: number) => "¥" + Math.round(n).toLocaleString("en-US");
  // 按金额字符串长度自适应字号,防大额(如 ¥12,345,678)溢出面板
  function moneyFont(v: number, base: number, extra = 0): number {
    const len = ("¥" + Math.round(Math.abs(v)).toLocaleString("en-US")).length + extra;
    if (len <= 8) return base;
    if (len <= 11) return Math.round(base * 0.78);
    if (len <= 14) return Math.round(base * 0.6);
    return Math.round(base * 0.5);
  }

  // 上次更新相对时间(英文),随 store.assets.updatedAt 实时变化
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const updatedAgo = $derived.by(() => {
    const diffMs = store.assets.updatedAt.getTime() - Date.now();
    const hours = Math.round(diffMs / 3_600_000);
    return rtf.format(hours, "hour");
  });

  // 被动覆盖率(0% 时数字 ink、% inkMuted、caption "覆盖日常消费")
  const passivePct = $derived(Math.round(vm.passiveRatio * 100));
  const passiveCovered = $derived(vm.passiveRatio >= 1);
  const passiveSources = $derived(store.passiveSources); // 空 → 渲染空态提示

  // ── 明细排序(金额↓ / 利率↓ / 类型),持久化在 settings ──
  const ASSET_ORDER = new Map(ASSET_TYPES.map((t, i) => [t, i]));
  const LIAB_ORDER = new Map(LIABILITY_TYPES.map((t, i) => [t, i]));
  function sortItems<T extends { type: string; amount: number; rate: number }>(items: T[], mode: AssetSort, order: Map<string, number>): T[] {
    const arr = [...items];
    if (mode === "rate") arr.sort((a, b) => (b.rate || 0) - (a.rate || 0) || b.amount - a.amount);
    else if (mode === "type") arr.sort((a, b) => (order.get(a.type) ?? 99) - (order.get(b.type) ?? 99) || b.amount - a.amount);
    else arr.sort((a, b) => b.amount - a.amount);
    return arr;
  }
  const SORT_CYCLE: AssetSort[] = ["amount", "rate", "type"];
  const assetSortLabel = $derived(settings.assetSort === "rate" ? "收益" : settings.assetSort === "type" ? "类型" : "金额");
  const liabSortLabel = $derived(settings.liabilitySort === "rate" ? "利率" : settings.liabilitySort === "type" ? "类型" : "金额");
  function cycleAssetSort() {
    settings.assetSort = SORT_CYCLE[(SORT_CYCLE.indexOf(settings.assetSort) + 1) % SORT_CYCLE.length];
  }
  function cycleLiabSort() {
    settings.liabilitySort = SORT_CYCLE[(SORT_CYCLE.indexOf(settings.liabilitySort) + 1) % SORT_CYCLE.length];
  }

  // ── 资产明细项(增/改共用一个 sheet;editId=null 为新增)──
  const assetItems = $derived(sortItems(store.assets.assetItems, settings.assetSort, ASSET_ORDER));
  const assetTypeOpts = $derived(ASSET_TYPES.map((t) => ({ name: t, color: assetTypeColor(t) })));
  let showAssetSheet = $state(false);
  let assetEditId = $state<string | null>(null);
  let assetType = $state<string>(ASSET_TYPES[0]);
  let assetName = $state("");
  let assetAmount = $state("");
  let assetRate = $state("");
  const assetValid = $derived.by(() => {
    const v = Number(assetAmount);
    return Number.isFinite(v) && v > 0;
  });
  function openAsset(id: string | null) {
    assetEditId = id;
    if (id) {
      const it = store.assets.assetItems.find((x) => x.id === id);
      assetType = it?.type ?? ASSET_TYPES[0];
      assetName = it?.name ?? "";
      assetAmount = it ? String(Math.round(it.amount)) : "";
      assetRate = it && it.rate > 0 ? String(it.rate) : "";
    } else {
      assetType = ASSET_TYPES[0];
      assetName = "";
      assetAmount = "";
      assetRate = "";
    }
    showAssetSheet = true;
  }
  function saveAsset() {
    if (!assetValid) return;
    const rate = Number(assetRate) || 0;
    if (assetEditId) updateAssetItem(assetEditId, { type: assetType, amount: Number(assetAmount), name: assetName, rate });
    else addAssetItem(assetType, Number(assetAmount), assetName, rate);
    showAssetSheet = false;
  }
  function delAsset() {
    if (assetEditId) removeAssetItem(assetEditId);
    showAssetSheet = false;
  }

  // ── 负债明细项(含年化利率)──
  const liabilityItems = $derived(sortItems(store.assets.liabilityItems, settings.liabilitySort, LIAB_ORDER));
  const liabTypeOpts = $derived(LIABILITY_TYPES.map((t) => ({ name: t, color: liabilityTypeColor(t) })));
  let showLiabSheet = $state(false);
  let liabEditId = $state<string | null>(null);
  let liabType = $state<string>(LIABILITY_TYPES[0]);
  let liabAmount = $state("");
  let liabRate = $state("");
  const liabValid = $derived.by(() => {
    const v = Number(liabAmount);
    return Number.isFinite(v) && v > 0;
  });
  function openLiab(id: string | null) {
    liabEditId = id;
    if (id) {
      const it = store.assets.liabilityItems.find((x) => x.id === id);
      liabType = it?.type ?? LIABILITY_TYPES[0];
      liabAmount = it ? String(Math.round(it.amount)) : "";
      liabRate = it && it.rate > 0 ? String(it.rate) : "";
    } else {
      liabType = LIABILITY_TYPES[0];
      liabAmount = "";
      liabRate = "";
    }
    showLiabSheet = true;
  }
  function saveLiab() {
    if (!liabValid) return;
    const rate = Number(liabRate) || 0;
    if (liabEditId) updateLiabilityItem(liabEditId, { type: liabType, amount: Number(liabAmount), rate });
    else addLiabilityItem(liabType, Number(liabAmount), rate);
    showLiabSheet = false;
  }
  function delLiab() {
    if (liabEditId) removeLiabilityItem(liabEditId);
    showLiabSheet = false;
  }

  let showEditCash = $state(false);
  let editCashAmount = $state("");
  const editCashValid = $derived.by(() => {
    if (editCashAmount.trim() === "") return false;
    const v = Number(editCashAmount);
    return Number.isFinite(v) && v >= 0;
  });
  function openEditCash() {
    editCashAmount = String(Math.round(store.assets.cash));
    showEditCash = true;
  }
  function saveEditCash() {
    if (!editCashValid) return;
    updateBucket("cash", Number(editCashAmount));
    showEditCash = false;
  }

  // ── 添加被动收入源 ──
  let showAddPassive = $state(false);
  let passiveName = $state("");
  let passiveMonthly = $state("");
  const passiveValid = $derived.by(() => {
    const v = Number(passiveMonthly);
    return passiveName.trim() !== "" && Number.isFinite(v) && v > 0;
  });
  function openAddPassive() {
    passiveName = "";
    passiveMonthly = "";
    showAddPassive = true;
  }
  function saveAddPassive() {
    if (!passiveValid) return;
    addPassiveSource(passiveName.trim(), Number(passiveMonthly));
    showAddPassive = false;
    passiveName = "";
    passiveMonthly = "";
  }
  const passiveDailyPreview = $derived.by(() => {
    const v = Number(passiveMonthly);
    return Number.isFinite(v) && v > 0 ? (v / 30).toFixed(1) : null;
  });
</script>

<div class="assets">
  <header class="page-head">
    <p class="kicker">ASSETS</p>
    <h1>我的资产</h1>
  </header>

  <!-- ───── 净值 ───── -->
      <section class="vault-card hi networth">
        <span class="kicker">NET WORTH · 净值</span>
        <div class="nw-number num" style="font-size:{moneyFont(vm.netWorth, 56)}px">{yuan(vm.netWorth)}</div>
        <p class="nw-caption">上次更新 · {updatedAgo}</p>
      </section>

      <!-- ───── 三桶横排:资产(金/锁) + 现金(蓝/钞) + 负债(从净值扣减)───── -->
      <div class="buckets">
        <section class="vault-card bucket">
          <div class="bucket-head">
            <span class="glyph gold">
              <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                <path fill="currentColor" d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5Zm3 8H9V6a3 3 0 0 1 6 0v3Z"/>
              </svg>
            </span>
            <span class="kicker">资产</span>
          </div>
          <div class="bucket-amount num" style="font-size:{moneyFont(vm.lockedAssets, 21)}px">{yuan(vm.lockedAssets)}</div>
        </section>

        <section class="vault-card bucket">
          <div class="bucket-head">
            <span class="glyph blue">
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path fill="currentColor" d="M2 6.5A1.5 1.5 0 0 1 3.5 5h17A1.5 1.5 0 0 1 22 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 17.5v-11ZM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM5.5 8A1.5 1.5 0 0 1 4 9.5V8h1.5ZM4 16v-1.5A1.5 1.5 0 0 1 5.5 16H4Zm14.5 0A1.5 1.5 0 0 1 20 14.5V16h-1.5Zm0-8H20v1.5A1.5 1.5 0 0 1 18.5 8Z"/>
              </svg>
            </span>
            <span class="kicker">现金</span>
            <button class="pencil" aria-label="编辑现金" onclick={openEditCash}>
              <svg viewBox="0 0 24 24" width="13" height="13">
                <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/>
              </svg>
            </button>
          </div>
          <div class="bucket-amount num" style="font-size:{moneyFont(vm.cash, 21)}px">{yuan(vm.cash)}</div>
        </section>

        <section class="vault-card bucket liab">
          <div class="bucket-head">
            <span class="glyph flame-g">
              <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                <path fill="currentColor" d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm3 8h10v2H7v-2Z"/>
              </svg>
            </span>
            <span class="kicker">负债</span>
          </div>
          <div class="bucket-amount num" class:neg={vm.liabilities > 0} style="font-size:{moneyFont(vm.liabilities, 21, 1)}px">
            {vm.liabilities > 0 ? "−" + yuan(vm.liabilities) : yuan(0)}
          </div>
        </section>
      </div>

      <!-- ───── 资产明细(定期/基金/股票…)───── -->
      <section class="vault-card detail">
        <div class="detail-head">
          <span class="kicker">资产明细</span>
          {#if assetItems.length > 1}
            <button class="sort-btn" onclick={cycleAssetSort} aria-label="切换资产排序">
              <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M8 4v13l-3-3-1.4 1.4L9 20.8l5.4-5.4L13 14l-3 3V4H8Zm8 3.2 3-3 3 3L21.6 5.8 17 1.2l-4.6 4.6L13.8 7.2 16 5v13h2V7.2Z"/></svg>
              {assetSortLabel}
            </button>
          {/if}
          <button class="add-btn" aria-label="添加资产" onclick={() => openAsset(null)}>
            <svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2h6Z"/></svg>
          </button>
        </div>
        {#if assetItems.length === 0}
          <p class="detail-empty">还没有资产,点右上 + 添加(定期 / 基金 / 股票 / 房产…)</p>
        {:else}
          <div class="item-list">
            {#each assetItems as it (it.id)}
              <button class="item-row" onclick={() => openAsset(it.id)}>
                <span class="item-dot" style="background:{assetTypeColor(it.type)}"></span>
                <span class="item-type">{it.type}</span>
                {#if it.name}<span class="item-name">{it.name}</span>{/if}
                {#if it.rate > 0}<span class="item-rate gain num">{it.rate}%</span>{/if}
                <span class="item-amt num">{yuan(it.amount)}</span>
              </button>
            {/each}
          </div>
        {/if}
      </section>

      <!-- ───── 负债明细(房贷/车贷…,含年化利率)───── -->
      <section class="vault-card detail">
        <div class="detail-head">
          <span class="kicker">负债明细</span>
          {#if liabilityItems.length > 1}
            <button class="sort-btn" onclick={cycleLiabSort} aria-label="切换负债排序">
              <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M8 4v13l-3-3-1.4 1.4L9 20.8l5.4-5.4L13 14l-3 3V4H8Zm8 3.2 3-3 3 3L21.6 5.8 17 1.2l-4.6 4.6L13.8 7.2 16 5v13h2V7.2Z"/></svg>
              {liabSortLabel}
            </button>
          {/if}
          <button class="add-btn" aria-label="添加负债" onclick={() => openLiab(null)}>
            <svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2h6Z"/></svg>
          </button>
        </div>
        {#if liabilityItems.length === 0}
          <p class="detail-empty">没有负债 👍(有房贷 / 车贷 / 信用卡可添加,标注利率后 AI 会优先建议还高息的)</p>
        {:else}
          <div class="item-list">
            {#each liabilityItems as it (it.id)}
              <button class="item-row" onclick={() => openLiab(it.id)}>
                <span class="item-dot" style="background:{liabilityTypeColor(it.type)}"></span>
                <span class="item-type">{it.type}</span>
                {#if it.rate > 0}<span class="item-rate num">{it.rate}%</span>{/if}
                <span class="item-amt num neg">−{yuan(it.amount)}</span>
              </button>
            {/each}
          </div>
        {/if}
      </section>

      <section class="vault-card passive">
        <div class="passive-head">
          <span class="kicker">PASSIVE · 被动收入</span>
          <button class="add-btn" aria-label="添加被动收入源" onclick={openAddPassive}>
            <svg viewBox="0 0 24 24" width="13" height="13">
              <path fill="currentColor" d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2h6Z"/>
            </svg>
          </button>
        </div>

        <div class="passive-number">
          <span class="num" class:moss={passiveCovered}>{passivePct}</span>
          <span class="pct">%</span>
          <span class="passive-cap" class:moss={passiveCovered}>
            {passiveCovered ? "已覆盖日常消费" : "覆盖日常消费"}
          </span>
        </div>

        {#if passiveSources.length === 0}
          <p class="passive-empty">还没有被动收入源, 点击右上 + 添加</p>
        {:else}
          <p class="passive-sub">
            月入 {yuan(passiveSources.reduce((s, p) => s + p.monthlyAmount, 0))}
            <span class="dot">·</span>
            日均 ¥{vm.dailyPassive.toFixed(1)}
          </p>
          <hr class="hairline soft" />
          {#each passiveSources as src (src.id)}
            <div class="src-row">
              <span class="glyph moss-g">
                <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true">
                  <path fill="currentColor" d="M12 2.5S5 10 5 14.5a7 7 0 0 0 14 0C19 10 12 2.5 12 2.5Z"/>
                </svg>
              </span>
              <div class="src-info">
                <span class="src-name">{src.name}</span>
                <span class="src-meta num">¥{Math.round(src.monthlyAmount)}/月 · ¥{(src.monthlyAmount / 30).toFixed(1)}/天</span>
              </div>
              <button
                class="src-del"
                aria-label="删除被动收入源"
                onclick={() => deletePassiveSource(src.id)}
              >
                <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                  <path fill="currentColor" d="M18.3 5.71 12 12l6.3 6.29-1.42 1.42L10.59 13.4 4.29 19.7 2.88 18.3 9.17 12 2.88 5.71 4.29 4.29l6.3 6.3 6.29-6.3 1.42 1.42Z"/>
                </svg>
              </button>
            </div>
          {/each}
        {/if}
      </section>

      <!-- ───── 模拟一笔投资(看清年化陷阱)───── -->
      <button class="invest-btn" onclick={() => (showInvest = true)}>⚡ 模拟一笔 · 看清金融陷阱 →</button>

  <!-- ───── 说明 ───── -->
  <section class="explain">
    <div class="explain-head">
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z"/>
      </svg>
      <span class="explain-title">净值 · 资产 · 现金 · 负债</span>
    </div>
    <p class="explain-body">
      净值 = 资产 + 现金 − 负债, 是自动算出来的结果, 不能直接改。资产 (金色) 是暂时不动的钱, 按类型分条记 —— 定期 / 基金 / 股票 / 债券 / 房产 / 黄金 / 加密货币; 现金 (蓝色) 是随时能花的钱; 负债 (红色) 是欠的钱 —— 房贷 / 车贷 / 信用卡 等, 建议标注年化利率, 会拉低净值、也会缩短自由天数。平时收入默认进现金, 支出从现金扣; 资产 / 负债只在你手动增删改时变。
    </p>
  </section>

  <!-- ───── 添加 / 编辑资产项 ───── -->
  <Sheet open={showAssetSheet} title={assetEditId ? "编辑资产" : "添加资产"} onClose={() => (showAssetSheet = false)}>
    <div class="fg-field">
      <span class="fg-label">类型</span>
      <CatSelect options={assetTypeOpts} value={assetType} onSelect={(n) => (assetType = n)} addLabel="类型" />
    </div>
    <div class="fg-field">
      <label class="fg-label" for="asset-amt">金额(元)</label>
      <input id="asset-amt" class="fg-input fg-amount num" type="text" inputmode="decimal" placeholder="0" bind:value={assetAmount} />
    </div>
    <div class="fg-field">
      <label class="fg-label" for="asset-name">备注(可选)</label>
          <input id="asset-name" class="fg-input" type="text" placeholder="比如:招行三年定期 / 沪深300" value={assetName} use:imeSafe={(v) => (assetName = v)} />
    </div>
    <div class="fg-field">
      <label class="fg-label" for="asset-rate">年化收益率 %(可选)</label>
      <input id="asset-rate" class="fg-input num" type="text" inputmode="decimal" placeholder="如 2.5 / 8" bind:value={assetRate} />
      <p class="sheet-hint">定期 / 债券 / 基金等有预期年化的可填,AI 会参考配置收益。</p>
    </div>
    <div class="sheet-actions">
      {#if assetEditId}<button class="fg-btn ghostbtn danger" onclick={delAsset}>删除</button>{/if}
      <button class="fg-btn" disabled={!assetValid} onclick={saveAsset}>{assetEditId ? "保存" : "添加"}</button>
    </div>
  </Sheet>

  <!-- ───── 添加 / 编辑负债项 ───── -->
  <Sheet open={showLiabSheet} title={liabEditId ? "编辑负债" : "添加负债"} onClose={() => (showLiabSheet = false)}>
    <div class="fg-field">
      <span class="fg-label">类型</span>
      <CatSelect options={liabTypeOpts} value={liabType} onSelect={(n) => (liabType = n)} addLabel="类型" />
    </div>
    <div class="fg-field">
      <label class="fg-label" for="liab-amt">未还本金(元)</label>
      <input id="liab-amt" class="fg-input fg-amount num" type="text" inputmode="decimal" placeholder="0" bind:value={liabAmount} />
    </div>
    <div class="fg-field">
      <label class="fg-label" for="liab-rate">年化利率 %(可选)</label>
      <input id="liab-rate" class="fg-input num" type="text" inputmode="decimal" placeholder="如 4.9 / 18.25" bind:value={liabRate} />
      <p class="sheet-hint">标注利率后,AI 年报会优先建议先还利率最高的那笔。</p>
    </div>
    <div class="sheet-actions">
      {#if liabEditId}<button class="fg-btn ghostbtn danger" onclick={delLiab}>删除</button>{/if}
      <button class="fg-btn" disabled={!liabValid} onclick={saveLiab}>{liabEditId ? "保存" : "添加"}</button>
    </div>
  </Sheet>

  <!-- ───── 编辑现金 ───── -->
  <Sheet open={showEditCash} title="编辑现金" onClose={() => (showEditCash = false)}>
    <div class="fg-field">
      <label class="fg-label" for="edit-cash-input">新金额(元)</label>
      <input
        id="edit-cash-input"
        class="fg-input fg-amount num"
        type="text"
        inputmode="decimal"
        placeholder="0"
        bind:value={editCashAmount}
      />
      <p class="sheet-hint">可花的钱 — 活期 / 钱包余额 / 微信支付宝</p>
    </div>
    <button class="fg-btn" disabled={!editCashValid} onclick={saveEditCash}>确认</button>
  </Sheet>

  <!-- ───── 添加被动收入 ───── -->
  <Sheet open={showAddPassive} title="添加被动收入" onClose={() => (showAddPassive = false)}>
    <div class="fg-field">
      <label class="fg-label" for="passive-name-input">名称</label>
      <input
        id="passive-name-input"
        class="fg-input"
        type="text"
        placeholder="房租 / 股息 / 版税…"
        bind:value={passiveName}
      />
    </div>
    <div class="fg-field">
      <label class="fg-label" for="passive-monthly-input">月入(元 / 月)</label>
      <input
        id="passive-monthly-input"
        class="fg-input fg-amount num"
        type="text"
        inputmode="decimal"
        placeholder="0"
        bind:value={passiveMonthly}
      />
      {#if passiveDailyPreview}
        <p class="sheet-hint moss">≈ ¥{passiveDailyPreview} / 天</p>
      {/if}
    </div>
    <button class="fg-btn" disabled={!passiveValid} onclick={saveAddPassive}>添加</button>
  </Sheet>
</div>

<InvestSimSheet open={showInvest} {dailyNetBurn} onClose={() => (showInvest = false)} />

<style>
  .invest-btn {
    width: 100%;
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
  .invest-btn:hover {
    background: color-mix(in srgb, var(--income-gold) 8%, transparent);
  }
  .assets {
    display: flex;
    flex-direction: column;
    gap: var(--sp-lg);
    max-width: 1080px;
    margin: 0 auto;
  }

  .page-head {
    margin-bottom: var(--sp-xs);
  }
  .page-head h1 {
    font-size: 30px;
    font-weight: 500;
    margin: 4px 0 0;
    letter-spacing: -0.01em;
  }

  /* ── 净值 ── */
  .networth {
    position: relative;
    overflow: hidden;
  }
  .nw-number {
    font-size: 56px;
    line-height: 1;
    font-weight: 100;
    letter-spacing: -0.03em;
    color: var(--ink);
    margin: var(--sp-md) 0 0;
    white-space: nowrap;
  }
  .nw-caption {
    font-size: 12px;
    color: var(--ink-faint);
    margin: var(--sp-md) 0 0;
  }

  /* ── 双桶 ── */
  .buckets {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--sp-md);
  }
  .bucket {
    padding: var(--sp-md) var(--sp-md);
    min-width: 0;
    overflow: hidden;
  }
  .bucket-head {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .glyph {
    display: inline-flex;
    align-items: center;
  }
  .glyph.gold {
    color: var(--income-gold);
  }
  .glyph.blue {
    color: var(--asset-blue);
  }
  .glyph.moss-g {
    color: var(--moss);
  }
  .glyph.flame-g {
    color: var(--flame);
  }
  .bucket.liab {
    padding: var(--sp-md) var(--sp-md);
  }
  .pencil {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    color: var(--ink-faint);
    background: transparent;
    border: 0;
    padding: 0;
    cursor: pointer;
    transition: color 0.15s ease;
  }
  .pencil:hover {
    color: var(--ink);
  }

  /* ── sheet 内提示 ── */
  .sheet-hint {
    font-size: 12px;
    color: var(--ink-faint);
    margin: 6px 0 0;
    line-height: 1.5;
  }
  .sheet-hint.moss {
    color: var(--moss);
    font-family: var(--font-mono);
  }
  .bucket-amount {
    font-size: 26px;
    font-weight: 300;
    line-height: 1;
    color: var(--ink);
    margin-top: var(--sp-md);
    white-space: nowrap;
  }
  .bucket-amount.neg {
    color: var(--flame);
  }
  .bucket.liab .bucket-amount {
    font-size: 22px;
    margin-top: var(--sp-sm);
  }

  /* ── 被动 ── */
  .passive-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .add-btn {
    width: 24px;
    height: 24px;
    border-radius: 999px;
    background: transparent;
    border: 1px solid color-mix(in srgb, var(--sky-deep) 50%, transparent);
    color: var(--sky-deep);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
  }
  .add-btn:hover {
    background: color-mix(in srgb, var(--sky-deep) 12%, transparent);
  }
  .passive-number {
    display: flex;
    align-items: baseline;
    gap: 3px;
    margin-top: var(--sp-md);
  }
  .passive-number .num {
    font-size: 56px;
    font-weight: 100;
    line-height: 1;
    color: var(--ink);
  }
  .passive-number .num.moss {
    color: var(--moss);
  }
  .passive-number .pct {
    font-size: 24px;
    font-weight: 100;
    color: var(--ink-muted);
  }
  .passive-cap {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.05em;
    color: var(--ink-faint);
    align-self: flex-end;
    padding-bottom: 4px;
  }
  .passive-cap.moss {
    color: var(--moss);
  }
  .passive-empty {
    font-size: 13px;
    color: var(--ink-faint);
    margin: var(--sp-md) 0 0;
  }
  .passive-sub {
    font-size: 13px;
    color: var(--ink-muted);
    margin: var(--sp-md) 0 0;
  }
  .passive-sub .dot {
    color: var(--ink-faint);
    padding: 0 2px;
  }
  .passive .hairline {
    margin: var(--sp-md) 0;
  }
  .src-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: var(--sp-sm) 0;
  }
  .src-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .src-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--ink);
  }
  .src-meta {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-faint);
  }
  .src-del {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 0;
    padding: 4px;
    color: var(--ink-faint);
    cursor: pointer;
  }
  .src-del:hover {
    color: var(--flame);
  }

  /* ── 资产/负债明细 ── */
  .detail-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: var(--sp-sm);
  }
  .detail-head .kicker {
    margin-right: auto;
  }
  .sort-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: transparent;
    border: 1px solid var(--hairline-soft);
    border-radius: 999px;
    padding: 4px 11px;
    color: var(--ink-faint);
    font-family: var(--font-rounded);
    font-size: 12px;
    cursor: pointer;
    transition: color 0.15s ease, border-color 0.15s ease;
  }
  .sort-btn:hover {
    color: var(--ink-muted);
    border-color: var(--hairline);
  }
  .detail-empty {
    margin: 0;
    font-size: 13px;
    color: var(--ink-faint);
    line-height: 1.5;
  }
  .item-list {
    display: flex;
    flex-direction: column;
  }
  .item-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 11px 2px;
    background: transparent;
    border: 0;
    border-top: 1px solid var(--hairline-soft);
    color: var(--ink);
    font-family: var(--font-rounded);
    font-size: 14px;
    text-align: left;
    cursor: pointer;
  }
  .item-row:first-child {
    border-top: 0;
  }
  .item-dot {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    flex: none;
  }
  .item-type {
    font-weight: 500;
  }
  .item-name {
    color: var(--ink-faint);
    font-size: 13px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .item-rate {
    font-size: 12px;
    color: var(--flame);
    background: color-mix(in srgb, var(--flame) 12%, transparent);
    padding: 1px 6px;
    border-radius: 6px;
  }
  .item-rate.gain {
    color: var(--moss);
    background: color-mix(in srgb, var(--moss) 14%, transparent);
  }
  .item-amt {
    margin-left: auto;
    flex: none;
  }
  .item-amt.neg {
    color: var(--flame);
  }
  .sheet-actions {
    display: flex;
    gap: var(--sp-md);
  }
  .sheet-actions .fg-btn {
    flex: 1 1 0;
    min-width: 0;
  }
  .ghostbtn {
    background: transparent;
    border: 1px solid var(--hairline);
    color: var(--ink-muted);
  }
  .ghostbtn.danger {
    color: var(--flame);
    border-color: color-mix(in srgb, var(--flame) 40%, transparent);
  }

  /* ── 说明 ── */
  .explain {
    background: var(--sky-faint);
    border-radius: var(--radius-card);
    padding: var(--sp-lg) var(--sp-xl);
  }
  .explain-head {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--ink-faint);
  }
  .explain-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--ink);
  }
  .explain-body {
    font-size: 13px;
    line-height: 1.65;
    color: var(--ink-muted);
    margin: var(--sp-sm) 0 0;
  }

  /* ── 窄屏塌成单列 ── */
  @media (max-width: 720px) {
    .upper {
      grid-template-columns: 1fr;
    }
    .nw-number {
      font-size: 48px;
    }
  }
  @media (max-width: 340px) {
    .buckets {
      grid-template-columns: 1fr;
    }
  }
</style>
