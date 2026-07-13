<script lang="ts">
  // 数据 · 备份与导入 —— 从资产页迁来的全 app 级数据工具(导出/导入/AI提示词/清空)。
  // 独立组件,单一来源;供设置页挂载。
  import { store, exportJSONString, exportJSONStringForYear, importBackup, mergeBackup, clearAll } from "../store.svelte";
  import { EXPENSE_CATEGORIES, INCOME_SOURCES } from "../models";
  import { availableYears } from "../annual";
  import { restoreBadgeMeta, markBadgeEvent } from "../achievements.svelte";
  import { markBackupNow, daysSinceBackup, settings } from "../settings.svelte";
  import { loadFqResult, saveFqResult, type FqStored } from "../fq-test";
  import { parseImport, type ParsedImport } from "../import-adapters";
  import { aiReady } from "../ai/config.svelte";
  import { chat } from "../ai/llm";
  import { importMessages, stripFence } from "../ai/prompts";
  import { Capacitor } from "@capacitor/core";
  import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
  import { Share } from "@capacitor/share";
  import { tick } from "svelte";
  import Sheet from "./Sheet.svelte";
  import { buildFullBackup, parseFullBackup, restore as restoreKeys, type FullBackup } from "../backup-full";
  import { mirrorNow } from "../native-mirror";

  // ── 导出:原生写缓存+分享;web/桌面 blob 下载 ──
  let exporting = $state(false);
  async function download(text: string, filename: string, mime: string) {
    if (Capacitor.isNativePlatform()) {
      if (exporting) return;
      exporting = true;
      try {
        const res = await Filesystem.writeFile({ path: filename, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
        await Share.share({ title: filename, text: "自由日记 数据备份", url: res.uri, dialogTitle: "导出 / 分享备份" });
        markBadgeEvent("exported_backup"); // 隐藏成就:有备无患
        markBackupNow(); // 记下"上次备份"时间
      } catch {
        /* 用户取消/写盘失败:忽略不崩 */
      } finally {
        exporting = false;
      }
      return;
    }
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    markBadgeEvent("exported_backup"); // 隐藏成就:有备无患
    markBackupNow(); // 记下"上次备份"时间
  }

  function exportJSON() {
    if (exportYear === "all") {
      download(exportJSONString(), "freegrid-backup.json", "application/json");
    } else {
      download(exportJSONStringForYear(exportYear), `freegrid-backup-${exportYear}.json`, "application/json");
    }
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const csvCell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  function exportCSV() {
    const inScope = (d: Date) => exportYear === "all" || d.getFullYear() === exportYear;
    const rows = [["类型", "日期", "类别/来源", "金额", "备注"]];
    for (const e of store.expenses) if (inScope(e.date)) rows.push(["支出", ymd(e.date), e.category, String(e.amount), e.note ?? ""]);
    for (const i of store.incomes) if (inScope(i.date)) rows.push(["收入", ymd(i.date), i.source, String(i.amount), i.note ?? ""]);
    const body = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
    const fname = exportYear === "all" ? "freegrid.csv" : `freegrid-${exportYear}.csv`;
    download("\uFEFF" + body, fname, "text/csv;charset=utf-8");
  }

  // ── 导出范围:全部 / 指定自然年 ──
  const years = $derived(availableYears(store.expenses, store.incomes));
  let exportYear = $state<number | "all">("all");

  // ── 完整备份 · 换机迁移(全 app 数据,不含 AI 密钥;导入=整机覆盖)──
  let fullFileInput = $state<HTMLInputElement | null>(null);
  let pendingFull = $state<FullBackup | null>(null);
  let fullErr = $state("");
  function exportFull() {
    const d = new Date();
    const name = `freegrid-full-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
    download(JSON.stringify(buildFullBackup(), null, 2), name, "application/json");
  }
  function triggerFullImport() {
    if (busy) return;
    fullErr = "";
    fullFileInput?.click();
  }
  async function onFullFilePicked(ev: Event) {
    const input = ev.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    fullErr = "";
    let text = "";
    try {
      text = await file.text();
    } catch {
      fullErr = "读取文件失败";
      return;
    }
    const parsed = parseFullBackup(text);
    if (!parsed) {
      fullErr = "这不是「完整备份」文件(应为 freegrid-full-*.json)";
      return;
    }
    pendingFull = parsed;
  }
  async function confirmFullImport() {
    if (!pendingFull) return;
    restoreKeys(pendingFull.keys, { overwrite: true });
    await mirrorNow(); // 覆盖后刷新原生镜像,避免下次启动补回旧数据
    pendingFull = null;
    location.reload(); // 整机替换后重载,让所有模块从新 localStorage 重新水合
  }

  // ── 导入:解析 → 弹「合并/替换」──
  let fileInput = $state<HTMLInputElement | null>(null);
  function triggerImport() {
    if (busy) return;
    fileInput?.click();
  }
  let pendingImport = $state<ParsedImport | null>(null);
  let importMsg = $state("");
  let importErr = $state(false);
  // 耗时阶段:ai=AI 识别中 / importing=正在写入大量数据。busy 时按钮禁用 + 显示进度条。
  let phase = $state<"idle" | "ai" | "importing">("idle");
  const busy = $derived(phase !== "idle");
  let importCount = $state(0);
  // 本机识别失败但已开 AI:把待识别文本交给用户决定(联网+额度取舍由用户拍板)
  let pendingAiText = $state<string | null>(null);
  const aiImportOn = $derived(aiReady("import"));
  // 大文件分批送 AI(见 splitForAi):当前进度 done/total
  let aiProgress = $state<{ done: number; total: number } | null>(null);
  // 决策 Sheet 里预告将分几批(仅估算,给用户额度心理预期)
  const aiBatches = $derived(pendingAiText ? splitForAi(pendingAiText).length : 0);

  let msgTimer: ReturnType<typeof setTimeout> | undefined;
  function showMsg(msg: string, isErr = false, ms = 4000) {
    if (msgTimer) clearTimeout(msgTimer);
    importMsg = msg;
    importErr = isErr;
    msgTimer = setTimeout(() => {
      importMsg = "";
      importErr = false;
    }, ms);
  }

  async function onFilePicked(ev: Event) {
    const input = ev.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    importMsg = "";
    importErr = false;
    let text = "";
    try {
      text = await file.text();
    } catch {
      showMsg("读取文件失败", true);
      return;
    }
    const total = store.assets.lockedAssets + store.assets.cash;
    // ① 先尝试本机识别(app 备份 / 已是 transactions JSON)—— 直接导入,不联网
    const res = parseImport(text, total);
    if (res.ok) {
      pendingImport = res;
      return;
    }
    // ② 本机识别失败
    if (aiImportOn) {
      // 交给用户决定要不要用 AI(会联网上传 + 消耗额度)
      pendingAiText = text;
    } else {
      // ③ 普通导入格式不对 → 直接返回明确错误
      showMsg(`文件格式不支持:${res.error}。仅支持本机 JSON 备份;CSV / 其他账单需在「设置 · AI 助手」开启 AI 识别。`, true, 6500);
    }
  }

  // ── 通用分批(与任何外部格式无关:只按「逻辑行」等分)──────────────────────
  // AI 单次输出有 token 上限,几百行会被截断。故把原文按行切成多块、逐块识别再合并。
  // 完全不认识列/分隔符/平台:只做两件通用的事 ——
  //   ① 按行切分,但引号内的换行不算换行(RFC4180 通用文本规则,防止一行记录被切断);
  //   ② 若首行不含日期(像是列说明/表头),则把它带到每一块作上下文。
  const CHUNK_LINES = 80; // 每块数据行数(约 3000 tokens 输出,安全落在 4000 上限内)

  function splitLogicalLines(text: string): string[] {
    const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '"') { inQ = !inQ; cur += c; }
      else if (c === "\n" && !inQ) { lines.push(cur); cur = ""; }
      else cur += c;
    }
    if (cur.length) lines.push(cur);
    return lines;
  }

  function splitForAi(text: string): string[] {
    const lines = splitLogicalLines(text).filter((l) => l.trim() !== "");
    if (lines.length <= CHUNK_LINES) return [text]; // 小文件:原样一次,保留原始换行/引号
    const dateRe = /\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/;
    const header = lines[0] && !dateRe.test(lines[0]) ? lines[0] : null; // 首行无日期 → 视作表头
    const body = header ? lines.slice(1) : lines;
    const chunks: string[] = [];
    for (let i = 0; i < body.length; i += CHUNK_LINES) {
      const part = body.slice(i, i + CHUNK_LINES).join("\n");
      chunks.push(header ? header + "\n" + part : part);
    }
    return chunks;
  }

  async function runAiImport() {
    const text = pendingAiText;
    pendingAiText = null;
    if (!text) return;
    const total = store.assets.lockedAssets + store.assets.cash;
    const chunks = splitForAi(text);
    phase = "ai";
    importMsg = "";
    importErr = false;
    aiProgress = { done: 0, total: chunks.length };
    // 收入来源约束:app 预设 + 用户自定义(去重),让 AI 把同义来源归一,避免「工作收入/工资」拆开
    const incomeSources = [...new Set([...INCOME_SOURCES, ...settings.customIncomeSources])];

    const expenses: NonNullable<ParsedImport["backup"]>["expenses"] = [];
    const incomes: NonNullable<ParsedImport["backup"]>["incomes"] = [];
    let failed = 0;
    for (let i = 0; i < chunks.length; i++) {
      let ok = false;
      // 每块最多试 2 次(网络抖动/偶发格式异常容错)
      for (let attempt = 0; attempt < 2 && !ok; attempt++) {
        const r = await chat({ messages: importMessages(chunks[i], EXPENSE_CATEGORIES, incomeSources), json: true, maxTokens: 4000, temperature: 0.2 });
        if (r.ok && r.content) {
          const part = parseImport(stripFence(r.content), total);
          if (part.ok && part.backup) {
            expenses!.push(...(part.backup.expenses ?? []));
            incomes!.push(...(part.backup.incomes ?? []));
            ok = true;
          }
        }
      }
      if (!ok) failed++;
      aiProgress = { done: i + 1, total: chunks.length };
    }
    phase = "idle";
    aiProgress = null;

    if (!expenses!.length && !incomes!.length) {
      showMsg(`没能从这份文件里认出账目(${failed ? `${failed} 批识别失败` : "格式异常"}),可换个文件重试`, true);
      return;
    }
    if (failed) {
      showMsg(`注意:有 ${failed} 批未能识别,已导入其余部分`, true, 6000);
    }
    pendingImport = {
      ok: true,
      source: "ai",
      backup: { assets: { total, updated_at: new Date().toISOString() }, expenses, incomes, passive_sources: [], first_record_date: null },
      expCount: expenses!.length,
      incCount: incomes!.length,
    };
  }

  async function doImport(mode: "merge" | "replace") {
    const res = pendingImport;
    if (!res?.backup) return;
    pendingImport = null;
    // 大量数据写入 = 耗时,先显示进度条再落库
    const count = res.expCount + res.incCount;
    const large = count > 300;
    if (large) {
      importCount = count;
      phase = "importing";
      await tick();
      await new Promise((r) => setTimeout(r, 40)); // 让进度条渲染出来
    }
    let doneMsg: string;
    if (mode === "replace") {
      importBackup(res.backup);
      doneMsg = `已替换导入 · ${count} 笔`;
    } else {
      const r = mergeBackup(res.backup);
      doneMsg = `已合并 ${r.added} 笔${r.skipped ? ` · 跳过重复 ${r.skipped}` : ""}`;
    }
    // 恢复 app_meta:徽章按并集(取更早时间戳)、财商仅在本机无存档时补上(不覆盖)
    const meta = res.backup.app_meta;
    if (meta) {
      restoreBadgeMeta(meta.badges ?? null);
      const fq = meta.fq as FqStored | undefined;
      if (fq && typeof fq.code === "string" && Array.isArray(fq.leans) && !loadFqResult()) {
        saveFqResult(fq);
      }
    }
    phase = "idle";
    showMsg(doneMsg, false, 3500);
  }

  // ── 清空 ──
  let showPurge = $state(false);
  function confirmPurge() {
    clearAll();
    showPurge = false;
  }

  // ── 备份提醒:上次备份 & 久未备份 ──
  const hasData = $derived(store.expenses.length + store.incomes.length > 0);
  const sinceBackup = $derived(daysSinceBackup());
  const backupText = $derived(
    sinceBackup === null ? "从未备份" : sinceBackup === 0 ? "今天已备份" : `${sinceBackup} 天前`
  );
  // 有数据且(从未备份 或 超过 14 天)→ 提醒
  const needBackup = $derived(hasData && (sinceBackup === null || sinceBackup >= 14));</script>

<div class="dt">
  <div class="backup-status" class:warn={needBackup}>
    <svg viewBox="0 0 24 24" class="bk-ic" aria-hidden="true">
      {#if needBackup}
        <path d="M12 3l9 16H3L12 3Z" /><path d="M12 10v4" /><circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none" />
      {:else}
        <path d="M20 7L10 17l-5-5" />
      {/if}
    </svg>
    <span class="bk-text">
      上次备份:<b>{backupText}</b>
      {#if needBackup}<span class="bk-tip">— 数据只存本机,卸载/清缓存会丢,建议导出到设备外(文件 / 云盘 / 微信)。</span>{/if}
    </span>
  </div>
  {#if years.length}
    <div class="export-scope">
      <span class="scope-label">导出范围</span>
      <div class="scope-chips">
        <button class="scope-chip" class:on={exportYear === "all"} onclick={() => (exportYear = "all")}>全部</button>
        {#each years as y (y)}
          <button class="scope-chip num" class:on={exportYear === y} onclick={() => (exportYear = y)}>{y}</button>
        {/each}
      </div>
    </div>
    {#if exportYear !== "all"}
      <p class="scope-hint">仅导出 {exportYear} 年的流水(不含资产 / 被动收入);回导时建议用「合并」。</p>
    {/if}
  {/if}
  <div class="data-btns">
    <button class="vbtn data-out" onclick={exportCSV}>
      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M4 4h16v16H4V4Zm2 4v3h5V8H6Zm7 0v3h5V8h-5Zm-7 5v3h5v-3H6Zm7 0v3h5v-3h-5Z" /></svg>
      导出 CSV
    </button>
    <button class="vbtn data-out" onclick={exportJSON}>
      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M8.5 7.5 5 12l3.5 4.5L7 17.7 2.3 12 7 6.3 8.5 7.5Zm7 0L19 12l-3.5 4.5 1.5 1.2L21.7 12 17 6.3 15.5 7.5Z" /></svg>
      导出 JSON
    </button>
  </div>

  <button class="vbtn data-out data-import" class:aion={aiImportOn} onclick={triggerImport} disabled={busy}>
    {#if busy}
      <svg class="imp-spin" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" /></svg>
      {phase === "ai" ? "AI 识别中…" : "导入中…"}
    {:else if aiImportOn}
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6L12 2Zm6.2 12l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6Z" /></svg>
      导入数据<span class="ai-badge">AI</span>
    {:else}
      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M12 3v10.6l3.3-3.3 1.4 1.4L12 17.4l-4.7-4.7 1.4-1.4 3.3 3.3V3h2ZM5 19h14v2H5v-2Z" /></svg>
      导入数据
    {/if}
  </button>
  <input bind:this={fileInput} type="file" accept=".json,application/json,.csv,text/csv,text/plain" onchange={onFilePicked} hidden />

  {#if busy}
    <div class="imp-progress">
      <div class="imp-bar"><div class="imp-bar-fill"></div></div>
      <span class="imp-phase">{phase === "ai" ? (aiProgress && aiProgress.total > 1 ? `AI 正在识别账单…第 ${aiProgress.done}/${aiProgress.total} 批(联网中,勿关闭)` : "AI 正在识别账单…请稍候(联网中,勿关闭)") : `正在导入 ${importCount} 笔,请稍候…`}</span>
    </div>
  {/if}

  {#if importMsg}<p class="data-msg" class:err={importErr}>{importMsg}</p>{/if}
  <p class="data-note">
    本机 <b>JSON 备份</b>直接回导。CSV / 其他账单{#if aiImportOn}会先问你是否用 <b>AI</b> 识别成账目(联网 + 消耗额度){:else}需在「设置 · AI 助手」开启 AI 才能识别{/if}。
  </p>

  <hr class="hairline soft" />
  <div class="full-block">
    <div class="full-head">
      <b>完整备份 · 换机迁移</b>
      <span class="full-sub">一份文件打包资产 / 自检 / 设置 / 个人档案(不含 AI 密钥)</span>
    </div>
    <div class="data-btns">
      <button class="vbtn data-out" onclick={exportFull} disabled={busy || exporting}>
        <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M12 3v10.6l3.3-3.3 1.4 1.4L12 17.4l-4.7-4.7 1.4-1.4 3.3 3.3V3h2ZM5 19h14v2H5v-2Z" /></svg>
        导出全部数据
      </button>
      <button class="vbtn data-out" onclick={triggerFullImport} disabled={busy}>
        <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M12 21V10.4l-3.3 3.3-1.4-1.4L12 7.6l4.7 4.7-1.4 1.4L12 10.4V21h0ZM5 3h14v2H5V3Z" /></svg>
        一键导入全部
      </button>
    </div>
    <input bind:this={fullFileInput} type="file" accept=".json,application/json" onchange={onFullFilePicked} hidden />
    {#if fullErr}<p class="data-msg err">{fullErr}</p>{/if}
    <p class="data-note">换新手机:老机点「导出全部数据」→ 传到新机 → 这里「一键导入全部」,资产 / 徽章 / 财商 / 个人档案一并还原,无需重填。<b>导入会覆盖当前全部数据。</b></p>
  </div>

  <hr class="hairline soft" />
  <button class="purge" onclick={() => (showPurge = true)}>
    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M6 7h12l-1 14H7L6 7Zm3-3h6l1 2H8l1-2ZM4 6h16v1H4V6Z" /></svg>
    清空所有数据
  </button>
</div>

<!-- 用 AI 识别?(本机识别失败 + 已开 AI:联网/额度取舍交给用户) -->
<Sheet open={pendingAiText !== null} title="用 AI 识别这份文件?" onClose={() => (pendingAiText = null)}>
  <p class="imp-sum">这个文件不是本机备份格式。</p>
  <p class="imp-hint">
    要用 <b>AI</b> 把它识别成账目吗?会把这份账单文本<b>联网上传</b>给你配置的服务商、并消耗额度;<b>只发送这份文件内容</b>,不含其它数据。{#if aiBatches > 1}文件较大,会分 <b>{aiBatches}</b> 批发送(消耗约 {aiBatches} 次额度)。{/if}识别完还会让你确认「合并 / 替换」。
  </p>
  <div class="imp-actions">
    <button class="vbtn" onclick={() => (pendingAiText = null)}>取消</button>
    <button class="vbtn ai-go" onclick={runAiImport}>✨ 用 AI 识别</button>
  </div>
</Sheet>

<!-- 导入确认:合并 / 替换 -->
<Sheet open={pendingImport !== null} title="导入数据" onClose={() => (pendingImport = null)}>
  {#if pendingImport}
    <p class="imp-sum">
      识别到 <b class="num">{pendingImport.expCount}</b> 笔支出 · <b class="num">{pendingImport.incCount}</b> 笔收入
      {#if pendingImport.source === "app"}<span class="imp-tag">来自 app 备份</span>{:else}<span class="imp-tag">AI 转换</span>{/if}
    </p>
    <p class="imp-hint">
      <b>合并</b>:追加到现有账本(重复的自动跳过),资产净值不变。<br />
      <b>替换</b>:清空现有记录后整体导入{#if pendingImport.source === "app"}(含资产){/if}。
    </p>
    <div class="imp-actions">
      <button class="vbtn" onclick={() => doImport("merge")}>合并</button>
      <button class="vbtn danger" onclick={() => doImport("replace")}>替换</button>
    </div>
    <button class="imp-cancel" onclick={() => (pendingImport = null)}>取消</button>
  {/if}
</Sheet>

<!-- 清空二次确认 -->
<Sheet open={showPurge} title="清空所有数据" onClose={() => (showPurge = false)}>
  <p class="imp-sum">确定清空所有数据?</p>
  <p class="imp-hint">将删除全部收支流水、资产与被动收入,<b>此操作不可撤销</b>。建议先「导出 JSON」备份。</p>
  <div class="imp-actions">
    <button class="vbtn" onclick={() => (showPurge = false)}>取消</button>
    <button class="vbtn danger" onclick={confirmPurge}>确认清空</button>
  </div>
</Sheet>

<!-- 完整导入二次确认(整机覆盖) -->
<Sheet open={pendingFull !== null} title="导入全部数据" onClose={() => (pendingFull = null)}>
  {#if pendingFull}
    <p class="imp-sum">用这份备份<b>覆盖当前全部数据</b>?</p>
    <p class="imp-hint">
      将替换<b>资产、收支、成就、财商、设置与个人档案</b>(不含 AI 密钥)。此操作<b>不可撤销</b>,完成后应用会自动重启。<br />
      备份时间:{new Date(pendingFull.exportedAt).toLocaleString()}
    </p>
    <div class="imp-actions">
      <button class="vbtn" onclick={() => (pendingFull = null)}>取消</button>
      <button class="vbtn danger" onclick={confirmFullImport}>覆盖并导入</button>
    </div>
  {/if}
</Sheet>

<style>
  .dt {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
  }
  .full-block {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
  }
  .full-head {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .full-head b {
    font-size: 14px;
    color: var(--ink);
  }
  .full-sub {
    font-size: 12px;
    color: var(--ink-faint);
  }
  .backup-status {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
    color: var(--ink-muted);
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--mist2);
    border: 1px solid var(--hairline);
  }
  .backup-status.warn {
    color: var(--ink);
    background: color-mix(in srgb, var(--flame) 8%, transparent);
    border-color: color-mix(in srgb, var(--flame) 32%, var(--hairline));
  }
  .bk-ic {
    width: 16px;
    height: 16px;
    flex: 0 0 16px;
    margin-top: 1px;
    fill: none;
    stroke: var(--moss);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .backup-status.warn .bk-ic {
    stroke: var(--flame);
  }
  .bk-text b {
    font-weight: 600;
    color: var(--ink);
  }
  .bk-tip {
    color: var(--ink-muted);
  }
  .export-scope {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
    flex-wrap: wrap;
  }
  .scope-label {
    font-size: 12px;
    color: var(--ink-faint);
    flex: 0 0 auto;
  }
  .scope-chips {
    display: flex;
    gap: 6px;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .scope-chips::-webkit-scrollbar {
    display: none;
  }
  .scope-chip {
    flex: 0 0 auto;
    font-size: 13px;
    padding: 5px 12px;
    border-radius: 999px;
    border: 1px solid var(--hairline);
    background: var(--mist);
    color: var(--ink-muted);
    cursor: pointer;
    white-space: nowrap;
  }
  .scope-chip.on {
    background: color-mix(in srgb, var(--sky) 18%, transparent);
    border-color: var(--sky);
    color: var(--sky-deep);
    font-weight: 600;
  }
  .scope-hint {
    font-size: 12px;
    color: var(--ink-faint);
    margin: -2px 0 2px;
    line-height: 1.5;
  }
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
  .vbtn.danger {
    border-color: color-mix(in srgb, var(--flame) 50%, var(--hairline));
    color: var(--flame);
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
  .data-import.aion {
    color: var(--sky-deep);
    border-color: color-mix(in srgb, var(--sky-deep) 50%, var(--hairline));
  }
  .ai-badge {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    line-height: 1;
    padding: 3px 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--sky) 22%, transparent);
    color: var(--sky-deep);
    margin-left: 2px;
  }
  .imp-spin {
    animation: imp-spin 0.9s linear infinite;
  }
  @keyframes imp-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .imp-spin {
      animation: none;
    }
  }
  /* 进度条(不定量:滑动填充) */
  .imp-progress {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: var(--sp-xs) 0 0;
  }
  .imp-bar {
    height: 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--sky) 14%, var(--mist2));
    overflow: hidden;
  }
  .imp-bar-fill {
    height: 100%;
    width: 40%;
    border-radius: 999px;
    background: var(--sky-deep);
    animation: imp-indet 1.1s ease-in-out infinite;
  }
  @keyframes imp-indet {
    0% {
      transform: translateX(-110%);
    }
    100% {
      transform: translateX(300%);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .imp-bar-fill {
      animation: none;
      width: 100%;
      opacity: 0.7;
    }
  }
  .imp-phase {
    font-size: 12.5px;
    color: var(--sky-deep);
  }
  .ai-go {
    border-color: var(--sky-deep);
    color: var(--sky-deep);
    background: color-mix(in srgb, var(--sky) 12%, transparent);
  }
  .vbtn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .data-msg.err {
    color: var(--flame);
  }
  .data-msg {
    font-size: 13px;
    color: var(--sky-deep);
    margin: var(--sp-xs) 0 0;
  }
  .data-note {
    font-size: 12px;
    color: var(--ink-faint);
    margin: 0;
    line-height: 1.55;
  }
  .dt hr {
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
  /* 导入/清空确认 sheet */
  .imp-sum {
    font-size: 15px;
    color: var(--ink);
    margin: 0 0 var(--sp-sm);
  }
  .imp-tag {
    font-size: 11px;
    color: var(--ink-faint);
    border: 1px solid var(--hairline);
    border-radius: 999px;
    padding: 2px 8px;
    margin-left: 6px;
  }
  .imp-hint {
    font-size: 13px;
    line-height: 1.7;
    color: var(--ink-muted);
    margin: 0 0 var(--sp-lg);
  }
  .imp-actions {
    display: flex;
    gap: var(--sp-md);
  }
  .imp-actions .vbtn {
    flex: 1;
  }
  .imp-cancel {
    display: block;
    margin: var(--sp-md) auto 0;
    border: 0;
    background: transparent;
    color: var(--ink-faint);
    font-size: 14px;
    cursor: pointer;
  }
</style>
