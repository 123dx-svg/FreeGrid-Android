import { Capacitor, registerPlugin } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { compareAndroidVersions, findReleaseApkAsset, formatReleaseNotes } from "./android-update-utils";

interface ApkInstallerPlugin {
  canInstallPackages(): Promise<{ allowed: boolean }>;
  openInstallSettings(): Promise<void>;
  openInstaller(options: { path: string }): Promise<void>;
}

interface GitHubRelease {
  tag_name: string;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  assets: Array<{ name: string; browser_download_url: string }>;
}

const ApkInstaller = registerPlugin<ApkInstallerPlugin>("ApkInstaller");
const RELEASE_API = "https://api.github.com/repos/123dx-svg/FreeGrid-Android/releases/latest";
const RELEASE_PATH_PREFIX = "/123dx-svg/FreeGrid-Android/releases/download/";

export const androidUpdateState = $state({
  available: false,
  dismissed: false,
  version: "",
  notes: [] as string[],
  status: "idle" as "idle" | "checking" | "downloading" | "permission" | "installing" | "ready" | "uptodate" | "error",
  error: "",
  downloadUrl: "",
  downloadedPath: "",
});

export async function checkForAndroidUpdate(): Promise<void> {
  if (Capacitor.getPlatform() !== "android" || androidUpdateState.status === "checking") return;

  androidUpdateState.status = "checking";
  androidUpdateState.error = "";
  try {
    const [{ App }, response] = await Promise.all([
      import("@capacitor/app"),
      fetch(RELEASE_API, {
        cache: "no-store",
        headers: { Accept: "application/vnd.github+json" },
      }),
    ]);
    if (!response.ok) throw new Error(`GitHub release request failed: ${response.status}`);

    const release = (await response.json()) as GitHubRelease;
    if (!release.tag_name || release.draft || release.prerelease) throw new Error("Invalid release metadata");

    const version = release.tag_name.replace(/^v/i, "");
    const current = await App.getInfo();
    const comparison = compareAndroidVersions(version, current.version);
    if (comparison == null) throw new Error("Invalid release version");
    if (comparison <= 0) {
      androidUpdateState.available = false;
      androidUpdateState.status = "uptodate";
      return;
    }

    const asset = findReleaseApkAsset(release.assets, release.tag_name);
    if (!asset) throw new Error("Release APK is missing");

    const downloadUrl = new URL(asset.browser_download_url);
    if (
      downloadUrl.protocol !== "https:" ||
      downloadUrl.hostname !== "github.com" ||
      !downloadUrl.pathname.startsWith(`${RELEASE_PATH_PREFIX}${release.tag_name}/`)
    ) {
      throw new Error("Release APK URL is not trusted");
    }

    androidUpdateState.available = true;
    androidUpdateState.dismissed = false;
    androidUpdateState.version = version;
    androidUpdateState.notes = formatReleaseNotes(release.body ?? "");
    androidUpdateState.downloadUrl = downloadUrl.href;
    androidUpdateState.downloadedPath = "";
    androidUpdateState.status = "idle";
  } catch {
    androidUpdateState.status = "error";
    androidUpdateState.error = "暂时无法检查更新，请检查网络后重试。";
  }
}

export async function installAndroidUpdate(): Promise<void> {
  if (!androidUpdateState.available || !androidUpdateState.downloadUrl) return;

  try {
    const permission = await ApkInstaller.canInstallPackages();
    if (!permission.allowed) {
      androidUpdateState.status = "permission";
      await ApkInstaller.openInstallSettings();
      return;
    }

    if (!androidUpdateState.downloadedPath) {
      androidUpdateState.status = "downloading";
      const result = await Filesystem.downloadFile({
        url: androidUpdateState.downloadUrl,
        path: `FreeGrid-Android-v${androidUpdateState.version}.apk`,
        directory: Directory.Cache,
      });
      if (!result.path) throw new Error("APK download returned no file path");
      androidUpdateState.downloadedPath = result.path;
    }

    androidUpdateState.status = "installing";
    await ApkInstaller.openInstaller({ path: androidUpdateState.downloadedPath });
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    androidUpdateState.status = "error";
    androidUpdateState.error =
      code === "wrong_signature"
        ? "APK 签名不匹配，已阻止安装。"
        : code === "old_version"
          ? "此版本不高于当前安装版本，已停止安装。"
          : code === "wrong_package"
            ? "安装包不属于自由日记，已阻止安装。"
            : "更新失败，请检查网络后重试。";
  }
}

export function dismissAndroidUpdate(): void {
  if (androidUpdateState.status === "downloading" || androidUpdateState.status === "installing") return;
  androidUpdateState.dismissed = true;
}

export async function resumeAndroidUpdate(isActive: boolean): Promise<void> {
  if (!isActive || androidUpdateState.status !== "installing") return;

  try {
    const { App } = await import("@capacitor/app");
    const current = await App.getInfo();
    const comparison = compareAndroidVersions(androidUpdateState.version, current.version);
    if (comparison != null && comparison <= 0) {
      androidUpdateState.available = false;
      androidUpdateState.status = "uptodate";
      androidUpdateState.downloadedPath = "";
      return;
    }
  } catch {
    // If package info cannot be read, leave the update available for another attempt.
  }
  androidUpdateState.status = androidUpdateState.downloadedPath ? "ready" : "idle";
}