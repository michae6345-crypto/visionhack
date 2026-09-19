interface ProgramIconProps {
  /** Programme abbreviation, e.g. SNAP, WIC, EPA. */
  abbr: string;
  size?: number;
}

/**
 * Ledger's own full-colour mark for each programme we track. These are drawn
 * here rather than taken from agency artwork: a real seal on the page would
 * claim an endorsement we don't have (see NON_AFFILIATION).
 */
const C = {
  green: "#1c7a4b",
  greenLt: "#3fb06f",
  blue: "#1b4dff",
  sky: "#3fa9f5",
  red: "#d13a2c",
  orange: "#f08a25",
  yellow: "#f5c53d",
  purple: "#7a5bd6",
  slate: "#2c3350",
  steel: "#8792b5",
  cream: "#f6efe2",
  white: "#ffffff",
};

const ART: Record<string, React.ReactNode> = {
  // Grocery bag of staples.
  SNAP: (
    <>
      <path d="M5 9h14l-1.3 11.4a1.6 1.6 0 0 1-1.6 1.4H7.9a1.6 1.6 0 0 1-1.6-1.4z" fill={C.green} />
      <path d="M9.6 9V6.4a2.4 2.4 0 0 1 4.8 0V9" fill="none" stroke={C.green} strokeWidth="1.7" />
      <rect x="7.4" y="2.6" width="3.1" height="6.4" rx="0.8" transform="rotate(-8 8.9 5.8)" fill={C.purple} />
      <path d="M15.2 8.6c.3-2.6 1.7-4.6 3.6-5.4 1 2 .5 4.4-1.2 5.9z" fill={C.orange} />
      <circle cx="13.2" cy="6.6" r="2.3" fill={C.red} />
      <path d="M13.2 4.3c.2-.8.8-1.3 1.5-1.4-.1.8-.6 1.3-1.5 1.4z" fill={C.greenLt} />
    </>
  ),
  // Milk carton and fruit: the WIC food list.
  WIC: (
    <>
      <path d="M4.6 8.4h7.2v12.2a1.2 1.2 0 0 1-1.2 1.2H5.8a1.2 1.2 0 0 1-1.2-1.2z" fill={C.sky} />
      <path d="M4.6 8.4 8.2 4.4l3.6 4z" fill={C.blue} />
      <rect x="5.9" y="12.4" width="4.6" height="3.4" rx="0.7" fill={C.white} />
      <circle cx="17" cy="14.6" r="5.2" fill={C.red} />
      <path d="M17 9.4c.3-1.6 1.4-2.6 3-2.8-.1 1.7-1.2 2.7-3 2.8z" fill={C.greenLt} />
      <rect x="16.5" y="6.6" width="1.1" height="3.2" rx="0.5" fill={C.green} />
    </>
  ),
  // Benefit card with a chip.
  EBT: (
    <>
      <rect x="2.4" y="5.2" width="19.2" height="13.6" rx="2.4" fill={C.blue} />
      <rect x="2.4" y="8.4" width="19.2" height="2.8" fill={C.slate} />
      <rect x="5.2" y="13" width="4.4" height="3.4" rx="0.8" fill={C.yellow} />
      <rect x="12.4" y="14.4" width="6.4" height="1.6" rx="0.8" fill={C.white} opacity="0.75" />
    </>
  ),
  // Leaf over clean water.
  EPA: (
    <>
      <path d="M19.6 3.4c.6 7.8-3.1 12-8.6 12A4.7 4.7 0 0 1 6.2 10c.6-4.4 6-6.6 13.4-6.6z" fill={C.greenLt} />
      <path d="M7.4 15.4C10 11.6 13.8 8.6 17.6 7.2" fill="none" stroke={C.green} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M2.4 18.6c1.6 0 1.6 1.1 3.2 1.1s1.6-1.1 3.2-1.1 1.6 1.1 3.2 1.1 1.6-1.1 3.2-1.1 1.6 1.1 3.2 1.1 1.6-1.1 3.2-1.1" fill="none" stroke={C.sky} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M2.4 21.4c1.6 0 1.6 1.1 3.2 1.1s1.6-1.1 3.2-1.1 1.6 1.1 3.2 1.1 1.6-1.1 3.2-1.1 1.6 1.1 3.2 1.1 1.6-1.1 3.2-1.1" fill="none" stroke={C.sky} strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
    </>
  ),
  // Hard hat.
  OSHA: (
    <>
      <path d="M3.6 16.4a8.4 8.4 0 0 1 16.8 0z" fill={C.yellow} />
      <path d="M9.2 16.4V6.8c0-.8.6-1.4 1.4-1.4h2.8c.8 0 1.4.6 1.4 1.4v9.6z" fill={C.orange} />
      <rect x="2.2" y="16.4" width="19.6" height="2.6" rx="1.3" fill={C.slate} />
    </>
  ),
  // Bottle with a license band.
  ABC: (
    <>
      <path d="M9.2 2.6h5.6v3.6l2 3v11a1.8 1.8 0 0 1-1.8 1.8H9a1.8 1.8 0 0 1-1.8-1.8v-11l2-3z" fill={C.green} />
      <rect x="7.2" y="11" width="9.6" height="5" fill={C.cream} />
      <rect x="9.2" y="2.6" width="5.6" height="2" rx="0.6" fill={C.red} />
      <rect x="9.1" y="12.4" width="5.8" height="1.1" rx="0.55" fill={C.green} />
    </>
  ),
  // Hazmat truck.
  DOT: (
    <>
      <rect x="1.6" y="6.4" width="12" height="9.6" rx="1.2" fill={C.blue} />
      <path d="M13.6 9.4h3.8l3.2 3.6v3h-7z" fill={C.steel} />
      <rect x="5.2" y="9.2" width="4.6" height="4.2" rx="0.6" fill={C.yellow} transform="rotate(45 7.5 11.3)" />
      <circle cx="6.4" cy="18.4" r="2.4" fill={C.slate} />
      <circle cx="16.8" cy="18.4" r="2.4" fill={C.slate} />
      <circle cx="6.4" cy="18.4" r="0.9" fill={C.white} />
      <circle cx="16.8" cy="18.4" r="0.9" fill={C.white} />
    </>
  ),
  // Health permit: clipboard with a tick.
  CHP: (
    <>
      <rect x="3.6" y="4.6" width="16.8" height="17" rx="2" fill={C.sky} />
      <rect x="5.8" y="7" width="12.4" height="12.2" rx="1.2" fill={C.white} />
      <rect x="8.2" y="2.4" width="7.6" height="4" rx="1.3" fill={C.blue} />
      <path d="m8.6 13.4 2.6 2.6 4.6-5" fill="none" stroke={C.green} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  // Balance scale.
  "W&M": (
    <>
      <rect x="11.1" y="4" width="1.8" height="15.4" rx="0.9" fill={C.slate} />
      <rect x="6.4" y="19.4" width="11.2" height="2.2" rx="1.1" fill={C.slate} />
      <rect x="3.4" y="6.6" width="17.2" height="1.8" rx="0.9" fill={C.steel} />
      <circle cx="12" cy="4.2" r="1.9" fill={C.yellow} />
      <path d="M4.4 8.4 1.6 13.8h5.6z" fill={C.blue} />
      <path d="M19.6 8.4 16.8 13.8h5.6z" fill={C.blue} />
    </>
  ),
  // Tobacco retail.
  TRL: (
    <>
      <rect x="2.4" y="14" width="14.4" height="4.6" rx="1.2" fill={C.cream} />
      <rect x="13.2" y="14" width="3.6" height="4.6" fill={C.orange} />
      <rect x="18.2" y="14" width="3.4" height="4.6" rx="1.2" fill={C.red} />
      <path d="M15.4 11.2c1.9-1.3 1.9-3.2 0-4.5s-1.9-3.2 0-4.5" fill="none" stroke={C.steel} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M19.6 11.2c1.4-1 1.4-2.5 0-3.5" fill="none" stroke={C.steel} strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  // Federal permit with a seal.
  TTB: (
    <>
      <path d="M4.6 2.6h10l5 5v13.8H4.6z" fill={C.white} stroke={C.slate} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14.4 2.8v4.8h4.8" fill="none" stroke={C.slate} strokeWidth="1.5" />
      <rect x="7" y="10.4" width="7" height="1.5" rx="0.75" fill={C.steel} />
      <circle cx="16.4" cy="16.8" r="4.4" fill={C.red} />
      <path d="m14.4 16.9 1.5 1.5 2.7-3" fill="none" stroke={C.white} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  // Food facility.
  FDA: (
    <>
      <path d="M12 2.8 21.6 8.6v12.8H2.4V8.6z" fill={C.sky} />
      <rect x="8.4" y="12.4" width="7.2" height="9" fill={C.white} />
      <rect x="11.1" y="13.8" width="1.8" height="6.2" fill={C.blue} />
      <rect x="9.4" y="16.1" width="5.2" height="1.8" fill={C.blue} />
      <rect x="1.2" y="21" width="21.6" height="2.2" rx="1.1" fill={C.slate} />
    </>
  ),
  // Wrench.
  BAR: (
    <>
      <path d="M16 2.6a5.4 5.4 0 0 0-4.6 8.2l-7.2 7.2a2 2 0 0 0 2.8 2.8l7.2-7.2A5.4 5.4 0 0 0 20.8 7l-3.2 3.2-2.9-.8-.8-2.9z" fill={C.steel} />
      <circle cx="6.2" cy="19.4" r="1.2" fill={C.white} />
    </>
  ),
  // Receipt.
  RSP: (
    <>
      <path d="M5 2.8h14v18.6l-2.8-1.6-2.8 1.6-2.8-1.6-2.8 1.6L5 19.8z" fill={C.white} stroke={C.green} strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="7.8" y="7" width="8.4" height="1.6" rx="0.8" fill={C.green} />
      <rect x="7.8" y="10.8" width="8.4" height="1.6" rx="0.8" fill={C.greenLt} />
      <rect x="7.8" y="14.6" width="5" height="1.6" rx="0.8" fill={C.greenLt} />
    </>
  ),
  // Mortar and pestle.
  BOP: (
    <>
      <path d="M8.4 9.6 14.8 3.2a2.3 2.3 0 0 1 3.3 3.3l-3.2 3.1z" fill={C.steel} />
      <path d="M4.6 9.6h14.8v2.2a7.4 7.4 0 0 1-14.8 0z" fill={C.sky} />
      <rect x="10.9" y="18.6" width="2.2" height="2.6" fill={C.slate} />
      <rect x="7.4" y="20.6" width="9.2" height="2.2" rx="1.1" fill={C.slate} />
    </>
  ),
  // Fire marshal.
  FIRE: (
    <>
      <path d="M12 1.8c3.6 3.6 6.6 6.4 6.6 10.6a6.6 6.6 0 1 1-13.2 0c0-2.1 1-3.9 2.4-5.6.6 1.3 1.4 2.2 2.5 2.6-.4-2.8.4-5.3 1.7-7.6z" fill={C.orange} />
      <path d="M12 20.6a3.4 3.4 0 0 1-1.6-6.4c.3.8.9 1.4 1.6 1.7.6-1 .9-2.1.9-3.3 1.2 1.4 2.3 2.7 2.3 4.6a3.4 3.4 0 0 1-3.2 3.4z" fill={C.yellow} />
    </>
  ),
  // Business tax certificate.
  BTC: (
    <>
      <path d="M4.8 2.8h9.4l5 4.8v14.6H4.8z" fill={C.white} stroke={C.blue} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14 3v4.6h4.6" fill="none" stroke={C.blue} strokeWidth="1.5" />
      <rect x="7.6" y="11.4" width="8.8" height="1.6" rx="0.8" fill={C.sky} />
      <rect x="7.6" y="15" width="5.4" height="1.6" rx="0.8" fill={C.sky} />
      <circle cx="16.8" cy="17.6" r="3.4" fill={C.blue} opacity="0.9" />
      <path d="M16.8 15.6v4m-1.4-2.8h2.4a.9.9 0 0 1 0 1.8h-2a.9.9 0 0 0 0 1.8h2.4" fill="none" stroke={C.white} strokeWidth="1.1" strokeLinecap="round" />
    </>
  ),
  // Certificate of occupancy.
  CoO: (
    <>
      <path d="M4.4 21v-17a1.2 1.2 0 0 1 1.2-1.2h9.6A1.2 1.2 0 0 1 16.4 4v17z" fill={C.orange} />
      <rect x="6.6" y="5.2" width="7.6" height="13.6" rx="1" fill={C.cream} />
      <circle cx="12.4" cy="12.4" r="1.2" fill={C.slate} />
      <rect x="2.6" y="21" width="19" height="2.2" rx="1.1" fill={C.slate} />
    </>
  ),
};

const FALLBACK = (
  <>
    <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="2.4" fill={C.steel} />
    <rect x="6.6" y="8" width="10.8" height="1.7" rx="0.85" fill={C.white} />
    <rect x="6.6" y="12.4" width="6.6" height="1.7" rx="0.85" fill={C.white} />
  </>
);

export function ProgramIcon({ abbr, size = 24 }: ProgramIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {ART[abbr] ?? FALLBACK}
    </svg>
  );
}
