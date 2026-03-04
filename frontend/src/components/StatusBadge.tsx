import React from 'react';
import { VMStatus } from '../types';

const STATUS_CONFIG: Record<string, { className: string; dot: string; label: string }> = {
  running: {
    className: 'badge-running',
    dot: 'bg-green-400',
    label: 'Запущена',
  },
  stopped: {
    className: 'badge-stopped',
    dot: 'bg-gray-400',
    label: 'Остановлена',
  },
  pending: {
    className: 'badge-pending',
    dot: 'bg-yellow-400',
    label: 'Ожидание',
  },
  error: {
    className: 'badge-error',
    dot: 'bg-red-400',
    label: 'Ошибка',
  },
  active: {
    className: 'badge-running',
    dot: 'bg-green-400',
    label: 'Активен',
  },
  suspended: {
    className: 'badge-stopped',
    dot: 'bg-gray-400',
    label: 'Приостановлен',
  },
};

export default function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG['stopped'];
  return (
    <span className={config.className}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} animate-pulse`} />
      {config.label}
    </span>
  );
}
