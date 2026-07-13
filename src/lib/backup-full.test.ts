import { describe, it, expect, beforeEach } from "vitest";
import { snapshot, restore, buildFullBackup, parseFullBackup, EXPORT_KEYS, APP_DATA_KEYS } from "./backup-full";

// 简易 localStorage mock(node 环境无 localStorage)
function installLocalStorage() {
  const m = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
  return m;
}

describe("backup-full", () => {
  beforeEach(() => installLocalStorage());

  it("snapshot 只收已存在的键", () => {
    localStorage.setItem("freegrid-data-v1", "D");
    localStorage.setItem("freegrid-settings-v1", "S");
    const snap = snapshot(APP_DATA_KEYS);
    expect(snap["freegrid-data-v1"]).toBe("D");
    expect(snap["freegrid-settings-v1"]).toBe("S");
    expect("freegrid-badges-v1" in snap).toBe(false); // 未设置 → 不在快照
  });

  it("restore overwrite:false 只补缺失键", () => {
    localStorage.setItem("freegrid-data-v1", "OLD");
    const n = restore({ "freegrid-data-v1": "NEW", "freegrid-badges-v1": "B" }, { overwrite: false });
    expect(localStorage.getItem("freegrid-data-v1")).toBe("OLD"); // 已存在 → 不覆盖
    expect(localStorage.getItem("freegrid-badges-v1")).toBe("B"); // 缺失 → 补上
    expect(n).toBe(1);
  });

  it("restore overwrite:true 整机覆盖", () => {
    localStorage.setItem("freegrid-data-v1", "OLD");
    restore({ "freegrid-data-v1": "NEW" }, { overwrite: true });
    expect(localStorage.getItem("freegrid-data-v1")).toBe("NEW");
  });

  it("restore 拒绝非 freegrid- 前缀键", () => {
    restore({ "evil-key": "x", "freegrid-fq-v1": "F" } as any, { overwrite: true });
    expect(localStorage.getItem("evil-key")).toBe(null);
    expect(localStorage.getItem("freegrid-fq-v1")).toBe("F");
  });

  it("完整备份不含 AI 密钥键", () => {
    localStorage.setItem("freegrid-data-v1", "D");
    localStorage.setItem("freegrid-ai-v1", "SECRET");
    const b = buildFullBackup();
    expect(b.kind).toBe("freegrid-full");
    expect("freegrid-data-v1" in b.keys).toBe(true);
    expect("freegrid-ai-v1" in b.keys).toBe(false);
    expect(EXPORT_KEYS.includes("freegrid-ai-v1" as any)).toBe(false);
  });

  it("parseFullBackup 认格式", () => {
    const good = JSON.stringify(buildFullBackup());
    expect(parseFullBackup(good)?.kind).toBe("freegrid-full");
    expect(parseFullBackup('{"expenses":[]}')).toBe(null); // 账单备份不是完整备份
    expect(parseFullBackup("not json")).toBe(null);
  });
});
