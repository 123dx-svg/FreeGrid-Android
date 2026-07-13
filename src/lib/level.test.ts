import { describe, it, expect } from "vitest";
import { levelForCount, levelReached, LEVELS } from "./level";

describe("经营等级", () => {
  it("边界正确落级", () => {
    expect(levelForCount(0).index).toBe(1);
    expect(levelForCount(1).index).toBe(1);
    expect(levelForCount(2).index).toBe(2);
    expect(levelForCount(4).index).toBe(2);
    expect(levelForCount(5).index).toBe(3);
    expect(levelForCount(8).index).toBe(3);
    expect(levelForCount(9).index).toBe(4);
    expect(levelForCount(13).index).toBe(4);
    expect(levelForCount(14).index).toBe(5); // demo 17 → Lv.5
    expect(levelForCount(17).index).toBe(5);
    expect(levelForCount(18).index).toBe(5);
    expect(levelForCount(19).index).toBe(6);
    expect(levelForCount(24).index).toBe(6);
    expect(levelForCount(25).index).toBe(7);
    expect(levelForCount(29).index).toBe(7);
  });

  it("进度与还差枚数", () => {
    const s = levelForCount(16); // Lv.5(14–18),下一级 19
    expect(s.name).toBe("成长企业");
    expect(s.next?.min).toBe(19);
    expect(s.toNext).toBe(3);
    expect(s.progress).toBeCloseTo((16 - 14) / (19 - 14), 5);
  });

  it("顶级无 next、进度满", () => {
    const s = levelForCount(29);
    expect(s.next).toBeNull();
    expect(s.toNext).toBe(0);
    expect(s.progress).toBe(1);
  });

  it("levelReached 门控", () => {
    expect(levelReached(5, 3)).toBe(true); // Lv.3 已达
    expect(levelReached(4, 3)).toBe(false); // 仍 Lv.2
    expect(levelReached(17, 5)).toBe(true);
    expect(levelReached(17, 6)).toBe(false);
  });

  it("阶梯单调递增", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].min).toBeGreaterThan(LEVELS[i - 1].min);
      expect(LEVELS[i].index).toBe(LEVELS[i - 1].index + 1);
    }
  });
});
