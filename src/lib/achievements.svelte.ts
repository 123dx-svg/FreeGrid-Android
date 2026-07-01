// ============================================================================
// 成就徽章 —— 状态 / 持久化 / 对账 / 庆祝队列(Svelte 5 runes 模块状态)。
// 持久化:独立 key `freegrid-badges-v1`(不动任何现有键)。
// 粘性解锁:一旦点亮永不熄灭(只增不减),并记录点亮时间。
// 首次上线:静默设基线(已满足的直接点亮,不弹动画),之后新解锁才庆祝。
// ============================================================================
import { ACHIEVEMENTS, evaluateAchievements, achById, type AchInput, type Achievement } from "./achievements";

const KEY = "freegrid-badges-v1";

interface BadgeStore {
  v: number;
  seeded: boolean;
  unlocked: Record<string, string>; // id → 解锁 ISO 时间
}

function load(): BadgeStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o && typeof o === "object" && o.unlocked && typeof o.unlocked === "object") {
        return { v: 1, seeded: !!o.seeded, unlocked: o.unlocked as Record<string, string> };
      }
    }
  } catch {
    /* 忽略 */
  }
  return { v: 1, seeded: false, unlocked: {} };
}

let badges = $state<BadgeStore>(load());
// 庆祝队列:每个元素 = 一批同时解锁的徽章(多枚合并成一张卡)
let queue = $state<Achievement[][]>([]);

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(badges));
  } catch {
    /* 忽略 */
  }
}

export function isUnlocked(id: string): boolean {
  return id in badges.unlocked;
}
export function unlockTime(id: string): string | null {
  return badges.unlocked[id] ?? null;
}
export function unlockedCount(): number {
  return Object.keys(badges.unlocked).length;
}
/** 供 BadgeToast 读取的庆祝队列(响应式)。 */
export function celebrationQueue(): Achievement[][] {
  return queue;
}
export function dismissCelebration() {
  queue = queue.slice(1);
}

function enqueue(items: Achievement[]) {
  if (items.length) queue = [...queue, items];
}

/** 对账:算当前满足集,新增的点亮盖时戳;首次静默设基线,之后新解锁入庆祝队列。 */
export function reconcileAchievements(input: AchInput) {
  const satisfied = evaluateAchievements(input);
  const now = new Date().toISOString();

  if (!badges.seeded) {
    const unlocked = { ...badges.unlocked };
    for (const id of satisfied) if (!(id in unlocked)) unlocked[id] = now;
    // 事件型「认识自己」:老用户此前已完成过测试 → 静默补上,不弹庆祝
    if (input.fqDone) {
      const fqB = ACHIEVEMENTS.find((a) => a.event === "completed_fq");
      if (fqB && !(fqB.id in unlocked)) unlocked[fqB.id] = now;
    }
    badges = { v: 1, seeded: true, unlocked };
    persist();
    return;
  }

  const newly: Achievement[] = [];
  const unlocked = { ...badges.unlocked };
  for (const id of satisfied) {
    if (!(id in unlocked)) {
      unlocked[id] = now;
      const a = achById(id);
      if (a) newly.push(a);
    }
  }
  if (newly.length) {
    badges = { ...badges, unlocked };
    persist();
    enqueue(newly);
  }
}

/** 事件型徽章解锁(如查看年报)。主动行为 → 总是庆祝。 */
export function markBadgeEvent(event: string) {
  const a = ACHIEVEMENTS.find((x) => x.event === event);
  if (!a || a.id in badges.unlocked) return;
  badges = { seeded: true, v: 1, unlocked: { ...badges.unlocked, [a.id]: new Date().toISOString() } };
  persist();
  enqueue([a]);
}

/** 便捷对账入口:从仪表盘指标 + store 片段构建 AchInput 并对账(App / FqTest 共用)。 */
export function reconcileFromData(d: {
  trackDays: number;
  netWorth: number;
  freedomDays: number;
  passiveRatio: number;
  expenses: { amount: number }[];
  incomes: { amount: number }[];
  passiveCount: number;
  fqDone: boolean;
}) {
  const ti = d.incomes.reduce((s, i) => s + i.amount, 0);
  const te = d.expenses.reduce((s, e) => s + e.amount, 0);
  reconcileAchievements({
    trackDays: d.trackDays,
    txCount: d.expenses.length + d.incomes.length,
    margin: ti > 0 ? (ti - te) / ti : 0,
    netWorth: d.netWorth,
    freedomDays: d.freedomDays,
    passiveRatio: d.passiveRatio,
    hasPassive: d.passiveCount > 0,
    hasAssets: d.netWorth > 0,
    fqDone: d.fqDone,
  });
}

// ── 跨设备迁移:随 JSON 备份的 app_meta 走(静默恢复,不庆祝)──
export function exportBadgeMeta(): Record<string, string> {
  return { ...badges.unlocked };
}
export function restoreBadgeMeta(incoming?: Record<string, string> | null) {
  if (!incoming || typeof incoming !== "object") return;
  const unlocked = { ...badges.unlocked };
  for (const [id, t] of Object.entries(incoming)) {
    if (typeof t !== "string" || !achById(id)) continue;
    // 并集,取更早的点亮时间
    if (!(id in unlocked) || t < unlocked[id]) unlocked[id] = t;
  }
  badges = { ...badges, seeded: true, unlocked };
  persist();
}
