<script lang="ts">
  import Sheet from "./Sheet.svelte";
  import FqEmblem from "./FqEmblem.svelte";
  import { store } from "../store.svelte";
  import { deriveDashboard } from "../derive";
  import {
    QUESTIONS,
    sampleQuestions,
    buildResult,
    composeResult,
    saveFqResult,
    loadFqResult,
    saveFqProgress,
    loadFqProgress,
    clearFqProgress,
    familyOf,
    type FqStored,
    type FqQuestion,
    type FqProgress,
  } from "../fq-test";
  import { Capacitor } from "@capacitor/core";
  import { Share } from "@capacitor/share";
  import { renderPersonalityPng, sharePngDataUrl } from "../fq-share";
  import { markBadgeEvent } from "../achievements.svelte";
  import { pushOverlay, popOverlay } from "../overlay";
  import { aiReady, aiConfig, cacheGet, cacheSet } from "../ai/config.svelte";
  import { chat, fmtCost } from "../ai/llm";
  import { fqMessages, parseFqInterpretation, type FqInterpretation } from "../ai/prompts";

  let { open = false, startFresh = false, resume = false, onClose }: { open?: boolean; startFresh?: boolean; resume?: boolean; onClose?: () => void } = $props();

  // 真实记账指标(用于财商分并入,随 store 实时变)
  const vm = $derived(deriveDashboard(store));
  const totalIncome = $derived(store.incomes.reduce((s, i) => s + i.amount, 0));
  const totalExpense = $derived(store.expenses.reduce((s, e) => s + e.amount, 0));
  const metrics = $derived({
    margin: totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome : 0,
    fiProgress: Math.min(1, vm.passiveRatio),
    freedomDays: vm.freedomDays,
    trackDays: vm.trackDays,
    hasData: store.expenses.length + store.incomes.length > 0,
  });

  type Stage = "intro" | "quiz" | "result";
  let stage = $state<Stage>("intro");
  let answers = $state<number[]>([]);
  let current = $state(0);
  let locked = false;
  let stored = $state<FqStored | null>(null);
  let flipped = $state(false); // 结果卡:正面/背面

  const QUIZ_LEN = 50; // 每次测试固定 50 题(从题库分层随机抽)
  let quizQuestions = $state<FqQuestion[]>([]);
  const total = $derived(quizQuestions.length || QUIZ_LEN);
  const result = $derived(stored ? composeResult(stored, metrics) : null);
  const fam = $derived(familyOf(result?.code ?? "开稳"));
  // 每极的 2 字说明词(替代难懂的裸代号)
  const POLE_WORD: Record<string, string> = {
    开: "开源", 省: "节流", 进: "进取", 稳: "稳健", 即: "即时", 远: "远见", 感: "随心", 研: "精算",
  };

  // 打开时:只在「关→开」的那一次决定进入哪个阶段(用 prevOpen 守卫,避免 effect 反复重跑打断关闭)。
  //  · startFresh(点“重新测试/开始测试”)→ 全新一套。
  //  · resume(点“继续未完成的重测”)→ 优先续答已保存的进度;没有进度再退回结果/全新。
  //  · 默认(点结果卡/入口)→ 有结果看结果;否则有进度续答;都没有则全新。
  //    ——「结果优先」只在默认路径;in-progress 的重测通过独立的 resume 入口保证可续答、不丢答题进度。
  let prevOpen = false;
  $effect(() => {
    const isOpen = open;
    if (isOpen && !prevOpen) {
      if (startFresh) {
        startFreshQuiz();
      } else if (resume) {
        const p = loadFqProgress();
        if (p) {
          resumeQuiz(p);
        } else {
          const s = loadFqResult();
          if (s) {
            stored = s;
            flipped = false;
            stage = "result";
          } else {
            startFreshQuiz();
          }
        }
      } else {
        const s = loadFqResult();
        if (s) {
          stored = s;
          flipped = false;
          stage = "result";
        } else {
          const p = loadFqProgress();
          if (p) resumeQuiz(p);
          else startFreshQuiz();
        }
      }
    }
    prevOpen = isOpen;
  });

  function startFreshQuiz() {
    clearFqProgress();
    quizQuestions = sampleQuestions(QUIZ_LEN);
    answers = new Array(quizQuestions.length).fill(-1);
    current = 0;
    locked = false;
    flipped = false;
    stage = "quiz";
  }

  function resumeQuiz(p: FqProgress) {
    quizQuestions = p.questions;
    answers = p.answers.slice();
    current = Math.min(Math.max(0, p.current), p.questions.length - 1);
    locked = false;
    flipped = false;
    stage = "quiz";
  }

  function beginQuiz() {
    startFreshQuiz();
  }

  // 中途退出:保留本次抽到的题目 + 已答进度,下次续答
  function requestClose() {
    if (stage === "quiz" && quizQuestions.length) {
      saveFqProgress({ questions: quizQuestions, answers, current, date: new Date().toISOString() });
    }
    onClose?.();
  }

  function choose(idx: number) {
    if (locked) return;
    answers[current] = idx;
    locked = true;
    setTimeout(() => {
      if (current >= total - 1) {
        finish();
      } else {
        current += 1;
        locked = false;
      }
    }, 200);
  }

  function back() {
    if (current > 0) {
      current -= 1;
      locked = false;
    }
  }

  function finish() {
    clearFqProgress(); // 答完 → 清除未完成进度
    const r = buildResult(answers, quizQuestions, metrics);
    const s: FqStored = { code: r.code, name: r.name, q: r.q, leans: r.axes.map((a) => ({ key: a.key, pole: a.pole, leanPct: a.leanPct })), date: r.date };
    saveFqResult(s);
    stored = s;
    flipped = false;
    stage = "result";
    // 答完整套题 → 解锁「认识自己」徽章(每次完成都会检查,首次点亮即弹庆祝)
    markBadgeEvent("completed_fq");
  }

  function flip(e: Event) {
    e.stopPropagation();
    flipped = !flipped;
  }
  function closeCard() {
    onClose?.();
  }
  function onKey(e: KeyboardEvent) {
    if (open && stage === "result" && e.key === "Escape") closeCard();
  }

  // 结果卡模态(非 Sheet)登记到全局弹层栈,供物理返回键关闭
  $effect(() => {
    if (open && stage === "result" && result) {
      const id = pushOverlay(() => onClose?.());
      return () => popOverlay(id);
    }
  });

  let sharing = $state(false);
  async function share(e?: Event) {
    e?.stopPropagation();
    if (!result || sharing) return;
    const caption = `我的财商人格是【${result.name}】${result.code} · 财商分 ${result.fqFinal}\n「${result.tagline}」\n来自由日记测测你的财商人格 →`;
    sharing = true;
    // 1) 先生成卡片图片。只有这一步失败,才退回纯文字分享。
    let dataUrl: string | null = null;
    try {
      dataUrl = await renderPersonalityPng(result);
    } catch {
      dataUrl = null;
    }
    try {
      if (dataUrl) {
        // 2) 分享图片。用户取消 / 分享失败 → 直接结束,**不再弹文字**。
        try {
          await sharePngDataUrl(dataUrl, caption);
        } catch {
          /* 取消或分享失败:静默,不做文字兜底 */
        }
        return;
      }
      // 出图失败的兜底:纯文字分享
      try {
        if (Capacitor.isNativePlatform()) {
          await Share.share({ title: "我的财商人格", text: caption, dialogTitle: "分享财商人格" });
        } else if (navigator.share) {
          await navigator.share({ text: caption });
        }
      } catch {
        /* 用户取消等忽略 */
      }
    } finally {
      sharing = false;
    }
  }

  function retest(e: Event) {
    e.stopPropagation();
    beginQuiz();
  }

  const pct = (x: number) => `${Math.round(x * 100)}%`;

  // ── AI 深度解读(可选;仅在开启 AI 且填了密钥时出现)──
  let aiLoading = $state(false);
  let aiErr = $state("");
  let aiData = $state<FqInterpretation | null>(null);
  let aiCost = $state("");
  let lastAiCode = "";
  // 人格代号变化(重测/切换结果)→ 清空上次解读
  $effect(() => {
    const c = result?.code ?? "";
    if (c !== lastAiCode) {
      lastAiCode = c;
      aiData = null;
      aiErr = "";
      aiCost = "";
    }
  });

  async function genAi(force: boolean) {
    if (!result || aiLoading) return;
    const withReal = aiConfig.sendRealMetrics && metrics.hasData;
    const m = withReal
      ? { marginPct: Math.round(metrics.margin * 100), passivePct: Math.round(Math.min(metrics.fiProgress, 9.99) * 100) }
      : null;
    const { messages, cacheKey } = fqMessages({
      name: result.name,
      code: result.code,
      axes: result.axes.map((a) => ({ label: a.label, poleChar: a.poleChar, otherChar: a.otherChar, leanPct: a.leanPct })),
      metrics: m,
    });
    aiErr = "";
    if (!force) {
      const cached = cacheGet(cacheKey);
      if (cached) {
        const p = parseFqInterpretation(cached);
        if (p) {
          aiData = p;
          aiCost = "";
          return;
        }
      }
    }
    aiLoading = true;
    const r = await chat({ messages, json: true, maxTokens: 520, temperature: 0.85 });
    aiLoading = false;
    if (!r.ok || !r.content) {
      aiErr = r.error ?? "生成失败";
      return;
    }
    const p = parseFqInterpretation(r.content);
    if (!p) {
      aiErr = "AI 返回格式异常,可重试";
      return;
    }
    cacheSet(cacheKey, r.content);
    aiData = p;
    aiCost = fmtCost(r.usage);
  }
</script>

<svelte:window onkeydown={onKey} />

{#if stage !== "result"}
  <Sheet {open} title="财商人格测试" wide onClose={requestClose}>
    {#if stage === "intro"}
      <div class="fq-intro">
        <div class="fq-intro-badge">
          <FqEmblem code="开进远研" size={92} animated />
        </div>
        <h2 class="fq-intro-title">财商人格测试</h2>
        <p class="fq-intro-sub">题库 {QUESTIONS.length} 题 · 每次随机抽 {QUIZ_LEN} 题<br />测出你的财商人格 + 财商分,看看你是哪一型</p>
        <ul class="fq-intro-pts">
          <li>· 4 个维度组合出 <b>16 种财商人格</b></li>
          <li>· 结合你的真实记账,给出 <b>财商分</b></li>
          <li>· 一只专属小精灵 + 可分享人格卡</li>
        </ul>
        <button class="fq-btn primary" onclick={beginQuiz}>开始测试 →</button>
      </div>
    {:else if stage === "quiz"}
      {@const q = quizQuestions[current]}
      <div class="fq-quiz">
        <div class="fq-prog">
          <div class="fq-prog-bar"><div class="fq-prog-fill" style="width:{((current + 1) / total) * 100}%"></div></div>
          <span class="fq-prog-txt num">{current + 1} / {total}</span>
        </div>
        <p class="fq-q">{q.text}</p>
        <div class="fq-opts">
          {#each q.options as opt, i (i)}
            <button class="fq-opt" class:sel={answers[current] === i} onclick={() => choose(i)}>{opt.label}</button>
          {/each}
        </div>
        {#if current > 0}
          <button class="fq-back" onclick={back}>← 上一题</button>
        {/if}
      </div>
    {/if}
  </Sheet>
{:else if open && result}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fq-modal" onclick={closeCard}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="flipwrap" class:flipped onclick={flip} style="--fam:{fam.base};--famd:{fam.deep}">
      <div class="flipinner">
        <!-- 正面:身份卡 -->
        <div class="face front">
          <span class="cardkicker">FREEGRID · 财商人格</span>
          <div class="poster-glow"></div>
          <div class="poster-emblem"><FqEmblem code={result.code} size={144} animated /></div>
          <h2 class="poster-name">{result.name}</h2>
          <span class="name-line"></span>
          <div class="poster-chips">
            {#each result.axes as a (a.key)}
              <span class="pchip">{POLE_WORD[a.poleChar] ?? a.poleChar}</span>
            {/each}
          </div>
          <p class="poster-tag">「{result.tagline}」</p>
          <div class="poster-score">
            <span class="ps-cap">财商分</span>
            <div class="ps-num num">{result.fqFinal}<span class="ps-of">/100</span></div>
          </div>
          <p class="flip-hint">点卡片看详解 · 点空白处收起</p>
        </div>

        <!-- 背面:详解 -->
        <div class="face back">
          <p class="back-title">{result.name} <span class="num back-code">{result.code}</span></p>

          <div class="poster-axes">
            {#each result.axes as a (a.key)}
              <div class="pa-row">
                <span class="pa-other">{a.otherChar}</span>
                <span class="pa-track">
                  <span class="pa-fill" class:right={a.pole === "A"} style="width:{a.leanPct * 50}%"></span>
                </span>
                <span class="pa-pole">{a.poleChar}</span>
              </div>
            {/each}
          </div>

          {#if result.usedReal}
            <p class="fq-real">
              已结合你的真实记账(储蓄率 {pct(metrics.margin)} · 被动覆盖 {pct(metrics.fiProgress)})
              {#if result.realDelta !== 0}<span class="fq-delta" class:up={result.realDelta > 0}>{result.realDelta > 0 ? "+" : ""}{result.realDelta} 分</span>{/if}
            </p>
          {:else}
            <p class="fq-real muted">记账数据还少,财商分以测试为主——记得越久,评估越准 📈</p>
          {/if}

          <div class="fq-detail">
            <div class="fq-sec">
              <p class="fq-sec-h">你的优势</p>
              {#each result.strengths as s (s)}<p class="fq-li">· {s}</p>{/each}
            </div>
            <div class="fq-sec">
              <p class="fq-sec-h">小心盲点</p>
              {#each result.blindspots as s (s)}<p class="fq-li">· {s}</p>{/each}
            </div>
            <div class="fq-sec">
              <p class="fq-sec-h">一句建议</p>
              <p class="fq-li">· {result.tip}</p>
            </div>
          </div>

          {#if aiReady("fq")}
            <div class="fq-ai">
              {#if aiData}
                <p class="fq-ai-cap">✨ AI 深度解读</p>
                <p class="fq-ai-sum">{aiData.summary}</p>
                {#if aiData.strengths.length}
                  <div class="fq-sec"><p class="fq-sec-h">AI · 优势</p>{#each aiData.strengths as s (s)}<p class="fq-li">· {s}</p>{/each}</div>
                {/if}
                {#if aiData.blindspots.length}
                  <div class="fq-sec"><p class="fq-sec-h">AI · 盲点</p>{#each aiData.blindspots as s (s)}<p class="fq-li">· {s}</p>{/each}</div>
                {/if}
                {#if aiData.advice.length}
                  <div class="fq-sec"><p class="fq-sec-h">AI · 建议</p>{#each aiData.advice as s (s)}<p class="fq-li">· {s}</p>{/each}</div>
                {/if}
                <div class="fq-ai-foot">
                  {#if aiCost}<span class="fq-ai-cost">{aiCost}</span>{/if}
                  <button class="fq-ai-regen" onclick={() => genAi(true)} disabled={aiLoading}>{aiLoading ? "生成中…" : "重新生成"}</button>
                </div>
              {:else}
                <button class="fq-ai-btn" onclick={() => genAi(false)} disabled={aiLoading}>{aiLoading ? "AI 解读中…" : "✨ AI 深度解读"}</button>
                {#if aiErr}<p class="fq-ai-err">{aiErr}</p>{/if}
              {/if}
            </div>
          {/if}

          <div class="fq-actions">
            <button class="fq-btn" onclick={retest}>重新测试</button>
            <button class="fq-btn primary" onclick={share} disabled={sharing}>{sharing ? "生成卡片…" : "分享我的人格 ↗"}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── 介绍页 ── */
  .fq-intro {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--sp-md);
    padding: var(--sp-sm) 0 var(--sp-md);
  }
  .fq-intro-badge {
    opacity: 0.9;
  }
  .fq-intro-title {
    font-size: 24px;
    font-weight: 600;
    color: var(--ink);
    margin: 0;
  }
  .fq-intro-sub {
    font-size: 14px;
    line-height: 1.6;
    color: var(--ink-muted);
    margin: 0;
  }
  .fq-intro-pts {
    list-style: none;
    margin: var(--sp-sm) 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    color: var(--ink-muted);
    text-align: left;
  }
  .fq-intro-pts b {
    color: var(--ink);
  }

  /* ── 答题 ── */
  .fq-quiz {
    display: flex;
    flex-direction: column;
    gap: var(--sp-lg);
    min-height: 320px;
  }
  .fq-prog {
    display: flex;
    align-items: center;
    gap: var(--sp-md);
  }
  .fq-prog-bar {
    flex: 1;
    height: 5px;
    border-radius: 999px;
    background: var(--hairline);
    overflow: hidden;
  }
  .fq-prog-fill {
    height: 100%;
    border-radius: 999px;
    background: var(--sky-deep);
    transition: width 0.25s ease;
  }
  .fq-prog-txt {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--ink-faint);
  }
  .fq-q {
    font-size: 20px;
    font-weight: 600;
    color: var(--ink);
    line-height: 1.45;
    margin: var(--sp-md) 0;
  }
  .fq-opts {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
  }
  .fq-opt {
    text-align: left;
    padding: 16px 18px;
    border-radius: 14px;
    border: 1px solid var(--hairline);
    background: var(--mist2);
    color: var(--ink);
    font-family: var(--font-rounded);
    font-size: 15px;
    line-height: 1.4;
    cursor: pointer;
    transition: background 0.12s ease, border-color 0.12s ease, transform 0.12s ease;
  }
  .fq-opt:hover {
    border-color: var(--ink-ghost);
  }
  .fq-opt.sel {
    background: color-mix(in srgb, var(--sky) 18%, transparent);
    border-color: var(--sky);
    color: var(--sky-deep);
    transform: scale(0.99);
  }
  .fq-back {
    align-self: flex-start;
    margin-top: var(--sp-sm);
    border: 0;
    background: transparent;
    color: var(--ink-faint);
    font-size: 13px;
    cursor: pointer;
  }

  /* ── 结果:翻转卡模态 ── */
  .fq-modal {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: color-mix(in srgb, #05070a 58%, transparent);
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
    animation: fq-fade 0.2s ease;
  }
  .flipwrap {
    position: relative;
    width: min(330px, 88vw);
    height: min(548px, 82vh);
    perspective: 1500px;
    cursor: pointer;
    touch-action: manipulation;
    animation: fq-pop 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.25);
  }
  .flipinner {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    transition: transform 0.55s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .flipwrap.flipped .flipinner {
    transform: rotateY(180deg);
  }
  .face {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    border-radius: 24px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--fam) 34%, var(--hairline));
    box-shadow: 0 18px 46px -20px color-mix(in srgb, var(--famd) 70%, transparent);
  }
  .face.front {
    justify-content: center;
    text-align: center;
    gap: 5px;
    padding: var(--sp-lg) var(--sp-lg) var(--sp-md);
    background: radial-gradient(120% 80% at 50% 22%, color-mix(in srgb, var(--fam) 15%, var(--mist2)), var(--mist) 72%);
  }
  .face.back {
    transform: rotateY(180deg);
    justify-content: flex-start;
    gap: var(--sp-sm);
    padding: var(--sp-lg) var(--sp-md) var(--sp-md);
    background: linear-gradient(170deg, color-mix(in srgb, var(--fam) 8%, var(--mist2)), var(--mist));
    overflow-y: auto;
  }
  @keyframes fq-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes fq-pop {
    from { opacity: 0; transform: scale(0.9) translateY(8px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .fq-modal, .flipwrap { animation: none; }
    .flipinner { transition: none; }
  }

  /* ── 正面 ── */
  .cardkicker {
    font-family: var(--font-mono);
    font-size: 9.5px;
    letter-spacing: 0.16em;
    color: var(--ink-faint);
    margin-bottom: 2px;
  }
  .poster-glow {
    position: absolute;
    top: 42px;
    width: 190px;
    height: 190px;
    border-radius: 50%;
    background: radial-gradient(circle, color-mix(in srgb, var(--fam) 32%, transparent), transparent 66%);
    pointer-events: none;
  }
  .poster-emblem {
    position: relative;
    filter: drop-shadow(0 6px 14px color-mix(in srgb, var(--famd) 35%, transparent));
  }
  .poster-name {
    font-size: 29px;
    font-weight: 800;
    color: var(--ink);
    margin: 4px 0 0;
    letter-spacing: 0.01em;
  }
  .name-line {
    width: 34px;
    height: 3px;
    border-radius: 999px;
    background: var(--fam);
    margin: 7px 0 2px;
  }
  .poster-chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
    margin: var(--sp-xs) 0 2px;
  }
  .pchip {
    font-size: 11.5px;
    font-weight: 600;
    color: var(--famd);
    background: color-mix(in srgb, var(--fam) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--fam) 35%, transparent);
    padding: 3px 10px;
    border-radius: 999px;
  }
  .poster-tag {
    font-size: 13px;
    color: var(--ink-muted);
    margin: 5px 0 var(--sp-md);
    font-style: italic;
  }
  .poster-score {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
  }
  .ps-cap {
    font-size: 11px;
    letter-spacing: 0.1em;
    color: var(--ink-faint);
  }
  .ps-num {
    font-size: 48px;
    font-weight: 200;
    color: var(--ink);
    line-height: 1.05;
  }
  .ps-of {
    font-size: 16px;
    color: var(--ink-faint);
  }
  .flip-hint {
    position: absolute;
    bottom: var(--sp-md);
    font-size: 11px;
    color: var(--ink-ghost);
    letter-spacing: 0.03em;
    margin: 0;
  }

  /* ── 背面 ── */
  .back-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--ink);
    margin: 0 0 2px;
    text-align: center;
  }
  .back-code {
    font-family: var(--font-mono);
    font-size: 12px;
    letter-spacing: 0.24em;
    color: var(--famd);
    margin-left: 4px;
  }
  .poster-axes {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    max-width: 250px;
    align-self: center;
    margin: 2px 0 var(--sp-xs);
  }
  .pa-row {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
  }
  .pa-other,
  .pa-pole {
    font-size: 13px;
    flex: 0 0 18px;
    text-align: center;
    color: var(--ink-faint);
  }
  .pa-pole {
    color: var(--ink);
    font-weight: 600;
  }
  .pa-track {
    flex: 1;
    height: 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--ink) 8%, transparent);
    position: relative;
    display: flex;
    justify-content: center;
  }
  .pa-fill {
    position: absolute;
    top: 0;
    height: 100%;
    border-radius: 999px;
    background: var(--famd);
    right: 50%;
  }
  .pa-fill.right {
    right: auto;
    left: 50%;
  }

  /* ── 详情(背面)── */
  .fq-detail {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
    width: 100%;
  }
  .fq-real {
    font-size: 12.5px;
    color: var(--ink-muted);
    margin: 0;
    padding: var(--sp-sm) var(--sp-md);
    border-radius: 10px;
    background: color-mix(in srgb, var(--fam) 8%, var(--mist2));
    text-align: center;
  }
  .fq-real.muted {
    color: var(--ink-faint);
  }
  .fq-delta {
    color: var(--ink-faint);
    margin-left: 6px;
  }
  .fq-delta.up {
    color: var(--moss);
  }
  .fq-sec-h {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.06em;
    color: var(--ink-faint);
    margin: 0 0 4px;
  }
  .fq-li {
    font-size: 14px;
    line-height: 1.6;
    color: var(--ink-muted);
    margin: 0;
  }
  .fq-actions {
    display: flex;
    gap: var(--sp-md);
    width: 100%;
    margin-top: auto;
    padding-top: var(--sp-sm);
  }

  /* ── AI 深度解读 ── */
  .fq-ai {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
    padding-top: var(--sp-sm);
    margin-top: 2px;
    border-top: 1px dashed color-mix(in srgb, var(--fam) 40%, var(--hairline));
  }
  .fq-ai-cap {
    font-size: 12px;
    font-weight: 600;
    color: var(--famd);
    margin: 0;
  }
  .fq-ai-sum {
    font-size: 13.5px;
    line-height: 1.6;
    color: var(--ink);
    margin: 0;
  }
  .fq-ai-btn {
    align-self: stretch;
    padding: 11px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--famd, var(--sky-deep)) 55%, transparent);
    background: color-mix(in srgb, var(--fam, var(--sky)) 12%, transparent);
    color: var(--famd, var(--sky-deep));
    font-family: var(--font-rounded);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  }
  .fq-ai-btn:disabled {
    opacity: 0.6;
  }
  .fq-ai-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-md);
    margin-top: 2px;
  }
  .fq-ai-cost {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--ink-ghost);
  }
  .fq-ai-regen {
    margin-left: auto;
    border: 0;
    background: transparent;
    color: var(--famd);
    font-size: 12.5px;
    cursor: pointer;
    padding: 2px 0;
  }
  .fq-ai-err {
    font-size: 12px;
    color: var(--flame);
    margin: 0;
  }
  .fq-btn {
    flex: 1;
    padding: 13px;
    border-radius: 999px;
    border: 1px solid var(--hairline);
    background: transparent;
    color: var(--ink-muted);
    font-family: var(--font-rounded);
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .fq-btn:hover {
    background: var(--mist2);
    color: var(--ink);
  }
  .fq-btn.primary {
    border-color: color-mix(in srgb, var(--famd, var(--sky-deep)) 60%, transparent);
    background: color-mix(in srgb, var(--fam, var(--sky)) 16%, transparent);
    color: var(--famd, var(--sky-deep));
  }
  .fq-btn.primary:hover {
    background: color-mix(in srgb, var(--fam, var(--sky)) 26%, transparent);
  }
</style>
