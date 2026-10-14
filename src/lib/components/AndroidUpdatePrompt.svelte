<script lang="ts">
  import Sheet from "./Sheet.svelte";
  import {
    androidUpdateState,
    dismissAndroidUpdate,
    installAndroidUpdate,
  } from "../android-updater.svelte";

  const isOpen = $derived(androidUpdateState.available && !androidUpdateState.dismissed);
  const busy = $derived(androidUpdateState.status === "downloading" || androidUpdateState.status === "installing");

  function close() {
    dismissAndroidUpdate();
  }

  function actionLabel() {
    if (androidUpdateState.status === "permission") return "已授权，继续更新";
    if (androidUpdateState.status === "downloading") return "正在下载 APK…";
    if (androidUpdateState.status === "installing") return "正在打开系统安装器…";
    if (androidUpdateState.status === "ready") return "重新打开安装器";
    if (androidUpdateState.status === "error") return "重试更新";
    return "下载并安装";
  }
</script>

<Sheet open={isOpen} title="应用更新" onClose={close}>
  <div class="update-prompt">
    <p class="update-version">发现新版本 <strong>v{androidUpdateState.version}</strong></p>

    {#if androidUpdateState.notes.length}
      <ul class="update-notes">
        {#each androidUpdateState.notes as note (note)}
          <li>{note}</li>
        {/each}
      </ul>
    {/if}

    {#if androidUpdateState.status === "permission"}
      <p class="update-status">Android 要求先允许自由日记安装此来源的更新。授权后返回此处继续；系统仍会要求你确认安装。</p>
    {:else if androidUpdateState.status === "downloading"}
      <p class="update-status">正在下载更新包，请保持网络连接。</p>
    {:else if androidUpdateState.status === "installing"}
      <p class="update-status">请在 Android 系统安装界面确认更新。</p>
    {:else if androidUpdateState.status === "error"}
      <p class="update-status error" role="alert">{androidUpdateState.error}</p>
    {:else}
      <p class="update-status">只读取 GitHub 版本信息，不会上传本机数据。</p>
    {/if}

    <div class="update-actions">
      <button class="fg-btn" disabled={busy} onclick={installAndroidUpdate}>{actionLabel()}</button>
      <button class="ghostbtn" disabled={busy} onclick={close}>稍后</button>
    </div>
  </div>
</Sheet>

<style>
  .update-version {
    margin: 0 0 var(--sp-md);
    color: var(--ink);
    font-size: 16px;
  }
  .update-version strong {
    color: var(--sky-deep);
  }
  .update-notes {
    display: grid;
    gap: 8px;
    margin: 0 0 var(--sp-lg);
    padding-left: 20px;
    color: var(--ink-soft);
    font-size: 13px;
    line-height: 1.55;
  }
  .update-status {
    margin: 0 0 var(--sp-lg);
    color: var(--ink-faint);
    font-size: 12px;
    line-height: 1.5;
  }
  .update-status.error {
    color: var(--flame);
  }
  .update-actions {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--sp-sm);
    align-items: center;
  }
  .update-actions .fg-btn {
    min-width: 0;
    white-space: normal;
  }
</style>