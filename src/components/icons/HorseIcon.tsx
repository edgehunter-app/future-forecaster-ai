import type { SVGProps } from "react";

export function HorseIcon({ className, ...props }: SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M19 6c-.5-1.2-1.7-2-3-2-1 0-1.8.4-2.5 1l-1 1-2 .3c-2.5.4-4.5 2.5-4.5 5V13l-2 2v3h3v-2l2-1h4l1 3h3v-3l-1-2v-3l2-1c1 0 1.8-.6 2-1.5.2-.9-.2-1.8-1-2.5z" />
      <circle cx="17" cy="7" r="0.6" fill="currentColor" />
    </svg>
  );
}

export default HorseIcon;