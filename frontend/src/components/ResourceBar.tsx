import React from 'react';

interface ResourceBarProps {
  label: string;
  used: number;
  limit: number;
  unit?: string;
}

export default function ResourceBar({ label, used, limit, unit = '' }: ResourceBarProps) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const color =
    pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-medium">
          {used}{unit} / {limit}{unit}
          <span className="text-gray-500 ml-1">({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
