// ============================================================================
// 成就徽章「卡片截图」分享 —— 复用 fq-share 的 SVG→PNG→系统分享管线。零依赖。
// 两种:单枚徽章卡 / 整面成就墙长图。
// ============================================================================
import { svgToPngDataUrl, sharePngDataUrl } from "./fq-share";
import { ACHIEVEMENTS, type Achievement } from "./achievements";

const MIST = "#F2EEE6";
const INK = "#2B2722";
const MUTED = "#8A8178";
const FAINT = "#B4ABA0";
const FONT = "'PingFang SC','Noto Sans CJK SC','Microsoft YaHei','Hiragino Sans GB',sans-serif";
const EMOJI_FONT = "'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji',sans-serif";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(+d)) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

// ── 单枚徽章海报(1080×1350)──
function badgeSVG(a: Achievement, unlockedAt: string | null): string {
  const W = 1080;
  const H = 1350;
  const cx = W / 2;
  const base = `hsl(${a.hue} 62% 52%)`;
  const deep = `hsl(${a.hue} 55% 38%)`;
  const soft = `hsl(${a.hue} 60% 88%)`;
  const cardBg = `hsl(${a.hue} 40% 96%)`;
  const dateLine = unlockedAt ? `${fmtDate(unlockedAt)} 点亮` : "尚未点亮";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="hsl(${a.hue} 45% 92%)"/>
        <stop offset="1" stop-color="${MIST}"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="${base}" stop-opacity="0.45"/>
        <stop offset="1" stop-color="${base}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#bg)"/>
    <rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="56" fill="${cardBg}" stroke="hsl(${a.hue} 45% 82%)" stroke-width="2"/>
    <text x="${cx}" y="150" text-anchor="middle" font-family="${FONT}" font-size="26" font-weight="600" letter-spacing="4" fill="${FAINT}">FREEGRID · 成就徽章</text>
    <ellipse cx="${cx}" cy="470" rx="260" ry="260" fill="url(#glow)"/>
    <circle cx="${cx}" cy="470" r="168" fill="${soft}" stroke="${deep}" stroke-width="6"/>
    <circle cx="${cx}" cy="470" r="168" fill="none" stroke="${base}" stroke-width="2" stroke-dasharray="4 10"/>
    <text x="${cx}" y="520" text-anchor="middle" font-family="${EMOJI_FONT}" font-size="150">${a.icon}</text>
    <text x="${cx}" y="760" text-anchor="middle" font-family="${FONT}" font-size="72" font-weight="700" fill="${INK}">${esc(a.name)}</text>
    <rect x="${cx - 46}" y="794" width="92" height="5" rx="2.5" fill="${base}"/>
    <text x="${cx}" y="890" text-anchor="middle" font-family="${FONT}" font-size="34" fill="${MUTED}">${esc(a.desc)}</text>
    <text x="${cx}" y="985" text-anchor="middle" font-family="${FONT}" font-size="28" font-weight="600" fill="${deep}">${esc(dateLine)}</text>
    <text x="${cx}" y="1250" text-anchor="middle" font-family="${FONT}" font-size="24" fill="${FAINT}">自由日记 · 通往财富自由之路</text>
  </svg>`;
}

// ── 整面成就墙长图(1080 宽,高度随数量)──
function wallSVG(items: { a: Achievement; at: string | null }[], unlockedCount: number, total: number): string {
  const W = 1080;
  const cols = 3;
  const cellW = 320;
  const cellH = 300;
  const padX = (W - cols * cellW) / 2;
  const top = 230;
  const rows = Math.ceil(items.length / cols);
  const H = top + rows * cellH + 90;
  const cx = W / 2;

  const cells = items
    .map((it, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = padX + c * cellW + cellW / 2;
      const y = top + r * cellH;
      const on = !!it.at;
      const base = on ? `hsl(${it.a.hue} 62% 52%)` : "#C9C3B8";
      const soft = on ? `hsl(${it.a.hue} 60% 90%)` : "#EAE6DE";
      const deep = on ? `hsl(${it.a.hue} 55% 40%)` : "#B4ABA0";
      const nameColor = on ? INK : "#B4ABA0";
      return `<g>
        <circle cx="${x}" cy="${y + 92}" r="70" fill="${soft}" stroke="${deep}" stroke-width="4" opacity="${on ? 1 : 0.75}"/>
        <text x="${x}" y="${y + 112}" text-anchor="middle" font-family="${EMOJI_FONT}" font-size="62" opacity="${on ? 1 : 0.5}">${on ? it.a.icon : "🔒"}</text>
        <text x="${x}" y="${y + 200}" text-anchor="middle" font-family="${FONT}" font-size="27" font-weight="600" fill="${nameColor}">${esc(it.a.name)}</text>
        <text x="${x}" y="${y + 234}" text-anchor="middle" font-family="${FONT}" font-size="20" fill="${on ? deep : "#C9C3B8"}">${on ? esc(fmtDate(it.at)) : "未解锁"}</text>
        <circle cx="${x}" cy="${y + 92}" r="70" fill="none" stroke="${base}" stroke-width="1.5" stroke-dasharray="3 8" opacity="${on ? 0.8 : 0}"/>
      </g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect x="0" y="0" width="${W}" height="${H}" fill="${MIST}"/>
    <text x="${cx}" y="110" text-anchor="middle" font-family="${FONT}" font-size="26" font-weight="600" letter-spacing="4" fill="${FAINT}">FREEGRID · 我的成就墙</text>
    <text x="${cx}" y="170" text-anchor="middle" font-family="${FONT}" font-size="54" font-weight="700" fill="${INK}">已点亮 ${unlockedCount} / ${total} 枚</text>
    ${cells}
    <text x="${cx}" y="${H - 34}" text-anchor="middle" font-family="${FONT}" font-size="24" fill="${FAINT}">自由日记 · 通往财富自由之路</text>
  </svg>`;
}

/** 分享单枚徽章卡。 */
export async function shareBadge(a: Achievement, unlockedAt: string | null): Promise<void> {
  const png = await svgToPngDataUrl(badgeSVG(a, unlockedAt), 1080, 1350, 2);
  await sharePngDataUrl(png, `我在自由日记点亮了成就【${a.name}】——${a.desc}`);
}

/** 分享整面成就墙。unlockedMap:id→解锁时间。 */
export async function shareWall(unlockedMap: Record<string, string>): Promise<void> {
  const items = ACHIEVEMENTS.map((a) => ({ a, at: unlockedMap[a.id] ?? null }));
  const count = items.filter((x) => x.at).length;
  const H = 230 + Math.ceil(items.length / 3) * 300 + 90;
  const png = await svgToPngDataUrl(wallSVG(items, count, ACHIEVEMENTS.length), 1080, H, 2);
  await sharePngDataUrl(png, `我在自由日记已点亮 ${count}/${ACHIEVEMENTS.length} 枚成就徽章 🎖️`);
}
