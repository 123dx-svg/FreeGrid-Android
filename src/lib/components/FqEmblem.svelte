<script lang="ts">
  // 参数化「财商小精灵」:统一硬币小生物基底 + 4 维各驱动一个特征插槽,2⁴=16 只同族一眼可辨。
  // code 4 字代号:income(开/省)·risk(进/稳)·time(即/远)·decision(感/研)。纯 SVG 零依赖。
  import { familyOf } from "../fq-test";

  let { code, size = 100, animated = false }: { code: string; size?: number; animated?: boolean } = $props();

  const inc = $derived((code[0] ?? "开") === "开"); // 开源 / 省
  const adv = $derived((code[1] ?? "稳") === "进"); // 进取 / 稳
  const now = $derived((code[2] ?? "远") === "即"); // 即时 / 远
  const feel = $derived((code[3] ?? "研") === "感"); // 感性 / 研
  const fam = $derived(familyOf(code));
</script>

<svg
  viewBox="0 0 120 120"
  width={size}
  height={size}
  class="mascot"
  class:anim={animated}
  role="img"
  aria-label="财商小精灵 {code}"
  style="--b:{fam.base};--d:{fam.deep}"
>
  <!-- 落地阴影 -->
  <ellipse cx="60" cy="108" rx="26" ry="4.5" fill="color-mix(in srgb, var(--d) 22%, transparent)" />

  <!-- 前倾(进)/ 直立(稳) -->
  <g class="breathe">
   <g transform={adv ? "rotate(-6 60 72)" : ""}>
    <!-- ══ 头顶插槽:时间 即=兔耳 / 远=龟壳帽 ══ -->
    {#if now}
      <!-- 兔耳 -->
      <g class="ear ear-l">
        <path d="M49 48 C44 28 46 12 53 12 C59 12 58 32 58 48 Z" class="fill-soft stroke-d" />
        <path d="M52 44 C50 30 51 20 54 20 C56 20 55 32 55 44 Z" class="fill-b" />
      </g>
      <g class="ear ear-r">
        <path d="M71 48 C76 28 74 12 67 12 C61 12 62 32 62 48 Z" class="fill-soft stroke-d" />
        <path d="M68 44 C70 30 69 20 66 20 C64 20 65 32 65 44 Z" class="fill-b" />
      </g>
    {:else}
      <!-- 龟壳帽(长期/armored)-->
      <path d="M34 50 C34 24 86 24 86 50 Z" class="fill-b stroke-d" />
      <path d="M60 27 L60 50 M46 31 L46 50 M74 31 L74 50 M36 44 H84" class="stroke-shell" />
    {/if}

    <!-- ══ 身体(硬币)══ -->
    <rect x="32" y="46" width="56" height="54" rx="24" class="fill-body stroke-d" />
    <rect x="38" y="52" width="44" height="42" rx="18" class="stroke-ridge" fill="none" />

    <!-- 腹部 ¥(开:手举高露出肚子;省:被钱袋遮住)-->
    {#if inc}
      <text x="60" y="90" text-anchor="middle" class="belly">¥</text>
    {/if}

    <!-- ══ 胸口/肩:风险 进=火花 / 稳=盾徽 ══ -->
    {#if adv}
      <g class="flame-grp">
        <path d="M84 56 C77 50 86 44 82 34 C94 40 95 55 84 56 Z" class="fill-b stroke-d flame" />
        <path d="M85 53 C82 50 86 46 85 42 C90 46 90 53 85 53 Z" class="flame-inner" />
      </g>
    {:else}
      <path d="M54 60 L66 60 L66 69 C66 73 60 76 60 76 C60 76 54 73 54 69 Z" class="fill-soft stroke-d" />
      <path d="M56.5 66 L59 69 L64 63" class="stroke-check" fill="none" />
    {/if}

    <!-- ══ 手臂/持物:收入 开=举币 / 省=抱钱袋 ══ -->
    {#if inc}
      <!-- 举币 -->
      <path d="M37 68 C27 62 24 47 31 41" class="arm" fill="none" />
      <path d="M83 68 C93 62 96 47 89 41" class="arm" fill="none" />
      <g class="coin-grp">
        <circle cx="60" cy="28" r="11" class="fill-b stroke-d" />
        <text x="60" y="32.5" text-anchor="middle" class="coin">¥</text>
        <path d="M42 30 l-3 -3 M42 34 l-4 0 M78 30 l3 -3 M78 34 l4 0" class="stroke-spark" />
      </g>
    {:else}
      <!-- 抱钱袋 -->
      <path d="M46 74 C44 66 54 62 60 62 C66 62 76 66 74 74 L77 92 C77 98 43 98 43 92 Z" class="fill-soft stroke-d" />
      <path d="M52 64 L54 60 L66 60 L68 64" class="stroke-d" fill="none" />
      <text x="60" y="86" text-anchor="middle" class="coin">¥</text>
      <path d="M36 72 C40 84 50 90 57 90" class="arm" fill="none" />
      <path d="M84 72 C80 84 70 90 63 90" class="arm" fill="none" />
    {/if}

    <!-- ══ 眼睛:决策 感=爱心眼 / 研=圆眼镜 ══ -->
    {#if feel}
      <path d="M51 62 C51 58 46 58 46 62 C46 65 51 68 51 68 C51 68 56 65 56 62 C56 58 51 58 51 62 Z" class="fill-eye" />
      <path d="M69 62 C69 58 64 58 64 62 C64 65 69 68 69 68 C69 68 74 65 74 62 C74 58 69 58 69 62 Z" class="fill-eye" />
    {:else}
      <circle cx="50" cy="63" r="6.5" class="glasses" fill="none" />
      <circle cx="70" cy="63" r="6.5" class="glasses" fill="none" />
      <path d="M56.5 63 H63.5" class="glasses" />
      <circle cx="50" cy="63" r="2" class="fill-eye" />
      <circle cx="70" cy="63" r="2" class="fill-eye" />
    {/if}

    <!-- ══ 嘴:进=咧嘴 / 稳=淡定 ══ -->
    {#if adv}
      <path d="M53 74 Q60 83 67 74 Q60 78 53 74 Z" class="mouth-fill" />
    {:else}
      <path d="M55 76 Q60 80 65 76" class="mouth-line" fill="none" />
    {/if}

    <!-- ══ 脚:稳=双脚扎地 / 进=跨步 ══ -->
    {#if adv}
      <ellipse cx="50" cy="100" rx="7" ry="4" class="fill-d" />
      <ellipse cx="72" cy="102" rx="7" ry="4" class="fill-d" />
    {:else}
      <ellipse cx="49" cy="101" rx="8" ry="4.5" class="fill-d" />
      <ellipse cx="71" cy="101" rx="8" ry="4.5" class="fill-d" />
    {/if}
   </g>
  </g>
</svg>

<style>
  .mascot {
    display: block;
  }
  /* 描边 */
  .stroke-d,
  .arm,
  .glasses,
  .mouth-line {
    stroke: var(--d);
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .arm {
    stroke-width: 3.2;
  }
  .stroke-ridge {
    stroke: color-mix(in srgb, var(--d) 26%, transparent);
    stroke-width: 1.4;
  }
  .stroke-shell {
    stroke: color-mix(in srgb, var(--d) 55%, transparent);
    stroke-width: 1.6;
    stroke-linecap: round;
    fill: none;
  }
  .stroke-check {
    stroke: #fff;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .stroke-spark {
    stroke: var(--b);
    stroke-width: 2;
    stroke-linecap: round;
  }
  .flame {
    stroke-width: 1.8;
  }
  .flame-inner {
    fill: color-mix(in srgb, #fff 70%, var(--b));
  }
  /* 填充 */
  .fill-body {
    fill: color-mix(in srgb, var(--b) 15%, var(--mist));
  }
  .fill-soft {
    fill: color-mix(in srgb, var(--b) 32%, var(--mist));
  }
  .fill-b {
    fill: var(--b);
  }
  .fill-d {
    fill: var(--d);
  }
  .fill-eye {
    fill: var(--d);
  }
  .mouth-fill {
    fill: color-mix(in srgb, var(--d) 78%, #000);
  }
  /* 文字 */
  .belly {
    font-family: var(--font-rounded);
    font-size: 15px;
    font-weight: 700;
    fill: color-mix(in srgb, var(--d) 40%, transparent);
  }
  .coin {
    font-family: var(--font-rounded);
    font-size: 13px;
    font-weight: 800;
    fill: #fff;
  }

  /* ── idle 动画(仅 animated=true;纯 transform/opacity,GPU 合成)── */
  .anim .breathe {
    transform-box: fill-box;
    transform-origin: 50% 100%;
    animation: fq-breathe 4s ease-in-out infinite;
  }
  .anim .ear {
    transform-box: fill-box;
    transform-origin: 50% 90%;
  }
  .anim .ear-l {
    animation: fq-earL 5s ease-in-out infinite;
  }
  .anim .ear-r {
    animation: fq-earR 5s ease-in-out infinite;
  }
  .anim .flame-grp {
    transform-box: fill-box;
    transform-origin: 50% 100%;
    animation: fq-flame 0.9s ease-in-out infinite;
  }
  .anim .coin-grp {
    transform-box: fill-box;
    transform-origin: 50% 50%;
    animation: fq-coin 2.6s ease-in-out infinite;
  }
  @keyframes fq-breathe {
    0%, 100% { transform: translateY(0) scale(1); }
    50% { transform: translateY(-1px) scale(1.02); }
  }
  @keyframes fq-earL {
    0%, 82%, 100% { transform: rotate(0deg); }
    88% { transform: rotate(-7deg); }
    94% { transform: rotate(4deg); }
  }
  @keyframes fq-earR {
    0%, 80%, 100% { transform: rotate(0deg); }
    86% { transform: rotate(7deg); }
    92% { transform: rotate(-4deg); }
  }
  @keyframes fq-flame {
    0%, 100% { transform: scaleY(1) scaleX(1); opacity: 1; }
    50% { transform: scaleY(1.15) scaleX(0.92); opacity: 0.82; }
  }
  @keyframes fq-coin {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-2.5px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .anim .breathe,
    .anim .ear-l,
    .anim .ear-r,
    .anim .flame-grp,
    .anim .coin-grp {
      animation: none;
    }
  }
</style>
