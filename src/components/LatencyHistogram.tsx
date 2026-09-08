import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { LatencySample } from '../types/slam';
import { Activity } from 'lucide-react';
import { COLOR } from '../design/tokens';
import { StatusBadge } from './ui/Panel';

interface LatencyHistogramProps {
  latencyHistory: LatencySample[];
  currentLatency: number;
  isStressTest: boolean;
}

/** Latency bands, in ms, shared by the bars and the legend. */
const BANDS = [
  { max: 20, color: COLOR.success, label: '< 20 ms URLLC' },
  { max: 50, color: COLOR.ink3, label: '20–50 ms nominal' },
  { max: 80, color: COLOR.warning, label: '50–80 ms elevated' },
  { max: Infinity, color: COLOR.danger, label: '> 80 ms severe' },
] as const;

const bandColor = (ms: number) => (BANDS.find((b) => ms <= b.max) ?? BANDS[3]).color;

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

  // Track the available width so the chart stays legible in the telemetry rail.
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
      const p95 =
        sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] || currentLatency;
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

  useEffect(() => {
    if (!svgRef.current || containerWidth <= 0) return;

    const width = containerWidth;
    const height = 112;
    const margin = { top: 14, right: 10, bottom: 20, left: 26 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const maxDomain = Math.max(120, Math.ceil((maxLatency + 10) / 10) * 10);
    const binStep = 10;
    const thresholds = d3.range(0, maxDomain + binStep, binStep);

    const xScale = d3
      .scaleLinear()
      .domain([0, maxDomain])
      .range([margin.left, margin.left + innerWidth]);

    const bins = d3.bin<number, number>().domain([0, maxDomain]).thresholds(thresholds)(
      sampleValues
    );
    const maxCount = Math.max(4, d3.max(bins, (d) => d.length) || 1);

    const yScale = d3
      .scaleLinear()
      .domain([0, maxCount * 1.15])
      .range([margin.top + innerHeight, margin.top]);

    // Horizontal reference lines.
    svg
      .append('g')
      .selectAll('line')
      .data(yScale.ticks(3))
      .enter()
      .append('line')
      .attr('x1', margin.left)
      .attr('x2', margin.left + innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', COLOR.line)
      .attr('stroke-width', 1);

    // Bars — flat band fills, no gradients.
    const barGroup = svg.append('g');

    barGroup
      .selectAll('rect')
      .data(bins)
      .enter()
      .append('rect')
      .attr('x', (d) => xScale(d.x0 ?? 0) + 1)
      .attr('width', (d) => Math.max(0, xScale(d.x1 ?? 0) - xScale(d.x0 ?? 0) - 2))
      .attr('y', (d) => yScale(d.length))
      .attr('height', (d) => Math.max(0, margin.top + innerHeight - yScale(d.length)))
      .attr('fill', (d) => bandColor(((d.x0 ?? 0) + (d.x1 ?? 0)) / 2))
      .style('cursor', 'pointer')
      .on('mouseenter', (_event, d) => {
        const x0 = d.x0 ?? 0;
        const count = d.length;
        setHoveredBin({
          x0,
          x1: d.x1 ?? 0,
          count,
          percent: sampleValues.length > 0 ? (count / sampleValues.length) * 100 : 0,
          isSpike: x0 >= 50,
        });
      })
      .on('mouseleave', () => setHoveredBin(null));

    // Counts above non-empty bars.
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
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('fill', COLOR.ink3)
      .text((d) => d.length);

    // URLLC target and spike threshold.
    const drawThreshold = (ms: number, color: string, label: string) => {
      const x = xScale(ms);
      svg
        .append('line')
        .attr('x1', x)
        .attr('x2', x)
        .attr('y1', margin.top)
        .attr('y2', margin.top + innerHeight)
        .attr('stroke', color)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,3');
      svg
        .append('text')
        .attr('x', x + 3)
        .attr('y', margin.top + 6)
        .attr('font-size', '8px')
        .attr('font-family', 'JetBrains Mono, monospace')
        .attr('fill', color)
        .text(label);
    };

    drawThreshold(20, COLOR.successInk, '20 ms');
    drawThreshold(50, COLOR.warningInk, '50 ms');

    // Instantaneous latency marker.
    const currentX = Math.min(
      margin.left + innerWidth,
      Math.max(margin.left, xScale(currentLatency))
    );
    const markerColor = currentLatency > 50 ? COLOR.danger : COLOR.primary;
    svg
      .append('line')
      .attr('x1', currentX)
      .attr('x2', currentX)
      .attr('y1', margin.top - 4)
      .attr('y2', margin.top + innerHeight)
      .attr('stroke', markerColor)
      .attr('stroke-width', 1.5);
    svg
      .append('polygon')
      .attr(
        'points',
        `${currentX - 3},${margin.top - 6} ${currentX + 3},${margin.top - 6} ${currentX},${
          margin.top - 1
        }`
      )
      .attr('fill', markerColor);

    const gx = svg
      .append('g')
      .attr('transform', `translate(0, ${margin.top + innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickValues([0, 20, 40, 60, 80, 100, 120])
          .tickFormat((d) => `${d}`)
          .tickSize(3)
      );

    gx.select('.domain').attr('stroke', COLOR.lineStrong);
    gx.selectAll('.tick line').attr('stroke', COLOR.lineStrong);
    gx.selectAll('.tick text')
      .attr('fill', COLOR.ink4)
      .attr('font-size', '8px')
      .attr('font-family', 'JetBrains Mono, monospace');

    const gy = svg
      .append('g')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(yScale).ticks(3).tickFormat(d3.format('d')).tickSize(2));

    gy.select('.domain').attr('stroke', COLOR.lineStrong);
    gy.selectAll('.tick line').attr('stroke', COLOR.lineStrong);
    gy.selectAll('.tick text')
      .attr('fill', COLOR.ink4)
      .attr('font-size', '8px')
      .attr('font-family', 'JetBrains Mono, monospace');
  }, [containerWidth, sampleValues, maxLatency, isStressTest, currentLatency]);

  return (
    <div ref={containerRef} className="rounded border border-line bg-surface-2 p-2">
      <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-line pb-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <Activity className="h-3 w-3 shrink-0 text-ink-3" />
          <span className="truncate text-2xs font-medium text-ink-2">Latency distribution</span>
          <span className="shrink-0 text-3xs text-ink-4">60 s window</span>
        </div>
        <StatusBadge
          label={isStressTest ? 'Spike rate high' : 'Within URLLC target'}
          tone={isStressTest ? 'danger' : 'success'}
        />
      </div>

      <div className="relative w-full overflow-hidden rounded-sm bg-surface-1">
        <svg ref={svgRef} className="block h-[112px] w-full select-none" />

        {hoveredBin && (
          <div className="pointer-events-none absolute right-1.5 top-1.5 z-10 rounded border border-line-strong bg-surface-0 px-2 py-1">
            <div className="telemetry text-3xs font-semibold text-ink">
              {hoveredBin.x0}–{hoveredBin.x1} ms · {hoveredBin.count} samples (
              {hoveredBin.percent.toFixed(1)}%)
            </div>
            <div
              className={`mt-0.5 text-3xs ${
                hoveredBin.isSpike ? 'text-danger-ink' : 'text-success-ink'
              }`}
            >
              {hoveredBin.isSpike ? 'Spike — degrades SLAM sync' : 'Within URLLC budget'}
            </div>
          </div>
        )}
      </div>

      <div className="mt-1.5 grid grid-cols-4 gap-1.5">
        {[
          {
            label: 'Spikes',
            value: `${spikeCount}`,
            unit: `${spikePercent.toFixed(0)}%`,
            tone: spikeCount > 0 ? (isStressTest ? 'text-danger-ink' : 'text-warning-ink') : 'text-success-ink',
          },
          {
            label: 'Peak',
            value: `${maxLatency}`,
            unit: 'ms',
            tone: maxLatency > 50 ? 'text-danger-ink' : 'text-ink',
          },
          {
            label: 'P95',
            value: `${p95Latency}`,
            unit: 'ms',
            tone: p95Latency > 50 ? 'text-warning-ink' : 'text-ink',
          },
          { label: 'Median', value: `${medianLatency}`, unit: 'ms', tone: 'text-ink' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-sm border border-line bg-surface-1 px-1.5 py-1">
            <div className="text-3xs text-ink-4">{stat.label}</div>
            <div className="flex items-baseline gap-1">
              <span className={`telemetry text-2xs font-semibold ${stat.tone}`}>{stat.value}</span>
              <span className="text-3xs text-ink-4">{stat.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-1.5">
        {BANDS.map((band) => (
          <span key={band.label} className="flex items-center gap-1 text-3xs text-ink-4">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-sm"
              style={{ backgroundColor: band.color }}
            />
            {band.label}
          </span>
        ))}
      </div>
    </div>
  );
};
