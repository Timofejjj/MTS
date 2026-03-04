import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Server,
  Building2,
  Users,
  Network,
  Plus,
  Cpu,
  MemoryStick,
  HardDrive,
  Play,
  Square,
  ChevronRight,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { statsApi, vmsApi, orgVdcsApi } from '../services/api';
import { AdminStats, ClientStats, VM, OrgVDC } from '../types';
import StatusBadge from '../components/StatusBadge';

// ─── Smart progress bar (цвет зависит от заполненности) ──────────────────────
function QuotaBar({
  icon,
  label,
  used,
  limit,
  unit,
}: {
  icon: React.ReactNode;
  label: string;
  used: number;
  limit: number;
  unit: string;
}) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

  // Цвет полоски
  let barColor = 'from-blue-500 to-cyan-400';
  let textColor = 'text-cyan-400';
  let bgGlow = 'shadow-blue-500/20';
  let warning = false;

  if (pct >= 90) {
    barColor = 'from-red-600 to-red-400';
    textColor = 'text-red-400';
    bgGlow = 'shadow-red-500/30';
    warning = true;
  } else if (pct >= 70) {
    barColor = 'from-orange-500 to-yellow-400';
    textColor = 'text-orange-400';
    bgGlow = 'shadow-orange-500/20';
    warning = true;
  } else if (pct >= 50) {
    barColor = 'from-yellow-500 to-yellow-300';
    textColor = 'text-yellow-400';
    bgGlow = 'shadow-yellow-500/20';
  }

  return (
    <div className="space-y-2">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`${textColor}`}>{icon}</span>
          <span className="text-sm font-medium text-gray-300">{label}</span>
          {warning && pct >= 90 && (
            <span className="flex items-center gap-1 text-xs text-red-400 bg-red-900/30 border border-red-800/50 px-1.5 py-0.5 rounded-full">
              <AlertTriangle size={10} />
              Критично
            </span>
          )}
          {warning && pct >= 70 && pct < 90 && (
            <span className="flex items-center gap-1 text-xs text-orange-400 bg-orange-900/30 border border-orange-800/50 px-1.5 py-0.5 rounded-full">
              <AlertTriangle size={10} />
              Мало места
            </span>
          )}
        </div>
        <div className="text-right">
          <span className={`text-base font-bold ${textColor}`}>{used}</span>
          <span className="text-gray-500 text-sm"> / {limit} {unit}</span>
        </div>
      </div>

      {/* Полоска */}
      <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden">
        {/* Фоновый свет */}
        <div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${barColor} transition-all duration-700 ease-out shadow-lg ${bgGlow}`}
          style={{ width: `${pct}%` }}
        />
        {/* Блик */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white/10 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Процент и остаток */}
      <div className="flex justify-between text-xs">
        <span className="text-gray-600">{pct.toFixed(0)}% использовано</span>
        <span className={pct >= 70 ? textColor : 'text-gray-500'}>
          Свободно: {limit - used} {unit}
        </span>
      </div>
    </div>
  );
}

// ─── Карточка мини-ВМ ────────────────────────────────────────────────────────
function VMRow({ vm }: { vm: VM }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-800/70 last:border-0">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          vm.status === 'running'
            ? 'bg-green-900/40 border border-green-800/50'
            : 'bg-gray-800 border border-gray-700'
        }`}>
          <Server size={14} className={vm.status === 'running' ? 'text-green-400' : 'text-gray-500'} />
        </div>
        <div>
          <p className="text-sm font-medium text-white leading-none">{vm.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{vm.os} · {vm.ip}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-xs text-gray-500">{vm.cpu} vCPU · {vm.ram}GB RAM</p>
        </div>
        <StatusBadge status={vm.status} />
      </div>
    </div>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<AdminStats | ClientStats | null>(null);
  const [vms, setVms] = useState<VM[]>([]);
  const [vdcs, setVdcs] = useState<OrgVDC[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      statsApi.get(),
      vmsApi.getAll(),
      orgVdcsApi.getAll(),
    ])
      .then(([statsRes, vmsRes, vdcsRes]) => {
        setStats(statsRes.data);
        setVms(vmsRes.data);
        setVdcs(Array.isArray(vdcsRes.data) ? vdcsRes.data : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const adminStats = stats as AdminStats;

  // Суммируем ресурсы по всем VDC
  const totalCpuLimit = vdcs.reduce((s, v) => s + parseInt(v.cpu_limit || '0'), 0);
  const totalRamLimit = vdcs.reduce((s, v) => s + parseInt(v.ram_limit || '0'), 0);
  const totalDiskLimit = vdcs.reduce((s, v) => s + parseInt(v.disk_limit || '0'), 0);
  const totalCpuUsed = vdcs.reduce((s, v) => s + parseInt(v.cpu_used || '0'), 0);
  const totalRamUsed = vdcs.reduce((s, v) => s + parseInt(v.ram_used || '0'), 0);
  const totalDiskUsed = vdcs.reduce((s, v) => s + parseInt(v.disk_used || '0'), 0);

  // 3 последних ВМ
  const recentVMs = [...vms]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3);

  const runningCount = vms.filter((v) => v.status === 'running').length;

  return (
    <div className="space-y-6 max-w-6xl">

      {/* ── Заголовок + Большая кнопка "Создать сервер" ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isAdmin ? 'Панель администратора' : 'Обзор ресурсов'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Добро пожаловать, <span className="text-gray-300 font-medium">{user?.name}</span>
          </p>
        </div>

        {/* Большая кнопка создания ВМ */}
        <button
          onClick={() => navigate('/vms')}
          className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 active:scale-95 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-primary-500/30 transition-all duration-150 shrink-0 text-base"
        >
          <Plus size={20} strokeWidth={2.5} />
          Создать сервер
        </button>
      </div>

      {/* ── Статус-плашки (для admin) ── */}
      {isAdmin && adminStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MiniStatCard icon={<Building2 size={18} />} label="Тенанты" value={adminStats.tenants?.total ?? 0} color="blue" />
          <MiniStatCard icon={<Network size={18} />} label="Org VDC" value={adminStats.org_vdcs?.total ?? 0} color="purple" />
          <MiniStatCard icon={<Server size={18} />} label="Всего ВМ" value={adminStats.vms?.total ?? 0} color="green" />
          <MiniStatCard icon={<Users size={18} />} label="Пользователи" value={adminStats.users?.total ?? 0} color="orange" />
        </div>
      )}

      {/* ── Основной контент: 2 колонки ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── ЛЕВАЯ колонка: Квоты организации (3/5) ── */}
        <div className="lg:col-span-3 space-y-6">

          {/* Блок квот */}
          <div className="card">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-primary-500/20 rounded-lg flex items-center justify-center">
                  <Zap size={14} className="text-primary-400" />
                </div>
                <h2 className="text-base font-semibold text-white">Квоты организации</h2>
              </div>
              <button
                onClick={() => navigate('/org-vdcs')}
                className="text-xs text-gray-500 hover:text-primary-400 flex items-center gap-1 transition-colors"
              >
                Управление <ChevronRight size={12} />
              </button>
            </div>

            {vdcs.length === 0 ? (
              <div className="py-8 text-center">
                <Network size={36} className="text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Нет выделенных ресурсов</p>
                {isAdmin && (
                  <button onClick={() => navigate('/org-vdcs')} className="text-xs text-primary-400 mt-2 hover:underline">
                    Создать Org VDC →
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                <QuotaBar
                  icon={<Cpu size={15} />}
                  label="Процессор (CPU)"
                  used={totalCpuUsed}
                  limit={totalCpuLimit}
                  unit="ядер"
                />
                <QuotaBar
                  icon={<MemoryStick size={15} />}
                  label="Оперативная память (RAM)"
                  used={totalRamUsed}
                  limit={totalRamLimit}
                  unit="ГБ"
                />
                <QuotaBar
                  icon={<HardDrive size={15} />}
                  label="Хранилище (Storage)"
                  used={totalDiskUsed}
                  limit={totalDiskLimit}
                  unit="ГБ"
                />
              </div>
            )}
          </div>

          {/* Для admin: детализация по VDC */}
          {isAdmin && vdcs.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
                Детализация по VDC
              </h3>
              <div className="space-y-3">
                {vdcs.map((vdc) => {
                  const cpuPct = parseInt(vdc.cpu_limit) > 0
                    ? Math.round((parseInt(vdc.cpu_used) / parseInt(vdc.cpu_limit)) * 100)
                    : 0;
                  return (
                    <div key={vdc.id} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{vdc.name}</p>
                        <p className="text-xs text-gray-500">
                          {vdc.cpu_used}/{vdc.cpu_limit} vCPU · {vdc.ram_used}/{vdc.ram_limit} GB RAM
                        </p>
                      </div>
                      <div className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        cpuPct >= 80 ? 'text-red-400 bg-red-900/30' :
                        cpuPct >= 50 ? 'text-yellow-400 bg-yellow-900/30' :
                        'text-green-400 bg-green-900/30'
                      }`}>
                        {cpuPct}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── ПРАВАЯ колонка: Мои серверы (2/5) ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Блок "Мои серверы" */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-center">
                  <Server size={14} className="text-green-400" />
                </div>
                <h2 className="text-base font-semibold text-white">Мои серверы</h2>
              </div>
              <button
                onClick={() => navigate('/vms')}
                className="text-xs text-gray-500 hover:text-primary-400 flex items-center gap-1 transition-colors"
              >
                Все <ChevronRight size={12} />
              </button>
            </div>

            {/* Счётчики */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1 bg-green-900/20 border border-green-800/40 rounded-lg px-3 py-2 text-center">
                <p className="text-xl font-bold text-green-400">{runningCount}</p>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center justify-center gap-1">
                  <Play size={9} />
                  Работают
                </p>
              </div>
              <div className="flex-1 bg-gray-800/60 border border-gray-700/40 rounded-lg px-3 py-2 text-center">
                <p className="text-xl font-bold text-gray-300">{vms.length - runningCount}</p>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center justify-center gap-1">
                  <Square size={9} />
                  Остановлены
                </p>
              </div>
            </div>

            {/* Список 3 последних ВМ */}
            {recentVMs.length === 0 ? (
              <div className="py-6 text-center">
                <Server size={32} className="text-gray-700 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Нет серверов</p>
              </div>
            ) : (
              <div>
                {recentVMs.map((vm) => (
                  <VMRow key={vm.id} vm={vm} />
                ))}
              </div>
            )}

            {/* Большая кнопка создания */}
            <button
              onClick={() => navigate('/vms')}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 active:scale-[0.98] text-white font-semibold py-3 rounded-xl shadow-md shadow-primary-500/25 transition-all duration-150"
            >
              <Plus size={18} strokeWidth={2.5} />
              Создать сервер
            </button>
          </div>

          {/* Быстрая навигация */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Быстрый доступ</h3>
            <div className="space-y-2">
              <QuickLink icon={<Server size={15} />} label="Виртуальные машины" to="/vms" onClick={() => navigate('/vms')} />
              <QuickLink icon={<Network size={15} />} label="Org VDC" to="/org-vdcs" onClick={() => navigate('/org-vdcs')} />
              {isAdmin && (
                <>
                  <QuickLink icon={<Building2 size={15} />} label="Тенанты" to="/tenants" onClick={() => navigate('/tenants')} />
                  <QuickLink icon={<Users size={15} />} label="Пользователи" to="/users" onClick={() => navigate('/users')} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Вспомогательные компоненты ───────────────────────────────────────────────

function MiniStatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  const styles: Record<string, string> = {
    blue:   'bg-blue-500/10 border-blue-500/20 text-blue-400',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    green:  'bg-green-500/10 border-green-500/20 text-green-400',
    orange: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
  };

  return (
    <div className={`card border ${styles[color]} p-4`}>
      <div className="flex items-center justify-between">
        <span className="opacity-80">{icon}</span>
        <span className="text-2xl font-bold text-white">{value}</span>
      </div>
      <p className="text-xs text-gray-500 mt-2">{label}</p>
    </div>
  );
}

function QuickLink({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  to: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-800/50 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors group"
    >
      <div className="flex items-center gap-2">
        <span className="text-gray-500 group-hover:text-primary-400 transition-colors">{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
      <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
