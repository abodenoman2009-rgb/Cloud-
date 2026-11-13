"use client";

/** Hand-drawn mark: a drive chassis with a cloud bay and a status LED. */
export function Logo({ size = 34, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Cloud Hard Drive"
      fill="none"
    >
      <rect
        x="2"
        y="5"
        width="36"
        height="30"
        rx="9"
        stroke="currentColor"
        strokeWidth="2.6"
      />
      <path
        d="M12.4 26.2h15.1a5.4 5.4 0 0 0 .7-10.76A7.4 7.4 0 0 0 13 15.1a5.6 5.6 0 0 0-.6 11.1Z"
        fill="var(--c-accent)"
      />
      <path
        d="M8.4 11.6h4.2M8.4 15.4h2.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="30.8" cy="30.2" r="1.7" fill="var(--c-accent)" />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <Logo />
      {!compact && (
        <span className="leading-none">
          <span className="block text-[15px] font-bold tracking-tight">Cloud Hard Drive</span>
          <span className="label mt-1 block">قرصك الصلب السحابي</span>
        </span>
      )}
    </span>
  );
}
