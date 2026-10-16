export type AssetCurrency = "CNY" | "HKD" | "USD";

export interface CnyRates {
  HKD: number;
  USD: number;
}

export function cnyPerUnit(currency: AssetCurrency, rates: CnyRates | null): number | null {
  if (currency === "CNY") return 1;
  const rate = rates?.[currency];
  return typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : null;
}

export function convertToCny(amount: number, currency: AssetCurrency, rates: CnyRates | null): number | null {
  if (!Number.isFinite(amount) || amount < 0) return null;
  const rate = cnyPerUnit(currency, rates);
  return rate == null ? null : Math.round(amount * rate * 100) / 100;
}

export function ratesFromCnyBaseResponse(data: unknown): { rates: CnyRates; date: string } | null {
  if (!data || typeof data !== "object") return null;
  const response = data as { base?: unknown; date?: unknown; rates?: Record<string, unknown> };
  const hkdQuote = response.rates?.HKD;
  const usdQuote = response.rates?.USD;
  if (
    response.base !== "CNY" ||
    typeof response.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(response.date) ||
    typeof hkdQuote !== "number" ||
    !Number.isFinite(hkdQuote) ||
    hkdQuote <= 0 ||
    typeof usdQuote !== "number" ||
    !Number.isFinite(usdQuote) ||
    usdQuote <= 0
  ) {
    return null;
  }

  return { rates: { HKD: 1 / hkdQuote, USD: 1 / usdQuote }, date: response.date };
}

export function localDayKey(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function shouldFetchDailyRates(checkedOn: string, today: string): boolean {
  return checkedOn !== today;
}