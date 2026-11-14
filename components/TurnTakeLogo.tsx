import React from 'react';

interface TurnTakeLogoProps {
  size?: 'sm' | 'lg';
}

export function TurnTakeLogo({ size = 'lg' }: TurnTakeLogoProps) {
  if (size === 'sm') {
    return (
      <div className="inline-flex items-center gap-2.5 select-none">
        <svg
          width="28"
          height="28"
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
          className="shrink-0"
        >
          <rect
            x="2"
            y="2"
            width="28"
            height="28"
            rx="7"
            stroke="#65737C"
            strokeOpacity="0.45"
            strokeWidth="1.5"
          />
          <path
            d="M8.5 10.5L13.5 15.5M13.5 10.5L8.5 15.5"
            stroke="#43DDE6"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle
            cx="21"
            cy="20.5"
            r="3.2"
            stroke="#FF795E"
            strokeWidth="2.5"
          />
          <path
            d="M17.5 8.5L14.5 23.5"
            stroke="#FFDA79"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span className="font-display text-lg font-extrabold tracking-tight text-[#F4F4F0] whitespace-nowrap">
          TURN<span className="text-[#43DDE6]">/</span>
          <span className="text-[#FF795E]">/</span>TAKE
        </span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-3 sm:gap-4 select-none">
      <svg
        width="52"
        height="52"
        viewBox="0 0 56 56"
        fill="none"
        aria-hidden="true"
        className="w-10 h-10 sm:w-[52px] sm:h-[52px] shrink-0"
      >
        <circle
          cx="28"
          cy="28"
          r="25"
          stroke="#65737C"
          strokeOpacity="0.4"
          strokeWidth="1.5"
          strokeDasharray="6 4"
        />
        <rect
          x="7"
          y="7"
          width="42"
          height="42"
          rx="11"
          fill="#151B27"
          stroke="#65737C"
          strokeOpacity="0.45"
          strokeWidth="1.5"
        />
        <path
          d="M15 17L23 25M23 17L15 25"
          stroke="#43DDE6"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <circle
          cx="37"
          cy="36"
          r="5"
          stroke="#FF795E"
          strokeWidth="3.5"
        />
        <path
          d="M31 14L25 42"
          stroke="#FFDA79"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
      <div className="flex flex-col">
        <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-[#F4F4F0] leading-none">
          TURN<span className="text-[#43DDE6]">/</span>
          <span className="text-[#FF795E]">/</span>TAKE
        </h1>
      </div>
    </div>
  );
}
