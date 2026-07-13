// ============================================================================
// 经营等级 · 响应式状态(runes)。等级由徽章数派生(天然粘性,只增不减);
// 升级检测:仅存"已庆祝到的等级" freegrid-level-v1={shown},首启静默设基线。
// ============================================================================
import { unlockedCount } from "./achievements.svelte";
import { levelForCount, levelReached, type LevelState } from "./level";

const KEY = "freegrid-level-v1";

function loadShown(): number {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o && typeof o.shown === "number") return o.shown;
    }
  } catch {
    /* 忽略 */
  }
  return -1; // -1 = 未初始化(首启静默设基线)
}

let shown = $state(loadShown());
let pending = $state<LevelState | null>(null); // 待庆祝的升级

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ shown }));
  } catch {
    /* 忽略 */
  }
}

/** 当前等级(响应式:读徽章数)。 */
export function currentLevel(): LevelState {
  return levelForCount(unlockedCount());
}

/** 某等级是否已达(外观/进阶门控)。 */
export function reached(levelIndex: number): boolean {
  return levelReached(unlockedCount(), levelIndex);
}

/** 检测升级:徽章变化后调用(由 LevelUpToast 的 $effect 驱动)。 */
export function syncLevel() {
  const lv = levelForCount(unlockedCount());
  if (shown < 0) {
    shown = lv.index; // 首启静默基线,不弹
    persist();
    return;
  }
  if (lv.index > shown) {
    pending = lv;
    shown = lv.index;
    persist();
  }
}

export function pendingLevelUp(): LevelState | null {
  return pending;
}
export function dismissLevelUp() {
  pending = null;
}
