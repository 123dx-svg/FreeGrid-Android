import { describe, it, expect } from "vitest";
import {
  trackDays,
  dailyBurn,
  dailyPassive,
  passiveRatio,
  freedomDays,
  freedomDaysDisplay,
  gridState,
  freedomDaysHistory,
  deltaSummary,
  depleteDate,
  daysBetween,
  financialState,
  WARN_DAYS,
} from "./freedom-math";

describe("基础计量", () => {
  it("trackDays 含今天 +1,最小 1", () => {
    const first = new Date(2024, 8, 7); // 2024-09-07
    const now = new Date(2024, 8, 7, 14, 0); // 同一天
    expect(trackDays(first, now)).toBe(1); // 当天 = 1 天
    expect(trackDays(new Date(2024, 8, 6), now)).toBe(2); // 昨天起 = 2 天
    expect(trackDays(null)).toBe(1); // 没记账 = 1
  });

  it("dailyBurn / dailyPassive / passiveRatio", () => {
    expect(dailyBurn(3100, 31)).toBeCloseTo(100, 6);
    expect(dailyBurn(100, 0)).toBe(0); // 除零保护
    expect(dailyPassive([{ monthlyAmount: 3000 }])).toBeCloseTo(100, 6); // 3000/30
    expect(passiveRatio(100, 50)).toBe(2);
    expect(passiveRatio(100, 0)).toBe(0);
  });
});

describe("自由天数核心", () => {
  it("78 天案例(真机口径:净值 5600 ÷ 日均 71.79)", () => {
    const fd = freedomDays(5600, 5600 / 78, 0);
    expect(fd).toBeCloseTo(78, 6);
    expect(freedomDaysDisplay(fd)).toBe("78");
  });

  it("floor 一致性:77.9 必须显示 77,不能四舍五入成 78(Hero/Grid 同口径)", () => {
    expect(freedomDaysDisplay(77.9)).toBe("77");
    expect(freedomDaysDisplay(77.0)).toBe("77");
    expect(freedomDaysDisplay(0.4)).toBe("0");
  });

  it("∞ 案例:被动覆盖 ≥ 100% → Infinity → 显示 ∞", () => {
    // 日均消费 100,日均被动 120 → 净消耗 0
    expect(freedomDays(5600, 100, 120)).toBe(Infinity);
    expect(freedomDays(5600, 100, 100)).toBe(Infinity); // 正好覆盖也算
    expect(freedomDaysDisplay(Infinity)).toBe("∞");
    expect(freedomDaysDisplay(NaN)).toBe("∞");
  });

  it("分档:天/月/年三档", () => {
    expect(freedomDaysDisplay(127)).toBe("127"); // 天
    expect(freedomDaysDisplay(365 * 2)).toBe(String(Math.trunc((365 * 2) / 30.44))); // 月
    expect(freedomDaysDisplay(3650)).toBe((3650 / 365.25).toFixed(1)); // 年,1 位小数
  });

  it("负净值不产生负自由天数", () => {
    expect(freedomDays(-100, 50, 0)).toBe(0);
  });
});

describe("生命网格 gridState", () => {
  it("被动完全覆盖 → 年档满格 99", () => {
    const g = gridState(3000, 2000, 100, 150); // 净消耗 0
    expect(g.unit).toBe("year");
    expect(g.count).toBe(99);
    expect(g.isOverflow).toBe(true);
  });

  it("日档 + 双色分配(蓝=资产在前,金=现金在后)", () => {
    // 净值 100,日均 1 → 100 天;资产 30 / 现金 70 → 蓝 30 金 70
    const g = gridState(30, 70, 1, 0);
    expect(g.unit).toBe("day");
    expect(g.count).toBe(100);
    expect(g.blueDays).toBe(30);
    expect(g.yellowDays).toBe(70);
    expect(g.blueDays + g.yellowDays).toBe(g.count);
  });

  it("dailyBurn=0 → 空网格", () => {
    expect(gridState(100, 100, 0).count).toBe(0);
  });
});

describe("历史趋势(自然日归属 —— 关键回归)", () => {
  // 固定 now,避免依赖真实时间
  const now = new Date(2026, 4, 30, 10, 0); // 2026-05-30 10:00
  const first = new Date(2026, 3, 30); // 30 天前

  it("终点当天到账的收入,不能被误判成'今天之后'减掉", () => {
    // 一笔今天(同终点日)晚些时候的收入 1600;一笔 15 天前的支出 300
    const expenses = [{ amount: 300, date: new Date(2026, 4, 15) }];
    const incomes = [{ amount: 1600, date: new Date(2026, 4, 30, 18, 0) }]; // 今天 18:00,时间戳晚于 weekEnd 00:00
    const currentNetWorth = 5000;

    const hist = freedomDaysHistory(expenses, incomes, currentNetWorth, first, 0, 12, now);
    expect(hist.length).toBeGreaterThanOrEqual(2);

    const end = hist[hist.length - 1];
    // 终点 weekEnd = 今天
    expect(daysBetween(end.date, now)).toBe(0);

    // trackDays_i = 31, dailyBurn = 300/31, netWorth 应为完整 5000(收入没被减掉)
    const expectedDays = 5000 / (300 / 31);
    expect(end.freedomDays).toBeCloseTo(expectedDays, 4);
    // 反例守卫:若 bug 复发(收入被减),会变成 3400/(300/31),必须不等
    expect(end.freedomDays).not.toBeCloseTo(3400 / (300 / 31), 1);
  });

  it("trackDays < 14 天数据不足返回空", () => {
    const shortFirst = new Date(2026, 4, 25); // 5 天前
    expect(freedomDaysHistory([], [], 1000, shortFirst, 0, 12, now)).toEqual([]);
  });

  it("deltaSummary 两端 floor", () => {
    const hist = [
      { date: new Date(2026, 0, 1), freedomDays: 50.9 },
      { date: new Date(2026, 0, 8), freedomDays: 78.9 },
    ];
    expect(deltaSummary(hist)).toEqual({ start: 50, end: 78, delta: 28 });
  });
});

describe("见底日期", () => {
  it("∞ 或超 5*1825 返回 null,有限值返回今天+round 天", () => {
    expect(depleteDate(Infinity)).toBeNull();
    expect(depleteDate(0)).toBeNull();
    const now = new Date(2026, 4, 30);
    const d = depleteDate(78, now);
    expect(d).not.toBeNull();
    expect(daysBetween(now, d!)).toBe(78);
  });
});

describe("financialState 四档", () => {
  it("∞(被动覆盖)→ free", () => {
    expect(financialState(5000, Infinity)).toBe("free");
    expect(financialState(-500, Infinity)).toBe("free"); // 被动全覆盖即便负净值也 free
  });
  it("净值≤0 / 自由天数=0 → survival", () => {
    expect(financialState(0, 0)).toBe("survival");
    expect(financialState(-469, 0)).toBe("survival");
  });
  it("0<天数<WARN_DAYS → warning", () => {
    expect(financialState(500, 1)).toBe("warning");
    expect(financialState(500, WARN_DAYS - 0.5)).toBe("warning");
  });
  it("天数≥WARN_DAYS → normal", () => {
    expect(financialState(5000, WARN_DAYS)).toBe("normal");
    expect(financialState(5000, 146)).toBe("normal");
  });
});
