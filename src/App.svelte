<script lang="ts">
  import Sidebar from "./lib/Sidebar.svelte";
  import Dashboard from "./lib/Dashboard.svelte";
  import Assets from "./lib/Assets.svelte";
  import History from "./lib/History.svelte";
  import Check from "./lib/Check.svelte";

  let theme = $state<"dark" | "light">("dark");
  let tab = $state("dashboard");

  $effect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  });

  function toggleTheme() {
    theme = theme === "dark" ? "light" : "dark";
  }
</script>

<div class="shell">
  <Sidebar current={tab} onNavigate={(t) => (tab = t)} {theme} onToggleTheme={toggleTheme} />
  <main>
    {#if tab === "dashboard"}
      <Dashboard />
    {:else if tab === "assets"}
      <Assets />
    {:else if tab === "history"}
      <History />
    {:else if tab === "check"}
      <Check />
    {/if}
  </main>
</div>

<style>
  .shell {
    display: flex;
    height: 100%;
    background: var(--paper);
  }
  main {
    flex: 1;
    overflow-y: auto;
    padding: var(--sp-2xl) var(--sp-2xl) var(--sp-3xl);
  }
</style>
