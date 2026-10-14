import { describe, expect, it } from "vitest";
import { compareAndroidVersions, findReleaseApkAsset, formatReleaseNotes } from "./android-update-utils";

describe("Android 更新版本", () => {
  it("比较数字版本段而不是字符串顺序", () => {
    expect(compareAndroidVersions("v2.76", "2.75")).toBe(1);
    expect(compareAndroidVersions("2.10", "2.9")).toBe(1);
    expect(compareAndroidVersions("2.75", "v2.75.0")).toBe(0);
    expect(compareAndroidVersions("2.74", "2.75")).toBe(-1);
  });

  it("拒绝不能安全比较的版本格式", () => {
    expect(compareAndroidVersions("latest", "2.75")).toBeNull();
  });

  it("优先选带版本号的 APK，单 APK 时兼容 Gradle 默认文件名", () => {
    const versioned = { name: "FreeGrid-Android-v2.76.apk" };
    expect(findReleaseApkAsset([{ name: "app-release.apk" }, versioned], "v2.76")).toBe(versioned);
    expect(findReleaseApkAsset([{ name: "app-release.apk" }], "v2.76")?.name).toBe("app-release.apk");
    expect(findReleaseApkAsset([{ name: "app-release.apk" }, { name: "debug.apk" }], "v2.76")).toBeNull();
  });

  it("提取更新说明并排除安装说明", () => {
    expect(formatReleaseNotes("## 更新内容\n- 修复问题\n\n## 安装\n请覆盖安装")).toEqual([
      "更新内容",
      "修复问题",
    ]);
  });
});