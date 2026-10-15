const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
};

export const CheckIcon = () => (
  <svg {...base}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const LockIcon = () => (
  <svg {...base} strokeWidth={2.2}>
    <rect x="5" y="11" width="14" height="9" rx="2.2" />
    <path d="M8 11V8a4 4 0 018 0v3" />
  </svg>
);
export const FlagIcon = () => (
  <svg {...base} strokeWidth={2.2}>
    <path d="M6 21V4" />
    <path d="M6 5h11l-2.2 3.8L17 12.5H6" />
  </svg>
);
export const TrophyIcon = () => (
  <svg {...base} strokeWidth={2.2}>
    <path d="M8 4h8v5a4 4 0 01-8 0V4z" />
    <path d="M8 6H4.5c0 3 1.5 4.5 3.7 4.8M16 6h3.5c0 3-1.5 4.5-3.7 4.8" />
    <path d="M12 13v4M8.5 20h7M10 17h4" />
  </svg>
);
export const BoltIcon = () => (
  <svg {...base} width={14} height={14} strokeWidth={2.4}>
    <path d="M13 3L5 13.5h6L10 21l8-10.5h-6L13 3z" />
  </svg>
);
export const PinIcon = () => (
  <svg {...base} width={14} height={14} strokeWidth={2.4}>
    <path d="M12 21s6-5.6 6-10.5a6 6 0 10-12 0C6 15.4 12 21 12 21z" />
    <circle cx="12" cy="10.5" r="2" />
  </svg>
);
export const DotIcon = () => (
  <svg {...base} width={14} height={14}>
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
);
export const ClockIcon = () => (
  <svg {...base} width={14} height={14}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);
