import { describe, it, expect } from "vitest";
import { equalInstallment, equalPrincipal, installmentFee, realizedGain, lostFreedomDays } from "./sim-finance";

describe("月供:等额本息 / 等额本金", () => {
  it("等额本息 100万/30年/4.9% → 月供~5307、总利息~91万", () => {
    const r = equalInstallment(1_000_000, 4.9, 360);
    expect(r.monthly).toBeGreaterThan(5250);
    expect(r.monthly).toBeLessThan(5360);
    expect(r.totalInterest).toBeGreaterThan(880_000);
    expect(r.totalInterest).toBeLessThan(940_000);
    expect(r.descending).toBe(false);
  });
  it("等额本金 100万/30年/4.9% → 总利息~73.7万、月供递减", () => {
    const r = equalPrincipal(1_000_000, 4.9, 360);
    expect(r.totalInterest).toBeGreaterThan(720_000);
    expect(r.totalInterest).toBeLessThan(755_000);
    expect(r.firstMonthly).toBeGreaterThan(r.lastMonthly); // 递减
    expect(r.descending).toBe(true);
  });
  it("等额本金总利息 < 等额本息", () => {
    const ei = equalInstallment(1_000_000, 4.9, 360);
    const ep = equalPrincipal(1_000_000, 4.9, 360);
    expect(ep.totalInterest).toBeLessThan(ei.totalInterest);
  });
  it("零利率退化 = 本金/期,无利息", () => {
    const r = equalInstallment(12000, 0, 12);
    expect(r.monthly).toBeCloseTo(1000, 5);
    expect(r.totalInterest).toBeCloseTo(0, 5);
  });
});

describe("分期费率:真实年化 ≈ 宣传×2", () => {
  it("1万/12期/0.6%月 → 月供~893、手续费720、真实年化~13%", () => {
    const r = installmentFee(10000, 0.6, 12);
    expect(r.monthly).toBeCloseTo(893.33, 1);
    expect(r.totalInterest).toBeCloseTo(720, 5);
    // 宣传 0.6%×12=7.2%,真实年化约其 1.8~2 倍
    expect(r.apr).toBeGreaterThan(12);
    expect(r.apr).toBeLessThan(14);
  });
});

describe("翻译成自由", () => {
  it("总利息 ÷ 日均净烧 = 少自由天数;净烧≤0 → ∞", () => {
    expect(lostFreedomDays(3810, 38.1)).toBeCloseTo(100, 5);
    expect(lostFreedomDays(1000, 0)).toBe(Infinity);
    expect(lostFreedomDays(0, 38.1)).toBe(0);
  });
  it("投资实得 = 本金×年化×年(单利)", () => {
    expect(realizedGain(100000, 8, 0.25)).toBeCloseTo(2000, 5);
    expect(realizedGain(100000, 8, 3)).toBeCloseTo(24000, 5);
  });
});
