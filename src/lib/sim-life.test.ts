import { describe, it, expect } from "vitest";
import { jobStats, daysPerWeek, startupMonthlyBurn, startupRunwayMonths, monthlyVsEmployed, freedomDaysFor } from "./sim-life";

describe("跳槽:真实时薪", () => {
  it("休息类型 → 每周天数", () => {
    expect(daysPerWeek("double")).toBe(5);
    expect(daysPerWeek("bigsmall")).toBe(5.5);
    expect(daysPerWeek("single")).toBe(6);
    expect(daysPerWeek("none")).toBe(7);
  });
  it("双休 1万/天8h/通勤1h → 真实时薪 ≈ ¥46/h", () => {
    const s = jobStats({ monthlySalary: 10000, hoursPerDay: 8, commutePerDay: 1, rest: "double" });
    expect(s.annualIncome).toBe(120000);
    expect(s.workDays).toBe(240); // 5×48
    expect(s.annualWork).toBe(1920);
    expect(s.annualCommute).toBe(240);
    expect(s.realHourly).toBeCloseTo(120000 / 2160, 1); // ≈55.6
  });
  it("总额更高但工时/通勤更长 → 真实时薪可能更低", () => {
    const now = jobStats({ monthlySalary: 10000, hoursPerDay: 8, commutePerDay: 1, rest: "double" });
    const next = jobStats({ monthlySalary: 13000, hoursPerDay: 10, commutePerDay: 2, rest: "single" });
    expect(next.annualIncome).toBeGreaterThan(now.annualIncome); // 总额更高
    expect(next.realHourly).toBeLessThan(now.realHourly); // 真实时薪反而更低
  });
});

describe("创业:烧钱跑道", () => {
  it("月净烧 = 月消费 + (固定成本 − 营收)", () => {
    expect(startupMonthlyBurn(5000, 20000, 8000)).toBe(17000);
    expect(startupMonthlyBurn(5000, 10000, 20000)).toBe(-5000); // 盈利
  });
  it("跑道 = (净值−启动)/月净烧;盈利→∞", () => {
    expect(startupRunwayMonths(200000, 50000, 15000)).toBeCloseTo(10, 5);
    expect(startupRunwayMonths(200000, 50000, -5000)).toBe(Infinity);
    expect(startupRunwayMonths(40000, 50000, 15000)).toBe(0); // 启动已超净值
  });
  it("比打工每月少攒 = 放弃月薪 − (营收−固定成本)", () => {
    expect(monthlyVsEmployed(15000, 20000, 8000)).toBe(15000 - (8000 - 20000)); // 27000
  });
});

describe("金额换自由天数", () => {
  it("金额 ÷ 日均净烧;净烧≤0 → ∞", () => {
    expect(freedomDaysFor(3810, 38.1)).toBeCloseTo(100, 5);
    expect(freedomDaysFor(1000, 0)).toBe(Infinity);
    expect(freedomDaysFor(0, 38.1)).toBe(0);
  });
});
