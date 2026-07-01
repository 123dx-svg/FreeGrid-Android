// ============================================================================
// 全局弹层栈 —— 物理返回键优先关闭最上面的弹层,而不是直接退出 app。
// Sheet / FqTest 结果卡等打开时注册,关闭时注销;App.svelte 的 backButton 监听读取本栈。
// ============================================================================

type Entry = { id: number; close: () => void };

let stack: Entry[] = [];
let seq = 0;

/** 弹层打开时调用,返回登记 id。 */
export function pushOverlay(close: () => void): number {
  const id = ++seq;
  stack.push({ id, close });
  return id;
}

/** 弹层关闭时调用,按 id 注销(幂等)。 */
export function popOverlay(id: number): void {
  stack = stack.filter((e) => e.id !== id);
}

export function overlayCount(): number {
  return stack.length;
}

/** 关闭最上面的弹层。返回是否确实关掉了一个。 */
export function closeTopOverlay(): boolean {
  const top = stack.pop();
  if (!top) return false;
  top.close();
  return true;
}
