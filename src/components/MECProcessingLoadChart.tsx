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
import { TrendingUp, AlertTriangle, CheckCircle2, Cpu, Flame } from 'lucide-react';

interface MECProcessingLoadChartProps {
  loadHistory: MECLoadSample[];
  currentLoad: number;
  peakLoad?: number;
  isFusing: boolean;
}

export const MECProcessingLoadChart: React.FC<MECProcessingLoadChartProps> = ({
  loadHistory,
  currentLoad,
  peakLoad,
  isFusing,
}) => {
  // Safe formatting of data for Recharts
  const chartData = useMemo(() => {
    if (!loadHistory || loadHistory.length === 0) {
      return [{ time: 'Now', slamLoad: currentLoad, cpuUsage: 30, gpuUsage: 35, isBottleneck: false }];
    }
    return loadHistory.map((item, index) => ({
      time: item.time || `${index}s`,
      slamLoad: item.slamLoad,
      cpuUsage: item.cpuUsage,
      gpuUsage: item.gpuUsage,
      isBottleneck: item.slamLoad >= 75,
    }));
  }, [loadHistory, currentLoad]);

  const maxRecorded = useMemo(() => {
    if (peakLoad !== undefined && peakLoad > 0) return peakLoad;
    if (!loadHistory || loadHistory.length === 0) return currentLoad;
    return Math.max(...loadHistory.map((d) => d.slamLoad), currentLoad);
  }, [peakLoad, loadHistory, currentLoad]);

  const bottleneckCount = useMemo(() => {
    if (!loadHistory || loadHistory.length === 0) return currentLoad >= 75 ? 1 : 0;
    return loadHistory.filter((d) => d.slamLoad >= 75).length;
  }, [loadHistory, currentLoad]);

  const bottleneckPercent = useMemo(() => {
    if (!loadHistory || loadHistory.length === 0) return 0;
    return Math.round((bottleneckCount / loadHistory.length) * 100);
  }, [bottleneckCount, loadHistory]);

  const isCurrentBottleneck = currentLoad >= 75;

  return (
    <div className="bg-zinc-950 rounded-xs border border-zinc-800 p-2 font-sans flex flex-col gap-1.5">
      {/* Header with Title and Live Bottleneck Indicator */}
      <div className="flex items-center justify-between text-[10px] pb-1 border-b border-zinc-900">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-semibold font-sans text-zinc-200">
            SLAM Processing Load Trend
          </span>
        </div>

        <div className="flex items-center gap-1.5 font-sans">
          {isCurrentBottleneck ? (
            <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-xs bg-rose-950/90 text-rose-300 border border-rose-600 animate-pulse font-semibold">
              <Flame className="w-3 h-3 text-rose-400" />
              Bottleneck Active (&gt;75%)
            </span>
          ) : isFusing ? (
            <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-xs bg-amber-950/80 text-amber-300 border border-amber-600 font-semibold">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              High Compute: Map Fusion
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-xs bg-emerald-950/80 text-emerald-300 border border-emerald-700/80 font-semibold">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Capacity Nominal (&lt;75%)
            </span>
          )}
        </div>
      </div>

      {/* Recharts Area/Line Chart Container */}
      <div className="w-full h-[115px] bg-black rounded-xs border border-zinc-900 relative select-none">
        <ResponsiveContainer width="100%" height={115}>
          <AreaChart data={chartData} margin={{ top: 8, right: 10, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id="slamLoadGradNominal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="slamLoadGradBottleneck" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="#27272a" strokeDasharray="2 2" vertical={false} />

            <XAxis
              dataKey="time"
              stroke="#71717a"
              tick={{ fill: '#71717a', fontSize: 8, fontFamily: 'Inter, sans-serif' }}
              tickLine={{ stroke: '#3f3f46' }}
              interval="preserveStartEnd"
              minTickGap={24}
            />

            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              stroke="#71717a"
              tick={{ fill: '#71717a', fontSize: 8, fontFamily: 'Inter, sans-serif' }}
              tickLine={{ stroke: '#3f3f46' }}
              unit="%"
            />

            {/* Bottleneck Threshold Reference Line at 75% */}
            <ReferenceLine
              y={75}
              stroke="#f59e0b"
              strokeDasharray="3 2"
              strokeWidth={1.2}
              label={{
                value: 'Bottleneck (75%)',
                position: 'insideTopRight',
                fill: '#fbbf24',
                fontSize: 8,
                fontFamily: 'Inter, sans-serif',
                offset: 4,
              }}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  const isHigh = data.slamLoad >= 75;
                  return (
                    <div className="bg-black border border-zinc-700 p-2 rounded-xs shadow-xl text-[10px] font-sans z-50">
                      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-1 mb-1 font-sans">
                        <span className="text-zinc-400 font-medium">Timestamp: <span className="font-mono tabular-nums">{data.time}</span></span>
                        <span
                          className={`font-semibold px-1 rounded-2xs ${
                            isHigh ? 'bg-rose-950 text-rose-300' : 'bg-emerald-950 text-emerald-300'
                          }`}
                        >
                          {isHigh ? 'Bottleneck' : 'Normal'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4 font-sans">
                        <span className="text-zinc-400 font-medium">SLAM Processing:</span>
                        <span
                          className={`font-semibold font-mono tabular-nums ${
                            isHigh ? 'text-rose-400' : 'text-cyan-300'
                          }`}
                        >
                          {data.slamLoad}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-zinc-400 font-sans">
                        <span className="font-medium">CPU / GPU:</span>
                        <span className="text-zinc-200 font-mono tabular-nums font-semibold">
                          {data.cpuUsage}% / {data.gpuUsage}%
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            {/* Area Fill for Volume Under Curve */}
            <Area
              type="monotone"
              dataKey="slamLoad"
              stroke="transparent"
              fill={isCurrentBottleneck ? 'url(#slamLoadGradBottleneck)' : 'url(#slamLoadGradNominal)'}
              isAnimationActive={false}
            />

            {/* Primary SLAM Load Trend Line */}
            <Line
              type="monotone"
              dataKey="slamLoad"
              stroke={isCurrentBottleneck ? '#f43f5e' : '#06b6d4'}
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 4,
                fill: isCurrentBottleneck ? '#ef4444' : '#38bdf8',
                stroke: '#09090b',
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottleneck Telemetry & Summary Row */}
      <div className="grid grid-cols-4 gap-1.5 text-[10px] pt-0.5 font-sans">
        <div className="bg-zinc-900/90 px-1.5 py-1 rounded-xs border border-zinc-800">
          <span className="text-[9px] text-zinc-500 font-medium block">Current Load</span>
          <span
            className={`font-semibold font-mono tabular-nums ${
              isCurrentBottleneck
                ? 'text-rose-400 animate-pulse'
                : currentLoad > 55
                ? 'text-amber-400'
                : 'text-cyan-300'
            }`}
          >
            {currentLoad}%
          </span>
        </div>

        <div className="bg-zinc-900/90 px-1.5 py-1 rounded-xs border border-zinc-800">
          <span className="text-[9px] text-zinc-500 font-medium block">Peak Load</span>
          <span
            className={`font-semibold font-mono tabular-nums ${
              maxRecorded >= 75 ? 'text-rose-400' : 'text-zinc-200'
            }`}
          >
            {maxRecorded}%
          </span>
        </div>

        <div className="bg-zinc-900/90 px-1.5 py-1 rounded-xs border border-zinc-800">
          <span className="text-[9px] text-zinc-500 font-medium block">Bottleneck Time</span>
          <span
            className={`font-semibold font-mono tabular-nums ${
              bottleneckCount > 0 ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            {bottleneckCount} <span className="text-[9px] font-normal font-mono tabular-nums text-zinc-400">({bottleneckPercent}%)</span>
          </span>
        </div>

        <div className="bg-zinc-900/90 px-1.5 py-1 rounded-xs border border-zinc-800">
          <span className="text-[9px] text-zinc-500 font-medium block">Optimization Backend</span>
          <span className="font-semibold text-zinc-200 truncate block">
            {isFusing ? 'g2o (16 Threads)' : 'DBoW2 (4 Threads)'}
          </span>
        </div>
      </div>
    </div>
  );
};
