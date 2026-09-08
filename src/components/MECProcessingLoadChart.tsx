import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { MECLoadSample } from '../types/slam';
import { TrendingUp } from 'lucide-react';
import { COLOR } from '../design/tokens';
import { StatusBadge } from './ui/Panel';

interface MECProcessingLoadChartProps {
  loadHistory: MECLoadSample[];
  currentLoad: number;
  peakLoad?: number;
  isFusing: boolean;
}

/** Load above this share of edge capacity is treated as a bottleneck. */
const BOTTLENECK_THRESHOLD = 75;

const AXIS_TICK = { fill: COLOR.ink4, fontSize: 8, fontFamily: 'JetBrains Mono, monospace' };

export const MECProcessingLoadChart: React.FC<MECProcessingLoadChartProps> = ({
  loadHistory,
  currentLoad,
  peakLoad,
  isFusing,
}) => {
  const chartData = useMemo(() => {
    if (!loadHistory || loadHistory.length === 0) {
      return [{ time: 'now', slamLoad: currentLoad, cpuUsage: 30, gpuUsage: 35 }];
    }
    return loadHistory.map((item, index) => ({
      time: item.time || `${index}s`,
      slamLoad: item.slamLoad,
      cpuUsage: item.cpuUsage,
      gpuUsage: item.gpuUsage,
    }));
  }, [loadHistory, currentLoad]);

  const maxRecorded = useMemo(() => {
    if (peakLoad !== undefined && peakLoad > 0) return peakLoad;
    if (!loadHistory || loadHistory.length === 0) return currentLoad;
    return Math.max(...loadHistory.map((d) => d.slamLoad), currentLoad);
  }, [peakLoad, loadHistory, currentLoad]);

  const bottleneckCount = useMemo(() => {
    if (!loadHistory || loadHistory.length === 0)
      return currentLoad >= BOTTLENECK_THRESHOLD ? 1 : 0;
    return loadHistory.filter((d) => d.slamLoad >= BOTTLENECK_THRESHOLD).length;
  }, [loadHistory, currentLoad]);

  const bottleneckPercent =
    !loadHistory || loadHistory.length === 0
      ? 0
      : Math.round((bottleneckCount / loadHistory.length) * 100);

  const isCurrentBottleneck = currentLoad >= BOTTLENECK_THRESHOLD;
  const traceColor = isCurrentBottleneck ? COLOR.danger : COLOR.primary;

  const status = isCurrentBottleneck
    ? { label: 'Bottleneck above 75%', tone: 'danger' as const }
    : isFusing
    ? { label: 'High compute — fusion', tone: 'warning' as const }
    : { label: 'Capacity nominal', tone: 'success' as const };

  return (
    <div className="rounded border border-line bg-surface-2 p-2">
      <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-line pb-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <TrendingUp className="h-3 w-3 shrink-0 text-ink-3" />
          <span className="truncate text-2xs font-medium text-ink-2">
            SLAM processing load trend
          </span>
        </div>
        <StatusBadge label={status.label} tone={status.tone} />
      </div>

      <div className="relative h-[115px] w-full select-none rounded-sm bg-surface-1">
        <ResponsiveContainer width="100%" height={115}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="mec-load-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={traceColor} stopOpacity={0.22} />
                <stop offset="100%" stopColor={traceColor} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke={COLOR.line} vertical={false} />

            <XAxis
              dataKey="time"
              stroke={COLOR.lineStrong}
              tick={AXIS_TICK}
              tickLine={{ stroke: COLOR.lineStrong }}
              interval="preserveStartEnd"
              minTickGap={24}
            />

            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              stroke={COLOR.lineStrong}
              tick={AXIS_TICK}
              tickLine={{ stroke: COLOR.lineStrong }}
              unit="%"
            />

            <ReferenceLine
              y={BOTTLENECK_THRESHOLD}
              stroke={COLOR.warningInk}
              strokeDasharray="3 3"
              label={{
                value: 'Bottleneck 75%',
                position: 'insideTopRight',
                fill: COLOR.warningInk,
                fontSize: 8,
                fontFamily: 'Inter, sans-serif',
                offset: 4,
              }}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const data = payload[0].payload as (typeof chartData)[number];
                const isHigh = data.slamLoad >= BOTTLENECK_THRESHOLD;
                return (
                  <div className="rounded border border-line-strong bg-surface-0 px-2 py-1.5">
                    <div className="mb-1 flex items-center justify-between gap-3 border-b border-line pb-1">
                      <span className="telemetry text-3xs text-ink-3">{data.time}</span>
                      <span
                        className={`text-3xs font-medium ${
                          isHigh ? 'text-danger-ink' : 'text-success-ink'
                        }`}
                      >
                        {isHigh ? 'Bottleneck' : 'Nominal'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-3xs">
                      <span className="text-ink-3">SLAM processing</span>
                      <span
                        className={`telemetry font-semibold ${
                          isHigh ? 'text-danger-ink' : 'text-primary-ink'
                        }`}
                      >
                        {data.slamLoad}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-3xs">
                      <span className="text-ink-3">CPU / GPU</span>
                      <span className="telemetry font-semibold text-ink">
                        {data.cpuUsage}% / {data.gpuUsage}%
                      </span>
                    </div>
                  </div>
                );
              }}
            />

            <Area
              type="monotone"
              dataKey="slamLoad"
              stroke="transparent"
              fill="url(#mec-load-fill)"
              isAnimationActive={false}
            />

            <Line
              type="monotone"
              dataKey="slamLoad"
              stroke={traceColor}
              strokeWidth={1.75}
              dot={false}
              activeDot={{ r: 3, fill: traceColor, stroke: COLOR.surface0, strokeWidth: 1.5 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-1.5 grid grid-cols-4 gap-1.5">
        {[
          {
            label: 'Current',
            value: `${currentLoad}%`,
            tone: isCurrentBottleneck
              ? 'text-danger-ink'
              : currentLoad > 55
              ? 'text-warning-ink'
              : 'text-ink',
          },
          {
            label: 'Peak',
            value: `${maxRecorded}%`,
            tone: maxRecorded >= BOTTLENECK_THRESHOLD ? 'text-danger-ink' : 'text-ink',
          },
          {
            label: 'Bottleneck samples',
            value: `${bottleneckCount} (${bottleneckPercent}%)`,
            tone: bottleneckCount > 0 ? 'text-warning-ink' : 'text-success-ink',
          },
          {
            label: 'Backend',
            value: isFusing ? 'g2o · 16 threads' : 'DBoW2 · 4 threads',
            tone: 'text-ink',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="min-w-0 rounded-sm border border-line bg-surface-1 px-1.5 py-1"
          >
            <div className="truncate text-3xs text-ink-4">{stat.label}</div>
            <div className={`telemetry truncate text-2xs font-semibold ${stat.tone}`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
