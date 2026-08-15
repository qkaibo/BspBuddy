/** BspBuddy 品牌小标 — 标题栏 / 侧栏复用 */
export function BspBuddyMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="#2563eb" />
      <path
        d="M9.5 22V10h5.2c2.85 0 4.55 1.45 4.55 3.55 0 1.4-.75 2.55-2.05 3.1v.1c1.7.45 2.75 1.75 2.75 3.5 0 2.4-1.85 3.75-5 3.75H9.5zm2.55-6.85h2.45c1.4 0 2.2-.7 2.2-1.75s-.8-1.7-2.2-1.7h-2.45v3.45zm0 2.1v4.55h2.85c1.55 0 2.45-.75 2.45-2.05s-.9-2.5-2.55-2.5h-2.75z"
        fill="#fff"
      />
      <circle cx="24.2" cy="9.2" r="2.4" fill="#93c5fd" />
    </svg>
  )
}
