/** MakeFirstStep mark: rounded square (brand green) with a rising stair, "the first step". Theme-aware via CSS tokens. */
export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path
        d="M7.5 24.5H13V18.5H19V12.5H24.5"
        fill="none"
        stroke="var(--on-accent)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
