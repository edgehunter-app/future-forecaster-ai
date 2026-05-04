import { useId } from "react";

export function EdgeHunterLogo({
  size = 32,
  variant = "icon",
}: {
  size?: number;
  variant?: "icon" | "full";
}) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9]/g, "");

  const icon = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={`ehGrad_${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id={`ehBg_${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a1f3a" />
          <stop offset="100%" stopColor="#0a0b0f" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="98" height="98" rx="18" fill={`url(#ehBg_${id})`} stroke="#1e2130" strokeWidth="1" />
      <circle cx="50" cy="50" r="32" fill="none" stroke={`url(#ehGrad_${id})`} strokeWidth="1.5" opacity="0.6" />
      <circle cx="50" cy="50" r="22" fill="none" stroke={`url(#ehGrad_${id})`} strokeWidth="1" opacity="0.85" />
      <circle cx="50" cy="50" r="22" fill="#3b82f6" opacity="0.08" />
      <line x1="8" y1="50" x2="26" y2="50" stroke="#60a5fa" strokeWidth="1.5" opacity="0.9" />
      <line x1="74" y1="50" x2="92" y2="50" stroke="#60a5fa" strokeWidth="1.5" opacity="0.9" />
      <line x1="50" y1="8" x2="50" y2="26" stroke="#60a5fa" strokeWidth="1.5" opacity="0.9" />
      <line x1="50" y1="74" x2="50" y2="92" stroke="#60a5fa" strokeWidth="1.5" opacity="0.9" />
      <line x1="50" y1="16" x2="50" y2="20" stroke="#60a5fa" strokeWidth="2" opacity="0.7" />
      <line x1="50" y1="80" x2="50" y2="84" stroke="#60a5fa" strokeWidth="2" opacity="0.7" />
      <line x1="16" y1="50" x2="20" y2="50" stroke="#60a5fa" strokeWidth="2" opacity="0.7" />
      <line x1="80" y1="50" x2="84" y2="50" stroke="#60a5fa" strokeWidth="2" opacity="0.7" />
      <circle cx="50" cy="50" r="5" fill="#3b82f6" />
      <circle cx="50" cy="50" r="2.5" fill="#e8eaf0" />
    </svg>
  );

  if (variant === "icon") return icon;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.28 }}>
      {icon}
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <span
          style={{
            fontSize: size * 0.38,
            fontWeight: 800,
            color: "#e8eaf0",
            letterSpacing: "-0.02em",
            lineHeight: 1,
            fontFamily: "DM Sans, -apple-system, sans-serif",
          }}
        >
          EdgeHunter
        </span>
        {size >= 32 && (
          <span
            style={{
              fontSize: size * 0.2,
              color: "#6b7280",
              letterSpacing: "0.01em",
              lineHeight: 1,
              fontFamily: "DM Sans, -apple-system, sans-serif",
            }}
          >
            Stop guessing. Start hunting.
          </span>
        )}
      </div>
    </div>
  );
}

export default EdgeHunterLogo;