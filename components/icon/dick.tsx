// dick.tsx
import type { SVGProps } from "react";

type DickProps = SVGProps<SVGSVGElement>;

export default function Dick(props: DickProps) {
return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* 龜頭 */}
      <path d="M16 4 Q 22 4 22 10 Q 22 14 16 14 Q 10 14 10 10 Q 10 4 16 4 Z" />

      {/* 莖身 */}
      <path d="M13 14 L13 24 Q 16 28 19 24 L19 14" />

      {/* 左蛋 */}
      <circle cx="11" cy="26" r="4" />

      {/* 右蛋 */}
      <circle cx="21" cy="26" r="4" />
    </svg>
  );
}