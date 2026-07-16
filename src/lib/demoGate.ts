/**
 * Tiny event bus so any component can open the global "sign up to unlock"
 * bottom sheet mounted in Layout.
 */
const EVT = "edgehunter:demo-gate";

export function openDemoGate(feature?: string) {
  window.dispatchEvent(new CustomEvent(EVT, { detail: { feature } }));
}

export function onDemoGate(cb: (feature?: string) => void) {
  const h = (e: Event) => cb((e as CustomEvent).detail?.feature);
  window.addEventListener(EVT, h);
  return () => window.removeEventListener(EVT, h);
}

const CLAUDE_KEY = "demo_claude_calls";
export const DEMO_CLAUDE_LIMIT = 5;

export function getDemoClaudeCalls(): number {
  try { return Number(sessionStorage.getItem(CLAUDE_KEY) ?? 0) || 0; } catch { return 0; }
}
export function incDemoClaudeCalls(): number {
  const n = getDemoClaudeCalls() + 1;
  try { sessionStorage.setItem(CLAUDE_KEY, String(n)); } catch { /* noop */ }
  return n;
}