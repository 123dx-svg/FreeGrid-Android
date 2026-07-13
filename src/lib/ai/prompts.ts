// ============================================================================
// AI 提示词构造 —— 固定指令放最前(每次一致 → 命中前缀缓存,便宜),用户数据放末尾。
// 三个功能:财商结果解读 / 年报致股东的信 / 账单智能导入。
// 只发送必要的最小数据:财商与年报仅发「聚合/派生」信息,绝不发逐笔明细。
// ============================================================================
import type { ChatMessage } from "./llm";

// ── ① 财商结果·个性化解读 ──────────────────────────────────────────────
export interface FqPromptInput {
  name: string; // 人格名,如「热血弄潮儿」
  code: string; // 4 字代号,如「开进即感」
  axes: { label: string; poleChar: string; otherChar: string; leanPct: number }[];
  metrics?: { marginPct: number; passivePct: number } | null; // 可选真实记账聚合(仅当用户允许)
}

const FQ_SYS = [
  "你是「自由日记」App 里的财商人格解读师,风格温暖、具体、生活化、口语,绝不空洞说教。",
  "根据用户的财商人格(4 个维度的倾向)给出个性化解读。只谈个人理财心理与习惯,不做投资荐股、不给具体金融产品建议。",
  "面向中国大陆用户,语言接地气;建议可参照国内常识(应急储备、储蓄率、警惕超前消费/网贷),不套用国外经验。",
  "严格只输出一个 JSON 对象,不要任何多余文字、不要 markdown 代码块。结构:",
  '{"summary":"2-3 句总体画像,点出这类人的鲜明特质",',
  '"strengths":["优势1","优势2","优势3"],',
  '"blindspots":["盲点1","盲点2"],',
  '"advice":["可执行的小建议1","小建议2","小建议3"]}',
  "要求:每条不超过 30 字;结合 4 个维度中最突出的倾向;语气像懂钱的朋友在跟你聊。",
].join("\n");

export function fqMessages(input: FqPromptInput): { messages: ChatMessage[]; cacheKey: string } {
  const axisLines = input.axes
    .map((a) => `${a.label}:偏「${a.poleChar}」(相对「${a.otherChar}」),倾向强度 ${Math.round(a.leanPct * 100)}%`)
    .join(";");
  const metricLine = input.metrics
    ? `\n真实记账参考:储蓄率约 ${input.metrics.marginPct}%、被动收入覆盖日常约 ${input.metrics.passivePct}%。`
    : "";
  // 危机轻触:真实储蓄率为负(入不敷出)时,让建议更偏务实回正,而非长期优化
  const crisisLine =
    input.metrics && input.metrics.marginPct < 0
      ? "\n注意:该用户当前入不敷出(储蓄率为负),建议(advice)请更偏向务实的止血 / 开源 / 先回正,语气稳重支持、不制造焦虑。"
      : "";
  const user = `财商人格:${input.name}(${input.code})。\n四维倾向:${axisLines}。${metricLine}${crisisLine}`;
  const cacheKey = `fq:${input.code}:${input.axes.map((a) => Math.round(a.leanPct * 100)).join("-")}:${input.metrics ? `${input.metrics.marginPct}-${input.metrics.passivePct}` : "x"}`;
  return { messages: [{ role: "system", content: FQ_SYS }, { role: "user", content: user }], cacheKey };
}

export interface FqInterpretation {
  summary: string;
  strengths: string[];
  blindspots: string[];
  advice: string[];
}
export function parseFqInterpretation(raw: string): FqInterpretation | null {
  try {
    const o = JSON.parse(stripFence(raw));
    if (o && typeof o.summary === "string") {
      return {
        summary: String(o.summary),
        strengths: arr(o.strengths),
        blindspots: arr(o.blindspots),
        advice: arr(o.advice),
      };
    }
  } catch {
    /* 忽略 */
  }
  return null;
}

// ── ② 年报·致股东的一封信 ──────────────────────────────────────────────
export interface AnnualPromptInput {
  yearLabel: string; // "2026" 或 "全部"
  income: number;
  expense: number;
  net: number;
  savingRatePct: number;
  topCategories: { name: string; pct: number }[];
  healthScore: number;
  rating: string;
  passivePct: number;
  freedomDays: number | null;
  isQuarter?: boolean; // 季报 = true
  settled?: boolean; // 该周期是否已结束(未结束 → 中期解读)
  liveState?: "free" | "normal" | "warning" | "survival"; // 当前实时财务态(作背景,让展望呼应现实)
  profile?: string; // 可选:用户个人背景摘要(城市/家庭/赡养抚养等,opt-in 才传),用于贴合国情个性化
  assets?: {
    netWorth: number;
    lockedAssets: number;
    cash: number;
    liabilities: number;
    passivePct: number;
    allocation?: { type: string; pct: number; rate?: number }[]; // 资产配置(按类型占比 + 年化收益率)
    debts?: { type: string; amount: number; rate: number }[]; // 负债清单(含年化利率)
  }; // 当前资产快照(综合分析用)
  prev?: { label: string; income: number; expense: number; net: number } | null; // 往期同比(上一年度/季度)
}

// 面向中国用户的通用参照准则(注入各解读人格,不写死任何外部平台/产品)
const CHINA_CONTEXT =
  "面向中国大陆用户:货币为人民币(¥);建议贴合国内常识——应急储备一般建议 3–6 个月必要支出,警惕超前消费、网贷与信用卡分期滚利;可用储蓄率、恩格尔系数等作参照依据(点明依据,别空泛);不照搬国外经验(如 4% 法则在国内利率与通胀下未必适用,若提及需说明);语言接地气、可执行。";

/** 轻量字符串哈希(仅用于 cacheKey 区分不同个人背景,非安全用途)。 */
function shortHash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

type AnnualTone = "crisis" | "caution" | "positive";
/** 按该周期自身数字定调:亏损/见底/健康分低 → 求生;偏紧 → 谨慎;否则 → 正向。 */
function annualTone(input: AnnualPromptInput): AnnualTone {
  if (input.net < 0 || input.freedomDays === 0 || input.healthScore < 40) return "crisis";
  if ((input.freedomDays != null && input.freedomDays > 0 && input.freedomDays < 30) || input.savingRatePct < 10)
    return "caution";
  return "positive";
}

export function annualMessages(input: AnnualPromptInput): { messages: ChatMessage[]; cacheKey: string } {
  const period = input.isQuarter ? "季度" : "年度";
  const ongoing = input.settled === false;
  const tone = annualTone(input);
  const ongoingLine = ongoing
    ? `注意:这个${period}尚未结束,数据只到目前为止,请以"本${period}至今"的口吻写。`
    : `根据我提供的这个${period}聚合财务数据 + 当前资产 + 往期同比来写。`;

  // 共用体例:董事会致辞口吻 + 分条 + 表扬与建议平衡 + 综合(收支/资产/同比)+ 控篇幅
  const FORMAT = [
    "体例:开头一句固定用「尊敬的董事长,您的公司本" + period + "……」称呼(把用户当成「人生这家公司」的董事长),亲切而专业。",
    "然后用 3~5 条要点,每条一行、以「· 」开头、一句话讲清:",
    "① 综合经营(营收/成本/结余,结合当前资产:净值=资产+现金−负债、被动收入覆盖);② 同比往期(较上一" + period + "增/减多少、变好还是变差);③ 亮点表扬(做得好的地方要真诚点名鼓励,别只挑毛病);④ 一两条克制的改进建议(点到为止,给依据)。",
    "最后一句收尾寄语。全文不超过 320 字,分条清晰、一目了然。",
    "只谈个人收支与理财习惯,不荐股、不推销任何金融产品。输出纯文本,不要 markdown / 标题符号 / 表格。",
  ].join("\n");

  let toneLine: string;
  if (tone === "crisis") {
    toneLine =
      "本" + period + "入不敷出 / 净值承压:如实点破,但先肯定用户仍在坚持记账等可取之处;建议聚焦止血、开源、理清债务优先级;稳重、支持、不制造焦虑。";
  } else if (tone === "caution") {
    toneLine = "本" + period + "财务偏紧(结余薄 / 跑道变短):温和提醒,先表扬亮点,再给增厚结余的务实建议。";
  } else {
    toneLine = "本" + period + "经营稳健:多一些真诚的肯定与鼓励,改进建议点到为止。";
  }

  let sys = [`你是「自由日记」App 的${period}财务主笔,为用户写一份《${period}经营解读》。`, ongoingLine, toneLine, FORMAT].join("\n");

  const cats = input.topCategories.map((c) => `${c.name} ${c.pct}%`).join("、");
  const freedom = input.freedomDays == null ? "未知" : input.freedomDays >= 3650 ? "已接近财务自由" : `约 ${input.freedomDays} 天`;
  sys += "\n" + CHINA_CONTEXT;
  if (input.profile) sys += "\n请结合用户的个人背景(见下)给出更贴合其处境的建议,但不要在正文里复述这些隐私信息。";
  const liveBg =
    input.liveState === "survival"
      ? "\n补充背景:用户此刻的实时净值已见底(求生中),结尾寄语请呼应这一现实,别写得像高枕无忧。"
      : input.liveState === "warning"
        ? "\n补充背景:用户此刻的自由跑道已很短(临界),寄语里可温和提示。"
        : "";

  const a = input.assets;
  const assetLine = a
    ? `当前资产:净值 ¥${Math.round(a.netWorth)}(资产 ¥${Math.round(a.lockedAssets)} + 现金 ¥${Math.round(a.cash)} − 负债 ¥${Math.round(a.liabilities)});被动收入覆盖日常 ${a.passivePct}%`
    : `被动收入覆盖日常 ${input.passivePct}%`;
  const allocLine =
    a?.allocation && a.allocation.length
      ? `资产配置:${a.allocation.map((x) => `${x.type} ${x.pct}%${x.rate ? `(年化${x.rate}%)` : ""}`).join("、")}`
      : "";
  const debtLine =
    a?.debts && a.debts.length
      ? `负债清单:${a.debts.map((d) => `${d.type} ¥${Math.round(d.amount)}${d.rate > 0 ? ` @年化${d.rate}%` : ""}`).join("、")}`
      : "";
  const prevLine = input.prev
    ? `往期同比(上一${period} ${input.prev.label}):收入 ¥${Math.round(input.prev.income)}、支出 ¥${Math.round(input.prev.expense)}、结余 ¥${Math.round(input.prev.net)}`
    : "往期同比:暂无上一期数据(首期,不必强行同比)";

  // 有配置/负债明细 → 提示 AI 顺带点评资产配置(集中度/流动性)与高息负债优先偿还
  if (allocLine || debtLine) {
    sys +=
      "\n用户提供了资产配置与负债明细:可在要点里顺带点评①资产配置是否过度集中/流动性是否够(若给了各类年化收益率,可点评配置效率、低收益占比是否过高);②若有负债,优先建议先还年化利率最高的那笔(高息负债雪崩法),低息长期负债(如房贷)不必急于提前还。";
  }

  const user =
    [
      `周期:${input.yearLabel}${ongoing ? "(尚未结束)" : ""}`,
      `本期:总收入 ¥${Math.round(input.income)}、总支出 ¥${Math.round(input.expense)}、结余 ¥${Math.round(input.net)}、储蓄率 ${input.savingRatePct}%`,
      `主要支出:${cats || "暂无"}`,
      `经营健康分 ${input.healthScore}/100(评级 ${input.rating}),自由天数 ${freedom}`,
      assetLine,
      allocLine,
      debtLine,
      prevLine,
    ]
      .filter(Boolean)
      .join("\n") +
    liveBg +
    (input.profile ? `\n个人背景:${input.profile}` : "");

  const allocSig = a?.allocation?.length ? a.allocation.map((x) => `${x.type}${x.pct}-${x.rate ?? 0}`).join(",") : "x";
  const debtSig = a?.debts?.length ? a.debts.map((d) => `${d.type}${Math.round(d.amount / 1000)}@${d.rate}`).join(",") : "x";
  const assetSig = a ? `${Math.round(a.netWorth / 1000)}-${a.passivePct}-${allocSig}-${debtSig}` : "x";
  const prevSig = input.prev ? `${Math.round(input.prev.net / 1000)}` : "x";
  const cacheKey = `annual2:${input.yearLabel}:${Math.round(input.income)}:${Math.round(input.expense)}:${input.healthScore}:${tone}:${input.liveState ?? "x"}:${shortHash(assetSig)}:${prevSig}:${input.profile ? shortHash(input.profile) : "x"}`;
  return { messages: [{ role: "system", content: sys }, { role: "user", content: user }], cacheKey };
}

// ── ③ 账单智能导入(JSON) ─────────────────────────────────────────────
export function importMessages(rawBill: string, categories: readonly string[], incomeSources: readonly string[] = []): ChatMessage[] {
  const cats = categories.join(" / ");
  const sys = [
    "你是记账数据转换助手。把用户提供的账单(任意格式:微信/支付宝导出、CSV、聊天记录、表格文本)转换成严格 JSON。",
    "只输出一个 JSON 对象,不要任何解释、不要 markdown。结构:",
    '{"transactions":[{"type":"expense|income","amount":正数,"date":"YYYY-MM-DD","category":"支出分类","source":"收入来源","note":"备注","passive":true|false}]}',
    "规则:支出填 category、收入填 source;amount 为正数不带符号;无法解析金额或日期的行跳过;利息/分红/租金等被动收入 passive=true。",
    `支出 category 尽量从这些里选最接近的:${cats};拿不准填「其他」。`,
    "车险/寿险/意外险/医疗险等各类保险归「保险」,不要并进「交通」;「交通」只放地铁/公交/打车/高铁/机票等公共出行。",
    ...(incomeSources.length
      ? [`收入 source 必须从这些里选最接近的一个(同义合并,如「工作收入/薪水」都归「工资」):${incomeSources.join(" / ")};拿不准填「其他」。`]
      : []),
  ].join("\n");
  return [
    { role: "system", content: sys },
    { role: "user", content: `请转换下面的账单数据:\n${rawBill}` },
  ];
}

// ── 小工具 ──
function stripFence(s: string): string {
  return s
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}
function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()) : [];
}
export { stripFence };
