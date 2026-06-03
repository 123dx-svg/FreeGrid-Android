// Cloudflare Pages Function —— GitHub Release 更新代理(给墙内用户绕过对 GitHub 的封锁)。
// CF 边缘能直连 GitHub,用户只跟 CF 通信:
//   GET /updater/latest.json        → 取 GitHub 最新 latest.json,把各平台 url 改写成走本代理
//   GET /updater/download/<tag>/<f> → 流式转发对应 release 安装包(原样字节,latest.json 内的签名照常验过)
// 任何失败都返回非 2xx,让 Tauri 更新器回退到 GitHub 主 endpoint。
const REPO = "coni555/FreeGrid-Web";
const UA = "freegrid-updater-proxy";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const sub = decodeURIComponent(url.pathname.replace(/^\/updater\//, "").replace(/\/+$/, ""));

  // ── 1) 更新清单:取最新 + 改写下载地址 ──
  if (sub === "latest.json") {
    let upstream;
    try {
      upstream = await fetch(`https://github.com/${REPO}/releases/latest/download/latest.json`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        redirect: "follow",
      });
    } catch {
      return new Response("upstream fetch failed", { status: 502 });
    }
    if (!upstream.ok) return new Response("upstream " + upstream.status, { status: 502 });

    let manifest;
    try {
      manifest = await upstream.json();
    } catch {
      return new Response("bad manifest", { status: 502 });
    }

    const ghPrefix = `https://github.com/${REPO}/releases/download/`;
    const proxyPrefix = `${url.origin}/updater/download/`;
    for (const k of Object.keys(manifest.platforms || {})) {
      const p = manifest.platforms[k];
      if (p && typeof p.url === "string" && p.url.startsWith(ghPrefix)) {
        p.url = proxyPrefix + p.url.slice(ghPrefix.length);
      }
    }
    return new Response(JSON.stringify(manifest), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      },
    });
  }

  // ── 2) 安装包:流式转发(支持 Range 续传)──
  if (sub.startsWith("download/")) {
    const rel = sub.slice("download/".length); // <tag>/<file>
    // 限定 <段>/<段>,挡掉路径穿越 / SSRF 到任意 GitHub 路径
    if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(rel)) {
      return new Response("bad path", { status: 400 });
    }
    const fwd = { "User-Agent": UA };
    const range = context.request.headers.get("range");
    if (range) fwd["Range"] = range;

    let upstream;
    try {
      upstream = await fetch(`https://github.com/${REPO}/releases/download/${rel}`, {
        headers: fwd,
        redirect: "follow",
      });
    } catch {
      return new Response("upstream fetch failed", { status: 502 });
    }
    if (!upstream.ok && upstream.status !== 206) {
      return new Response("upstream " + upstream.status, { status: 502 });
    }
    const headers = new Headers();
    headers.set("content-type", upstream.headers.get("content-type") || "application/octet-stream");
    for (const h of ["content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    headers.set("cache-control", "public, max-age=86400");
    return new Response(upstream.body, { status: upstream.status, headers });
  }

  return new Response("not found", { status: 404 });
}
