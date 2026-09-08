import React from 'react';
import type { Tone } from '../../design/tokens';
import { TONE_BAR, TONE_TEXT } from '../../design/tokens';

/* -------------------------------------------------------------------------- */
/* Panel                                                                      */
/* -------------------------------------------------------------------------- */

interface PanelProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  /** Removes internal padding so the child controls its own layout. */
  flush?: boolean;
}

export const Panel: React.FC<PanelProps> = ({ children, className = '', id, flush = false }) => (
  <section
    id={id}
    className={`panel flex flex-col min-w-0 ${flush ? '' : 'p-3'} ${className}`}
  >
    {children}
  </section>
);

interface PanelHeaderProps {
  icon?: React.ReactNode;
  title: string;
  /** Short qualifier shown after the title in muted text. */
  subtitle?: string;
  /** Controls or status pushed to the trailing edge. */
  actions?: React.ReactNode;
  className?: string;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({
  icon,
  title,
  subtitle,
  actions,
  className = '',
}) => (
  <header
    className={`flex items-center justify-between gap-3 pb-2 mb-3 border-b border-line ${className}`}
  >
    <div className="flex items-center gap-2 min-w-0">
      {icon && <span className="text-ink-3 shrink-0">{icon}</span>}
      <h2 className="text-xs font-semibold text-ink truncate">{title}</h2>
      {subtitle && <span className="text-2xs text-ink-3 truncate">{subtitle}</span>}
    </div>
    {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
  </header>
);

/* -------------------------------------------------------------------------- */
/* Status badge                                                               */
/* -------------------------------------------------------------------------- */

const BADGE_TONE: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-ink-2 border-line',
  primary: 'bg-primary-dim text-primary-ink border-primary-line',
  success: 'bg-success-dim text-success-ink border-success-line',
  warning: 'bg-warning-dim text-warning-ink border-warning-line',
  danger: 'bg-danger-dim text-danger-ink border-danger-line',
};

const DOT_TONE: Record<Tone, string> = {
  neutral: 'bg-ink-4',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

interface StatusBadgeProps {
  label: string;
  tone?: Tone;
  /** Shows a leading state dot. */
  dot?: boolean;
  className?: string;
  id?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  tone = 'neutral',
  dot = false,
  className = '',
  id,
}) => (
  <span
    id={id}
    className={`inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-3xs font-medium whitespace-nowrap ${BADGE_TONE[tone]} ${className}`}
  >
    {dot && <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${DOT_TONE[tone]}`} />}
    {label}
  </span>
);

/* -------------------------------------------------------------------------- */
/* Metric tile                                                                */
/* -------------------------------------------------------------------------- */

interface MetricTileProps {
  label: string;
  value: React.ReactNode;
  /** Unit or qualifier rendered next to the value at reduced emphasis. */
  unit?: string;
  /** Caption under the value — source, target, or context. */
  caption?: string;
  tone?: Tone;
  className?: string;
  id?: string;
  size?: 'sm' | 'md' | 'lg';
}

const VALUE_SIZE = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
} as const;

export const MetricTile: React.FC<MetricTileProps> = ({
  label,
  value,
  unit,
  caption,
  tone = 'neutral',
  className = '',
  id,
  size = 'md',
}) => (
  <div id={id} className={`tile px-2.5 py-2 min-w-0 ${className}`}>
    <div className="text-3xs text-ink-3 truncate">{label}</div>
    <div className="flex items-baseline gap-1 mt-0.5">
      <span
        className={`telemetry font-semibold truncate ${VALUE_SIZE[size]} ${
          tone === 'neutral' ? 'text-ink' : TONE_TEXT[tone]
        }`}
      >
        {value}
      </span>
      {unit && <span className="text-3xs text-ink-3 shrink-0">{unit}</span>}
    </div>
    {caption && <div className="text-3xs text-ink-4 truncate mt-0.5">{caption}</div>}
  </div>
);

/* -------------------------------------------------------------------------- */
/* Progress bar                                                               */
/* -------------------------------------------------------------------------- */

interface ProgressBarProps {
  /** 0–100. */
  value: number;
  tone?: Tone;
  className?: string;
  /** Height in px; defaults to a 4px rail. */
  height?: number;
  label?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  tone = 'primary',
  className = '',
  height = 4,
  label,
}) => {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`w-full overflow-hidden rounded-full bg-surface-4 ${className}`}
      style={{ height }}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-300 ease-out ${TONE_BAR[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Key/value row — dense label + telemetry value                              */
/* -------------------------------------------------------------------------- */

interface DataRowProps {
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  className?: string;
  /** Renders the value in the UI face instead of telemetry mono. */
  prose?: boolean;
}

export const DataRow: React.FC<DataRowProps> = ({
  label,
  value,
  tone = 'neutral',
  className = '',
  prose = false,
}) => (
  <div className={`flex items-center justify-between gap-2 min-w-0 ${className}`}>
    <span className="text-2xs text-ink-3 truncate">{label}</span>
    <span
      className={`text-2xs font-medium truncate ${prose ? '' : 'telemetry'} ${
        tone === 'neutral' ? 'text-ink' : TONE_TEXT[tone]
      }`}
    >
      {value}
    </span>
  </div>
);

/* -------------------------------------------------------------------------- */
/* Section label — replaces the old ALL-CAPS tracking-wide headers             */
/* -------------------------------------------------------------------------- */

export const SectionLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`text-2xs font-medium text-ink-2 mb-2 ${className}`}>{children}</div>
);
