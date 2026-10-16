import { CapacitorHttp } from "@capacitor/core";
import { revalueForeignAssetItems } from "./store.svelte";
import { localDayKey, ratesFromCnyBaseResponse, shouldFetchDailyRates, type CnyRates } from "./currency";

const CACHE_KEY = "freegrid-fx-v1";
const FX_URL = "https://api.frankfurter.dev/v1/latest?base=CNY&symbols=HKD,USD";

interface FxCache {
  checkedOn: string;
  succeededOn: string;
  date: string;
  rates: CnyRates | null;
}

function loadCache(): FxCache {
  const empty: FxCache = { checkedOn: "", succeededOn: "", date: "", rates: null };
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return empty;
    const cache = JSON.parse(raw) as Partial<FxCache>;
    const hkd = cache.rates?.HKD;
    const usd = cache.rates?.USD;
    return {
      checkedOn: typeof cache.checkedOn === "string" ? cache.checkedOn : "",
      succeededOn: typeof cache.succeededOn === "string" ? cache.succeededOn : "",
      date: typeof cache.date === "string" ? cache.date : "",
      rates:
        typeof hkd === "number" && Number.isFinite(hkd) && hkd > 0 &&
        typeof usd === "number" && Number.isFinite(usd) && usd > 0
          ? { HKD: hkd, USD: usd }
          : null,
    };
  } catch {
    return empty;
  }
}

const cached = loadCache();
const checkedToday = cached.checkedOn === localDayKey();

export const fxState = $state({
  rates: cached.rates,
  date: cached.date,
  status: checkedToday && cached.succeededOn !== cached.checkedOn ? "error" as "idle" | "checking" | "ready" | "error" : cached.rates ? "ready" as "idle" | "checking" | "ready" | "error" : "idle" as "idle" | "checking" | "ready" | "error",
});

let checkedOn = cached.checkedOn;
let succeededOn = cached.succeededOn;
let inFlight: Promise<void> | null = null;

function persistCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      checkedOn,
      succeededOn,
      date: fxState.date,
      rates: fxState.rates,
    } satisfies FxCache));
  } catch {
    // Rate caching is best-effort when local storage is unavailable.
  }
}

export function refreshDailyFxRates(): Promise<void> {
  if (inFlight) return inFlight;
  const today = localDayKey();
  if (!shouldFetchDailyRates(checkedOn, today)) {
    if (succeededOn !== today) fxState.status = "error";
    return Promise.resolve();
  }

  checkedOn = today;
  fxState.status = "checking";
  persistCache();

  inFlight = (async () => {
    try {
      const response = await CapacitorHttp.request({
        url: FX_URL,
        method: "GET",
        headers: { Accept: "application/json" },
        connectTimeout: 12000,
        readTimeout: 12000,
      });
      if (response.status < 200 || response.status >= 300) throw new Error(`HTTP ${response.status}`);

      let data: unknown = response.data;
      if (typeof data === "string") data = JSON.parse(data);
      const result = ratesFromCnyBaseResponse(data);
      if (!result) throw new Error("Invalid exchange-rate response");

      fxState.rates = result.rates;
      fxState.date = result.date;
      fxState.status = "ready";
      succeededOn = today;
      persistCache();
      revalueForeignAssetItems(result.rates);
    } catch {
      fxState.status = "error";
      persistCache();
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}