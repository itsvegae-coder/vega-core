import React, { useState } from 'react';
import { fmt } from '../lib/storage';

export interface PointChartDataPoint {
  xLabel: string;
  xSubLabel?: string;
  value: number | null;
  secondaryValue?: number | null;
  color?: string;
  tooltipTitle?: string;
  tooltipSubtitle?: string;
  rawDate?: string;
  count?: number;
  highlight?: boolean;
}

interface PointChartProps {
  data: PointChartDataPoint[];
  yUnit?: string;
  yLabel?: string;
  xLabelTitle?: string;
  fixedMaxY?: number;
  minY?: number;
  showConnectingLine?: boolean;
  showValuesOnPoints?: boolean;
  height?: number;
  targetLine?: { value: number; label: string; color?: string };
  emptyMessage?: string;
  legend?: { label: string; color: string }[];
  accentColor?: string;
  decimals?: number;
}

export const PointChart: React.FC<PointChartProps> = ({
  data,
  yUnit = '',
  yLabel,
  xLabelTitle,
  fixedMaxY,
  minY = 0,
  showConnectingLine = true,
  showValuesOnPoints = true,
  height = 220,
  targetLine,
  emptyMessage = 'No recorded data matching active filters.',
  legend,
  accentColor = '#38bdf8',
  decimals = 1,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const validDataPoints = data.filter((d) => d.value !== null && d.value !== undefined);
  const hasData = validDataPoints.length > 0;

  if (!hasData) {
    return (
      <div
        className="w-full flex flex-col items-center justify-center p-8 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-center"
        style={{ minHeight: `${height}px` }}
      >
        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-2">
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-500" />
        </div>
        <p className="text-xs font-semibold text-zinc-300">{emptyMessage}</p>
        <span className="text-[11px] text-zinc-500 mt-1">
          Adjust the subject, topic, or date range to inspect activity.
        </span>
      </div>
    );
  }

  // Calculate scales
  const rawMax = Math.max(...validDataPoints.map((d) => d.value as number));
  const rawMin = Math.min(...validDataPoints.map((d) => d.value as number));

  let calcMaxY = fixedMaxY !== undefined ? fixedMaxY : Math.max(1, Math.ceil(rawMax * 1.15));
  if (targetLine && targetLine.value > calcMaxY) {
    calcMaxY = Math.ceil(targetLine.value * 1.1);
  }

  // Generate 4-5 nice tick marks
  const numTicks = 4;
  const tickValues = Array.from({ length: numTicks + 1 }, (_, i) => {
    return minY + ((calcMaxY - minY) * (numTicks - i)) / numTicks;
  });

  const svgPadding = { top: 32, right: 30, bottom: 44, left: 48 };
  const chartWidth = 600; // SVG internal coordinate width
  const chartHeight = height;
  const plotWidth = chartWidth - svgPadding.left - svgPadding.right;
  const plotHeight = chartHeight - svgPadding.top - svgPadding.bottom;

  // Calculate coordinates for points
  const pointsWithCoords = data.map((d, idx) => {
    const x =
      data.length === 1
        ? svgPadding.left + plotWidth / 2
        : svgPadding.left + (idx / (data.length - 1)) * plotWidth;

    let y: number | null = null;
    if (d.value !== null && d.value !== undefined) {
      const normalized = Math.max(0, Math.min(1, (d.value - minY) / (calcMaxY - minY || 1)));
      y = svgPadding.top + plotHeight - normalized * plotHeight;
    }

    return { ...d, x, y, idx };
  });

  // Polyline coordinates for valid connected points
  const validCoords = pointsWithCoords.filter((p) => p.y !== null) as (PointChartDataPoint & {
    x: number;
    y: number;
    idx: number;
  })[];

  const polylinePoints = validCoords.map((p) => `${p.x},${p.y}`).join(' ');

  // Target line Y coordinate
  let targetY: number | null = null;
  if (targetLine && targetLine.value >= minY && targetLine.value <= calcMaxY) {
    const norm = (targetLine.value - minY) / (calcMaxY - minY || 1);
    targetY = svgPadding.top + plotHeight - norm * plotHeight;
  }

  return (
    <div className="w-full select-none">
      {/* Legend & Y-Label header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-xs">
        <div className="flex items-center gap-2">
          {yLabel && (
            <span className="text-[11px] font-semibold text-zinc-300">
              {yLabel} ({yUnit || 'value'})
            </span>
          )}
        </div>
        {legend && legend.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            {legend.map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block shadow-sm"
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto overflow-visible"
          style={{ maxHeight: `${height}px` }}
        >
          <defs>
            {/* Subtle vertical gradient for point fill glow */}
            <radialGradient id="pointGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Grid lines and Y-axis tick values */}
          {tickValues.map((val, i) => {
            const yPos = svgPadding.top + (i / numTicks) * plotHeight;
            return (
              <g key={i}>
                <line
                  x1={svgPadding.left}
                  y1={yPos}
                  x2={chartWidth - svgPadding.right}
                  y2={yPos}
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeDasharray={i === numTicks ? '0' : '3 3'}
                  strokeWidth="1"
                />
                <text
                  x={svgPadding.left - 8}
                  y={yPos + 3.5}
                  textAnchor="end"
                  fill="rgba(161, 161, 170, 0.9)"
                  fontSize="10"
                  fontFamily="system-ui, sans-serif"
                  fontWeight="500"
                >
                  {fmt(val, decimals)}
                  {yUnit}
                </text>
              </g>
            );
          })}

          {/* Target line */}
          {targetY !== null && targetLine && (
            <g>
              <line
                x1={svgPadding.left}
                y1={targetY}
                x2={chartWidth - svgPadding.right}
                y2={targetY}
                stroke={targetLine.color || '#f59e0b'}
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <text
                x={chartWidth - svgPadding.right}
                y={targetY - 5}
                textAnchor="end"
                fill={targetLine.color || '#f59e0b'}
                fontSize="9"
                fontWeight="600"
              >
                Target: {fmt(targetLine.value, decimals)}
                {yUnit} ({targetLine.label})
              </text>
            </g>
          )}

          {/* Connecting line between points */}
          {showConnectingLine && validCoords.length > 1 && (
            <polyline
              fill="none"
              stroke="rgba(255, 255, 255, 0.25)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={polylinePoints}
            />
          )}

          {/* Interactive vertical hover indicator */}
          {hoveredIndex !== null && pointsWithCoords[hoveredIndex]?.y !== null && (
            <line
              x1={pointsWithCoords[hoveredIndex].x}
              y1={svgPadding.top}
              x2={pointsWithCoords[hoveredIndex].x}
              y2={svgPadding.top + plotHeight}
              stroke="rgba(255, 255, 255, 0.3)"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
          )}

          {/* Render individual points */}
          {pointsWithCoords.map((pt, idx) => {
            if (pt.y === null) {
              // Null point (no data recorded)
              return (
                <g key={idx}>
                  {/* Subtle placeholder dot on baseline */}
                  <circle
                    cx={pt.x}
                    cy={svgPadding.top + plotHeight}
                    r="2.5"
                    fill="rgba(255, 255, 255, 0.1)"
                  />
                  {/* X-axis tick label */}
                  <text
                    x={pt.x}
                    y={svgPadding.top + plotHeight + 16}
                    textAnchor="middle"
                    fill="rgba(113, 113, 122, 0.9)"
                    fontSize="9.5"
                    fontFamily="system-ui, sans-serif"
                  >
                    {pt.xLabel}
                  </text>
                </g>
              );
            }

            const isHovered = hoveredIndex === idx;
            const ptColor = pt.color || accentColor;

            return (
              <g
                key={idx}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Glow ring for hovered point */}
                {isHovered && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="12"
                    fill={ptColor}
                    fillOpacity="0.2"
                  />
                )}

                {/* Outer halo */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? '7' : '5'}
                  fill={ptColor}
                  stroke="#18181b"
                  strokeWidth="2"
                  className="transition-all duration-200"
                />

                {/* Inner white highlight */}
                <circle cx={pt.x} cy={pt.y} r={isHovered ? '3' : '2'} fill="#ffffff" />

                {/* Direct numerical value label on top of point */}
                {showValuesOnPoints && (
                  <text
                    x={pt.x}
                    y={pt.y - (isHovered ? 12 : 9)}
                    textAnchor="middle"
                    fill={isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.85)'}
                    fontSize={isHovered ? '11' : '9.5'}
                    fontWeight="700"
                    fontFamily="system-ui, sans-serif"
                    className="transition-all"
                  >
                    {fmt(pt.value, decimals)}
                    {yUnit}
                  </text>
                )}

                {/* X-axis label */}
                <text
                  x={pt.x}
                  y={svgPadding.top + plotHeight + 16}
                  textAnchor="middle"
                  fill={isHovered ? '#ffffff' : 'rgba(161, 161, 170, 0.95)'}
                  fontSize="9.5"
                  fontWeight={isHovered ? '600' : '400'}
                  fontFamily="system-ui, sans-serif"
                >
                  {pt.xLabel}
                </text>

                {/* Optional X sublabel */}
                {pt.xSubLabel && (
                  <text
                    x={pt.x}
                    y={svgPadding.top + plotHeight + 28}
                    textAnchor="middle"
                    fill="rgba(113, 113, 122, 0.9)"
                    fontSize="8.5"
                    fontFamily="system-ui, sans-serif"
                  >
                    {pt.xSubLabel}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay with exact underlying values */}
        {hoveredIndex !== null && pointsWithCoords[hoveredIndex]?.y !== null && (
          <div
            className="absolute z-20 pointer-events-none -translate-x-1/2 p-2.5 rounded-xl bg-zinc-900/95 border border-white/20 shadow-2xl backdrop-blur-md text-xs min-w-[130px]"
            style={{
              left: `${(pointsWithCoords[hoveredIndex].x / chartWidth) * 100}%`,
              top: `${Math.max(10, (pointsWithCoords[hoveredIndex].y! / chartHeight) * 100 - 35)}%`,
            }}
          >
            <div className="font-bold text-white text-[11px] mb-0.5">
              {pointsWithCoords[hoveredIndex].tooltipTitle || pointsWithCoords[hoveredIndex].xLabel}
            </div>
            <div className="flex items-center gap-1.5 text-sky-300 font-extrabold text-sm">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: pointsWithCoords[hoveredIndex].color || accentColor }}
              />
              <span>
                {fmt(pointsWithCoords[hoveredIndex].value, decimals)} {yUnit}
              </span>
            </div>
            {pointsWithCoords[hoveredIndex].tooltipSubtitle && (
              <div className="text-[10px] text-zinc-400 mt-1 border-t border-white/10 pt-1">
                {pointsWithCoords[hoveredIndex].tooltipSubtitle}
              </div>
            )}
          </div>
        )}
      </div>

      {xLabelTitle && (
        <div className="text-center text-[10px] text-zinc-500 mt-1 uppercase tracking-wider font-semibold">
          {xLabelTitle}
        </div>
      )}
    </div>
  );
};
