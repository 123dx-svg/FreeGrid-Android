// ============================================================================
// 财商人格「卡片截图」分享 —— 纯 SVG 生成海报 → canvas 转 PNG → 系统分享。
// 零依赖:不引 html2canvas。小精灵配色在 JS 里解析 color-mix,内联到 SVG,
// 保证在隔离的 SVG 图像里也能正确着色(不会变黑)。
// ============================================================================
import { familyOf, type FqResult } from "./fq-test";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

// 海报固定用浅色底,和主题无关 → 精灵/文字观感稳定
const MIST = "#F2EEE6";
const INK = "#2B2722";
const MUTED = "#8A8178";
const FAINT = "#B4ABA0";
const FONT = "'PingFang SC','Noto Sans CJK SC','Microsoft YaHei','Hiragino Sans GB',sans-serif";

const POLE_WORD: Record<string, string> = {
  开: "开源", 省: "节流", 进: "进取", 稳: "稳健", 即: "即时", 远: "远见", 感: "随心", 研: "精算",
};

// ── 颜色工具:实现 color-mix(in srgb, A p%, B)(含 transparent,预乘 alpha)──
type RGBA = { r: number; g: number; b: number; a: number };
function parseColor(c: string): RGBA {
  if (c === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const h = c.replace("#", "");
  const n = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  return { r: parseInt(n.slice(0, 2), 16), g: parseInt(n.slice(2, 4), 16), b: parseInt(n.slice(4, 6), 16), a: 1 };
}
/** color-mix(in srgb, aHex pct%, bHex) → rgba() 字符串 */
function mix(aHex: string, pct: number, bHex: string): string {
  const A = parseColor(aHex);
  const B = parseColor(bHex);
  const p = pct / 100;
  const outA = p * A.a + (1 - p) * B.a;
  if (outA <= 0) return "rgba(0,0,0,0)";
  const ch = (ca: number, cb: number) => Math.round((p * A.a * ca + (1 - p) * B.a * cb) / outA);
  return `rgba(${ch(A.r, B.r)},${ch(A.g, B.g)},${ch(A.b, B.b)},${outA.toFixed(3)})`;
}
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── 小精灵:内联着色 SVG 片段(镜像 FqEmblem 的 16 变体几何)──
function emblemMarkup(code: string, cx: number, top: number, size: number): string {
  const fam = familyOf(code);
  const b = fam.base;
  const d = fam.deep;
  const inc = (code[0] ?? "开") === "开";
  const adv = (code[1] ?? "稳") === "进";
  const now = (code[2] ?? "远") === "即";
  const feel = (code[3] ?? "研") === "感";

  const body = mix(b, 15, MIST);
  const soft = mix(b, 32, MIST);
  const ridge = mix(d, 26, "transparent");
  const shell = mix(d, 55, "transparent");
  const mouthFill = mix(d, 78, "#000000");
  const flameInner = mix("#ffffff", 70, b);
  const belly = mix(d, 40, "transparent");
  const shadow = mix(d, 22, "transparent");
  const SD = `stroke="${d}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"`;
  const ARM = `stroke="${d}" stroke-width="3.2" fill="none" stroke-linecap="round"`;

  const head = now
    ? `<g>
        <path d="M49 48 C44 28 46 12 53 12 C59 12 58 32 58 48 Z" fill="${soft}" ${SD}/>
        <path d="M52 44 C50 30 51 20 54 20 C56 20 55 32 55 44 Z" fill="${b}"/>
        <path d="M71 48 C76 28 74 12 67 12 C61 12 62 32 62 48 Z" fill="${soft}" ${SD}/>
        <path d="M68 44 C70 30 69 20 66 20 C64 20 65 32 65 44 Z" fill="${b}"/>
       </g>`
    : `<path d="M34 50 C34 24 86 24 86 50 Z" fill="${b}" ${SD}/>
       <path d="M60 27 L60 50 M46 31 L46 50 M74 31 L74 50 M36 44 H84" stroke="${shell}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;

  const chest = adv
    ? `<g>
        <path d="M84 56 C77 50 86 44 82 34 C94 40 95 55 84 56 Z" fill="${b}" stroke="${d}" stroke-width="1.8"/>
        <path d="M85 53 C82 50 86 46 85 42 C90 46 90 53 85 53 Z" fill="${flameInner}"/>
       </g>`
    : `<path d="M54 60 L66 60 L66 69 C66 73 60 76 60 76 C60 76 54 73 54 69 Z" fill="${soft}" ${SD}/>
       <path d="M56.5 66 L59 69 L64 63" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

  const arms = inc
    ? `<path d="M37 68 C27 62 24 47 31 41" ${ARM}/>
       <path d="M83 68 C93 62 96 47 89 41" ${ARM}/>
       <g>
        <circle cx="60" cy="28" r="11" fill="${b}" ${SD}/>
        <text x="60" y="32.5" text-anchor="middle" font-family="${FONT}" font-size="13" font-weight="800" fill="#fff">¥</text>
        <path d="M42 30 l-3 -3 M42 34 l-4 0 M78 30 l3 -3 M78 34 l4 0" stroke="${b}" stroke-width="2" stroke-linecap="round"/>
       </g>`
    : `<path d="M46 74 C44 66 54 62 60 62 C66 62 76 66 74 74 L77 92 C77 98 43 98 43 92 Z" fill="${soft}" ${SD}/>
       <path d="M52 64 L54 60 L66 60 L68 64" ${SD} fill="none"/>
       <text x="60" y="86" text-anchor="middle" font-family="${FONT}" font-size="13" font-weight="800" fill="#fff">¥</text>
       <path d="M36 72 C40 84 50 90 57 90" ${ARM}/>
       <path d="M84 72 C80 84 70 90 63 90" ${ARM}/>`;

  const eyes = feel
    ? `<path d="M51 62 C51 58 46 58 46 62 C46 65 51 68 51 68 C51 68 56 65 56 62 C56 58 51 58 51 62 Z" fill="${d}"/>
       <path d="M69 62 C69 58 64 58 64 62 C64 65 69 68 69 68 C69 68 74 65 74 62 C74 58 69 58 69 62 Z" fill="${d}"/>`
    : `<circle cx="50" cy="63" r="6.5" stroke="${d}" stroke-width="2.4" fill="none"/>
       <circle cx="70" cy="63" r="6.5" stroke="${d}" stroke-width="2.4" fill="none"/>
       <path d="M56.5 63 H63.5" stroke="${d}" stroke-width="2.4"/>
       <circle cx="50" cy="63" r="2" fill="${d}"/>
       <circle cx="70" cy="63" r="2" fill="${d}"/>`;

  const mouth = adv
    ? `<path d="M53 74 Q60 83 67 74 Q60 78 53 74 Z" fill="${mouthFill}"/>`
    : `<path d="M55 76 Q60 80 65 76" stroke="${d}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;

  const feet = adv
    ? `<ellipse cx="50" cy="100" rx="7" ry="4" fill="${d}"/><ellipse cx="72" cy="102" rx="7" ry="4" fill="${d}"/>`
    : `<ellipse cx="49" cy="101" rx="8" ry="4.5" fill="${d}"/><ellipse cx="71" cy="101" rx="8" ry="4.5" fill="${d}"/>`;

  const bel = inc ? `<text x="60" y="90" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="700" fill="${belly}">¥</text>` : "";
  const scale = size / 120;
  const tx = cx - size / 2;

  return `<g transform="translate(${tx.toFixed(1)},${top}) scale(${scale.toFixed(4)})">
    <ellipse cx="60" cy="108" rx="26" ry="4.5" fill="${shadow}"/>
    <g transform="${adv ? "rotate(-6 60 72)" : ""}">
      ${head}
      <rect x="32" y="46" width="56" height="54" rx="24" fill="${body}" ${SD}/>
      <rect x="38" y="52" width="44" height="42" rx="18" stroke="${ridge}" stroke-width="1.4" fill="none"/>
      ${bel}
      ${chest}
      ${arms}
      ${eyes}
      ${mouth}
      ${feet}
    </g>
  </g>`;
}

// ── 海报 SVG(1080×1350,复刻结果卡正面)──
function posterSVG(result: FqResult): string {
  const fam = familyOf(result.code);
  const b = fam.base;
  const d = fam.deep;
  const W = 1080;
  const H = 1350;
  const cx = W / 2;

  const words = result.axes.map((a) => POLE_WORD[a.poleChar] ?? a.poleChar);
  const pillW = 118;
  const pillH = 56;
  const gap = 18;
  const totalW = words.length * pillW + (words.length - 1) * gap;
  let px = cx - totalW / 2;
  const chipFill = mix(b, 14, "#ffffff");
  const chipStroke = mix(b, 48, "#ffffff");
  const chips = words
    .map((w) => {
      const x = px;
      px += pillW + gap;
      return `<g>
        <rect x="${x.toFixed(1)}" y="822" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${chipFill}" stroke="${chipStroke}" stroke-width="1.5"/>
        <text x="${(x + pillW / 2).toFixed(1)}" y="859" text-anchor="middle" font-family="${FONT}" font-size="27" font-weight="600" fill="${d}">${esc(w)}</text>
      </g>`;
    })
    .join("");

  const cardBg = mix(b, 6, MIST);
  const glow = mix(b, 34, "#ffffff");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${mix(b, 12, MIST)}"/>
        <stop offset="1" stop-color="${MIST}"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="${glow}" stop-opacity="0.9"/>
        <stop offset="1" stop-color="${glow}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#bg)"/>
    <rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="56" fill="${cardBg}" stroke="${mix(b, 30, MIST)}" stroke-width="2"/>
    <text x="${cx}" y="150" text-anchor="middle" font-family="${FONT}" font-size="26" font-weight="600" letter-spacing="4" fill="${FAINT}">FREEGRID · 财商人格</text>
    <ellipse cx="${cx}" cy="420" rx="240" ry="240" fill="url(#glow)"/>
    ${emblemMarkup(result.code, cx, 230, 380)}
    <text x="${cx}" y="712" text-anchor="middle" font-family="${FONT}" font-size="76" font-weight="700" fill="${INK}">${esc(result.name)}</text>
    <rect x="${cx - 48}" y="744" width="96" height="5" rx="2.5" fill="${d}"/>
    ${chips}
    <text x="${cx}" y="952" text-anchor="middle" font-family="${FONT}" font-size="32" font-style="italic" fill="${MUTED}">「${esc(result.tagline)}」</text>
    <text x="${cx}" y="1058" text-anchor="middle" font-family="${FONT}" font-size="26" letter-spacing="2" fill="${FAINT}">财商分</text>
    <text x="${cx}" y="1168" text-anchor="middle" font-family="${FONT}" font-size="112" font-weight="300" fill="${INK}">${result.fqFinal}<tspan font-size="40" fill="${FAINT}" dx="8">/100</tspan></text>
    <text x="${cx}" y="1268" text-anchor="middle" font-family="${FONT}" font-size="24" fill="${FAINT}">自由日记 · 测测你的财商人格</text>
  </svg>`;
}

// ── SVG → PNG(canvas,2× 清晰度)──
export async function svgToPngDataUrl(svg: string, w: number, h: number, scale = 2): Promise<string> {
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("svg load failed"));
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d ctx");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

/** 生成人格卡 PNG 的 dataURL(供预览/调试)。 */
export async function renderPersonalityPng(result: FqResult): Promise<string> {
  return svgToPngDataUrl(posterSVG(result), 1080, 1350, 2);
}

/** 分享已生成的 PNG(dataURL)。取消 / 分享失败会向上抛,由调用方决定——**不做文字兜底**。 */
export async function sharePngDataUrl(dataUrl: string, caption: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const base64 = dataUrl.split(",")[1];
    const fname = `freegrid-fq-${Date.now()}.png`;
    const res = await Filesystem.writeFile({ path: fname, data: base64, directory: Directory.Cache });
    await Share.share({ title: "我的财商人格", text: caption, files: [res.uri], dialogTitle: "分享财商人格" });
    return;
  }
  // web / 桌面
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], "freegrid-fq.png", { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] }) && navigator.share) {
    await navigator.share({ files: [file], text: caption } as ShareData);
  } else {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "freegrid-fq.png";
    a.click();
  }
}
