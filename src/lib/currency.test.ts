import { describe, expect, it } from "vitest";
import { convertToCny, localDayKey, ratesFromCnyBaseResponse, shouldFetchDailyRates } from "./currency";

describe("资产外币换算", () => {
  it("用 CNY 基准报价的倒数换算 HKD / USD", () => {
    const result = ratesFromCnyBaseResponse({
      base: "CNY",
      date: "2026-10-16",
      rates: { HKD: 1.08, USD: 0.14 },
    });
    expect(result?.rates.HKD).toBeCloseTo(1 / 1.08, 10);
    expect(result?.rates.USD).toBeCloseTo(1 / 0.14, 10);
    expect(result?.date).toBe("2026-10-16");
  });

  it("换算成人民币并保留分", () => {
    expect(convertToCny(100, "CNY", null)).toBe(100);
    expect(convertToCny(100, "HKD", { HKD: 0.9259, USD: 7.14 })).toBe(92.59);
    expect(convertToCny(1, "USD", { HKD: 0.9259, USD: 7.145 })).toBe(7.15);
    expect(convertToCny(100, "USD", null)).toBeNull();
  });

  it("拒绝异常报价并按本地日期限制每日查询", () => {
    expect(ratesFromCnyBaseResponse({ base: "USD", date: "2026-10-16", rates: { HKD: 1, USD: 1 } })).toBeNull();
    expect(ratesFromCnyBaseResponse({ base: "CNY", date: "bad", rates: { HKD: 1, USD: 1 } })).toBeNull();
    expect(localDayKey(new Date(2026, 9, 16))).toBe("2026-10-16");
    expect(shouldFetchDailyRates("2026-10-16", "2026-10-16")).toBe(false);
    expect(shouldFetchDailyRates("2026-10-15", "2026-10-16")).toBe(true);
  });
});