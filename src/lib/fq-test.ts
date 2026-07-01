// ============================================================================
// 财商人格测试(仿 MBTI)—— 题库 120 题,每次按维度分层随机抽 50 题 · 每题 3 选项(含行为学题) · 4 维 · 16 型 · 财商分
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

// ── 题库(生活化场景 · 每题 3 选项 · 含行为学题;每次随机抽 50 题)──
export const QUESTIONS: FqQuestion[] = [
  // —— 收入观:开 / 省 ——
  { text: "一笔计划外的钱到手(奖金、红包),你更想?", options: [
    { label: "拿去钱生钱,开条新财路", axis: "income", pole: "A", fq: 2 },
    { label: "存起来,落袋为安", axis: "income", pole: "B", fq: 1 },
    { label: "留一部分,拿一点试试搞钱", axis: "income", pole: "A", fq: 1 },
  ]},
  { text: "你更认同哪句话?", options: [
    { label: "钱是赚出来的", axis: "income", pole: "A", fq: 1 },
    { label: "钱是省出来的", axis: "income", pole: "B", fq: 1 },
    { label: "边赚边省才踏实", axis: "income", pole: "B", fq: 1 },
  ]},
  { text: "对搞点副业、赚点外快,你?", options: [
    { label: "能搞就搞,多条腿走路", axis: "income", pole: "A", fq: 2 },
    { label: "主业稳住就行,不折腾", axis: "income", pole: "B", fq: 1 },
    { label: "有合适的机会才做", axis: "income", pole: "A", fq: 1 },
  ]},
  { text: "想让手头宽裕点,你会先?", options: [
    { label: "琢磨怎么多赚一笔", axis: "income", pole: "A", fq: 2 },
    { label: "把没必要的开销砍掉", axis: "income", pole: "B", fq: 1 },
    { label: "翻翻账,看看钱漏在哪", axis: "income", pole: "B", fq: 2 },
  ]},
  { text: "对“睡后收入”(钱替你干活),你?", options: [
    { label: "正在攒、正在搭,想让钱生钱", axis: "income", pole: "A", fq: 2 },
    { label: "听过,还没具体行动", axis: "income", pole: "B", fq: 0 },
    { label: "有一点点(利息、分红),想再多些", axis: "income", pole: "A", fq: 1 },
  ]},
  { text: "你心里的“有钱”更像?", options: [
    { label: "赚得多、来钱快", axis: "income", pole: "A", fq: 1 },
    { label: "花得少、存得住", axis: "income", pole: "B", fq: 1 },
    { label: "不用为钱操心就行", axis: "income", pole: "B", fq: 1 },
  ]},
  { text: "更想成为哪种人?", options: [
    { label: "不断开拓新收入的人", axis: "income", pole: "A", fq: 1 },
    { label: "把钱牢牢守住的人", axis: "income", pole: "B", fq: 1 },
    { label: "既能赚、也守得住的人", axis: "income", pole: "A", fq: 2 },
  ]},
  { text: "突然多出一整天空闲,你更可能?", options: [
    { label: "研究个搞钱的路子", axis: "income", pole: "A", fq: 1 },
    { label: "在家待着,省钱又省心", axis: "income", pole: "B", fq: 1 },
    { label: "学点将来能变现的东西", axis: "income", pole: "A", fq: 2 },
  ]},
  { text: "对“开源”和“节流”,你更擅长?", options: [
    { label: "开源,脑子里总有赚钱点子", axis: "income", pole: "A", fq: 1 },
    { label: "节流,很能控制开销", axis: "income", pole: "B", fq: 1 },
    { label: "都一般,还在学", axis: "income", pole: "B", fq: 0 },
  ]},
  { text: "月底钱紧了,你第一反应?", options: [
    { label: "想办法这个月多进点钱", axis: "income", pole: "A", fq: 2 },
    { label: "下个月省着点花", axis: "income", pole: "B", fq: 1 },
    { label: "翻账砍掉没用的订阅、开销", axis: "income", pole: "B", fq: 2 },
  ]},
  { text: "理想的搞钱方式?", options: [
    { label: "多线出击,机会都想抓", axis: "income", pole: "A", fq: 1 },
    { label: "守好一亩三分地", axis: "income", pole: "B", fq: 1 },
    { label: "先做精一条,再慢慢加", axis: "income", pole: "A", fq: 2 },
  ]},

  // —— 风险观:进 / 稳(含行为学:从众追高 / 泡沫 / 高息陷阱)——
  { text: "手头有 5 万闲钱,你倾向?", options: [
    { label: "找个高收益的搏一把", axis: "risk", pole: "A", fq: 1 },
    { label: "稳一点,保本最重要", axis: "risk", pole: "B", fq: 1 },
    { label: "大部分求稳,小部分博高", axis: "risk", pole: "B", fq: 2 },
  ]},
  { text: "面对“高波动、可能高收益”的机会?", options: [
    { label: "敢上,富贵险中求", axis: "risk", pole: "A", fq: 1 },
    { label: "睡得着觉最重要,不碰", axis: "risk", pole: "B", fq: 1 },
    { label: "只拿输得起的钱试试", axis: "risk", pole: "A", fq: 2 },
  ]},
  { text: "身边人都在聊某个大涨的东西,催你上车,你?", options: [
    { label: "别人都赚,我不能踏空,冲", axis: "risk", pole: "A", fq: 0 },
    { label: "越是人人上头,我越冷静", axis: "risk", pole: "B", fq: 2 },
    { label: "小仓位跟一点试试水", axis: "risk", pole: "A", fq: 1 },
  ]},
  { text: "对“借钱、负债”的看法?", options: [
    { label: "合理借力能加速,该借就借", axis: "risk", pole: "A", fq: 1 },
    { label: "无债一身轻,能不借就不借", axis: "risk", pole: "B", fq: 1 },
    { label: "只借买房这种,消费绝不借", axis: "risk", pole: "B", fq: 2 },
  ]},
  { text: "你更怕哪一种?", options: [
    { label: "错过一次暴富的机会", axis: "risk", pole: "A", fq: 0 },
    { label: "辛苦攒的本金亏掉", axis: "risk", pole: "B", fq: 1 },
    { label: "又想抓机会又怕亏,常纠结", axis: "risk", pole: "B", fq: 1 },
  ]},
  { text: "牛市来了,身边人人都在赚,你?", options: [
    { label: "加仓跟上,别踏空", axis: "risk", pole: "A", fq: 0 },
    { label: "警惕泡沫,留一手", axis: "risk", pole: "B", fq: 2 },
    { label: "该赚赚,但设好止盈就走", axis: "risk", pole: "A", fq: 2 },
  ]},
  { text: "把钱放哪你最安心?", options: [
    { label: "股票、基金,搏个增值", axis: "risk", pole: "A", fq: 1 },
    { label: "银行存款、国债,稳稳的", axis: "risk", pole: "B", fq: 1 },
    { label: "分开放,一部分稳一部分搏", axis: "risk", pole: "B", fq: 2 },
  ]},
  { text: "朋友拉你合伙做点小生意,你?", options: [
    { label: "心动,想搏一把", axis: "risk", pole: "A", fq: 1 },
    { label: "先算算最坏能亏多少再说", axis: "risk", pole: "B", fq: 2 },
    { label: "不熟的领域不碰", axis: "risk", pole: "B", fq: 1 },
  ]},
  { text: "发现一个新风口、新机会,你?", options: [
    { label: "先冲进去再说,怕错过", axis: "risk", pole: "A", fq: 0 },
    { label: "观望一阵,看明白再上", axis: "risk", pole: "B", fq: 2 },
    { label: "边看边小步试,不错过也不梭哈", axis: "risk", pole: "A", fq: 1 },
  ]},
  { text: "买保险这件事,你?", options: [
    { label: "年轻身体好,先不急", axis: "risk", pole: "A", fq: 0 },
    { label: "该配的都配上,图个安心", axis: "risk", pole: "B", fq: 2 },
    { label: "配了基础的,够用就行", axis: "risk", pole: "B", fq: 1 },
  ]},
  { text: "对“鸡蛋别放一个篮子”,你?", options: [
    { label: "看好一个就重仓,分散赚得慢", axis: "risk", pole: "A", fq: 0 },
    { label: "很认同,分散着来", axis: "risk", pole: "B", fq: 2 },
    { label: "分几个,但重点押一两个", axis: "risk", pole: "A", fq: 1 },
  ]},
  { text: "临近发工资,刷到一个限时高息理财,你?", options: [
    { label: "利息高,先买了", axis: "risk", pole: "A", fq: 0 },
    { label: "太高的收益,先怀疑是不是坑", axis: "risk", pole: "B", fq: 2 },
    { label: "查查正不正规再说", axis: "risk", pole: "B", fq: 1 },
  ]},

  // —— 时间观:即 / 远(含行为学:现时偏好 / 购物车 / 办卡 / 凑单 / 攀比)——
  { text: "发了这个月工资,你第一反应是?", options: [
    { label: "先转一笔进存钱、还款账户", axis: "time", pole: "B", fq: 2 },
    { label: "犒劳自己,买点早想要的", axis: "time", pole: "A", fq: 0 },
    { label: "留出固定一笔,剩下再花", axis: "time", pole: "B", fq: 1 },
  ]},
  { text: "现在给你 500,或者等一个月给你 600,你要?", options: [
    { label: "现在就要,拿到手才踏实", axis: "time", pole: "A", fq: 0 },
    { label: "等一个月,多 100 不香吗", axis: "time", pole: "B", fq: 2 },
    { label: "不急用的话就等一等", axis: "time", pole: "B", fq: 1 },
  ]},
  { text: "每月的结余,你习惯?", options: [
    { label: "先花,月底剩多少算多少", axis: "time", pole: "A", fq: 0 },
    { label: "先存、先投,剩下才花", axis: "time", pole: "B", fq: 2 },
    { label: "定个存钱目标,尽量不动", axis: "time", pole: "B", fq: 1 },
  ]},
  { text: "购物车里躺着想买的东西,你常?", options: [
    { label: "看到就忍不住直接结账", axis: "time", pole: "A", fq: 0 },
    { label: "放几天,不那么想要了就删", axis: "time", pole: "B", fq: 2 },
    { label: "等个活动价再下手", axis: "time", pole: "B", fq: 1 },
  ]},
  { text: "朋友约一场说走就走、会超预算的旅行,你?", options: [
    { label: "去!快乐无价", axis: "time", pole: "A", fq: 0 },
    { label: "缓缓,等有预算再去", axis: "time", pole: "B", fq: 2 },
    { label: "去,但控制一下花销", axis: "time", pole: "A", fq: 1 },
  ]},
  { text: "你更愿意为哪种花钱?", options: [
    { label: "当下的体验和快乐", axis: "time", pole: "A", fq: 1 },
    { label: "以后能升值、有回报的东西", axis: "time", pole: "B", fq: 2 },
    { label: "两者都要,分开留预算", axis: "time", pole: "B", fq: 1 },
  ]},
  { text: "健身房年卡比月卡划算不少,你?", options: [
    { label: "直接办年卡,便宜", axis: "time", pole: "A", fq: 0 },
    { label: "先办月卡,确认能坚持再续", axis: "time", pole: "B", fq: 2 },
    { label: "先蹭几次体验课再决定", axis: "time", pole: "B", fq: 1 },
  ]},
  { text: "看到“限量款、最后几件”,你?", options: [
    { label: "立刻冲,晚了就没了", axis: "time", pole: "A", fq: 0 },
    { label: "冷静想想到底用不用得上", axis: "time", pole: "B", fq: 2 },
    { label: "很想要,但会先犹豫一下", axis: "time", pole: "A", fq: 1 },
  ]},
  { text: "满 99 免运费,你差 12 块,你?", options: [
    { label: "凑单再买点,省下运费", axis: "time", pole: "A", fq: 0 },
    { label: "不需要就付运费,别为省小钱乱买", axis: "time", pole: "B", fq: 2 },
    { label: "看看有没有本来就要买的", axis: "time", pole: "B", fq: 1 },
  ]},
  { text: "你更看重?", options: [
    { label: "今天过得爽", axis: "time", pole: "A", fq: 0 },
    { label: "十年后的自己过得好", axis: "time", pole: "B", fq: 2 },
    { label: "当下和将来都顾一点", axis: "time", pole: "B", fq: 1 },
  ]},
  { text: "你“快乐消费”(奶茶、游戏、追星…)的频率?", options: [
    { label: "经常,生活得有滋味", axis: "time", pole: "A", fq: 1 },
    { label: "很克制,攒着办大事", axis: "time", pole: "B", fq: 2 },
    { label: "定个小额度,花超了就停", axis: "time", pole: "A", fq: 1 },
  ]},
  { text: "朋友都换了新款手机,你的还能用,你?", options: [
    { label: "不能太寒酸,也换一个", axis: "time", pole: "A", fq: 0 },
    { label: "能用就不换,钱花在刀刃上", axis: "time", pole: "B", fq: 2 },
    { label: "等这个真不行了再换", axis: "time", pole: "B", fq: 1 },
  ]},
  { text: "对未来的钱,你?", options: [
    { label: "活在当下,未来再说", axis: "time", pole: "A", fq: 0 },
    { label: "有长期规划和目标", axis: "time", pole: "B", fq: 2 },
    { label: "有个模糊的方向,慢慢靠近", axis: "time", pole: "B", fq: 1 },
  ]},
  { text: "你更想要哪种“自由”?", options: [
    { label: "现在就能随便花的自由", axis: "time", pole: "A", fq: 0 },
    { label: "以后不上班也饿不死的自由", axis: "time", pole: "B", fq: 2 },
    { label: "两种都想要,先攒着", axis: "time", pole: "B", fq: 1 },
  ]},

  // —— 决策观:感 / 研(含行为学:沉没成本 / 锚定 / 心理账户 / 框架 / 相对性)——
  { text: "对“记账”这件事,你?", options: [
    { label: "常记,心里有本清楚的账", axis: "decision", pole: "B", fq: 2 },
    { label: "大概知道就行,懒得记", axis: "decision", pole: "A", fq: 0 },
    { label: "偶尔记记,大额一定记", axis: "decision", pole: "B", fq: 1 },
  ]},
  { text: "做财务决定,你更信?", options: [
    { label: "数据和测算", axis: "decision", pole: "B", fq: 2 },
    { label: "感觉和直觉", axis: "decision", pole: "A", fq: 0 },
    { label: "先看数据,再结合直觉", axis: "decision", pole: "B", fq: 1 },
  ]},
  { text: "买大件前,你?", options: [
    { label: "比价、看测评、列清单", axis: "decision", pole: "B", fq: 2 },
    { label: "看对眼直接下单", axis: "decision", pole: "A", fq: 0 },
    { label: "简单查一下就买", axis: "decision", pole: "B", fq: 1 },
  ]},
  { text: "花钱买的电影票,开场十分钟发现是大烂片,你?", options: [
    { label: "忍着看完,钱不能白花", axis: "decision", pole: "A", fq: 0 },
    { label: "太烂就走,时间比那点票钱值", axis: "decision", pole: "B", fq: 2 },
    { label: "刷会儿手机凑合看完", axis: "decision", pole: "A", fq: 1 },
  ]},
  { text: "看到标签“原价 999、现价 299”,你?", options: [
    { label: "太划算了,先买了再说", axis: "decision", pole: "A", fq: 0 },
    { label: "先想 299 这东西我到底用不用得上", axis: "decision", pole: "B", fq: 2 },
    { label: "有点心动,但会再想想", axis: "decision", pole: "A", fq: 1 },
  ]},
  { text: "抢到的红包、中的小奖,这笔钱你?", options: [
    { label: "白来的,痛快花掉", axis: "decision", pole: "A", fq: 0 },
    { label: "和工资一样对待,该存存", axis: "decision", pole: "B", fq: 2 },
    { label: "花一半、留一半", axis: "decision", pole: "B", fq: 1 },
  ]},
  { text: "选基金、理财产品,你看?", options: [
    { label: "历史收益、回撤、费率", axis: "decision", pole: "B", fq: 2 },
    { label: "名字顺眼、别人推荐就买", axis: "decision", pole: "A", fq: 0 },
    { label: "看看排名和评论", axis: "decision", pole: "B", fq: 1 },
  ]},
  { text: "对自己的资产状况(有多少、欠多少),你?", options: [
    { label: "大概都清楚", axis: "decision", pole: "B", fq: 2 },
    { label: "没细算过,糊里糊涂", axis: "decision", pole: "A", fq: 0 },
    { label: "大数知道,细账没算", axis: "decision", pole: "B", fq: 1 },
  ]},
  { text: "大件商品,商家说“每天只要一杯奶茶钱”,你?", options: [
    { label: "听起来不贵,分期买了", axis: "decision", pole: "A", fq: 0 },
    { label: "换算成总价和利息再决定", axis: "decision", pole: "B", fq: 2 },
    { label: "先算算这钱花得值不值", axis: "decision", pole: "B", fq: 1 },
  ]},
  { text: "投资亏了、账户缩水,你常?", options: [
    { label: "复盘哪一步错了", axis: "decision", pole: "B", fq: 2 },
    { label: "怪运气不好", axis: "decision", pole: "A", fq: 0 },
    { label: "难受一阵,再慢慢想原因", axis: "decision", pole: "B", fq: 1 },
  ]},
  { text: "做预算这件事?", options: [
    { label: "有个大致的月度预算", axis: "decision", pole: "B", fq: 2 },
    { label: "走一步看一步", axis: "decision", pole: "A", fq: 0 },
    { label: "只给大项定个额度", axis: "decision", pole: "B", fq: 1 },
  ]},
  { text: "为了省 5 块钱,要多花半小时跑远一点的店,你?", options: [
    { label: "能省就省,跑一趟", axis: "decision", pole: "A", fq: 0 },
    { label: "半小时比 5 块值,就近买", axis: "decision", pole: "B", fq: 2 },
    { label: "顺路就去,不顺就算了", axis: "decision", pole: "B", fq: 1 },
  ]},
  { text: "决定买房、或一笔大额支出时?", options: [
    { label: "算清月供、收入比、风险", axis: "decision", pole: "B", fq: 2 },
    { label: "感觉差不多就拍板", axis: "decision", pole: "A", fq: 0 },
    { label: "问问身边人再定", axis: "decision", pole: "B", fq: 1 },
  ]},
  { text: "对“理财知识”,你?", options: [
    { label: "会主动学,看书、看课", axis: "decision", pole: "B", fq: 2 },
    { label: "用到再说,没系统学过", axis: "decision", pole: "A", fq: 0 },
    { label: "刷到相关内容会看看", axis: "decision", pole: "B", fq: 1 },
  ]},

  // ═══ 扩充题库(与上同风格,3 选项 · 每题同维)═══
  // —— 收入观:开 / 省 ——
  { text: "看到同事升职加薪,你?", options: [
    { label: "想想我怎么也涨一涨、跳一跳", axis: "income", pole: "A", fq: 2 },
    { label: "稳住现状,少花点也一样", axis: "income", pole: "B", fq: 1 },
    { label: "先把本职做亮,再谈涨薪", axis: "income", pole: "A", fq: 1 },
  ]},
  { text: "一项技能能变现但要花时间学,你?", options: [
    { label: "值得,学了能多赚", axis: "income", pole: "A", fq: 2 },
    { label: "回报不确定,先不投入", axis: "income", pole: "B", fq: 0 },
    { label: "抽空慢慢学着", axis: "income", pole: "A", fq: 1 },
  ]},
  { text: "家里一堆闲置的东西,你?", options: [
    { label: "挂二手卖掉,换点钱", axis: "income", pole: "A", fq: 2 },
    { label: "留着或送人,懒得折腾", axis: "income", pole: "B", fq: 1 },
    { label: "能卖的卖,不值钱的送", axis: "income", pole: "A", fq: 1 },
  ]},
  { text: "对“上班之外再开一份收入”,你?", options: [
    { label: "一直在找机会", axis: "income", pole: "A", fq: 2 },
    { label: "一份稳定的就够了", axis: "income", pole: "B", fq: 1 },
    { label: "有余力才考虑", axis: "income", pole: "A", fq: 1 },
  ]},
  { text: "领导给个有挑战但不加钱的项目,你?", options: [
    { label: "接,长本事以后能变现", axis: "income", pole: "A", fq: 2 },
    { label: "没钱的活能推就推", axis: "income", pole: "B", fq: 0 },
    { label: "看能不能学到东西再定", axis: "income", pole: "A", fq: 1 },
  ]},
  { text: "你怎么看“人脉”?", options: [
    { label: "多认识人,机会更多", axis: "income", pole: "A", fq: 1 },
    { label: "圈子小点,省心省钱", axis: "income", pole: "B", fq: 1 },
    { label: "重点维护能互相帮的", axis: "income", pole: "A", fq: 2 },
  ]},
  { text: "对拍照、写作、做手工这类手艺,你?", options: [
    { label: "想办法让它也能赚钱", axis: "income", pole: "A", fq: 2 },
    { label: "纯爱好,不想沾钱", axis: "income", pole: "B", fq: 1 },
    { label: "能接点单就接点", axis: "income", pole: "A", fq: 1 },
  ]},
  { text: "对“跳槽涨薪”,你?", options: [
    { label: "合适就跳,涨薪最实在", axis: "income", pole: "A", fq: 1 },
    { label: "稳定比涨那点强", axis: "income", pole: "B", fq: 1 },
    { label: "骑驴找马,有更好的再走", axis: "income", pole: "A", fq: 2 },
  ]},
  { text: "公司发的期权 / 股票,你?", options: [
    { label: "看好公司,长期拿着", axis: "income", pole: "A", fq: 1 },
    { label: "能套现就先落袋", axis: "income", pole: "B", fq: 1 },
    { label: "分批处理,别一次清也别死拿", axis: "income", pole: "A", fq: 2 },
  ]},
  { text: "你更愿意花钱学什么?", options: [
    { label: "能提升赚钱能力的", axis: "income", pole: "A", fq: 2 },
    { label: "免费资源够用就行", axis: "income", pole: "B", fq: 1 },
    { label: "感兴趣又可能变现的", axis: "income", pole: "A", fq: 1 },
  ]},
  { text: "对“多劳多得 vs 稳定工资”,你?", options: [
    { label: "多劳多得,凭本事拿钱", axis: "income", pole: "A", fq: 1 },
    { label: "稳定工资,心里踏实", axis: "income", pole: "B", fq: 1 },
    { label: "底薪稳 + 提成冲最好", axis: "income", pole: "A", fq: 2 },
  ]},
  { text: "看到风口行业在招人,你?", options: [
    { label: "研究下能不能进去分杯羹", axis: "income", pole: "A", fq: 2 },
    { label: "不熟不碰,守好现在", axis: "income", pole: "B", fq: 1 },
    { label: "观望,等看清了再动", axis: "income", pole: "A", fq: 1 },
  ]},
  { text: "你怎么处理年终奖?", options: [
    { label: "拿一部分去投资钱生钱", axis: "income", pole: "A", fq: 2 },
    { label: "存起来,心里有底", axis: "income", pole: "B", fq: 1 },
    { label: "投资 + 存 + 小犒劳,分三份", axis: "income", pole: "A", fq: 2 },
  ]},
  { text: "对“斜杠青年”(多重身份、多份收入),你?", options: [
    { label: "向往,正往这方向走", axis: "income", pole: "A", fq: 2 },
    { label: "太累,一份足矣", axis: "income", pole: "B", fq: 1 },
    { label: "有精力再多加一条线", axis: "income", pole: "A", fq: 1 },
  ]},
  { text: "朋友生意缺人手、给分成,你?", options: [
    { label: "有搞头就一起干", axis: "income", pole: "A", fq: 1 },
    { label: "帮忙可以,不掺钱", axis: "income", pole: "B", fq: 1 },
    { label: "先算算值不值再上", axis: "income", pole: "A", fq: 2 },
  ]},
  { text: "你更看重一份工作的?", options: [
    { label: "成长空间和赚钱潜力", axis: "income", pole: "A", fq: 1 },
    { label: "稳定和轻松", axis: "income", pole: "B", fq: 1 },
    { label: "能不能积累以后变现的东西", axis: "income", pole: "A", fq: 2 },
  ]},
  { text: "对“把爱好做成小生意”,你?", options: [
    { label: "很想试,先小规模起步", axis: "income", pole: "A", fq: 2 },
    { label: "怕亏,还是算了", axis: "income", pole: "B", fq: 0 },
    { label: "边做边看反馈", axis: "income", pole: "A", fq: 1 },
  ]},
  { text: "你怎么看“省一块 vs 赚一块”?", options: [
    { label: "赚钱天花板高,重点搞钱", axis: "income", pole: "A", fq: 1 },
    { label: "省下的都是净赚,先省", axis: "income", pole: "B", fq: 1 },
    { label: "该省的省住,再拼命赚", axis: "income", pole: "A", fq: 2 },
  ]},
  { text: "有个培训能拿证书、可能涨薪,你?", options: [
    { label: "报,投资自己", axis: "income", pole: "A", fq: 2 },
    { label: "太贵,先不报", axis: "income", pole: "B", fq: 0 },
    { label: "算算回本快不快再报", axis: "income", pole: "A", fq: 1 },
  ]},

  // —— 风险观:进 / 稳 ——
  { text: "第一次买股票 / 基金,你?", options: [
    { label: "小仓位先冲进去体验", axis: "risk", pole: "A", fq: 1 },
    { label: "先看书学明白再买", axis: "risk", pole: "B", fq: 2 },
    { label: "从最稳的货币基金起步", axis: "risk", pole: "B", fq: 1 },
  ]},
  { text: "朋友晒某投资赚翻了、拉你进,你?", options: [
    { label: "跟一点,别人行我也行", axis: "risk", pole: "A", fq: 0 },
    { label: "先问清风险和门道", axis: "risk", pole: "B", fq: 2 },
    { label: "赚太快的我反而警惕", axis: "risk", pole: "B", fq: 1 },
  ]},
  { text: "“鸡蛋分篮子”具体你怎么做?", options: [
    { label: "看好一个就重仓,分散赚得慢", axis: "risk", pole: "A", fq: 0 },
    { label: "股、债、现金分开配", axis: "risk", pole: "B", fq: 2 },
    { label: "大部分稳,小部分博", axis: "risk", pole: "B", fq: 1 },
  ]},
  { text: "市场大跌、你的持仓浮亏,你?", options: [
    { label: "跌了正好加仓", axis: "risk", pole: "A", fq: 1 },
    { label: "先别乱动,按计划来", axis: "risk", pole: "B", fq: 2 },
    { label: "慌,想清仓离场", axis: "risk", pole: "A", fq: 0 },
  ]},
  { text: "对“借钱投资(加杠杆)”,你?", options: [
    { label: "看准了敢用杠杆", axis: "risk", pole: "A", fq: 0 },
    { label: "绝不借钱投资", axis: "risk", pole: "B", fq: 2 },
    { label: "最多用一点点闲钱", axis: "risk", pole: "B", fq: 1 },
  ]},
  { text: "你能承受多大的本金波动?", options: [
    { label: "能扛腰斩,搏大的", axis: "risk", pole: "A", fq: 0 },
    { label: "亏一成就很难受", axis: "risk", pole: "B", fq: 1 },
    { label: "波动越小越好", axis: "risk", pole: "B", fq: 1 },
  ]},
  { text: "有人给你一个“内部消息”,你?", options: [
    { label: "机会难得,搏一把", axis: "risk", pole: "A", fq: 0 },
    { label: "天上不掉馅饼,不碰", axis: "risk", pole: "B", fq: 2 },
    { label: "先核实真假再说", axis: "risk", pole: "B", fq: 1 },
  ]},
  { text: "对创业这件事,你?", options: [
    { label: "想干一票大的", axis: "risk", pole: "A", fq: 1 },
    { label: "打工更稳,不折腾", axis: "risk", pole: "B", fq: 1 },
    { label: "先兼职试水,别急着辞职", axis: "risk", pole: "B", fq: 2 },
  ]},
  { text: "你的理财目标更接近?", options: [
    { label: "翻倍暴富", axis: "risk", pole: "A", fq: 0 },
    { label: "跑赢通胀就行", axis: "risk", pole: "B", fq: 2 },
    { label: "稳中求进,略高于大盘", axis: "risk", pole: "A", fq: 1 },
  ]},
  { text: "面对没研究过的新品种(某某币之类),你?", options: [
    { label: "新东西,先上车再说", axis: "risk", pole: "A", fq: 0 },
    { label: "看不懂坚决不投", axis: "risk", pole: "B", fq: 2 },
    { label: "拿极小的钱试试水", axis: "risk", pole: "A", fq: 1 },
  ]},
  { text: "你怎么看待“止损”?", options: [
    { label: "扛着,总会涨回来", axis: "risk", pole: "A", fq: 0 },
    { label: "设好止损线,到了就走", axis: "risk", pole: "B", fq: 2 },
    { label: "提前想好最多亏多少", axis: "risk", pole: "B", fq: 1 },
  ]},
  { text: "突发大额支出(修车 / 看病),你有底吗?", options: [
    { label: "没存,先刷卡 / 借", axis: "risk", pole: "A", fq: 0 },
    { label: "有应急金,不慌", axis: "risk", pole: "B", fq: 2 },
    { label: "够撑一阵,再慢慢补", axis: "risk", pole: "B", fq: 1 },
  ]},
  { text: "对“高收益一定伴随高风险”,你?", options: [
    { label: "技术好能吃到高收益低风险", axis: "risk", pole: "A", fq: 0 },
    { label: "深信,不贪高息", axis: "risk", pole: "B", fq: 2 },
    { label: "大体认同,偶尔搏一下", axis: "risk", pole: "B", fq: 1 },
  ]},
  { text: "你更愿意?", options: [
    { label: "承担风险换更高回报", axis: "risk", pole: "A", fq: 1 },
    { label: "少赚一点换安心", axis: "risk", pole: "B", fq: 1 },
    { label: "大头求稳,小钱冒险", axis: "risk", pole: "B", fq: 2 },
  ]},
  { text: "保险配置上,你?", options: [
    { label: "先不急,把钱拿去投资", axis: "risk", pole: "A", fq: 0 },
    { label: "意外、医疗、重疾都配齐", axis: "risk", pole: "B", fq: 2 },
    { label: "先配个百万医疗兜底", axis: "risk", pole: "B", fq: 1 },
  ]},
  { text: "对“满仓 vs 留现金”,你?", options: [
    { label: "满仓才不浪费机会", axis: "risk", pole: "A", fq: 0 },
    { label: "永远留一笔现金", axis: "risk", pole: "B", fq: 2 },
    { label: "大部分投,留点子弹", axis: "risk", pole: "B", fq: 1 },
  ]},
  { text: "遇到写着“稳赚不赔”的宣传,你?", options: [
    { label: "收益诱人,先投点", axis: "risk", pole: "A", fq: 0 },
    { label: "这话本身就是危险信号", axis: "risk", pole: "B", fq: 2 },
    { label: "查清资质再说", axis: "risk", pole: "B", fq: 1 },
  ]},
  { text: "你会为一个高回报机会押上多少?", options: [
    { label: "敢押上大部分身家", axis: "risk", pole: "A", fq: 0 },
    { label: "只押输得起的小钱", axis: "risk", pole: "B", fq: 2 },
    { label: "押一点点试试", axis: "risk", pole: "B", fq: 1 },
  ]},

  // —— 时间观:即 / 远 ——
  { text: "发了一笔奖金,你?", options: [
    { label: "先补进存款 / 投资", axis: "time", pole: "B", fq: 2 },
    { label: "痛快花一笔犒劳自己", axis: "time", pole: "A", fq: 0 },
    { label: "花一点,存大头", axis: "time", pole: "B", fq: 1 },
  ]},
  { text: "想买的贵东西,你?", options: [
    { label: "分期,先享受", axis: "time", pole: "A", fq: 0 },
    { label: "攒够了再买,不借钱", axis: "time", pole: "B", fq: 2 },
    { label: "等打折或攒到再说", axis: "time", pole: "B", fq: 1 },
  ]},
  { text: "对“存钱”这件事,你?", options: [
    { label: "有剩才存,常常没剩", axis: "time", pole: "A", fq: 0 },
    { label: "每月雷打不动先存一笔", axis: "time", pole: "B", fq: 2 },
    { label: "干脆设了自动转存", axis: "time", pole: "B", fq: 2 },
  ]},
  { text: "周末想放松,你?", options: [
    { label: "该吃吃该玩玩,别亏待自己", axis: "time", pole: "A", fq: 1 },
    { label: "找免费或低成本的方式", axis: "time", pole: "B", fq: 1 },
    { label: "定个预算内玩", axis: "time", pole: "B", fq: 1 },
  ]},
  { text: "你怎么看“提前还房贷”?", options: [
    { label: "留着钱现在花更实在", axis: "time", pole: "A", fq: 0 },
    { label: "有闲钱就提前还,省利息", axis: "time", pole: "B", fq: 1 },
    { label: "先算清利率再决定", axis: "time", pole: "B", fq: 2 },
  ]},
  { text: "看到“先用后付 / 花呗”,你?", options: [
    { label: "方便,常用", axis: "time", pole: "A", fq: 0 },
    { label: "尽量不用,容易超支", axis: "time", pole: "B", fq: 2 },
    { label: "用,但每月全额还清", axis: "time", pole: "B", fq: 1 },
  ]},
  { text: "对“养老 / 退休金”,你?", options: [
    { label: "太远了,以后再说", axis: "time", pole: "A", fq: 0 },
    { label: "已经在为几十年后攒", axis: "time", pole: "B", fq: 2 },
    { label: "知道该准备,还没动手", axis: "time", pole: "B", fq: 1 },
  ]},
  { text: "一笔钱三年后才用得上,你?", options: [
    { label: "放着,随时能花", axis: "time", pole: "A", fq: 1 },
    { label: "拿去做点稳健增值", axis: "time", pole: "B", fq: 2 },
    { label: "存个三年定期", axis: "time", pole: "B", fq: 1 },
  ]},
  { text: "逛街看到很喜欢但不必需的,你?", options: [
    { label: "喜欢就买,快乐要紧", axis: "time", pole: "A", fq: 0 },
    { label: "记下来,过几天不想要就算了", axis: "time", pole: "B", fq: 2 },
    { label: "忍住,先列进愿望清单", axis: "time", pole: "B", fq: 1 },
  ]},
  { text: "对“月光”,你?", options: [
    { label: "钱是用来花的,月光也无所谓", axis: "time", pole: "A", fq: 0 },
    { label: "绝不月光,一定留结余", axis: "time", pole: "B", fq: 2 },
    { label: "偶尔月光,尽量避免", axis: "time", pole: "B", fq: 1 },
  ]},
  { text: "你给未来的自己留钱了吗?", options: [
    { label: "没有,先顾好当下", axis: "time", pole: "A", fq: 0 },
    { label: "有专门的长期账户", axis: "time", pole: "B", fq: 2 },
    { label: "零零散散存了点", axis: "time", pole: "B", fq: 1 },
  ]},
  { text: "面对“限时秒杀”,你?", options: [
    { label: "手快下单,晚了没了", axis: "time", pole: "A", fq: 0 },
    { label: "不需要的再便宜也不买", axis: "time", pole: "B", fq: 2 },
    { label: "只抢本来就想要的", axis: "time", pole: "A", fq: 1 },
  ]},
  { text: "你怎么排“想要”和“需要”?", options: [
    { label: "想要的也尽量马上满足", axis: "time", pole: "A", fq: 0 },
    { label: "先满足需要,想要往后排", axis: "time", pole: "B", fq: 2 },
    { label: "想要的攒一攒再买", axis: "time", pole: "B", fq: 1 },
  ]},
  { text: "对“复利、时间的力量”,你?", options: [
    { label: "听过,没太当回事", axis: "time", pole: "A", fq: 0 },
    { label: "越早开始越好,已在行动", axis: "time", pole: "B", fq: 2 },
    { label: "信,但还没坚持下来", axis: "time", pole: "B", fq: 1 },
  ]},
  { text: "假期出游预算,你?", options: [
    { label: "难得出去,该花就花", axis: "time", pole: "A", fq: 1 },
    { label: "定好上限,超了就砍", axis: "time", pole: "B", fq: 2 },
    { label: "边玩边控制一下", axis: "time", pole: "A", fq: 1 },
  ]},
  { text: "刚发工资的头几天,你?", options: [
    { label: "最舍得花,报复性消费", axis: "time", pole: "A", fq: 0 },
    { label: "先把要存的转走,再安排花", axis: "time", pole: "B", fq: 2 },
    { label: "和平时差不多,不特别", axis: "time", pole: "B", fq: 1 },
  ]},

  // —— 决策观:感 / 研 ——
  { text: "买之前,你会看“单价 / 每克多少钱”吗?", options: [
    { label: "会,算清哪个更划算", axis: "decision", pole: "B", fq: 2 },
    { label: "不看,差不多就行", axis: "decision", pole: "A", fq: 0 },
    { label: "大额才算一算", axis: "decision", pole: "B", fq: 1 },
  ]},
  { text: "办卡 / 开会员前,你?", options: [
    { label: "算算多久回本、用不用得上", axis: "decision", pole: "B", fq: 2 },
    { label: "看着划算就先办", axis: "decision", pole: "A", fq: 0 },
    { label: "先试用 / 短期再说", axis: "decision", pole: "B", fq: 1 },
  ]},
  { text: "对自己的账单 / 流水,你?", options: [
    { label: "定期看,清楚钱去哪了", axis: "decision", pole: "B", fq: 2 },
    { label: "从不看,反正都花了", axis: "decision", pole: "A", fq: 0 },
    { label: "偶尔翻一下", axis: "decision", pole: "B", fq: 1 },
  ]},
  { text: "听到“别人都买了 / 都在用”,你?", options: [
    { label: "那我也跟一个", axis: "decision", pole: "A", fq: 0 },
    { label: "别人的需求不等于我的", axis: "decision", pole: "B", fq: 2 },
    { label: "看看是不是真适合我", axis: "decision", pole: "B", fq: 1 },
  ]},
  { text: "大促前,你?", options: [
    { label: "逛到哪买到哪", axis: "decision", pole: "A", fq: 0 },
    { label: "列好清单,只买清单里的", axis: "decision", pole: "B", fq: 2 },
    { label: "比比历史价,别被假折扣坑", axis: "decision", pole: "B", fq: 1 },
  ]},
  { text: "面对“买一送一 / 第二件半价”,你?", options: [
    { label: "划算,多买点", axis: "decision", pole: "A", fq: 0 },
    { label: "想想是不是本来就要买这么多", axis: "decision", pole: "B", fq: 2 },
    { label: "需要才凑,不需要不凑", axis: "decision", pole: "B", fq: 1 },
  ]},
  { text: "做大额决定前,你?", options: [
    { label: "列利弊、查资料、算账", axis: "decision", pole: "B", fq: 2 },
    { label: "凭感觉和喜好", axis: "decision", pole: "A", fq: 0 },
    { label: "问几个懂的人", axis: "decision", pole: "B", fq: 1 },
  ]},
  { text: "对“品牌溢价”,你?", options: [
    { label: "喜欢就买,牌子重要", axis: "decision", pole: "A", fq: 1 },
    { label: "衡量值不值那个价", axis: "decision", pole: "B", fq: 2 },
    { label: "平价替代够用就选替代", axis: "decision", pole: "B", fq: 2 },
  ]},
  { text: "你知道自己每月固定开销多少吗?", options: [
    { label: "大致数得出来", axis: "decision", pole: "B", fq: 2 },
    { label: "完全没概念", axis: "decision", pole: "A", fq: 0 },
    { label: "知道大项,小项模糊", axis: "decision", pole: "B", fq: 1 },
  ]},
  { text: "遇到“充多送多”的储值,你?", options: [
    { label: "送得多,充一大笔", axis: "decision", pole: "A", fq: 0 },
    { label: "按实际用量充,别被套牢", axis: "decision", pole: "B", fq: 2 },
    { label: "充够近期用的就行", axis: "decision", pole: "B", fq: 1 },
  ]},
  { text: "对退货 / 售后,你?", options: [
    { label: "懒得退,凑合用", axis: "decision", pole: "A", fq: 1 },
    { label: "不合适就果断退,不将就", axis: "decision", pole: "B", fq: 2 },
    { label: "看值不值得折腾", axis: "decision", pole: "B", fq: 1 },
  ]},
  { text: "判断一笔钱花得值不值,你看?", options: [
    { label: "当时开不开心", axis: "decision", pole: "A", fq: 0 },
    { label: "用的频率和实际收益", axis: "decision", pole: "B", fq: 2 },
    { label: "综合感受和性价比", axis: "decision", pole: "B", fq: 1 },
  ]},
  { text: "对“网红爆款”,你?", options: [
    { label: "看着好就入手", axis: "decision", pole: "A", fq: 0 },
    { label: "先看真实测评和差评", axis: "decision", pole: "B", fq: 2 },
    { label: "热度过了再看要不要", axis: "decision", pole: "B", fq: 1 },
  ]},
  { text: "你会给不同开销定预算吗?", options: [
    { label: "不设,花到哪算哪", axis: "decision", pole: "A", fq: 0 },
    { label: "各大项都有额度", axis: "decision", pole: "B", fq: 2 },
    { label: "只卡最容易超的那几项", axis: "decision", pole: "B", fq: 1 },
  ]},
  { text: "面对销售的极力推荐,你?", options: [
    { label: "说得心动就买了", axis: "decision", pole: "A", fq: 0 },
    { label: "回去冷静想想再决定", axis: "decision", pole: "B", fq: 2 },
    { label: "先了解清楚再说", axis: "decision", pole: "B", fq: 1 },
  ]},
  { text: "对“记账 App / 表格”,你?", options: [
    { label: "没耐心,坚持不下来", axis: "decision", pole: "A", fq: 0 },
    { label: "一直在用,数据心里有底", axis: "decision", pole: "B", fq: 2 },
    { label: "用它记大额和月结", axis: "decision", pole: "B", fq: 1 },
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

/** 由答案(每题选中的 option 下标)算出问卷部分:代号 / 倾向 / 问卷财商分。
 *  questions:本次实际作答的题目列表(可能是从题库随机抽样出的子集)。 */
export function scoreAnswers(
  answers: number[],
  questions: FqQuestion[] = QUESTIONS
): {
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
    const q = questions[i];
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

/** 组合出完整结果(可带真实数据指标)。questions:本次实际作答的题目列表。 */
export function buildResult(
  answers: number[],
  questions: FqQuestion[],
  metrics?: { margin: number; fiProgress: number; freedomDays: number; trackDays: number; hasData: boolean } | null,
  date = new Date().toISOString()
): FqResult {
  const { code, leans, q } = scoreAnswers(answers, questions);
  return composeResult({ code, name: TYPE_NAME[code] ?? code, q, leans, date }, metrics);
}

/** 每题所属维度(本题库每题 3 选项同维,取首项即可)。 */
export function questionAxis(q: FqQuestion): AxisKey {
  return q.options[0]?.axis ?? "income";
}

/** 洗牌(Fisher–Yates,纯本地随机)。 */
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 从题库按维度分层随机抽 count 题(默认 50):4 维尽量均衡,保证 16 型分型稳定;
 * 各维配额 = 尽量平均(如 50→13/13/12/12),不足则由其它维补足;最后整体洗牌打乱顺序。
 */
export function sampleQuestions(count = 50, pool: FqQuestion[] = QUESTIONS): FqQuestion[] {
  const byAxis: Record<AxisKey, FqQuestion[]> = { income: [], risk: [], time: [], decision: [] };
  for (const q of pool) byAxis[questionAxis(q)].push(q);
  const axes: AxisKey[] = ["income", "risk", "time", "decision"];
  // 每维基础配额
  const base = Math.floor(count / axes.length);
  const extra = count - base * axes.length;
  const quota: Record<AxisKey, number> = { income: base, risk: base, time: base, decision: base };
  // 多出的名额随机分给几个维度
  for (const k of shuffle(axes).slice(0, extra)) quota[k] += 1;

  const picked: FqQuestion[] = [];
  const leftovers: FqQuestion[] = [];
  for (const ax of axes) {
    const shuffled = shuffle(byAxis[ax]);
    picked.push(...shuffled.slice(0, quota[ax]));
    leftovers.push(...shuffled.slice(quota[ax]));
  }
  // 某维题不够 → 用其它维的剩余补满 count
  if (picked.length < count) {
    picked.push(...shuffle(leftovers).slice(0, count - picked.length));
  }
  return shuffle(picked).slice(0, count);
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
