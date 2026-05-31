<script lang="ts">
  // Assets 屏 —— 1:1 移植 iOS AssetsView,reflow 桌面。
  // 数据全走真引擎(deriveDashboard),数字只渲染不重算。
  // 数据源 = 中央响应式 store;所有派生量 $derived,store 变更后屏即时刷新。
  // 交互:调拨写库、导出 CSV/JSON、从 JSON 导入、清空 —— 均落真实 store 操作。
  import { deriveDashboard } from "./derive";
  import Sheet from "./components/Sheet.svelte";
  import {
    store,
    transfer,
    updateBucket,
    addPassiveSource,
    deletePassiveSource,
    importBackup,
    clearAll,
    exportJSONString,
  } from "./store.svelte";

  const vm = $derived(deriveDashboard(store));

  const yuan = (n: number) => "¥" + Math.round(n).toLocaleString("en-US");

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

  // ── 调拨(本地态,确认按钮按金额非空亮起)──
  let transferDir = $state<"cashToAssets" | "assetsToCash">("cashToAssets");
  let transferAmount = $state("");
  const transferValid = $derived.by(() => {
    const v = Number(transferAmount);
    return Number.isFinite(v) && v > 0;
  });

  function doTransfer() {
    if (!transferValid) return;
    transfer(Number(transferAmount), transferDir === "cashToAssets");
    transferAmount = "";
  }

  // ── 编辑资产 / 现金桶(prefill 在 open 时取最新值,避免捕获旧值)──
  let showEditLocked = $state(false);
  let editLockedAmount = $state("");
  const editLockedValid = $derived.by(() => {
    if (editLockedAmount.trim() === "") return false;
    const v = Number(editLockedAmount);
    return Number.isFinite(v) && v >= 0; // 桶是绝对值,0 合法
  });
  function openEditLocked() {
    editLockedAmount = String(Math.round(store.assets.lockedAssets));
    showEditLocked = true;
  }
  function saveEditLocked() {
    if (!editLockedValid) return;
    updateBucket("locked", Number(editLockedAmount));
    showEditLocked = false;
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

  // ── 数据管理:导出 / 导入 / 清空 ──
  function download(text: string, filename: string, mime: string) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportJSON() {
    download(exportJSONString(), "freegrid-backup.json", "application/json");
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const csvCell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  function exportCSV() {
    const rows = [["类型", "日期", "类别/来源", "金额", "备注"]];
    for (const e of store.expenses) rows.push(["支出", ymd(e.date), e.category, String(e.amount), e.note ?? ""]);
    for (const i of store.incomes) rows.push(["收入", ymd(i.date), i.source, String(i.amount), i.note ?? ""]);
    const body = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
    download("\uFEFF" + body, "freegrid.csv", "text/csv;charset=utf-8");
  }

  let fileInput = $state<HTMLInputElement | null>(null);
  function triggerImport() {
    fileInput?.click();
  }
  async function onFilePicked(ev: Event) {
    const input = ev.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      try {
        importBackup(JSON.parse(await file.text()));
      } catch {
        /* 解析失败忽略,不崩 */
      }
    }
    input.value = ""; // 复位,允许重选同一文件
  }

  function purgeAll() {
    if (window.confirm("确定清空所有数据?此操作不可撤销")) clearAll();
  }
</script>

<div class="assets">
  <header class="page-head">
    <p class="kicker">ASSETS</p>
    <h1>Assets</h1>
  </header>

  <!-- 上半区:左 净值 + 双桶,右 被动 + 调拨 -->
  <div class="upper">
    <div class="col">
      <!-- ───── 净值 ───── -->
      <section class="vault-card hi networth">
        <span class="kicker">NET WORTH · 净值</span>
        <div class="nw-number num">{yuan(vm.netWorth)}</div>
        <p class="nw-caption">上次更新 · {updatedAgo}</p>
      </section>

      <!-- ───── 双桶:资产(金/锁) + 现金(蓝/钞) ───── -->
      <div class="buckets">
        <section class="vault-card bucket">
          <div class="bucket-head">
            <span class="glyph gold">
              <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                <path fill="currentColor" d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5Zm3 8H9V6a3 3 0 0 1 6 0v3Z"/>
              </svg>
            </span>
            <span class="kicker">资产</span>
            <button class="pencil" aria-label="编辑资产" onclick={openEditLocked}>
              <svg viewBox="0 0 24 24" width="13" height="13">
                <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/>
              </svg>
            </button>
          </div>
          <div class="bucket-amount num">{yuan(vm.lockedAssets)}</div>
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
          <div class="bucket-amount num">{yuan(vm.cash)}</div>
        </section>
      </div>
    </div>

    <div class="col">
      <!-- ───── 被动收入 ───── -->
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

      <!-- ───── 调拨 ───── -->
      <section class="vault-card transfer">
        <span class="kicker">调拨</span>

        <div class="seg" role="group" aria-label="调拨方向">
          <button
            class="seg-opt"
            class:on={transferDir === "cashToAssets"}
            onclick={() => (transferDir = "cashToAssets")}
          >现金 → 资产</button>
          <button
            class="seg-opt"
            class:on={transferDir === "assetsToCash"}
            onclick={() => (transferDir = "assetsToCash")}
          >资产 → 现金</button>
        </div>

        <div class="amount-row">
          <span class="amount-yuan">¥</span>
          <input
            class="amount-input num"
            type="text"
            inputmode="decimal"
            placeholder="0"
            bind:value={transferAmount}
          />
        </div>

        <button class="vbtn confirm" class:dim={!transferValid} onclick={doTransfer}>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path fill="currentColor" d="M7 7h11l-3-3 1.4-1.4L21.8 8l-5.4 5.4L15 12l3-3H7V7Zm10 10H6l3 3-1.4 1.4L2.2 16l5.4-5.4L9 12l-3 3h11v2Z"/>
          </svg>
          确认调拨
        </button>
      </section>
    </div>
  </div>

  <!-- ───── 说明 ───── -->
  <section class="explain">
    <div class="explain-head">
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z"/>
      </svg>
      <span class="explain-title">净值 · 资产 · 现金</span>
    </div>
    <p class="explain-body">
      净值 = 资产 + 现金, 是自动相加的结果, 不能直接修改。资产 (金色) 是锁定的钱, 比如定期/股票/基金; 现金 (蓝色) 是可花的钱。收入默认进现金, 支出从现金扣。资产和现金之间用「调拨」移动。
    </p>
  </section>

  <!-- ───── 数据管理 ───── -->
  <section class="vault-card data">
    <div class="data-head">
      <span class="kicker">DATA</span>
      <svg class="drive" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path fill="currentColor" d="M4 5h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm0 12h16a1 1 0 0 1 1 1v0a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1a1 1 0 0 1 1-1Zm2-8h2v2H6V9Z"/>
      </svg>
    </div>

    <div class="data-btns">
      <button class="vbtn data-out" onclick={exportCSV}>
        <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
          <path fill="currentColor" d="M4 4h16v16H4V4Zm2 4v3h5V8H6Zm7 0v3h5V8h-5Zm-7 5v3h5v-3H6Zm7 0v3h5v-3h-5Z"/>
        </svg>
        导出 CSV
      </button>
      <button class="vbtn data-out" onclick={exportJSON}>
        <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
          <path fill="currentColor" d="M8.5 7.5 5 12l3.5 4.5L7 17.7 2.3 12 7 6.3 8.5 7.5Zm7 0L19 12l-3.5 4.5 1.5 1.2L21.7 12 17 6.3 15.5 7.5Z"/>
        </svg>
        导出 JSON
      </button>
    </div>

    <button class="vbtn data-out data-import" onclick={triggerImport}>
      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
        <path fill="currentColor" d="M12 3v10.6l3.3-3.3 1.4 1.4L12 17.4l-4.7-4.7 1.4-1.4 3.3 3.3V3h2ZM5 19h14v2H5v-2Z"/>
      </svg>
      从 JSON 导入
    </button>
    <input
      bind:this={fileInput}
      type="file"
      accept=".json,application/json"
      onchange={onFilePicked}
      hidden
    />
    <p class="data-note">CSV 用 Excel / Numbers 打开,JSON 可回导备份</p>

    <hr class="hairline soft" />
    <button class="purge" onclick={purgeAll}>
      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
        <path fill="currentColor" d="M6 7h12l-1 14H7L6 7Zm3-3h6l1 2H8l1-2ZM4 6h16v1H4V6Z"/>
      </svg>
      清空所有数据
    </button>
  </section>

  <!-- ───── 编辑资产 ───── -->
  <Sheet open={showEditLocked} title="编辑资产" onClose={() => (showEditLocked = false)}>
    <div class="fg-field">
      <label class="fg-label" for="edit-locked-input">新金额(元)</label>
      <input
        id="edit-locked-input"
        class="fg-input fg-amount num"
        type="text"
        inputmode="decimal"
        placeholder="0"
        bind:value={editLockedAmount}
      />
      <p class="sheet-hint">锁定的钱 — 定期 / 股票 / 基金 / 不动产等</p>
    </div>
    <button class="fg-btn" disabled={!editLockedValid} onclick={saveEditLocked}>确认</button>
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

<style>
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

  /* ── 上半区双列 ── */
  .upper {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-lg);
    align-items: start;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: var(--sp-lg);
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
  }
  .nw-caption {
    font-size: 12px;
    color: var(--ink-faint);
    margin: var(--sp-md) 0 0;
  }

  /* ── 双桶 ── */
  .buckets {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-lg);
  }
  .bucket {
    padding: var(--sp-lg) var(--sp-xl);
  }
  .bucket-head {
    display: flex;
    align-items: center;
    gap: 5px;
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

  /* ── 调拨 ── */
  .transfer {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
  }
  .seg {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3px;
    padding: 3px;
    background: var(--mist2);
    border-radius: 10px;
    border: 1px solid var(--hairline-soft);
  }
  .seg-opt {
    font-family: var(--font-rounded);
    font-size: 13px;
    padding: 8px 6px;
    border-radius: 7px;
    border: 0;
    background: transparent;
    color: var(--ink-muted);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .seg-opt.on {
    background: var(--surface-hi);
    color: var(--ink);
    box-shadow: 0 1px 0 var(--hairline-soft);
  }
  .amount-row {
    display: flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--hairline);
    border-radius: 10px;
    padding: 8px 12px;
  }
  .amount-yuan {
    font-size: 19px;
    color: var(--ink-faint);
  }
  .amount-input {
    flex: 1;
    border: 0;
    background: transparent;
    color: var(--ink);
    font-family: var(--font-rounded);
    font-size: 19px;
    outline: none;
    min-width: 0;
  }
  .amount-input::placeholder {
    color: var(--ink-ghost);
  }

  /* ── 共用按钮 ── */
  .vbtn {
    font-family: var(--font-rounded);
    font-size: 15px;
    padding: 12px 18px;
    border-radius: 999px;
    background: transparent;
    border: 1px solid var(--hairline);
    color: var(--ink);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
  }
  .vbtn:hover {
    background: var(--mist2);
  }
  .confirm {
    border-color: color-mix(in srgb, var(--sky-deep) 45%, var(--hairline));
    color: var(--sky-deep);
  }
  .confirm.dim {
    opacity: 0.4;
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

  /* ── 数据 ── */
  .data {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
  }
  .data-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--ink-faint);
  }
  .data-btns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-sm);
  }
  .data-out {
    color: var(--ink);
    border-color: color-mix(in srgb, var(--ink) 38%, var(--hairline));
    font-size: 14px;
    padding: 11px 14px;
  }
  .data-import {
    width: 100%;
  }
  .data-note {
    font-size: 12px;
    color: var(--ink-faint);
    margin: 0;
  }
  .data .hairline {
    margin: var(--sp-xs) 0;
  }
  .purge {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: 0;
    padding: 4px 0;
    font-family: var(--font-rounded);
    font-size: 14px;
    color: var(--flame);
    cursor: pointer;
  }
  .purge:hover {
    opacity: 0.8;
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
  @media (max-width: 420px) {
    .buckets {
      grid-template-columns: 1fr;
    }
  }
</style>
