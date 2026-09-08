import React, { useMemo, useState } from 'react';
import { MissionEvent } from '../types/slam';
import { Terminal, Download } from 'lucide-react';
import { Panel, PanelHeader } from './ui/Panel';
import { Button, Segmented } from './ui/Button';
import { LOG_TYPE_TAG, LOG_TYPE_TONE } from '../design/labels';
import { TONE_TEXT } from '../design/tokens';

interface SystemLogPanelProps {
  events: MissionEvent[];
}

type LogFilter = 'ALL' | 'SLAM' | 'NETWORK' | 'MEC' | 'WARN';

const FILTERS: { value: LogFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'SLAM', label: 'SLAM' },
  { value: 'NETWORK', label: 'Network' },
  { value: 'MEC', label: 'Edge' },
  { value: 'WARN', label: 'Warnings' },
];

export const SystemLogPanel: React.FC<SystemLogPanelProps> = ({ events }) => {
  const [filter, setFilter] = useState<LogFilter>('ALL');

  const filteredEvents = useMemo(
    () => (filter === 'ALL' ? events : events.filter((ev) => ev.type === filter)),
    [events, filter]
  );

  const handleExport = () => {
    const text = events
      .slice()
      .reverse()
      .map((e) => `[${e.timestamp}] [${e.type}] ${e.message}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vyom-mission-log-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Panel>
      <PanelHeader
        icon={<Terminal className="h-3.5 w-3.5" />}
        title="Mission log"
        subtitle={`${events.length} entries`}
        actions={
          <>
            <Segmented
              aria-label="Filter log by source"
              options={FILTERS.map((f) => ({ ...f, id: `log-filter-${f.value.toLowerCase()}` }))}
              value={filter}
              onChange={setFilter}
            />
            <Button
              id="btn-export-log"
              variant="neutral"
              size="sm"
              iconOnly
              aria-label="Export mission log"
              title="Export mission log as a text file"
              onClick={handleExport}
              icon={<Download className="h-3.5 w-3.5" />}
            />
          </>
        }
      />

      <div className="h-44 select-text overflow-y-auto rounded-lg border border-white/10 bg-surface-2/40 backdrop-blur-md p-1.5 shadow-inner">
        {filteredEvents.length === 0 ? (
          <p className="py-6 text-center text-2xs text-ink-4">No entries for this filter.</p>
        ) : (
          <ul className="space-y-0.5">
            {filteredEvents.map((ev) => (
              <li
                key={ev.id}
                className="flex items-start gap-2 rounded px-1 py-0.5 hover:bg-white/10 transition-colors"
              >
                <span className="telemetry shrink-0 select-none text-3xs text-ink-4">
                  {ev.timestamp}
                </span>
                <span
                  className={`w-[52px] shrink-0 text-3xs font-medium ${TONE_TEXT[LOG_TYPE_TONE[ev.type]]}`}
                >
                  {LOG_TYPE_TAG[ev.type]}
                </span>
                <span className="min-w-0 flex-1 break-words text-2xs text-ink-2">{ev.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
};
