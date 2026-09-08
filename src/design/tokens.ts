/**
 * VYOM design tokens for non-CSS consumers.
 *
 * Three.js, D3, Recharts and the 2D canvas HUD cannot read Tailwind classes,
 * so they read this module instead. Values mirror the `@theme` block in
 * `src/index.css` exactly — change both together.
 */

/** Hex strings for canvas / SVG / Recharts. */
export const COLOR = {
  surface0: '#0d0e10',
  surface1: '#15171a',
  surface2: '#1c1f23',
  surface3: '#24282d',
  surface4: '#2e3238',

  line: '#2a2e34',
  lineStrong: '#3a4046',

  ink: '#f1f3f5',
  ink2: '#aab0b8',
  ink3: '#7b818a',
  ink4: '#575c64',

  primary: '#e0762c',
  primaryHover: '#ef8b43',
  primaryDim: '#2a1a0d',
  primaryInk: '#f0a668',

  success: '#43a05a',
  successDim: '#12241a',
  successInk: '#6dc186',

  warning: '#cf8b1e',
  warningDim: '#2a2010',
  warningInk: '#e0ab53',

  danger: '#c94a40',
  dangerDim: '#2a1412',
  dangerInk: '#e07b73',
} as const;

/** Per-vehicle identity colours, restrained to the orange/gold/green family. */
export const AGENT_COLOR: Record<string, string> = {
  'AAV-01': '#e0762c',
  'AAV-02': '#cfa02c',
  'AAV-03': '#43a05a',
};

/** Same palette as 0xRRGGBB integers for Three.js material constructors. */
export const HEX = {
  surface0: 0x0d0e10,
  surface1: 0x15171a,
  surface2: 0x1c1f23,
  surface3: 0x24282d,
  surface4: 0x2e3238,

  line: 0x2a2e34,
  lineStrong: 0x3a4046,

  ink: 0xf1f3f5,
  ink2: 0xaab0b8,
  ink3: 0x7b818a,
  ink4: 0x575c64,

  primary: 0xe0762c,
  primaryHover: 0xef8b43,
  primaryDim: 0x2a1a0d,

  success: 0x43a05a,
  successInk: 0x6dc186,

  warning: 0xcf8b1e,
  warningInk: 0xe0ab53,

  danger: 0xc94a40,
  dangerInk: 0xe07b73,

  /* 3D environment */
  ground: 0x121416,
  gridMinor: 0x22262b,
  gridMajor: 0x33383e,
  building: 0x1a1d21,
  buildingEdge: 0x3f454c,
  landmark: 0xc8ccd2,
} as const;

export const AGENT_HEX: Record<string, number> = {
  'AAV-01': 0xe0762c,
  'AAV-02': 0xcfa02c,
  'AAV-03': 0x43a05a,
};

/** Semantic status → colour, so every surface tints identically. */
export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-ink-2',
  primary: 'text-primary-ink',
  success: 'text-success-ink',
  warning: 'text-warning-ink',
  danger: 'text-danger-ink',
};

export const TONE_BAR: Record<Tone, string> = {
  neutral: 'bg-surface-4',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

export const TONE_HEX: Record<Tone, string> = {
  neutral: COLOR.ink3,
  primary: COLOR.primary,
  success: COLOR.success,
  warning: COLOR.warning,
  danger: COLOR.danger,
};
