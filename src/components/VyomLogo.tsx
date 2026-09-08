import React from 'react';
import { COLOR } from '../design/tokens';

interface VyomLogoProps {
  className?: string;
  height?: number;
}

/**
 * VYOM wordmark. Letterforms in white, with the navigation reticle in the
 * platform's orange accent — no glow filters or gradients.
 */
export const VyomLogo: React.FC<VyomLogoProps> = ({ className = '', height = 24 }) => (
  <div className={`inline-flex items-center ${className}`}>
    <svg
      viewBox="0 0 290 64"
      style={{ height: `${height}px`, width: 'auto' }}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="block"
      role="img"
      aria-label="VYOM"
    >
      {/* V */}
      <path
        d="M 12 12 L 40 52 L 68 12"
        stroke={COLOR.ink}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Y */}
      <path
        d="M 90 12 L 114 33 M 138 12 L 114 33 M 114 33 L 114 52"
        stroke={COLOR.ink}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* O — navigation reticle with an aircraft delta */}
      <g>
        <path
          d="M 172 10 A 22 22 0 1 0 178 10"
          stroke={COLOR.ink}
          strokeWidth="5.5"
          strokeLinecap="butt"
        />
        <path d="M 175 19 L 163 38 L 175 34 Z" fill={COLOR.ink} />
        <path d="M 175 19 L 175 34 L 187 38 Z" fill={COLOR.ink2} />
        <path
          d="M 148 50 Q 175 42 202 50"
          stroke={COLOR.primary}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M 175 43.5 L 175 55"
          stroke={COLOR.primary}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </g>

      {/* M */}
      <path
        d="M 222 52 L 222 12 L 246 36 L 270 12 L 270 52"
        stroke={COLOR.ink}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </div>
);
