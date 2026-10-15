/** The mentor's face: inline SVG, brand colours via CSS variables (see "mentor chat" in globals.css). */
export default function MentorBot({ className = '' }: { className?: string }) {
  return (
    <svg className={'bot ' + className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <g className="bot-arm bot-arm-l">
        <rect x="5" y="50" width="14" height="6" rx="3" />
      </g>
      <g className="bot-arm bot-arm-r">
        <rect x="45" y="50" width="14" height="6" rx="3" />
      </g>
      <rect className="bot-body" x="16" y="45" width="32" height="15" rx="7" />
      <line className="bot-stem" x1="32" y1="14" x2="32" y2="7" />
      <circle className="bot-light" cx="32" cy="6" r="3" />
      <rect className="bot-ear" x="6.5" y="24" width="5" height="12" rx="2.5" />
      <rect className="bot-ear" x="52.5" y="24" width="5" height="12" rx="2.5" />
      <rect className="bot-head" x="11" y="13" width="42" height="32" rx="12" />
      <rect className="bot-face" x="16" y="18" width="32" height="22" rx="9" />
      <g className="bot-blink">
        <circle className="bot-eye" cx="25" cy="28" r="5" />
        <circle className="bot-pupil" cx="25" cy="28" r="2.2" />
      </g>
      <g className="bot-blink">
        <circle className="bot-eye" cx="39" cy="28" r="5" />
        <circle className="bot-pupil" cx="39" cy="28" r="2.2" />
      </g>
      <path className="bot-mouth" d="M28.5 35.2q3.5 2.6 7 0" />
    </svg>
  );
}
