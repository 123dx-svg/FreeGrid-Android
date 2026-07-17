// IME 安全输入(修微信输入法等在 WebView 里打不出中文的问题)
//
// 根因:Svelte 的 `bind:value` 在每次 input 事件后会把值写回 DOM 的 value。
// 中文输入法在「合成中」(composition,拼音选字阶段)若被写回 value,合成会被打断
// —— 微信输入法最敏感,直接导致中文一个字都上不了屏。
//
// 用法(不要再用 bind:value):
//   <input value={x} use:imeSafe={(v) => (x = v)} />
// 合成期间不回写、不同步 state;合成结束(选好字)后再一次性同步。
export function imeSafe(
  node: HTMLInputElement | HTMLTextAreaElement,
  onValue: (v: string) => void
) {
  let composing = false;
  let cb = onValue;
  const start = () => {
    composing = true;
  };
  const end = () => {
    composing = false;
    cb(node.value);
  };
  const input = () => {
    if (!composing) cb(node.value);
  };
  node.addEventListener("compositionstart", start);
  node.addEventListener("compositionend", end);
  node.addEventListener("input", input);
  return {
    update(next: (v: string) => void) {
      cb = next;
    },
    destroy() {
      node.removeEventListener("compositionstart", start);
      node.removeEventListener("compositionend", end);
      node.removeEventListener("input", input);
    },
  };
}
