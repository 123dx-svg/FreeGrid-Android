import { describe, it, expect } from "vitest";
import { monthlySavingByPct, monthlySavingByPerDay, annualSaving } from "./sim-spend";

describe("sim-spend · 省钱模拟", () => {
  it("按百分比省 + 夹取", () => {
    expect(monthlySavingByPct(1000, 30)).toBe(300);
    expect(monthlySavingByPct(1000, 150)).toBe(1000); // >100 夹到 100
    expect(monthlySavingByPct(1000, -5)).toBe(0); // <0 夹到 0
  });

  it("按每天少花 × 30", () => {
    expect(monthlySavingByPerDay(20)).toBe(600);
    expect(monthlySavingByPerDay(-3)).toBe(0);
  });

  it("每年省 = 月省 × 12", () => {
    expect(annualSaving(300)).toBe(3600);
    expect(annualSaving(-5)).toBe(0);
  });
});
