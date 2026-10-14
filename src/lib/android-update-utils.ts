export function compareAndroidVersions(left: string, right: string): number | null {
  const parse = (version: string) => {
    const match = version.trim().match(/^v?(\d+(?:\.\d+){1,3})$/i);
    return match?.[1].split(".").map(Number) ?? null;
  };

  const leftParts = parse(left);
  const rightParts = parse(right);
  if (!leftParts || !rightParts) return null;

  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

export function findReleaseApkAsset<T extends { name: string }>(assets: T[], tag: string): T | null {
  const apkAssets = assets.filter((asset) => asset.name.toLowerCase().endsWith(".apk"));
  const versionedName = `FreeGrid-Android-${tag}.apk`.toLowerCase();
  return apkAssets.find((asset) => asset.name.toLowerCase() === versionedName) ?? (apkAssets.length === 1 ? apkAssets[0] : null);
}

export function formatReleaseNotes(body: string): string[] {
  const updateSection = body.split(/^\s*##\s*(?:安装|Installation)(?:\s|$)/im)[0] ?? "";
  return updateSection
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*]\s+/, "").replace(/^\s*#{1,6}\s+/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}