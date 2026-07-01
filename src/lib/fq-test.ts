// ============================================================================
// 财商人格测试(仿 MBTI)—— 50 题 · 4 维 · 16 型 · 财商分(问卷+真实数据)
// 纯本地、零网络、零依赖。类型纯看问卷;财商分 = 问卷分 + 真实记账数据(自适应权重)。
// ============================================================================

export type AxisKey = "income" | "risk" | "time" | "decision";

// 每维两极(单字代号),代号顺序固定 income→risk→time→decision
export const AXES: { key: AxisKey; label: string; A: string; B: string; aDesc: string; bDesc: string }[] = [
  { key: "income", label: "收入观", A: "开", B: "省", aDesc: "开源搞钱", bDesc: "节流守财" },
  { key: "risk", label: "风险观", A: "进", B: "稳", aDesc: "进取冒险", bDesc: "稳健保守" },
  { key: "time", label: "时间观", A: "即", B: "远", aDesc: "即时享受", bDesc: "延迟长期" },
  { key: "decision", label: "决策观", A: "感", B: "研", aDesc: "直觉感性", bDesc: "数据理性" },
];

export interface FqOption {
  label: string;
  axis: AxisKey;
  pole: "A" | "B";
  fq: 0 | 1 | 2; // 财商权重:该选项体现的理财常识/好习惯
}
export interface FqQuestion {
  text: string;
  options: FqOption[];
}

// ── 50 题(场景化短题)──
export const QUESTIONS: FqQuestion[] = [
  { text: "发了这个月工资,你第一反应是?", options: [
    { label: "先还款/转一笔进存钱账户", axis: "time", pole: "B", fq: 2 },
    { label: "犒劳自己,买点早想要的", axis: "time", pole: "A", fq: 0 },
  ]},
  { text: "朋友说有只股票“稳赚不亏”,你?", options: [
    { label: "先查财报和逻辑再说", axis: "decision", pole: "B", fq: 2 },
    { label: "小赌一把,机会难得", axis: "risk", pole: "A", fq: 0 },
    { label: "不懂的不碰", axis: "risk", pole: "B", fq: 2 },
  ]},
  { text: "现在拿 1 万,vs 一年后拿 1.2 万,你选?", options: [
    { label: "现在就要,落袋为安", axis: "time", pole: "A", fq: 1 },
    { label: "等一年,多 20% 香", axis: "time", pole: "B", fq: 2 },
  ]},
  { text: "对“记账”这件事,你?", options: [
    { label: "每笔都记,心里有数", axis: "decision", pole: "B", fq: 2 },
    { label: "大概知道就行,懒得记", axis: "decision", pole: "A", fq: 0 },
  ]},
  { text: "更想提升哪一项?", options: [
    { label: "多搞几条收入路子", axis: "income", pole: "A", fq: 1 },
    { label: "把没必要的开销砍掉", axis: "income", pole: "B", fq: 1 },
  ]},
  { text: "看到“双11”满减,你?", options: [
    { label: "凑单买齐,省到就是赚到", axis: "time", pole: "A", fq: 0 },
    { label: "只买原本就要买的", axis: "time", pole: "B", fq: 2 },
  ]},
  { text: "手头有 5 万闲钱,你倾向?", options: [
    { label: "找高收益的标的搏一把", axis: "risk", pole: "A", fq: 1 },
    { label: "稳一点,保本最重要", axis: "risk", pole: "B", fq: 1 },
  ]},
  { text: "做财务决定,你更信?", options: [
    { label: "数据和测算", axis: "decision", pole: "B", fq: 2 },
    { label: "感觉和直觉", axis: "decision", pole: "A", fq: 0 },
  ]},
  { text: "你更认同哪句?", options: [
    { label: "钱是赚出来的", axis: "income", pole: "A", fq: 1 },
    { label: "钱是省出来的", axis: "income", pole: "B", fq: 1 },
  ]},
  { text: "信用卡账单出来了,你?", options: [
    { label: "全额还清,绝不分期", axis: "decision", pole: "B", fq: 2 },
    { label: "先还最低,周转一下", axis: "time", pole: "A", fq: 0 },
  ]},
  { text: "朋友约一场说走就走的旅行,预算超支,你?", options: [
    { label: "去!快乐无价", axis: "time", pole: "A", fq: 0 },
    { label: "缓缓,等有预算再说", axis: "time", pole: "B", fq: 2 },
  ]},
  { text: "对“副业”你的态度?", options: [
    { label: "能搞就搞,多多益善", axis: "income", pole: "A", fq: 2 },
    { label: "主业稳住就行,不折腾", axis: "income", pole: "B", fq: 1 },
  ]},
  { text: "买大件前,你?", options: [
    { label: "比价、看测评、列清单", axis: "decision", pole: "B", fq: 2 },
    { label: "看对眼直接下单", axis: "decision", pole: "A", fq: 0 },
  ]},
  { text: "一笔投资浮亏 20%,你?", options: [
    { label: "按计划止损或补仓,不慌", axis: "decision", pole: "B", fq: 2 },
    { label: "心态崩了,凭感觉操作", axis: "decision", pole: "A", fq: 0 },
  ]},
  { text: "更向往哪种状态?", options: [
    { label: "收入不断往上冲", axis: "income", pole: "A", fq: 1 },
    { label: "开销低、活得自在", axis: "income", pole: "B", fq: 1 },
  ]},
  { text: "对“负债”的看法?", options: [
    { label: "合理杠杆能加速财富", axis: "risk", pole: "A", fq: 1 },
    { label: "无债一身轻,能不借就不借", axis: "risk", pole: "B", fq: 1 },
  ]},
  { text: "发现一个新风口,你?", options: [
    { label: "先冲进去再说,怕错过", axis: "risk", pole: "A", fq: 0 },
    { label: "观望研究,看明白再上", axis: "decision", pole: "B", fq: 2 },
  ]},
  { text: "每月结余,你?", options: [
    { label: "先存/投,剩下才花", axis: "time", pole: "B", fq: 2 },
    { label: "先花,剩下才存", axis: "time", pole: "A", fq: 0 },
  ]},
  { text: "你更愿意为哪个花钱?", options: [
    { label: "体验和当下的快乐", axis: "time", pole: "A", fq: 1 },
    { label: "能升值/有回报的东西", axis: "time", pole: "B", fq: 2 },
  ]},
  { text: "对自己的资产状况,你?", options: [
    { label: "净值/负债大概都清楚", axis: "decision", pole: "B", fq: 2 },
    { label: "没细算过,糊里糊涂", axis: "decision", pole: "A", fq: 0 },
  ]},
  { text: "理想的搞钱方式?", options: [
    { label: "多线出击,机会全抓", axis: "income", pole: "A", fq: 1 },
    { label: "守好一亩三分地", axis: "income", pole: "B", fq: 1 },
  ]},
  { text: "面对高波动高收益的机会?", options: [
    { label: "敢上,富贵险中求", axis: "risk", pole: "A", fq: 1 },
    { label: "睡得着觉最重要", axis: "risk", pole: "B", fq: 1 },
  ]},
  { text: "你的消费节奏?", options: [
    { label: "想买就买,及时行乐", axis: "time", pole: "A", fq: 0 },
    { label: "计划着来,延迟满足", axis: "time", pole: "B", fq: 2 },
  ]},
  { text: "选基金/理财产品,你看?", options: [
    { label: "历史收益、回撤、费率", axis: "decision", pole: "B", fq: 2 },
    { label: "名字顺眼、别人推荐", axis: "decision", pole: "A", fq: 0 },
  ]},
  { text: "如果中了 50 万,你?", options: [
    { label: "想着怎么钱生钱", axis: "income", pole: "A", fq: 2 },
    { label: "先存银行,安心", axis: "risk", pole: "B", fq: 1 },
  ]},
  { text: "对“及时享乐 vs 攒钱”?", options: [
    { label: "人生苦短,先享受", axis: "time", pole: "A", fq: 0 },
    { label: "苦尽甘来,先攒着", axis: "time", pole: "B", fq: 2 },
  ]},
  { text: "买股票/基金亏了,你常?", options: [
    { label: "复盘哪步错了", axis: "decision", pole: "B", fq: 2 },
    { label: "怪运气不好", axis: "decision", pole: "A", fq: 0 },
  ]},
  { text: "更想成为?", options: [
    { label: "能不断开拓收入的人", axis: "income", pole: "A", fq: 1 },
    { label: "把钱守得住的人", axis: "income", pole: "B", fq: 1 },
  ]},
  { text: "朋友拉你合伙创业,你?", options: [
    { label: "心动,搏一把", axis: "risk", pole: "A", fq: 1 },
    { label: "先评估风险再决定", axis: "decision", pole: "B", fq: 2 },
  ]},
  { text: "看到限量款,你?", options: [
    { label: "立刻冲,晚了就没", axis: "time", pole: "A", fq: 0 },
    { label: "冷静想想用不用得上", axis: "time", pole: "B", fq: 2 },
  ]},
  { text: "对“被动收入”?", options: [
    { label: "梦想,正在努力搭建", axis: "income", pole: "A", fq: 2 },
    { label: "听过,没具体行动", axis: "income", pole: "B", fq: 0 },
  ]},
  { text: "做预算这件事?", options: [
    { label: "有清晰的月度预算", axis: "decision", pole: "B", fq: 2 },
    { label: "走一步看一步", axis: "decision", pole: "A", fq: 0 },
  ]},
  { text: "更怕哪一种?", options: [
    { label: "错过暴富的机会", axis: "risk", pole: "A", fq: 0 },
    { label: "本金亏掉", axis: "risk", pole: "B", fq: 1 },
  ]},
  { text: "工资到账,你的钱?", options: [
    { label: "分门别类各就各位", axis: "decision", pole: "B", fq: 2 },
    { label: "放一个账户随便花", axis: "decision", pole: "A", fq: 0 },
  ]},
  { text: "你更看重?", options: [
    { label: "今天过得爽", axis: "time", pole: "A", fq: 0 },
    { label: "十年后的自己", axis: "time", pole: "B", fq: 2 },
  ]},
  { text: "想增加收入,你会先?", options: [
    { label: "学新技能/拓新业务", axis: "income", pole: "A", fq: 2 },
    { label: "先把开销压下来", axis: "income", pole: "B", fq: 1 },
  ]},
  { text: "对“鸡蛋别放一个篮子”?", options: [
    { label: "深以为然,分散配置", axis: "decision", pole: "B", fq: 2 },
    { label: "看好一个就重仓", axis: "risk", pole: "A", fq: 0 },
  ]},
  { text: "购物车里的东西,你常?", options: [
    { label: "放几天,不冲动就删", axis: "time", pole: "B", fq: 2 },
    { label: "看到就忍不住结账", axis: "time", pole: "A", fq: 0 },
  ]},
  { text: "对“通货膨胀”你?", options: [
    { label: "懂,会想办法跑赢它", axis: "decision", pole: "B", fq: 2 },
    { label: "听过,没太在意", axis: "decision", pole: "A", fq: 0 },
  ]},
  { text: "更愿意把时间花在?", options: [
    { label: "找新的赚钱机会", axis: "income", pole: "A", fq: 1 },
    { label: "优化现有的花销", axis: "income", pole: "B", fq: 1 },
  ]},
  { text: "面对一个没把握的高回报?", options: [
    { label: "拿能输得起的钱试", axis: "risk", pole: "A", fq: 2 },
    { label: "再香也不碰", axis: "risk", pole: "B", fq: 1 },
  ]},
  { text: "你的“快乐消费”频率?", options: [
    { label: "经常,生活要有滋味", axis: "time", pole: "A", fq: 1 },
    { label: "克制,攒着办大事", axis: "time", pole: "B", fq: 2 },
  ]},
  { text: "决定要不要买房/大额时?", options: [
    { label: "算清月供、收入比、风险", axis: "decision", pole: "B", fq: 2 },
    { label: "差不多就拍板", axis: "decision", pole: "A", fq: 0 },
  ]},
  { text: "你心中的“有钱”是?", options: [
    { label: "赚得多、来钱快", axis: "income", pole: "A", fq: 1 },
    { label: "花得少、存得住", axis: "income", pole: "B", fq: 1 },
  ]},
  { text: "牛市来了人人都赚,你?", options: [
    { label: "加仓跟上,别踏空", axis: "risk", pole: "A", fq: 0 },
    { label: "警惕泡沫,留一手", axis: "risk", pole: "B", fq: 2 },
  ]},
  { text: "对未来的钱,你?", options: [
    { label: "活在当下,未来再说", axis: "time", pole: "A", fq: 0 },
    { label: "有长期规划和目标", axis: "time", pole: "B", fq: 2 },
  ]},
  { text: "理财知识,你?", options: [
    { label: "会主动学,看书/课程", axis: "decision", pole: "B", fq: 2 },
    { label: "用到再说,没系统学", axis: "decision", pole: "A", fq: 0 },
  ]},
  { text: "如果创业失败欠了债?", options: [
    { label: "再战,风浪越大鱼越贵", axis: "risk", pole: "A", fq: 1 },
    { label: "先求稳,慢慢还", axis: "risk", pole: "B", fq: 1 },
  ]},
  { text: "你更想要哪种自由?", options: [
    { label: "现在就能随便花的自由", axis: "time", pole: "A", fq: 0 },
    { label: "以后不上班也饿不死的自由", axis: "time", pole: "B", fq: 2 },
  ]},
  { text: "对自己的财商,你?", options: [
    { label: "清楚短板,在补课", axis: "decision", pole: "B", fq: 2 },
    { label: "没怎么想过", axis: "decision", pole: "A", fq: 0 },
  ]},
];

// ── 16 型名 + 金句(代号 income+risk+time+decision)──
const TYPE_NAME: Record<string, string> = {
  开进即感: "热血弄潮儿", 开进即研: "精算冒险家", 开进远感: "远征猎手", 开进远研: "增长操盘手",
  开稳即感: "乐活搞钱族", 开稳即研: "务实多面手", 开稳远感: "稳健开拓者", 开稳远研: "复利建筑师",
  省进即感: "矛盾省钱家", 省进即研: "精算赌徒", 省进远感: "苦行投资客", 省进远研: "价值狙击手",
  省稳即感: "知足常乐派", 省稳即研: "精算生活家", 省稳远感: "龟速存钱罐", 省稳远研: "精算守财人",
};
const TYPE_TAG: Record<string, string> = {
  开进即感: "钱要赚得猛,也要花得爽", 开进即研: "敢冲,但每一步都算过账", 开进远感: "为了大目标,什么都敢闯", 开进远研: "把人生当成一盘增长的棋",
  开稳即感: "搞钱不耽误享受生活", 开稳即研: "稳扎稳打,多点开花", 开稳远感: "一步一个脚印往前拓", 开稳远研: "时间和复利是我的朋友",
  省进即感: "嘴上说省,手却很诚实", 省进即研: "抠门归抠门,该赌也敢赌", 省进远感: "苦自己,搏一个未来", 省进远研: "只在看懂的地方下重注",
  省稳即感: "钱够花就好,知足常乐", 省稳即研: "把小日子过成精算题", 省稳远感: "慢慢攒,稳稳的幸福", 省稳远研: "精打细算,守住每一分",
};

// ── 各维“极”的描述块(组合生成结果文案)──
const POLE_TEXT: Record<string, { strength: string; blind: string; tip: string }> = {
  开: { strength: "搞钱嗅觉敏锐,愿意主动开拓收入", blind: "容易摊子铺太大、精力分散", tip: "聚焦最赚钱的一两条线,别什么都想抓" },
  省: { strength: "成本意识强,守得住钱包", blind: "可能省过头,错过该花的投资", tip: "在成长/健康上,该花的别抠" },
  进: { strength: "敢于把握机会、承担风险", blind: "容易上头追高、忽视风险", tip: "永远只用‘输得起’的钱去冒险" },
  稳: { strength: "风险意识好,本金守得稳", blind: "可能太保守,跑不赢通胀", tip: "留足安全垫后,拿一小部分去成长" },
  即: { strength: "懂得享受当下、生活有滋味", blind: "即时消费多,攒钱慢", tip: "试试‘先存后花’,给未来留一笔" },
  远: { strength: "长期规划强,延迟满足做得好", blind: "可能太克制,错过当下的快乐", tip: "给当下也留点预算,别只为未来活" },
  感: { strength: "决策果断、行动力强", blind: "凭感觉容易踩坑、缺复盘", tip: "大额决定前,强制自己算一遍账" },
  研: { strength: "理性、爱研究、决策有据", blind: "可能分析过度、迟迟不行动", tip: "想清楚就出手,别被分析瘫痪" },
};

// 各极人群占比(用于估算稀有度;每维两极相加=1)
const POLE_SHARE: Record<string, number> = {
  开: 0.45, 省: 0.55,
  进: 0.40, 稳: 0.60,
  即: 0.56, 远: 0.44,
  感: 0.58, 研: 0.42,
};

// ── 段位(轻松诙谐)──
function tierOf(fq: number): string {
  if (fq < 35) return "钱包黑洞";
  if (fq < 50) return "省钱萌新";
  if (fq < 62) return "记账小学生";
  if (fq < 74) return "理财明白人";
  if (fq < 86) return "钱生钱老手";
  return "财务自由候选人";
}

export interface AxisLean {
  key: AxisKey;
  label: string;
  pole: "A" | "B";
  poleChar: string;
  otherChar: string;
  leanPct: number; // 该极的倾向 0.5–1
}

export interface FqStored {
  code: string;
  name: string;
  q: number; // 问卷财商分(0-100)
  leans: { key: AxisKey; pole: "A" | "B"; leanPct: number }[];
  date: string;
}

export interface FqResult {
  code: string;
  name: string;
  tagline: string;
  axes: AxisLean[];
  q: number; // 问卷分
  fqFinal: number; // 终分(并入真实数据)
  tier: string;
  rarityPct: number;
  usedReal: boolean; // 是否并入了真实数据
  realDelta: number; // 终分 − 问卷分(成长/落差)
  strengths: string[];
  blindspots: string[];
  tip: string;
  date: string;
}

const axisChar = (key: AxisKey, pole: "A" | "B") => {
  const a = AXES.find((x) => x.key === key)!;
  return pole === "A" ? a.A : a.B;
};

/** 由答案(每题选中的 option 下标)算出问卷部分:代号 / 倾向 / 问卷财商分 */
export function scoreAnswers(answers: number[]): {
  code: string;
  leans: { key: AxisKey; pole: "A" | "B"; leanPct: number }[];
  q: number;
} {
  const tally: Record<AxisKey, { A: number; B: number }> = {
    income: { A: 0, B: 0 },
    risk: { A: 0, B: 0 },
    time: { A: 0, B: 0 },
    decision: { A: 0, B: 0 },
  };
  let fqSum = 0;
  let answered = 0;
  answers.forEach((choice, i) => {
    const q = QUESTIONS[i];
    if (!q || choice == null || choice < 0 || choice >= q.options.length) return;
    const opt = q.options[choice];
    tally[opt.axis][opt.pole] += 1;
    fqSum += opt.fq;
    answered += 1;
  });
  const leans = AXES.map((ax) => {
    const t = tally[ax.key];
    const totalA = t.A,
      totalB = t.B;
    const sum = totalA + totalB || 1;
    const pole: "A" | "B" = totalA >= totalB ? "A" : "B";
    const leanPct = Math.max(totalA, totalB) / sum;
    return { key: ax.key, pole, leanPct };
  });
  const code = leans.map((l) => axisChar(l.key, l.pole)).join("");
  // 问卷财商分:已答题的 fq 占满分比例 → 0-100
  const q = answered > 0 ? Math.round((fqSum / (answered * 2)) * 100) : 0;
  return { code, leans, q };
}

/** 真实记账数据财商分 + 置信度(数据越久越可信)。无数据返回 null。 */
export function realFqScore(m: {
  margin: number;
  fiProgress: number;
  freedomDays: number;
  trackDays: number;
  hasData: boolean;
}): { score: number; conf: number } | null {
  if (!m.hasData) return null;
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
  const sSave = clamp01(m.margin / 0.5) * 40;
  const sPassive = clamp01(m.fiProgress) * 25;
  const sRun = clamp01((Number.isFinite(m.freedomDays) ? m.freedomDays : 1e9) / 3650) * 20;
  const sHabit = clamp01(m.trackDays / 90) * 15;
  const score = Math.round(sSave + sPassive + sRun + sHabit);
  const conf = clamp01(m.trackDays / 60); // 记账 60 天 → 满置信
  return { score, conf };
}

export function rarityOf(code: string): number {
  let p = 1;
  for (const ch of code) p *= POLE_SHARE[ch] ?? 0.5;
  return p * 100; // 估算占比 %
}

// ── 家族色(按「收入×风险」四象限)──
// 颜色承载含义:同族同色,跨族区分。key = code[0]+code[1]。
export type Family = {
  key: string;
  label: string;
  base: string; // 主色
  deep: string; // 深色(描边/文字)
  soft: string; // 柔光底(半透明用)
};
const FAMILIES: Record<string, Family> = {
  开进: { key: "开进", label: "激进增长", base: "#F2704B", deep: "#C4471F", soft: "#F2704B" }, // 焰橙红
  开稳: { key: "开稳", label: "稳健增长", base: "#5FBE7E", deep: "#2F8C52", soft: "#5FBE7E" }, // 生长绿
  省进: { key: "省进", label: "精算搏击", base: "#9B7BE0", deep: "#6D4CBE", soft: "#9B7BE0" }, // 靛紫
  省稳: { key: "省稳", label: "安稳存钱", base: "#4FB4D8", deep: "#2A85AC", soft: "#4FB4D8" }, // 青蓝
};
export function familyOf(code: string): Family {
  const key = (code[0] ?? "开") + (code[1] ?? "稳");
  return FAMILIES[key] ?? FAMILIES["开稳"];
}

// ── 稀有度分级(卡牌宝石)──
export type RarityBand = { tier: string; color: string; stars: number };
export function rarityBand(pct: number): RarityBand {
  if (pct < 5) return { tier: "传说", color: "#E9B949", stars: 4 }; // 金
  if (pct < 10) return { tier: "史诗", color: "#B06FE0", stars: 3 }; // 紫
  if (pct < 18) return { tier: "稀有", color: "#4FB4D8", stars: 2 }; // 蓝
  return { tier: "常见", color: "#8A96A3", stars: 1 }; // 灰
}

/** 组合出完整结果(可带真实数据指标)。 */
export function buildResult(
  answers: number[],
  metrics?: { margin: number; fiProgress: number; freedomDays: number; trackDays: number; hasData: boolean } | null,
  date = new Date().toISOString()
): FqResult {
  const { code, leans, q } = scoreAnswers(answers);
  return composeResult({ code, name: TYPE_NAME[code] ?? code, q, leans, date }, metrics);
}

/** 由已存结果 + 当前真实指标 → 实时组合(财商分随记账更新)。 */
export function composeResult(
  stored: FqStored,
  metrics?: { margin: number; fiProgress: number; freedomDays: number; trackDays: number; hasData: boolean } | null
): FqResult {
  const { code, q, leans } = stored;
  const real = metrics ? realFqScore(metrics) : null;
  let fqFinal = q;
  let usedReal = false;
  if (real) {
    const w = 0.4 * real.conf; // 真实数据权重随置信度
    fqFinal = Math.round(q * (1 - w) + real.score * w);
    usedReal = w > 0.02;
  }
  const axes: AxisLean[] = leans.map((l) => {
    const ax = AXES.find((x) => x.key === l.key)!;
    return {
      key: l.key,
      label: ax.label,
      pole: l.pole,
      poleChar: axisChar(l.key, l.pole),
      otherChar: axisChar(l.key, l.pole === "A" ? "B" : "A"),
      leanPct: l.leanPct,
    };
  });
  // 描述:取倾向最强的两维做优势/盲点,加一句 tip
  const sorted = [...axes].sort((a, b) => b.leanPct - a.leanPct);
  const strengths = sorted.slice(0, 2).map((a) => POLE_TEXT[a.poleChar].strength);
  const blindspots = sorted.slice(0, 2).map((a) => POLE_TEXT[a.poleChar].blind);
  const tip = POLE_TEXT[sorted[0].poleChar].tip;
  return {
    code,
    name: TYPE_NAME[code] ?? code,
    tagline: TYPE_TAG[code] ?? "你的财商人格,独一无二",
    axes,
    q,
    fqFinal,
    tier: tierOf(fqFinal),
    rarityPct: rarityOf(code),
    usedReal,
    realDelta: fqFinal - q,
    strengths,
    blindspots,
    tip,
    date: stored.date,
  };
}

// ── 本地持久化(单独 key,不进财务备份)──
const FQ_KEY = "freegrid-fq-v1";
export function saveFqResult(stored: FqStored) {
  try {
    localStorage.setItem(FQ_KEY, JSON.stringify(stored));
  } catch {
    /* 忽略 */
  }
}
export function loadFqResult(): FqStored | null {
  try {
    const raw = localStorage.getItem(FQ_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (o && typeof o.code === "string" && Array.isArray(o.leans)) return o as FqStored;
  } catch {
    /* 忽略 */
  }
  return null;
}
export function clearFqResult() {
  try {
    localStorage.removeItem(FQ_KEY);
  } catch {
    /* 忽略 */
  }
}
