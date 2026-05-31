<script lang="ts">
  // Assets 屏 —— 1:1 移植 iOS AssetsView,reflow 桌面。
  // 数据全走真引擎(deriveDashboard),数字只渲染不重算。
  // 交互控件(调拨方向 / 金额输入)给本地 $state 让它看着是活的;
  // 真实写库 / 编辑 sheet / 导出 / 清空 在本草稿期不实现(无 store/modal),只做样式态。
  import { makeDemoData } from "./demo";
  import { deriveDashboard } from "./derive";

  const now = new Date();
  const data = makeDemoData(now);
  const vm = deriveDashboard(data, now);

  const yuan = (n: number) => "¥" + Math.round(n).toLocaleString("en-US");

  // updatedAt = now − 3h(demo 种子保证),用英文相对时间还原 "3 hours ago"
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const updatedAgo = (() => {
    const diffMs = data.assets.updatedAt.getTime() - now.getTime();
    const hours = Math.round(diffMs / 3_600_000);
    return rtf.format(hours, "hour");
  })();

  // 被动覆盖率(0% 时数字 ink、% inkMuted、caption "覆盖日常消费")
  const passivePct = Math.round(vm.passiveRatio * 100);
  const passiveCovered = vm.passiveRatio >= 1;
  const passiveSources = data.passiveSources; // demo 为空 → 渲染空态提示

  // ── 调拨(presentational:本地态,确认按钮按金额非空亮起)──
  let transferDir = $state<"cashToAssets" | "assetsToCash">("cashToAssets");
  let transferAmount = $state("");
  const transferValid = $derived.by(() => {
    const v = Number(transferAmount);
    return Number.isFinite(v) && v > 0;
  });
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
            <span class="pencil" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="13" height="13">
                <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/>
              </svg>
            </span>
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
            <span class="pencil" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="13" height="13">
                <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/>
              </svg>
            </span>
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
          <button class="add-btn" aria-label="添加被动收入源">
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

        <button class="vbtn confirm" class:dim={!transferValid}>
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
      <button class="vbtn data-out">
        <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
          <path fill="currentColor" d="M4 4h16v16H4V4Zm2 4v3h5V8H6Zm7 0v3h5V8h-5Zm-7 5v3h5v-3H6Zm7 0v3h5v-3h-5Z"/>
        </svg>
        导出 CSV
      </button>
      <button class="vbtn data-out">
        <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
          <path fill="currentColor" d="M8.5 7.5 5 12l3.5 4.5L7 17.7 2.3 12 7 6.3 8.5 7.5Zm7 0L19 12l-3.5 4.5 1.5 1.2L21.7 12 17 6.3 15.5 7.5Z"/>
        </svg>
        导出 JSON
      </button>
    </div>

    <button class="vbtn data-out data-import">
      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
        <path fill="currentColor" d="M12 3v10.6l3.3-3.3 1.4 1.4L12 17.4l-4.7-4.7 1.4-1.4 3.3 3.3V3h2ZM5 19h14v2H5v-2Z"/>
      </svg>
      从 JSON 导入
    </button>
    <p class="data-note">CSV 用 Excel / Numbers 打开,JSON 可回导备份</p>

    <hr class="hairline soft" />
    <button class="purge">
      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
        <path fill="currentColor" d="M6 7h12l-1 14H7L6 7Zm3-3h6l1 2H8l1-2ZM4 6h16v1H4V6Z"/>
      </svg>
      清空所有数据
    </button>
  </section>
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
    color: var(--ink-faint);
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
