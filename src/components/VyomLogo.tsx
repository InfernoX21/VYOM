import React from 'react';

interface VyomLogoProps {
  className?: string;
  height?: number;
}

export const VyomLogo: React.FC<VyomLogoProps> = ({ className = 'h-7', height = 28 }) => {
  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <svg
        viewBox="0 0 290 64"
        style={{ height: `${height}px`, width: 'auto' }}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="block"
        role="img"
        aria-label="VYOM Logo"
      >
        {/* Glow filter for subtle aerospace HUD radiance */}
        <defs>
          <filter id="vyom-glow" x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="horizon-grad" x1="145" y1="46" x2="205" y2="46" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#bae6fd" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Letter V */}
        <path
          d="M 12 12 L 40 52 L 68 12"
          stroke="#f8fafc"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Letter Y */}
        <path
          d="M 90 12 L 114 33 M 138 12 L 114 33 M 114 33 L 114 52"
          stroke="#f8fafc"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Letter O (Reticle / Compass Navigation Target) */}
        <g id="vyom-o-glyph">
          {/* Outer circle arc with top opening */}
          {/* Left arc from top slit (172, 10) counterclockwise around bottom to right slit (178, 10) */}
          <path
            d="M 172 10 A 22 22 0 1 0 178 10"
            stroke="#f8fafc"
            strokeWidth="5.5"
            strokeLinecap="butt"
          />

          {/* Upward Navigation Arrowhead / Aircraft Delta */}
          {/* Left facet (lighter) */}
          <path
            d="M 175 19 L 163 38 L 175 34 Z"
            fill="#f1f5f9"
          />
          {/* Right facet (soft shaded) */}
          <path
            d="M 175 19 L 175 34 L 187 38 Z"
            fill="#cbd5e1"
          />

          {/* Curved Horizon Arc & Vertical Needle Tick in Ice-Cyan */}
          <path
            d="M 148 50 Q 175 42 202 50"
            stroke="url(#horizon-grad)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M 175 43.5 L 175 55"
            stroke="#7dd3fc"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </g>

        {/* Letter M */}
        <path
          d="M 222 52 L 222 12 L 246 36 L 270 12 L 270 52"
          stroke="#f8fafc"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
