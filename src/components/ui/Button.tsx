import React from 'react';

export type ButtonVariant =
  | 'primary' // orange — main action (Fuse Maps, confirm)
  | 'success' // green — start / resume
  | 'danger' // red — pause / stop / fault
  | 'neutral' // gray — reset, secondary
  | 'ghost'; // borderless — icon buttons, close

export type ButtonSize = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon element, already sized by the caller or defaulted here. */
  icon?: React.ReactNode;
  /** Icon-only button: applies square padding and requires `aria-label`. */
  iconOnly?: boolean;
  /** Renders an inset ring to mark a toggle as engaged. */
  active?: boolean;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-surface-0 border-primary hover:bg-primary-hover active:bg-primary-press font-semibold',
  success:
    'bg-success text-surface-0 border-success hover:bg-success-hover active:bg-success-press font-semibold',
  danger:
    'bg-danger text-surface-0 border-danger hover:bg-danger-hover active:bg-danger-press font-semibold',
  neutral:
    'bg-surface-2 text-ink border-line hover:bg-surface-3 hover:border-line-strong font-medium',
  ghost:
    'bg-transparent text-ink-2 border-transparent hover:bg-surface-3 hover:text-ink font-medium',
};

const ACTIVE: Record<ButtonVariant, string> = {
  primary: '',
  success: '',
  danger: '',
  neutral: 'bg-surface-4 text-ink border-line-strong',
  ghost: 'bg-surface-3 text-ink',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'text-2xs h-7 px-2.5 gap-1.5',
  md: 'text-xs h-8 px-3 gap-1.5',
};

const SIZE_ICON_ONLY: Record<ButtonSize, string> = {
  sm: 'h-7 w-7 p-0',
  md: 'h-8 w-8 p-0',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'neutral',
  size = 'md',
  icon,
  iconOnly = false,
  active = false,
  className = '',
  children,
  ...rest
}) => (
  <button
    {...rest}
    className={[
      'inline-flex items-center justify-center shrink-0 rounded border',
      'transition-colors duration-100 whitespace-nowrap',
      'disabled:opacity-45 disabled:pointer-events-none',
      VARIANT[variant],
      active ? ACTIVE[variant] : '',
      iconOnly ? SIZE_ICON_ONLY[size] : SIZE[size],
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    {icon}
    {!iconOnly && children}
  </button>
);

/** Segmented control: a row of mutually exclusive options. */
interface SegmentedProps<T extends string> {
  options: { value: T; label: string; id?: string; title?: string }[];
  value: T;
  onChange: (value: T) => void;
  size?: ButtonSize;
  className?: string;
  /** Renders values in the telemetry face (speed multipliers, bin widths). */
  mono?: boolean;
  'aria-label'?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'sm',
  className = '',
  mono = false,
  'aria-label': ariaLabel,
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-0.5 rounded border border-line bg-surface-2 p-0.5 ${className}`}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            id={opt.id}
            title={opt.title}
            aria-pressed={selected}
            onClick={() => onChange(opt.value)}
            className={[
              'rounded-sm border border-transparent transition-colors duration-100 whitespace-nowrap',
              size === 'sm' ? 'h-6 px-2 text-2xs' : 'h-7 px-2.5 text-xs',
              mono ? 'telemetry' : '',
              selected
                ? 'bg-surface-4 text-ink font-semibold border-line-strong'
                : 'text-ink-3 hover:text-ink hover:bg-surface-3 font-medium',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
