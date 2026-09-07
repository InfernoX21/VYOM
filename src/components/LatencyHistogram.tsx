import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { LatencySample } from '../types/slam';
import { AlertCircle, CheckCircle2, Activity, Info } from 'lucide-react';

interface LatencyHistogramProps {
  latencyHistory: LatencySample[];
  currentLatency: number;
  isStressTest: boolean;
}

export const LatencyHistogram: React.FC<LatencyHistogramProps> = ({
  latencyHistory,
  currentLatency,
  isStressTest,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(380);
  const [hoveredBin, setHoveredBin] = useState<{
    x0: number;
    x1: number;
    count: number;
    percent: number;
    isSpike: boolean;
  } | null>(null);

  // Measure container width responsively
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 50) {
          setContainerWidth(Math.floor(entry.contentRect.width));
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute metrics from the 60s sample history
  const { sampleValues, spikeCount, spikePercent, maxLatency, p95Latency, medianLatency } =
    useMemo(() => {
      const values =
        latencyHistory && latencyHistory.length > 0
          ? latencyHistory.map((s) => s.latencyMs)
          : [currentLatency];

      const spikes = values.filter((v) => v > 50).length;
      const percent = values.length > 0 ? (spikes / values.length) * 100 : 0;
      const max = Math.max(...values, currentLatency);

      const sorted = [...values].sort((a, b) => a - b);
      const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] || currentLatency;
      const median = sorted[Math.floor(sorted.length * 0.5)] || currentLatency;

      return {
        sampleValues: values,
        spikeCount: spikes,
        spikePercent: percent,
        maxLatency: max,
        p95Latency: p95,
        medianLatency: median,
      };
    }, [latencyHistory, currentLatency]);

  // Render D3 Histogram
  useEffect(() => {
    if (!svgRef.current || containerWidth <= 0) return;

    const width = containerWidth;
    const height = 115;
    const margin = { top: 16, right: 14, bottom: 24, left: 30 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Domain bounds: upper bound up to at least 120ms or higher if severe spikes occur
    const maxDomain = Math.max(120, Math.ceil((maxLatency + 10) / 10) * 10);
    const binStep = 10; // 10ms bin resolution
    const thresholds = d3.range(0, maxDomain + binStep, binStep);

    // X Scale
    const xScale = d3
      .scaleLinear()
      .domain([0, maxDomain])
      .range([margin.left, margin.left + innerWidth]);

    // Bins generator
    const binGenerator = d3
      .bin<number, number>()
      .domain([0, maxDomain])
      .thresholds(thresholds);

    const bins = binGenerator(sampleValues);
    const maxCount = Math.max(4, d3.max(bins, (d) => d.length) || 1);

    // Y Scale
    const yScale = d3
      .scaleLinear()
      .domain([0, maxCount * 1.15])
      .range([margin.top + innerHeight, margin.top]);

    // Defs for Bar Gradients
    const defs = svg.append('defs');

    // URLLC compliant gradient (<25ms)
    const gradCompliant = defs
      .append('linearGradient')
      .attr('id', 'grad-compliant')
      .attr('x1', '0')
      .attr('y1', '0')
      .attr('x2', '0')
      .attr('y2', '1');
    gradCompliant.append('stop').attr('offset', '0%').attr('stop-color', '#10b981');
    gradCompliant.append('stop').attr('offset', '100%').attr('stop-color', '#047857');

    // Nominal / Jitter gradient (25-50ms)
    const gradNominal = defs
      .append('linearGradient')
      .attr('id', 'grad-nominal')
      .attr('x1', '0')
      .attr('y1', '0')
      .attr('x2', '0')
      .attr('y2', '1');
    gradNominal.append('stop').attr('offset', '0%').attr('stop-color', '#06b6d4');
    gradNominal.append('stop').attr('offset', '100%').attr('stop-color', '#0e7490');

    // Elevated gradient (50-80ms)
    const gradElevated = defs
      .append('linearGradient')
      .attr('id', 'grad-elevated')
      .attr('x1', '0')
      .attr('y1', '0')
      .attr('x2', '0')
      .attr('y2', '1');
    gradElevated.append('stop').attr('offset', '0%').attr('stop-color', '#f59e0b');
    gradElevated.append('stop').attr('offset', '100%').attr('stop-color', '#b45309');

    // Critical Spike gradient (>80ms)
    const gradSpike = defs
      .append('linearGradient')
      .attr('id', 'grad-spike')
      .attr('x1', '0')
      .attr('y1', '0')
      .attr('x2', '0')
      .attr('y2', '1');
    gradSpike.append('stop').attr('offset', '0%').attr('stop-color', '#f43f5e');
    gradSpike.append('stop').attr('offset', '100%').attr('stop-color', '#be123c');

    // Background horizontal grid lines
    const yTicks = yScale.ticks(3);
    svg
      .append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data(yTicks)
      .enter()
      .append('line')
      .attr('x1', margin.left)
      .attr('x2', margin.left + innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', '#1e293b')
      .attr('stroke-dasharray', '2,2')
      .attr('stroke-width', 0.8);

    // 20ms URLLC Target SLA Zone Shading
    const slaX = xScale(20);
    svg
      .append('rect')
      .attr('x', margin.left)
      .attr('y', margin.top)
      .attr('width', Math.max(0, slaX - margin.left))
      .attr('height', innerHeight)
      .attr('fill', '#10b981')
      .attr('opacity', 0.06);

    // 50ms+ Spike Danger Zone Shading
    const spikeZoneX = xScale(50);
    svg
      .append('rect')
      .attr('x', spikeZoneX)
      .attr('y', margin.top)
      .attr('width', Math.max(0, margin.left + innerWidth - spikeZoneX))
      .attr('height', innerHeight)
      .attr('fill', isStressTest ? '#ef4444' : '#f59e0b')
      .attr('opacity', isStressTest ? 0.1 : 0.04);

    // Histogram Bars
    const barGroup = svg.append('g').attr('class', 'bars');

    barGroup
      .selectAll('rect')
      .data(bins)
      .enter()
      .append('rect')
      .attr('x', (d) => xScale(d.x0 ?? 0) + 1)
      .attr('width', (d) => Math.max(0, xScale(d.x1 ?? 0) - xScale(d.x0 ?? 0) - 2))
      .attr('y', (d) => yScale(d.length))
      .attr('height', (d) => Math.max(0, margin.top + innerHeight - yScale(d.length)))
      .attr('fill', (d) => {
        const mid = ((d.x0 ?? 0) + (d.x1 ?? 0)) / 2;
        if (mid <= 25) return 'url(#grad-compliant)';
        if (mid <= 50) return 'url(#grad-nominal)';
        if (mid <= 80) return 'url(#grad-elevated)';
        return 'url(#grad-spike)';
      })
      .attr('rx', 1.5)
      .attr('stroke', (d) => {
        const mid = ((d.x0 ?? 0) + (d.x1 ?? 0)) / 2;
        if (mid > 50 && d.length > 0) return isStressTest ? '#f87171' : '#fbbf24';
        return 'transparent';
      })
      .attr('stroke-width', 0.75)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        const x0 = d.x0 ?? 0;
        const x1 = d.x1 ?? 0;
        const count = d.length;
        const percent = sampleValues.length > 0 ? (count / sampleValues.length) * 100 : 0;
        setHoveredBin({
          x0,
          x1,
          count,
          percent,
          isSpike: x0 >= 50,
        });
      })
      .on('mouseleave', () => {
        setHoveredBin(null);
      });

    // Bar top count labels for significant bars
    barGroup
      .selectAll('.bar-label')
      .data(bins.filter((d) => d.length > 0))
      .enter()
      .append('text')
      .attr('class', 'bar-label')
      .attr('x', (d) => (xScale(d.x0 ?? 0) + xScale(d.x1 ?? 0)) / 2)
      .attr('y', (d) => yScale(d.length) - 3)
      .attr('text-anchor', 'middle')
      .attr('font-size', '8px')
      .attr('font-family', 'monospace')
      .attr('fill', (d) => {
        const mid = ((d.x0 ?? 0) + (d.x1 ?? 0)) / 2;
        if (mid > 50) return '#fca5a5';
        return '#94a3b8';
      })
      .text((d) => d.length);

    // 20ms URLLC Reference Line
    svg
      .append('line')
      .attr('x1', slaX)
      .attr('x2', slaX)
      .attr('y1', margin.top)
      .attr('y2', margin.top + innerHeight)
      .attr('stroke', '#10b981')
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '3,2');

    svg
      .append('text')
      .attr('x', slaX + 2)
      .attr('y', margin.top + 7)
      .attr('font-size', '8px')
      .attr('font-family', 'monospace')
      .attr('fill', '#34d399')
      .text('URLLC <20ms');

    // 50ms Spike Threshold Reference Line
    svg
      .append('line')
      .attr('x1', spikeZoneX)
      .attr('x2', spikeZoneX)
      .attr('y1', margin.top)
      .attr('y2', margin.top + innerHeight)
      .attr('stroke', isStressTest ? '#f87171' : '#f59e0b')
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '3,2');

    svg
      .append('text')
      .attr('x', spikeZoneX + 2)
      .attr('y', margin.top + 7)
      .attr('font-size', '8px')
      .attr('font-family', 'monospace')
      .attr('fill', isStressTest ? '#f87171' : '#fbbf24')
      .text('Spike >50ms');

    // Instantaneous Latency Indicator Needle / Marker
    const currentX = Math.min(margin.left + innerWidth, Math.max(margin.left, xScale(currentLatency)));
    svg
      .append('line')
      .attr('x1', currentX)
      .attr('x2', currentX)
      .attr('y1', margin.top + 4)
      .attr('y2', margin.top + innerHeight)
      .attr('stroke', currentLatency > 50 ? '#ef4444' : '#38bdf8')
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round');

    // Marker Head
    svg
      .append('polygon')
      .attr(
        'points',
        `${currentX - 3},${margin.top + 2} ${currentX + 3},${margin.top + 2} ${currentX},${margin.top + 7}`
      )
      .attr('fill', currentLatency > 50 ? '#ef4444' : '#38bdf8');

    // X Axis
    const xAxis = d3
      .axisBottom(xScale)
      .tickValues([0, 20, 40, 60, 80, 100, 120])
      .tickFormat((d) => `${d}ms`)
      .tickSize(3);

    const gx = svg
      .append('g')
      .attr('transform', `translate(0, ${margin.top + innerHeight})`)
      .call(xAxis);

    gx.select('.domain').attr('stroke', '#334155');
    gx.selectAll('.tick line').attr('stroke', '#475569');
    gx.selectAll('.tick text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '8px')
      .attr('font-family', 'monospace');

    // Y Axis
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(3)
      .tickFormat(d3.format('d'))
      .tickSize(2);

    const gy = svg.append('g').attr('transform', `translate(${margin.left}, 0)`).call(yAxis);

    gy.select('.domain').attr('stroke', '#334155');
    gy.selectAll('.tick line').attr('stroke', '#475569');
    gy.selectAll('.tick text')
      .attr('fill', '#64748b')
      .attr('font-size', '8px')
      .attr('font-family', 'monospace');
  }, [containerWidth, sampleValues, maxLatency, isStressTest, currentLatency]);

  return (
    <div
      ref={containerRef}
      className="bg-zinc-950 rounded-xs border border-zinc-800 p-2 font-mono flex flex-col gap-1.5"
    >
      {/* Header and Live Status */}
      <div className="flex items-center justify-between text-[10px] pb-1 border-b border-zinc-850">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-bold text-zinc-200 tracking-wider">
            60s LATENCY SPIKE DISTRIBUTION (D3)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isStressTest ? (
            <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-xs bg-rose-950/80 text-rose-300 border border-rose-700/80 animate-pulse font-bold">
              <AlertCircle className="w-3 h-3" />
              SPIKE FREQUENCY HIGH
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-xs bg-emerald-950/80 text-emerald-300 border border-emerald-700/80 font-bold">
              <CheckCircle2 className="w-3 h-3" />
              URLLC SLA STABLE
            </span>
          )}
        </div>
      </div>

      {/* SVG D3 Histogram Canvas */}
      <div className="relative w-full overflow-hidden bg-black rounded-xs border border-zinc-900">
        <svg
          ref={svgRef}
          className="w-full h-[115px] block select-none"
          style={{ minWidth: '100%' }}
        />

        {/* Dynamic Tooltip on Hover */}
        {hoveredBin && (
          <div
            className="absolute top-1.5 right-1.5 bg-black/95 border border-zinc-750 px-2 py-1 rounded-xs shadow-lg text-[10px] z-10 pointer-events-none"
          >
            <div className="flex items-center gap-1 font-bold">
              <span className={hoveredBin.isSpike ? 'text-rose-400' : 'text-emerald-400'}>
                [{hoveredBin.x0}–{hoveredBin.x1} ms]:
              </span>
              <span className="text-zinc-100">{hoveredBin.count} samples</span>
              <span className="text-zinc-400">({hoveredBin.percent.toFixed(1)}%)</span>
            </div>
            <div className="text-[9px] text-zinc-400 mt-0.5">
              {hoveredBin.isSpike ? (
                <span className="text-amber-300 font-semibold">⚠️ LATENCY SPIKE (Degrading SLAM)</span>
              ) : (
                <span className="text-emerald-300">✅ 5G URLLC Compliant</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Statistical Summary Row */}
      <div className="grid grid-cols-4 gap-1.5 text-[10px] pt-0.5">
        <div className="bg-zinc-900/90 px-1.5 py-1 rounded-xs border border-zinc-800">
          <span className="text-[9px] text-zinc-500 block">Total Spikes:</span>
          <span
            className={`font-bold ${
              spikeCount > 0
                ? isStressTest
                  ? 'text-rose-400 animate-pulse'
                  : 'text-amber-400'
                : 'text-emerald-400'
            }`}
          >
            {spikeCount} <span className="text-[9px] font-normal text-zinc-400">({spikePercent.toFixed(0)}%)</span>
          </span>
        </div>

        <div className="bg-zinc-900/90 px-1.5 py-1 rounded-xs border border-zinc-800">
          <span className="text-[9px] text-zinc-500 block">Peak Spike:</span>
          <span
            className={`font-bold ${
              maxLatency > 50 ? 'text-rose-400' : 'text-zinc-200'
            }`}
          >
            {maxLatency} <span className="text-[9px] font-normal text-zinc-400">ms</span>
          </span>
        </div>

        <div className="bg-zinc-900/90 px-1.5 py-1 rounded-xs border border-zinc-800">
          <span className="text-[9px] text-zinc-500 block">95th %ile (P95):</span>
          <span
            className={`font-bold ${
              p95Latency > 50 ? 'text-amber-400' : 'text-cyan-300'
            }`}
          >
            {p95Latency} <span className="text-[9px] font-normal text-zinc-400">ms</span>
          </span>
        </div>

        <div className="bg-zinc-900/90 px-1.5 py-1 rounded-xs border border-zinc-800">
          <span className="text-[9px] text-zinc-500 block">Median:</span>
          <span className="font-bold text-zinc-200">
            {medianLatency} <span className="text-[9px] font-normal text-zinc-400">ms</span>
          </span>
        </div>
      </div>

      {/* Legend & Operator Guidance */}
      <div className="flex flex-wrap items-center justify-between text-[9px] text-zinc-400 px-0.5 pt-0.5 border-t border-zinc-900">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-2xs bg-emerald-500 inline-block" />
            <span>&lt;25ms URLLC</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-2xs bg-cyan-500 inline-block" />
            <span>25-50ms Nom</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-2xs bg-amber-500 inline-block" />
            <span>50-80ms Jitter</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-2xs bg-rose-500 inline-block" />
            <span>&gt;80ms Severe</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-zinc-500">
          <Info className="w-3 h-3" />
          <span>60s Rolling Window</span>
        </div>
      </div>
    </div>
  );
};
