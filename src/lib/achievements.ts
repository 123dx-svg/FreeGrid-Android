// ============================================================================
// 成就徽章 —— 定义 + 判定(纯函数,零依赖)。
// 每枚徽章:数据型(test 读指标)或事件型(event,由 markBadgeEvent 触发)。
// 解锁状态/时间的持久化在 achievements.svelte.ts。
// ============================================================================

export interface AchInput {
  trackDays: number; // 记账天数
  txCount: number; // 累计笔数(支出+收入)
  margin: number; // 储蓄率 0–1
  netWorth: number; // 净值
  freedomDays: number; // 自由天数(可能 Infinity)
  passiveRatio: number; // 被动覆盖 0–∞
  hasPassive: boolean; // 有被动收入来源
  hasAssets: boolean; // 记录了可变现资产(净值>0)
  fqDone: boolean; // 完成过财商测试
}

export interface Achievement {
  id: string;
  group: string; // 分组
  name: string; // 徽章名
  desc: string; // 达成条件说明
  icon: string; // emoji(墙上展示)
  hue: number; // 主色相(HSL,解锁后上色)
  test?: (a: AchInput) => boolean; // 数据型解锁条件
  event?: string; // 事件型(由 markBadgeEvent 解锁)
  eventCount?: { event: string; count: number }; // 事件累计到一定次数解锁(如多次完成测试)
  hidden?: boolean; // 隐藏成就:解锁前只显示「？？？」,达成即揭晓
}

// ── 徽章清单(~23 枚,分组里程碑,长期可追)──
export const ACHIEVEMENTS: Achievement[] = [
  // 记账习惯
  { id: "track7", group: "记账习惯", name: "初来乍到", desc: "记账满 7 天", icon: "🌱", hue: 140, test: (a) => a.trackDays >= 7 },
  { id: "track30", group: "记账习惯", name: "坚持一月", desc: "记账满 30 天", icon: "📅", hue: 140, test: (a) => a.trackDays >= 30 },
  { id: "track100", group: "记账习惯", name: "百日筑基", desc: "记账满 100 天", icon: "🧱", hue: 140, test: (a) => a.trackDays >= 100 },
  { id: "track365", group: "记账习惯", name: "一年之约", desc: "记账满 365 天", icon: "🎂", hue: 140, test: (a) => a.trackDays >= 365 },
  { id: "tx100", group: "记账习惯", name: "记账百笔", desc: "累计记满 100 笔", icon: "✍️", hue: 200, test: (a) => a.txCount >= 100 },
  { id: "tx1000", group: "记账习惯", name: "千笔达人", desc: "累计记满 1000 笔", icon: "📚", hue: 200, test: (a) => a.txCount >= 1000 },
  // 储蓄
  { id: "save0", group: "储蓄", name: "略有结余", desc: "开始有正结余", icon: "🪙", hue: 45, test: (a) => a.margin > 0 },
  { id: "save30", group: "储蓄", name: "储蓄能手", desc: "储蓄率 ≥ 30%", icon: "💪", hue: 45, test: (a) => a.margin >= 0.3 },
  { id: "save50", group: "储蓄", name: "存钱狂魔", desc: "储蓄率 ≥ 50%", icon: "🐷", hue: 45, test: (a) => a.margin >= 0.5 },
  // 资产
  { id: "nw1", group: "资产", name: "小有积蓄", desc: "净值突破 1 万", icon: "💰", hue: 42, test: (a) => a.netWorth >= 10000 },
  { id: "nw10", group: "资产", name: "十万里程", desc: "净值突破 10 万", icon: "💵", hue: 42, test: (a) => a.netWorth >= 100000 },
  { id: "nw50", group: "资产", name: "半百之家", desc: "净值突破 50 万", icon: "🏦", hue: 42, test: (a) => a.netWorth >= 500000 },
  { id: "nw100", group: "资产", name: "百万俱乐部", desc: "净值突破 100 万", icon: "👑", hue: 42, test: (a) => a.netWorth >= 1000000 },
  // 自由(需已有记录:无消费时 freedomDays=∞ 属平凡情形,不算成就)
  { id: "free180", group: "自由", name: "半年底气", desc: "自由天数 ≥ 180 天", icon: "⛅", hue: 210, test: (a) => a.freedomDays >= 180 && a.txCount > 0 },
  { id: "free365", group: "自由", name: "一年安心", desc: "自由天数 ≥ 365 天", icon: "☀️", hue: 210, test: (a) => a.freedomDays >= 365 && a.txCount > 0 },
  { id: "free1095", group: "自由", name: "三年从容", desc: "自由天数 ≥ 1095 天", icon: "🏔️", hue: 210, test: (a) => a.freedomDays >= 1095 && a.txCount > 0 },
  { id: "free3650", group: "自由", name: "十年自由", desc: "自由天数 ≥ 3650 天", icon: "🕊️", hue: 210, test: (a) => a.freedomDays >= 3650 && a.txCount > 0 },
  // 被动收入
  { id: "passive1", group: "被动收入", name: "睡后收入", desc: "拥有被动收入来源", icon: "🌙", hue: 265, test: (a) => a.hasPassive },
  { id: "passive50", group: "被动收入", name: "半程覆盖", desc: "被动覆盖 ≥ 50%", icon: "🌗", hue: 265, test: (a) => a.passiveRatio >= 0.5 },
  { id: "passive100", group: "被动收入", name: "财务自由", desc: "被动覆盖 ≥ 100%", icon: "🌟", hue: 265, test: (a) => a.passiveRatio >= 1.0 },
  // 探索
  { id: "fq", group: "探索", name: "认识自己", desc: "完成一次财商人格测试", icon: "🧭", hue: 20, event: "completed_fq" },
  { id: "assets", group: "探索", name: "资产在册", desc: "记录了可变现资产", icon: "🗂️", hue: 20, test: (a) => a.hasAssets },
  { id: "annual", group: "探索", name: "年度回望", desc: "查看过个人年报", icon: "📊", hue: 20, event: "viewed_annual" },
  // 隐藏成就(达成前只显示「？？？」,靠坚持/探索/惊喜触发)
  { id: "fq5", group: "隐藏成就", name: "反复横跳", desc: "累计完成 5 次财商测试", icon: "🔮", hue: 280, hidden: true, eventCount: { event: "completed_fq", count: 5 } },
  { id: "fq15", group: "隐藏成就", name: "人格考古学家", desc: "累计完成 15 次财商测试", icon: "🧬", hue: 300, hidden: true, eventCount: { event: "completed_fq", count: 15 } },
  { id: "report10", group: "隐藏成就", name: "年报钉子户", desc: "累计翻看 10 次个人年报", icon: "📈", hue: 190, hidden: true, eventCount: { event: "viewed_annual", count: 10 } },
  { id: "save80", group: "隐藏成就", name: "省钱忍者", desc: "储蓄率一度冲到 80%", icon: "🥷", hue: 48, hidden: true, test: (a) => a.margin >= 0.8 && a.txCount > 0 },
  { id: "nw500", group: "隐藏成就", name: "五百万", desc: "净值突破 500 万", icon: "🛥️", hue: 42, hidden: true, test: (a) => a.netWorth >= 5000000 },
  { id: "backup", group: "隐藏成就", name: "有备无患", desc: "导出过一次数据备份", icon: "💾", hue: 160, hidden: true, event: "exported_backup" },
];

export const ACH_GROUPS: string[] = [...new Set(ACHIEVEMENTS.map((a) => a.group))];

export function achById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/** 当前数据满足的徽章 id 集合(仅数据型;事件型不在此)。 */
export function evaluateAchievements(input: AchInput): Set<string> {
  const s = new Set<string>();
  for (const a of ACHIEVEMENTS) {
    if (a.test && a.test(input)) s.add(a.id);
  }
  return s;
}
