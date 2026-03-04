import React from 'react';

interface DonutChartProps {
  used: number;
  total: number;
  color: string;       // stroke color, e.g. '#E30611'
  trackColor?: string; // background track color
  label: string;       // center label e.g. "CPU"
  unit?: string;       // e.g. "vCPU"
  size?: number;       // SVG size in px, default 160
}

export default function DonutChart({
  used,
  total,
  color,
  trackColor = '#1f2937',
  label,
  unit = '',
  size = 160,
}: DonutChartProps) {
  const pct = total > 0 ? Math.min(used / total, 1) : 0;
  const radius = 54;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference * (1 - pct);

  // Color logic based on percentage
  let strokeColor = color;
  if (pct >= 0.9) strokeColor = '#ef4444';       // red
  else if (pct >= 0.7) strokeColor = '#f97316';  // orange
  else if (pct >= 0.5) strokeColor = '#eab308';  // yellow
  // else use provided color (blue/green/purple)

  const pctText = Math.round(pct * 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track (background circle) */}
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={16}
        />
        {/* Progress arc */}
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={16}
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out, stroke 0.3s' }}
        />
        {/* Glow effect */}
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={4}
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          opacity={0.25}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
        {/* Center: percentage */}
        <text
          x={cx} y={cy - 8}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize={pctText >= 100 ? 20 : 24}
          fontWeight="700"
          fontFamily="system-ui, sans-serif"
        >
          {pctText}%
        </text>
        {/* Center: label */}
        <text
          x={cx} y={cy + 14}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#6b7280"
          fontSize={11}
          fontFamily="system-ui, sans-serif"
        >
          {label}
        </text>
      </svg>
      {/* Used / Total */}
      <div className="text-center">
        <p className="text-sm font-semibold text-white">
          <span style={{ color: strokeColor }}>{used}</span>
          <span className="text-gray-500"> / {total} {unit}</span>
        </p>
        <p className="text-xs text-gray-600 mt-0.5">
          Свободно: <span className="text-gray-400">{total - used} {unit}</span>
        </p>
      </div>
    </div>
  );
}
