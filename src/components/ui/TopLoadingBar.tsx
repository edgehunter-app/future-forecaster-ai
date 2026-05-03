import { useEffect, useState } from "react";

export default function TopLoadingBar({ loading }: { loading: boolean }) {
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    if (loading) {
      setVisible(true);
      setWidth(10);
      id = setInterval(() => {
        setWidth((w) => (w < 85 ? w + Math.max(0.5, (85 - w) * 0.08) : w));
      }, 200);
    } else if (visible) {
      setWidth(100);
      const t = setTimeout(() => {
        setVisible(false);
        setWidth(0);
      }, 300);
      return () => clearTimeout(t);
    }
    return () => { if (id) clearInterval(id); };
  }, [loading, visible]);

  if (!visible) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5 bg-transparent pointer-events-none">
      <div
        className="h-full bg-info shadow-[0_0_8px_hsl(var(--info))]"
        style={{ width: `${width}%`, transition: "width 200ms ease-out, opacity 300ms" }}
      />
    </div>
  );
}