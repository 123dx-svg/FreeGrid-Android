<script lang="ts">
  // AI 助手设置(实验)—— BYOK、多服务商、严格 opt-in。挂在「设置」抽屉里。
  import Sheet from "./Sheet.svelte";
  import { PROVIDERS } from "../ai/providers";
  import { aiConfig, activeProvider } from "../ai/config.svelte";
  import { testConnection, fetchBalance } from "../ai/llm";

  let { open = false, onClose }: { open?: boolean; onClose?: () => void } = $props();

  const prov = $derived(activeProvider());

  let showKey = $state(false);
  let testing = $state(false);
  let testMsg = $state("");
  let testOk = $state(false);
  let ddOpen = $state(false); // 服务商下拉

  function selectProvider(id: (typeof PROVIDERS)[number]["id"]) {
    aiConfig.activeProvider = id;
    testMsg = "";
    ddOpen = false;
  }

  async function doTest() {
    testMsg = "";
    const key = (aiConfig.keys[aiConfig.activeProvider] ?? "").trim();
    const model = (aiConfig.models[aiConfig.activeProvider] || prov.defaultModel).trim();
    if (!key) {
      testOk = false;
      testMsg = "请先填写 API 密钥";
      return;
    }
    testing = true;
    const r = await testConnection(prov, key, model);
    testOk = r.ok;
    testMsg = r.ok ? "连接成功 ✓ 可以用了" : `连接失败:${r.error}`;
    testing = false;
  }

  function openKeyUrl() {
    try {
      window.open(prov.keyUrl, "_system");
    } catch {
      try {
        window.open(prov.keyUrl, "_blank");
      } catch {
        /* 忽略 */
      }
    }
  }

  function clearKey() {
    aiConfig.keys[aiConfig.activeProvider] = "";
    testMsg = "";
  }

  // ── Key 余额(手动刷新;仅部分服务商支持,如 DeepSeek)──
  let balanceLoading = $state(false);
  let balanceText = $state("");
  let balanceErr = $state("");
  let balanceAt = $state("");
  async function refreshBalance() {
    if (balanceLoading) return;
    const key = (aiConfig.keys[aiConfig.activeProvider] ?? "").trim();
    if (!key) {
      balanceErr = "请先填写 API 密钥";
      balanceText = "";
      return;
    }
    balanceLoading = true;
    balanceErr = "";
    const r = await fetchBalance(prov, key);
    balanceLoading = false;
    if (r.ok) {
      balanceText = r.text ?? "";
      balanceErr = "";
      const d = new Date();
      balanceAt = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} 刷新`;
    } else {
      balanceText = "";
      balanceErr = r.error ?? "查询失败";
    }
  }
  // 切换服务商时清空上次余额显示(避免张冠李戴)
  $effect(() => {
    aiConfig.activeProvider;
    balanceText = "";
    balanceErr = "";
    balanceAt = "";
  });

  const capUsedLabel = $derived(aiConfig.monthlyCap ? `本月已用 ${aiConfig.usage.calls} / ${aiConfig.monthlyCap} 次` : `本月已调用 ${aiConfig.usage.calls} 次`);
</script>

<Sheet {open} title="AI 助手 · 实验" wide {onClose}>
  <div class="ai">
    <!-- 总开关 -->
    <div class="ai-master">
      <div class="ai-master-txt">
        <span class="ai-master-title">启用 AI 助手</span>
        <span class="ai-master-sub">默认关闭 · 开启后部分功能可用 AI 增强</span>
      </div>
      <button class="tgl" class:on={aiConfig.enabled} role="switch" aria-checked={aiConfig.enabled} onclick={() => (aiConfig.enabled = !aiConfig.enabled)}>
        <span class="tgl-dot"></span>
      </button>
    </div>

    <!-- 隐私告知 -->
    <div class="ai-disclose">
      <p>· 本应用仍无服务器、不收集你的数据。开启 AI 后,应用会用<strong>你自己的密钥直连服务商</strong>(BYOK)。</p>
      <p>· 仅在你主动点击「用 AI 生成」时才联网;每次只发送该功能所需的最小信息(见下方各功能说明)。</p>
      <p>· 密钥只存在你手机本地,不会随备份导出。费用由你的服务商账户按用量结算(通常极低)。</p>
    </div>

    {#if aiConfig.enabled}
      <!-- 服务商 -->
      <div class="ai-row">
        <span class="ai-label">服务商</span>
        <div class="ai-dd">
          <button class="ai-dd-btn" onclick={() => (ddOpen = !ddOpen)} aria-haspopup="listbox" aria-expanded={ddOpen}>
            <span class="ai-dd-cur">{prov.name}{prov.status === "reserved" ? " · 预留" : ""}</span>
            <span class="ai-dd-caret" class:open={ddOpen}>▾</span>
          </button>
          {#if ddOpen}
            <button class="ai-dd-backdrop" aria-label="关闭" onclick={() => (ddOpen = false)}></button>
            <div class="ai-dd-menu" role="listbox">
              {#each PROVIDERS as p (p.id)}
                <button
                  class="ai-dd-item"
                  class:on={aiConfig.activeProvider === p.id}
                  role="option"
                  aria-selected={aiConfig.activeProvider === p.id}
                  onclick={() => selectProvider(p.id)}
                >
                  <span>{p.name}{p.status === "reserved" ? " · 预留" : ""}</span>
                  {#if aiConfig.activeProvider === p.id}<span class="ai-dd-check">✓</span>{/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
      {#if prov.status === "reserved"}
        <p class="ai-note">该服务商为预留接入(OpenAI 兼容,未逐一实测);当前已验证的是 DeepSeek。</p>
      {/if}

      <!-- 密钥 -->
      <div class="ai-block">
        <span class="ai-label">{prov.name} API 密钥</span>
        <div class="ai-keywrap">
          <input
            class="ai-input"
            type={showKey ? "text" : "password"}
            placeholder="粘贴你的 API Key"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            bind:value={aiConfig.keys[aiConfig.activeProvider]}
          />
          <button class="ai-eye" onclick={() => (showKey = !showKey)} aria-label="显示/隐藏">{showKey ? "隐藏" : "显示"}</button>
        </div>
        <p class="ai-note">{prov.keyHint}</p>
        <div class="ai-keyrow">
          <button class="ai-linkbtn" onclick={openKeyUrl}>获取密钥 ↗</button>
          {#if (aiConfig.keys[aiConfig.activeProvider] ?? "").trim()}
            <button class="ai-linkbtn danger" onclick={clearKey}>清除密钥</button>
          {/if}
        </div>
      </div>

      <!-- 模型 -->
      <div class="ai-block">
        <span class="ai-label">模型</span>
        <input class="ai-input" type="text" placeholder={prov.defaultModel} autocapitalize="off" spellcheck="false" bind:value={aiConfig.models[aiConfig.activeProvider]} />
        <p class="ai-note">可用:{prov.models.join(" / ")}{prov.id === "doubao" ? "(也可填 ep- 开头的接入点 ID)" : ""}</p>
      </div>

      <!-- 测试连接 -->
      <div class="ai-block">
        <button class="ai-test" disabled={testing} onclick={doTest}>{testing ? "测试中…" : "测试连接"}</button>
        {#if testMsg}<span class="ai-testmsg" class:ok={testOk} class:err={!testOk}>{testMsg}</span>{/if}
      </div>

      <!-- Key 余额(手动刷新)-->
      <div class="ai-block bal-block">
        <div class="bal-row">
          <span class="ai-label bal-label">Key 余额</span>
          <span class="bal-val">
            {#if balanceLoading}<span class="bal-loading">查询中…</span>
            {:else if balanceText}<b class="num">{balanceText}</b>{#if balanceAt}<span class="bal-at">· {balanceAt}</span>{/if}
            {:else if balanceErr}<span class="bal-err">{balanceErr}</span>
            {:else}<span class="bal-none">{prov.balanceUrl ? "未查询" : "该服务商暂不支持"}</span>{/if}
          </span>
          <button class="bal-refresh" disabled={balanceLoading || !prov.balanceUrl} onclick={refreshBalance}>刷新</button>
        </div>
        <span class="ai-note">手动查询,点「刷新」才联网(仅这一次、只发你的密钥)。</span>
      </div>

      <!-- 功能开关 -->
      <div class="ai-block">
        <span class="ai-label">用 AI 增强这些功能</span>
        <div class="ai-feat">
          <div class="ai-featrow">
            <div class="ai-feattxt"><b>财商结果 · 个性化解读</b><span>发送:人格代号 + 四维倾向{aiConfig.sendRealMetrics ? " + 记账聚合" : ""}(无逐笔明细)</span></div>
            <button class="tgl sm" class:on={aiConfig.features.fq} role="switch" aria-checked={aiConfig.features.fq} onclick={() => (aiConfig.features.fq = !aiConfig.features.fq)}><span class="tgl-dot"></span></button>
          </div>
          <div class="ai-featrow sub">
            <div class="ai-feattxt"><span>解读时附带真实记账聚合(储蓄率/被动覆盖)</span></div>
            <button class="tgl sm" class:on={aiConfig.sendRealMetrics} role="switch" aria-checked={aiConfig.sendRealMetrics} onclick={() => (aiConfig.sendRealMetrics = !aiConfig.sendRealMetrics)}><span class="tgl-dot"></span></button>
          </div>
          <div class="ai-featrow">
            <div class="ai-feattxt"><b>年报 · 致股东的一封信</b><span>发送:该年聚合数字(收支/储蓄率/健康分等,无逐笔){aiConfig.sendProfile ? " + 个人档案" : ""}</span></div>
            <button class="tgl sm" class:on={aiConfig.features.annual} role="switch" aria-checked={aiConfig.features.annual} onclick={() => (aiConfig.features.annual = !aiConfig.features.annual)}><span class="tgl-dot"></span></button>
          </div>
          <div class="ai-featrow sub">
            <div class="ai-feattxt"><span>结合个人档案个性化(城市/家庭/赡养抚养等,更贴国情)</span></div>
            <button class="tgl sm" class:on={aiConfig.sendProfile} role="switch" aria-checked={aiConfig.sendProfile} onclick={() => (aiConfig.sendProfile = !aiConfig.sendProfile)}><span class="tgl-dot"></span></button>
          </div>
          <div class="ai-featrow">
            <div class="ai-feattxt"><b>智能账单导入</b><span>发送:你粘贴的账单原文(较敏感,导入时会再次确认)</span></div>
            <button class="tgl sm" class:on={aiConfig.features.import} role="switch" aria-checked={aiConfig.features.import} onclick={() => (aiConfig.features.import = !aiConfig.features.import)}><span class="tgl-dot"></span></button>
          </div>
        </div>
      </div>

      <!-- 用量与限额 -->
      <div class="ai-block">
        <span class="ai-label">每月调用上限</span>
        <div class="ai-caprow">
          <div class="set-inputwrap">
            <input class="ai-input num capnum" type="number" inputmode="numeric" min="0" placeholder="0" bind:value={aiConfig.monthlyCap} />
            <span class="ai-capunit">次 / 月</span>
          </div>
          <span class="ai-note">{aiConfig.monthlyCap ? "" : "0 = 不限"} · {capUsedLabel}</span>
        </div>
      </div>
    {/if}

    <p class="ai-foot">AI 内容由第三方大模型生成,仅供参考,不构成投资建议。本地功能不依赖 AI,关闭后一切照常。</p>
  </div>
</Sheet>

<style>
  .ai {
    display: flex;
    flex-direction: column;
    gap: var(--sp-lg);
  }
  .ai-master {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-md);
  }
  .ai-master-txt {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .ai-master-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--ink);
  }
  .ai-master-sub {
    font-size: 12px;
    color: var(--ink-faint);
  }
  .ai-disclose {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: var(--sp-md);
    border-radius: 12px;
    background: color-mix(in srgb, var(--sky) 7%, var(--mist2));
    border: 1px solid var(--hairline-soft);
  }
  .ai-disclose p {
    margin: 0;
    font-size: 12px;
    line-height: 1.55;
    color: var(--ink-muted);
  }
  .ai-disclose strong {
    color: var(--ink);
  }
  .ai-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ai-label {
    font-size: 14px;
    color: var(--ink);
    font-weight: 500;
  }
  .ai-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-md);
  }
  /* 自定义主题下拉(替代原生 select,避免白底弹窗与深色主题冲突) */
  .ai-dd {
    position: relative;
    flex: 0 0 auto;
  }
  .ai-dd-btn {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-width: 160px;
    border: 1px solid var(--hairline);
    border-radius: 10px;
    background: var(--mist2);
    color: var(--ink);
    font-family: var(--font-rounded);
    font-size: 14px;
    padding: 9px 12px;
    cursor: pointer;
  }
  .ai-dd-caret {
    color: var(--ink-faint);
    font-size: 11px;
    transition: transform 0.16s ease;
  }
  .ai-dd-caret.open {
    transform: rotate(180deg);
  }
  .ai-dd-backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    border: 0;
    background: transparent;
    cursor: default;
  }
  .ai-dd-menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 61;
    min-width: 180px;
    display: flex;
    flex-direction: column;
    padding: 6px;
    border-radius: 12px;
    border: 1px solid var(--hairline);
    background: var(--paper);
    box-shadow: 0 14px 34px -12px color-mix(in srgb, #05070a 70%, transparent);
    animation: ai-dd-in 0.14s ease;
  }
  @keyframes ai-dd-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .ai-dd-menu { animation: none; }
    .ai-dd-caret { transition: none; }
  }
  .ai-dd-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    text-align: left;
    border: 0;
    background: transparent;
    color: var(--ink-muted);
    font-family: var(--font-rounded);
    font-size: 14px;
    padding: 9px 10px;
    border-radius: 8px;
    cursor: pointer;
    white-space: nowrap;
  }
  .ai-dd-item:hover {
    background: var(--mist2);
    color: var(--ink);
  }
  .ai-dd-item.on {
    color: var(--sky-deep);
    font-weight: 600;
  }
  .ai-dd-check {
    color: var(--sky-deep);
  }
  .ai-keywrap {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .ai-input {
    flex: 1;
    width: 100%;
    border: 1px solid var(--hairline);
    border-radius: 10px;
    background: var(--mist2);
    color: var(--ink);
    font-size: 14px;
    padding: 10px 12px;
    outline: none;
    font-family: var(--font-mono);
  }
  .ai-input:focus {
    border-color: var(--sky);
  }
  .ai-eye {
    flex: 0 0 auto;
    border: 1px solid var(--hairline);
    border-radius: 10px;
    background: var(--mist2);
    color: var(--ink-muted);
    font-size: 13px;
    padding: 10px 12px;
    cursor: pointer;
  }
  .ai-keyrow {
    display: flex;
    gap: var(--sp-md);
  }
  .ai-linkbtn {
    border: 0;
    background: transparent;
    color: var(--sky-deep);
    font-size: 13px;
    cursor: pointer;
    padding: 2px 0;
  }
  .ai-linkbtn.danger {
    color: var(--flame);
  }
  .ai-note {
    font-size: 12px;
    line-height: 1.5;
    color: var(--ink-faint);
    margin: 0;
  }
  .ai-test {
    align-self: flex-start;
    border: 1px solid var(--sky-deep);
    border-radius: 999px;
    background: color-mix(in srgb, var(--sky) 14%, transparent);
    color: var(--sky-deep);
    font-family: var(--font-rounded);
    font-size: 14px;
    padding: 9px 20px;
    cursor: pointer;
  }
  .ai-test:disabled {
    opacity: 0.55;
  }
  .ai-testmsg {
    font-size: 13px;
    margin-top: 2px;
  }
  .ai-testmsg.ok {
    color: var(--moss);
  }
  .ai-testmsg.err {
    color: var(--flame);
  }
  .bal-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .bal-label {
    margin: 0;
  }
  .bal-val {
    flex: 1;
    min-width: 0;
    font-size: 14px;
    color: var(--ink);
  }
  .bal-val .num {
    color: var(--income-gold);
  }
  .bal-at {
    font-size: 11px;
    color: var(--ink-faint);
    margin-left: 6px;
  }
  .bal-none {
    font-size: 13px;
    color: var(--ink-faint);
  }
  .bal-loading {
    font-size: 13px;
    color: var(--ink-muted);
  }
  .bal-err {
    font-size: 13px;
    color: var(--flame);
  }
  .bal-refresh {
    border: 1px solid var(--hairline);
    border-radius: 999px;
    background: var(--mist2);
    color: var(--ink-muted);
    font-family: var(--font-rounded);
    font-size: 13px;
    padding: 6px 14px;
    cursor: pointer;
  }
  .bal-refresh:disabled {
    opacity: 0.5;
  }
  .ai-feat {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--hairline-soft);
    border-radius: 12px;
    overflow: hidden;
  }
  .ai-featrow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-md);
    padding: 12px var(--sp-md);
    border-bottom: 1px solid var(--hairline-soft);
  }
  .ai-featrow:last-child {
    border-bottom: 0;
  }
  .ai-featrow.sub {
    padding-left: var(--sp-lg);
    background: color-mix(in srgb, var(--ink) 3%, transparent);
  }
  .ai-feattxt {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .ai-feattxt b {
    font-size: 14px;
    color: var(--ink);
    font-weight: 600;
  }
  .ai-feattxt span {
    font-size: 11.5px;
    color: var(--ink-faint);
    line-height: 1.4;
  }
  .ai-caprow {
    display: flex;
    align-items: center;
    gap: var(--sp-md);
    flex-wrap: wrap;
  }
  .set-inputwrap {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--hairline);
    border-radius: 10px;
    background: var(--mist2);
    padding: 4px 12px;
  }
  .capnum {
    width: 70px;
    border: 0;
    background: transparent;
    text-align: right;
    padding: 6px 0;
    font-family: var(--font-mono);
  }
  .ai-capunit {
    font-size: 13px;
    color: var(--ink-faint);
  }
  .ai-foot {
    font-size: 11.5px;
    line-height: 1.5;
    color: var(--ink-ghost);
    margin: 0;
  }

  /* 开关 */
  .tgl {
    flex: 0 0 auto;
    width: 46px;
    height: 28px;
    border-radius: 999px;
    border: 0;
    background: var(--hairline);
    position: relative;
    cursor: pointer;
    transition: background 0.18s ease;
    padding: 0;
  }
  .tgl.sm {
    width: 40px;
    height: 24px;
  }
  .tgl.on {
    background: var(--sky-deep);
  }
  .tgl-dot {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 22px;
    height: 22px;
    border-radius: 999px;
    background: #fff;
    transition: transform 0.18s ease;
  }
  .tgl.sm .tgl-dot {
    width: 18px;
    height: 18px;
  }
  .tgl.on .tgl-dot {
    transform: translateX(18px);
  }
  .tgl.sm.on .tgl-dot {
    transform: translateX(16px);
  }
</style>
