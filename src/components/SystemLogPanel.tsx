import React, { useState } from 'react';
import { MissionEvent } from '../types/slam';
import { Terminal, Filter, Download, Trash2 } from 'lucide-react';

interface SystemLogPanelProps {
  events: MissionEvent[];
}

export const SystemLogPanel: React.FC<SystemLogPanelProps> = ({ events }) => {
  const [filter, setFilter] = useState<'ALL' | 'SLAM' | 'NETWORK' | 'MEC' | 'WARN'>('ALL');

  const filteredEvents = events.filter((ev) => {
    if (filter === 'ALL') return true;
    if (filter === 'SLAM') return ev.type === 'SLAM';
    if (filter === 'NETWORK') return ev.type === 'NETWORK';
    if (filter === 'MEC') return ev.type === 'MEC';
    if (filter === 'WARN') return ev.type === 'WARN';
    return true;
  });

  const handleExport = () => {
    const text = events.map((e) => `[${e.timestamp}] [${e.type}] ${e.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vyom_slam_mission_log_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-black border border-zinc-800 rounded-sm p-3 flex flex-col gap-2 font-sans">
      {/* Header with Filters */}
      <div className="flex flex-wrap items-center justify-between border-b border-zinc-800 pb-2 gap-2">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-semibold font-sans text-zinc-100">
            Event & System Log
          </h2>
          <span className="text-[10px] text-zinc-500 font-mono tabular-nums">({events.length} entries)</span>
        </div>

        <div className="flex items-center gap-1 text-[11px] font-sans">
          {(['ALL', 'SLAM', 'NETWORK', 'MEC', 'WARN'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-0.5 rounded-xs transition-colors cursor-pointer ${
                filter === f
                  ? 'bg-cyan-500 text-black font-semibold'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 font-medium'
              }`}
            >
              {f}
            </button>
          ))}
          <div className="h-3 w-px bg-zinc-800 mx-1" />
          <button
            onClick={handleExport}
            className="p-1 text-zinc-400 hover:text-cyan-400 hover:bg-zinc-900 rounded-xs transition-colors cursor-pointer"
            title="Export Mission Log as .txt"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Log Stream Window (Technical Log Stream: Monospace JetBrains Mono) */}
      <div className="bg-zinc-950 rounded-xs border border-zinc-850 p-2 h-44 overflow-y-auto font-mono tabular-nums text-[11px] space-y-1 select-text scrollbar-thin">
        {filteredEvents.length === 0 ? (
          <div className="text-zinc-600 italic py-4 text-center font-sans">No log events recorded for current filter.</div>
        ) : (
          filteredEvents.map((ev) => {
            let badgeCol = 'text-zinc-400';
            if (ev.type === 'SLAM') badgeCol = 'text-cyan-400';
            if (ev.type === 'NETWORK') badgeCol = 'text-sky-300';
            if (ev.type === 'MEC') badgeCol = 'text-purple-400';
            if (ev.type === 'WARN') badgeCol = 'text-amber-400 font-semibold';
            if (ev.type === 'SUCCESS') badgeCol = 'text-emerald-400 font-semibold';

            return (
              <div key={ev.id} className="flex items-start gap-2 hover:bg-zinc-900/60 px-1 py-0.5 rounded">
                <span className="text-zinc-500 shrink-0 select-none">[{ev.timestamp}]</span>
                <span className={`shrink-0 text-[10px] px-1 py-0.2 rounded-xs border border-zinc-800 ${badgeCol}`}>
                  {ev.type}
                </span>
                <span className="text-zinc-200 break-all leading-relaxed">
                  {ev.message}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
