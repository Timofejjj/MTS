import React, { useEffect, useState } from 'react';
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Server,
  AlertTriangle,
  CheckCircle,
  Activity,
  Zap,
  RefreshCw,
  Thermometer,
  Network,
} from 'lucide-react';
import { orgVdcsApi, vmsApi } from '../services/api';
import { OrgVDC, VM } from '../types';
import DonutChart from '../components/DonutChart';

// ─── Physical hardware constants (simulating Proxmox node) ───────────────────
const NODES = [
  { id: 'pve-node-01', name: 'Node-1 (pve-node-01)', ip: '192.168.1.10', status: 'online', cpu_cores: 64, ram_gb: 128, disk_gb: 4096, cpu_load: 72, ram_load: 58, temp: 61 },
  { id: 'pve-node-02', name: 'Node-2 (pve-node-02)', ip: '192.168.1.11', status: 'online', cpu_cores: 48, ram_gb: 96,  disk_gb: 4096, cpu_load: 41, ram_load: 45, temp: 55 },
  { id: 'pve-node-03', name: 'Node-3 (pve-node-03)', ip: '192.168.1.12', status: 'warning', cpu_cores: 16, ram_gb: 32,  disk_gb: 2048, cpu_load: 91, ram_load: 87, temp: 78 },
];

const TOTAL_PHYSICAL = {
  cores: NODES.reduce((s, n) => s + n.cpu_cores, 0),   // 128
  ram:   NODES.reduce((s, n) => s + n.ram_gb, 0),      // 256
  disk:  NODES.reduce((s, n) => s + n.disk_gb, 0),     // 10240
};

// Static alerts (mock Proxmox alerts for demo)
const STATIC_ALERTS = [
  { id: 1, level: 'critical', node: 'Node-3', message: 'Узел Node-3 загружен на 91%, рекомендуется добавить мощности', time: '2 мин назад' },
  { id: 2, level: 'critical', node: 'Node-3', message: 'Температура процессора Node-3 достигла 78°C (критический порог: 75°C)', time: '5 мин назад' },
  { id: 3, level: 'warning',  node: 'Node-1', message: 'Использование CPU на Node-1 превышает 70% более 30 минут', time: '18 мин назад' },
  { id: 4, level: 'warning',  node: 'Node-2', message: 'Расчётное время до исчерпания дискового пространства: 14 дней', time: '1 ч назад' },
  { id: 5, level: 'info',     node: 'Node-1', message: 'Успешная синхронизация кластера. Все узлы в кворуме', time: '2 ч назад' },
  { id: 6, level: 'info',     node: 'Node-2', message: 'Автоматическое резервное копирование завершено (14 ВМ)', time: '6 ч назад' },
];

export default function InfrastructurePage() {
  const [vdcs, setVdcs] = useState<OrgVDC[]>([]);
  const [vms,  setVms]  = useState<VM[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [vdcsRes, vmsRes] = await Promise.all([orgVdcsApi.getAll(), vmsApi.getAll()]);
      setVdcs(Array.isArray(vdcsRes.data) ? vdcsRes.data : []);
      setVms(vmsRes.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Sum allocated resources across all org_vdcs
  const allocated = {
    cpu:  vdcs.reduce((s, v) => s + parseInt(v.cpu_limit || '0'), 0),
    ram:  vdcs.reduce((s, v) => s + parseInt(v.ram_limit || '0'), 0),
    disk: vdcs.reduce((s, v) => s + parseInt(v.disk_limit || '0'), 0),
  };

  // Dynamic alerts from real data
  const dynamicAlerts: typeof STATIC_ALERTS = [];
  vdcs.forEach((vdc) => {
    const cpuPct = parseInt(vdc.cpu_limit) > 0 ? (parseInt(vdc.cpu_used) / parseInt(vdc.cpu_limit)) * 100 : 0;
    const ramPct = parseInt(vdc.ram_limit) > 0 ? (parseInt(vdc.ram_used) / parseInt(vdc.ram_limit)) * 100 : 0;
    if (cpuPct >= 80) {
      dynamicAlerts.push({ id: 100 + dynamicAlerts.length, level: 'warning', node: vdc.name, message: `VDC "${vdc.name}": CPU использован на ${cpuPct.toFixed(0)}%`, time: 'сейчас' });
    }
    if (ramPct >= 80) {
      dynamicAlerts.push({ id: 200 + dynamicAlerts.length, level: 'warning', node: vdc.name, message: `VDC "${vdc.name}": RAM использована на ${ramPct.toFixed(0)}%`, time: 'сейчас' });
    }
  });

  const allAlerts = [...dynamicAlerts, ...STATIC_ALERTS];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Инфраструктура</h1>
          <p className="text-gray-500 text-sm mt-1">
            Proxmox VE Cluster · {NODES.length} узла · {TOTAL_PHYSICAL.cores} ядер · {TOTAL_PHYSICAL.ram} ГБ RAM
          </p>
        </div>
        <button
          onClick={() => loadData(true)}
          className="btn-secondary flex items-center gap-2 text-sm"
          disabled={refreshing}
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          Обновить
        </button>
      </div>

      {/* ── Nodes Status ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {NODES.map((node) => (
          <NodeCard key={node.id} node={node} vmCount={vms.length} />
        ))}
      </div>

      {/* ── Hypervisor Summary + Charts ── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-7 h-7 bg-primary-500/20 rounded-lg flex items-center justify-center">
            <Zap size={14} className="text-primary-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Сводка кластера Proxmox</h2>
          <span className="text-xs text-gray-500 ml-auto">
            Всего доступно: {TOTAL_PHYSICAL.cores} ядер · {TOTAL_PHYSICAL.ram} ГБ RAM · {(TOTAL_PHYSICAL.disk / 1024).toFixed(0)} ТБ Storage
          </span>
        </div>

        {/* Physical totals banner */}
        <div className="grid grid-cols-3 gap-4 mb-8 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
          <PhysicalRow icon={<Cpu size={16} className="text-blue-400" />} label="Всего CPU" value={`${TOTAL_PHYSICAL.cores} ядер`} sub={`Распределено: ${allocated.cpu} / Свободно: ${TOTAL_PHYSICAL.cores - allocated.cpu}`} />
          <PhysicalRow icon={<MemoryStick size={16} className="text-purple-400" />} label="Всего RAM" value={`${TOTAL_PHYSICAL.ram} ГБ`} sub={`Распределено: ${allocated.ram} ГБ / Свободно: ${TOTAL_PHYSICAL.ram - allocated.ram} ГБ`} />
          <PhysicalRow icon={<HardDrive size={16} className="text-green-400" />} label="Всего Storage" value={`${TOTAL_PHYSICAL.disk / 1024} ТБ`} sub={`Распределено: ${(allocated.disk / 1024).toFixed(1)} ТБ / Свободно: ${((TOTAL_PHYSICAL.disk - allocated.disk) / 1024).toFixed(1)} ТБ`} />
        </div>

        {/* Donut Charts */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide">CPU (ядра)</p>
            <DonutChart
              used={allocated.cpu}
              total={TOTAL_PHYSICAL.cores}
              color="#3b82f6"
              label="Allocated"
              unit="ядер"
              size={180}
            />
            <div className="flex gap-4 text-xs">
              <LegendDot color="#3b82f6" label={`Распределено: ${allocated.cpu}`} />
              <LegendDot color="#1f2937" label={`Свободно: ${TOTAL_PHYSICAL.cores - allocated.cpu}`} />
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide">RAM (ГБ)</p>
            <DonutChart
              used={allocated.ram}
              total={TOTAL_PHYSICAL.ram}
              color="#a855f7"
              label="Allocated"
              unit="ГБ"
              size={180}
            />
            <div className="flex gap-4 text-xs">
              <LegendDot color="#a855f7" label={`Распределено: ${allocated.ram} ГБ`} />
              <LegendDot color="#1f2937" label={`Свободно: ${TOTAL_PHYSICAL.ram - allocated.ram} ГБ`} />
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Storage (ТБ)</p>
            <DonutChart
              used={Math.round(allocated.disk / 1024 * 10) / 10}
              total={TOTAL_PHYSICAL.disk / 1024}
              color="#22c55e"
              label="Allocated"
              unit="ТБ"
              size={180}
            />
            <div className="flex gap-4 text-xs">
              <LegendDot color="#22c55e" label={`Распределено: ${(allocated.disk / 1024).toFixed(1)} ТБ`} />
              <LegendDot color="#1f2937" label={`Свободно: ${((TOTAL_PHYSICAL.disk - allocated.disk) / 1024).toFixed(1)} ТБ`} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Alerts ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-red-500/20 rounded-lg flex items-center justify-center">
              <AlertTriangle size={14} className="text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Уведомления системы</h2>
            <span className="ml-2 text-xs bg-red-900/40 text-red-400 border border-red-800/50 px-2 py-0.5 rounded-full">
              {allAlerts.filter(a => a.level === 'critical').length} критических
            </span>
          </div>
          <span className="text-xs text-gray-500">{allAlerts.length} уведомлений</span>
        </div>

        <div className="space-y-2">
          {allAlerts.map((alert) => (
            <AlertRow key={alert.id} alert={alert} />
          ))}
        </div>
      </div>

      {/* ── VMs by Node (distribution table) ── */}
      <div className="card">
        <h2 className="text-base font-semibold text-white mb-4">Распределение ВМ по узлам</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Узел</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">IP</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Статус</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">CPU</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">RAM</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Нагрузка</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {NODES.map((node) => (
                <tr key={node.id} className="hover:bg-gray-800/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${node.status === 'online' ? 'bg-green-400' : 'bg-orange-400'} animate-pulse`} />
                      <span className="text-sm font-medium text-white">{node.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-400">{node.ip}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${node.status === 'online' ? 'bg-green-900/30 text-green-400 border border-green-800/50' : 'bg-orange-900/30 text-orange-400 border border-orange-800/50'}`}>
                      {node.status === 'online' ? 'Online' : 'Warning'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">{node.cpu_cores} ядер</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{node.ram_gb} ГБ</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-800 rounded-full w-24">
                        <div
                          className={`h-full rounded-full ${node.cpu_load >= 90 ? 'bg-red-500' : node.cpu_load >= 70 ? 'bg-orange-500' : 'bg-blue-500'}`}
                          style={{ width: `${node.cpu_load}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${node.cpu_load >= 90 ? 'text-red-400' : node.cpu_load >= 70 ? 'text-orange-400' : 'text-gray-400'}`}>
                        {node.cpu_load}%
                      </span>
                      <Thermometer size={12} className={node.temp >= 75 ? 'text-red-400' : 'text-gray-600'} />
                      <span className={`text-xs ${node.temp >= 75 ? 'text-red-400' : 'text-gray-500'}`}>{node.temp}°C</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NodeCard({ node, vmCount }: { node: typeof NODES[0]; vmCount: number }) {
  const isWarning = node.status === 'warning';
  return (
    <div className={`card border ${isWarning ? 'border-orange-500/30 bg-orange-500/5' : 'border-gray-800'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Server size={16} className={isWarning ? 'text-orange-400' : 'text-blue-400'} />
          <span className="font-semibold text-white text-sm">{node.name}</span>
        </div>
        <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${isWarning ? 'bg-orange-900/30 text-orange-400 border border-orange-800/50' : 'bg-green-900/30 text-green-400 border border-green-800/50'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isWarning ? 'bg-orange-400' : 'bg-green-400'} animate-pulse`} />
          {isWarning ? 'Warning' : 'Online'}
        </span>
      </div>

      <p className="text-xs font-mono text-gray-500 mb-3">{node.ip}</p>

      <div className="space-y-2">
        <MiniLoad label="CPU" pct={node.cpu_load} />
        <MiniLoad label="RAM" pct={node.ram_load} />
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>{node.cpu_cores} cores · {node.ram_gb}GB RAM</span>
          <span className="flex items-center gap-1">
            <Thermometer size={10} className={node.temp >= 75 ? 'text-red-400' : ''} />
            <span className={node.temp >= 75 ? 'text-red-400' : ''}>{node.temp}°C</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function MiniLoad({ label, pct }: { label: string; pct: number }) {
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-orange-500' : 'bg-blue-500';
  const textColor = pct >= 90 ? 'text-red-400' : pct >= 70 ? 'text-orange-400' : 'text-gray-400';
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-8">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-medium w-8 text-right ${textColor}`}>{pct}%</span>
    </div>
  );
}

function PhysicalRow({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-base font-bold text-white">{value}</p>
        <p className="text-xs text-gray-600">{sub}</p>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full border border-gray-600 shrink-0" style={{ backgroundColor: color }} />
      <span className="text-gray-400">{label}</span>
    </div>
  );
}

const ALERT_CONFIG = {
  critical: { icon: <AlertTriangle size={14} />, textColor: 'text-red-400',    bg: 'bg-red-900/20 border-red-800/40',       dot: 'bg-red-400' },
  warning:  { icon: <AlertTriangle size={14} />, textColor: 'text-orange-400', bg: 'bg-orange-900/20 border-orange-800/40', dot: 'bg-orange-400' },
  info:     { icon: <CheckCircle size={14} />,   textColor: 'text-blue-400',   bg: 'bg-blue-900/10 border-blue-800/20',     dot: 'bg-blue-400' },
} as const;

function AlertRow({ alert }: { alert: typeof STATIC_ALERTS[0] }) {
  const level = alert.level as keyof typeof ALERT_CONFIG;
  const config = ALERT_CONFIG[level] ?? ALERT_CONFIG.info;

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${config.bg}`}>
      <span className={`mt-0.5 shrink-0 ${config.textColor}`}>{config.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold text-gray-400">{alert.node}</span>
          <span className="text-xs text-gray-600">{alert.time}</span>
        </div>
        <p className="text-sm text-gray-200">{alert.message}</p>
      </div>
      <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${config.dot} ${alert.level === 'critical' ? 'animate-pulse' : ''}`} />
    </div>
  );
}
