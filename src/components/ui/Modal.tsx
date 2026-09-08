import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Tabs or filters pinned below the header, outside the scroll area. */
  toolbar?: React.ReactNode;
  /** Footer controls; the shell always supplies a close action if omitted. */
  footer?: React.ReactNode;
  /** Tailwind max-width class. */
  width?: string;
  children: React.ReactNode;
}

/**
 * Shared modal shell. The body is the only scroll container, so long content
 * scrolls instead of being clipped by the outer `max-h` — the bug the old
 * hand-rolled modals had.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  icon,
  title,
  subtitle,
  toolbar,
  footer,
  width = 'max-w-4xl',
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 transition-opacity duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`panel w-full ${width} max-h-[90vh] flex flex-col overflow-hidden bg-surface-1 border border-line shadow-none rounded-md`}
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 shrink-0">
          <div className="flex items-start gap-2.5 min-w-0">
            {icon && <span className="text-primary mt-0.5 shrink-0">{icon}</span>}
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink truncate">{title}</h2>
              {subtitle && <p className="text-2xs text-ink-3 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="Close"
            onClick={onClose}
            icon={<X className="h-4 w-4" />}
          />
        </header>

        {toolbar && (
          <div className="border-b border-line px-4 py-2 shrink-0 overflow-x-auto">{toolbar}</div>
        )}

        {/* Body — the single scroll container */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">{children}</div>

        <footer className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 shrink-0">
          {footer ?? <span />}
          {!footer && (
            <Button variant="neutral" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
};

/** Tab strip for modal toolbars. */
interface ModalTabsProps<T extends string> {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function ModalTabs<T extends string>({ tabs, value, onChange }: ModalTabsProps<T>) {
  return (
    <div role="tablist" className="flex items-center gap-1">
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.value)}
            className={[
              'h-7 rounded px-3 text-2xs whitespace-nowrap border transition-colors duration-100',
              selected
                ? 'bg-surface-3 text-ink font-semibold border-line-strong'
                : 'bg-transparent text-ink-3 border-transparent hover:text-ink hover:bg-surface-2 font-medium',
            ].join(' ')}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
