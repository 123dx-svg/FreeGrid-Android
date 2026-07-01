<script lang="ts">
  // 数据 · 备份与导入 —— 从资产页迁来的全 app 级数据工具(导出/导入/AI提示词/清空)。
  // 独立组件,单一来源;供设置页挂载。
  import { store, exportJSONString, importBackup, mergeBackup, clearAll } from "../store.svelte";
  import { EXPENSE_CATEGORIES } from "../models";
  import { parseImport, buildImportPrompt, type ParsedImport } from "../import-adapters";
  import { Capacitor } from "@capacitor/core";
  import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
  import { Share } from "@capacitor/share";
  import Sheet from "./Sheet.svelte";

  // ── 导出:原生写缓存+分享;web/桌面 blob 下载 ──
  let exporting = $state(false);
  async function download(text: string, filename: string, mime: string) {
    if (Capacitor.isNativePlatform()) {
      if (exporting) return;
      exporting = true;
      try {
        const res = await Filesystem.writeFile({ path: filename, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
        await Share.share({ title: filename, text: "自由日记 数据备份", url: res.uri, dialogTitle: "导出 / 分享备份" });
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

  // ── 导入:解析 → 弹「合并/替换」──
  let fileInput = $state<HTMLInputElement | null>(null);
  function triggerImport() {
    fileInput?.click();
  }
  let pendingImport = $state<ParsedImport | null>(null);
  let importMsg = $state("");
  async function onFilePicked(ev: Event) {
    const input = ev.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      try {
        const total = store.assets.lockedAssets + store.assets.cash;
        const res = parseImport(await file.text(), total);
        if (res.ok) {
          pendingImport = res;
        } else {
          importMsg = res.error ?? "文件无法识别";
          setTimeout(() => (importMsg = ""), 3500);
        }
      } catch {
        importMsg = "读取文件失败";
        setTimeout(() => (importMsg = ""), 3500);
      }
    }
    input.value = "";
  }
  function doImport(mode: "merge" | "replace") {
    const res = pendingImport;
    if (!res?.backup) return;
    if (mode === "replace") {
      importBackup(res.backup);
      importMsg = `已替换导入 · 支出 ${res.expCount} · 收入 ${res.incCount}`;
    } else {
      const r = mergeBackup(res.backup);
      importMsg = `已合并 ${r.added} 笔${r.skipped ? ` · 跳过重复 ${r.skipped}` : ""}`;
    }
    pendingImport = null;
    setTimeout(() => (importMsg = ""), 3500);
  }

  // ── 复制 AI 转换提示词 ──
  let copied = $state(false);
  async function copyPrompt() {
    const txt = buildImportPrompt(EXPENSE_CATEGORIES);
    let ok = false;
    try {
      await navigator.clipboard.writeText(txt);
      ok = true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = txt;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    copied = ok;
    importMsg = ok ? "提示词已复制,粘给你的 AI 助手即可" : "复制失败,请手动长按复制";
    setTimeout(() => {
      copied = false;
      importMsg = "";
    }, 3500);
  }

  // ── 清空 ──
  let showPurge = $state(false);
  function confirmPurge() {
    clearAll();
    showPurge = false;
  }
</script>

<div class="dt">
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

  <button class="vbtn data-out data-import" onclick={triggerImport}>
    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M12 3v10.6l3.3-3.3 1.4 1.4L12 17.4l-4.7-4.7 1.4-1.4 3.3 3.3V3h2ZM5 19h14v2H5v-2Z" /></svg>
    导入数据
  </button>
  <input bind:this={fileInput} type="file" accept=".json,application/json,text/plain" onchange={onFilePicked} hidden />

  <button class="vbtn data-out data-prompt" onclick={copyPrompt}>
    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M9 3h9a2 2 0 0 1 2 2v11h-2V5H9V3Zm-4 4h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm0 2v10h9V9H5Z" /></svg>
    {copied ? "已复制 ✓" : "复制转换提示词(给 AI)"}
  </button>
  {#if importMsg}<p class="data-msg">{importMsg}</p>{/if}
  <p class="data-note">
    换其他平台的账单?导出成 CSV → 点上面「复制转换提示词」→ 连同 CSV 发给你的 AI 助手 → 把它给的 JSON 存下来 → 用「导入数据」选中即可。JSON 也用于本机备份回导。
  </p>

  <hr class="hairline soft" />
  <button class="purge" onclick={() => (showPurge = true)}>
    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M6 7h12l-1 14H7L6 7Zm3-3h6l1 2H8l1-2ZM4 6h16v1H4V6Z" /></svg>
    清空所有数据
  </button>
</div>

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

<style>
  .dt {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
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
  .data-prompt {
    width: 100%;
    margin-top: var(--sp-sm);
    border-color: color-mix(in srgb, var(--sky-deep) 45%, var(--hairline));
    color: var(--sky-deep);
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
