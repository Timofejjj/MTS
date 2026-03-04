import React, { useEffect, useState } from 'react';
import {
  Plus, Play, Square, Trash2, Server, Cpu, MemoryStick, HardDrive,
  Building2, ShieldAlert, Hash, Activity, TerminalSquare,
} from 'lucide-react';
import { VM, OrgVDC, Tenant } from '../types';
import { vmsApi, orgVdcsApi, tenantsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import TerminalModal from '../components/TerminalModal';

const OS_OPTIONS = ['Ubuntu 22.04', 'Ubuntu 20.04', 'Debian 12', 'CentOS 8', 'Windows Server 2022'];

/** Generate deterministic Proxmox vmid from UUID */
function getVmid(vmId: string): number {
  let hash = 0;
  for (let i = 0; i < vmId.length; i++) {
    hash = ((hash << 5) - hash) + vmId.charCodeAt(i);
    hash = hash & hash;
  }
  return 100 + Math.abs(hash % 900);
}

/** Simulate real-time CPU usage for running VMs */
function simulateCpuUsage(vm: VM): number {
  if (vm.status !== 'running') return 0;
  // Deterministic "random" based on vm id + current minute
  const seed = vm.id.charCodeAt(0) + vm.id.charCodeAt(4) + new Date().getMinutes();
  return Math.min(95, 5 + (seed % (parseInt(vm.cpu) * 20)));
}

export default function VMsPage() {
  const { isAdmin, token } = useAuth();
  const [vms,          setVms]         = useState<VM[]>([]);
  const [vdcs,         setVdcs]        = useState<OrgVDC[]>([]);
  const [tenants,      setTenants]     = useState<Tenant[]>([]);
  const [loading,      setLoading]     = useState(true);
  const [showCreate,   setShowCreate]  = useState(false);
  const [terminalVm,   setTerminalVm]  = useState<VM | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [vmsRes, vdcsRes, tenantsRes] = await Promise.all([
        vmsApi.getAll(),
        orgVdcsApi.getAll(),
        isAdmin ? tenantsApi.getAll() : Promise.resolve({ data: [] }),
      ]);
      setVms(vmsRes.data);
      setVdcs(Array.isArray(vdcsRes.data) ? vdcsRes.data : []);
      const t = tenantsRes.data;
      setTenants(Array.isArray(t) ? t : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleStatus = async (id: string, status: string) => {
    try {
      await vmsApi.setStatus(id, status);
      setVms((prev) => prev.map((vm) => vm.id === id ? { ...vm, status: status as VM['status'] } : vm));
    } catch (err: any) { alert(err.response?.data?.error || 'Ошибка'); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Удалить VM "${name}"?`)) return;
    try {
      await vmsApi.delete(id);
      setVms((prev) => prev.filter((vm) => vm.id !== id));
    } catch (err: any) { alert(err.response?.data?.error || 'Ошибка удаления'); }
  };

  const getTenantName = (tid: string) => tenants.find((t) => t.id === tid)?.name || tid.slice(0, 8) + '...';

  const runningCount = vms.filter((v) => v.status === 'running').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">
              {isAdmin ? 'Все виртуальные машины' : 'Мои виртуальные машины'}
            </h1>
            {isAdmin && (
              <span className="flex items-center gap-1 text-xs bg-primary-500/20 text-primary-400 border border-primary-500/30 px-2 py-0.5 rounded-full">
                <ShieldAlert size={11} />
                God Mode
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm mt-1">
            {vms.length} ВМ · <span className="text-green-400">{runningCount} работают</span> · <span className="text-gray-500">{vms.length - runningCount} остановлены</span>
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2"
          disabled={vdcs.length === 0}
          title={vdcs.length === 0 ? 'Сначала создайте Org VDC' : ''}
        >
          <Plus size={18} />
          Создать ВМ
        </button>
      </div>

      {/* Summary row (admin only) */}
      {isAdmin && vms.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <SummaryCard label="Всего ВМ"     value={vms.length} color="blue" />
          <SummaryCard label="Запущено"      value={runningCount} color="green" />
          <SummaryCard label="Остановлено"   value={vms.length - runningCount} color="gray" />
          <SummaryCard label="Тенантов с ВМ" value={new Set(vms.map(v => v.tenant_id)).size} color="purple" />
        </div>
      )}

      {/* VMs Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : vms.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Server size={48} className="text-gray-700 mb-4" />
          <p className="text-gray-400 font-medium">Нет виртуальных машин</p>
          <p className="text-gray-600 text-sm mt-1">
            {vdcs.length === 0 ? 'Сначала создайте Org VDC' : 'Нажмите "Создать ВМ" чтобы начать'}
          </p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/80">
                  {isAdmin && <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3 whitespace-nowrap"><span className="flex items-center gap-1"><Building2 size={11} />Тенант</span></th>}
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Имя ВМ</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3"><span className="flex items-center gap-1"><Hash size={11} />VMID</span></th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Статус</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">ОС</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3"><span className="flex items-center gap-1"><Activity size={11} />CPU / RAM</span></th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">IP-адрес</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {vms.map((vm) => {
                  const vdc = vdcs.find((v) => v.id === vm.org_vdc_id);
                  const vmid = getVmid(vm.id);
                  const cpuUsagePct = simulateCpuUsage(vm);
                  const cpuUsageCores = vm.status === 'running' ? Math.round(parseInt(vm.cpu) * cpuUsagePct / 100 * 10) / 10 : 0;

                  return (
                    <tr key={vm.id} className="hover:bg-gray-800/40 transition-colors group">

                      {/* Tenant (admin only) */}
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 bg-blue-500/10 border border-blue-500/20 rounded flex items-center justify-center shrink-0">
                              <Building2 size={10} className="text-blue-400" />
                            </div>
                            <span className="text-xs text-gray-300 max-w-[120px] truncate" title={getTenantName(vm.tenant_id)}>
                              {getTenantName(vm.tenant_id)}
                            </span>
                          </div>
                        </td>
                      )}

                      {/* VM Name */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{vm.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{vdc?.name || '—'}</div>
                      </td>

                      {/* VMID */}
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono bg-gray-800 border border-gray-700 text-gray-400 px-1.5 py-0.5 rounded">
                          {vmid}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3"><StatusBadge status={vm.status} /></td>

                      {/* OS */}
                      <td className="px-4 py-3 text-xs text-gray-400 max-w-[120px]">
                        <span className="truncate block">{vm.os}</span>
                      </td>

                      {/* CPU/RAM real-time */}
                      <td className="px-4 py-3">
                        <div className="space-y-1.5 w-36">
                          {/* CPU */}
                          <div>
                            <div className="flex justify-between text-xs mb-0.5">
                              <span className="text-gray-500 flex items-center gap-1">
                                <Cpu size={9} /> {cpuUsageCores}/{vm.cpu} vCPU
                              </span>
                              <span className={`font-medium ${cpuUsagePct > 80 ? 'text-red-400' : 'text-gray-400'}`}>{cpuUsagePct}%</span>
                            </div>
                            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${cpuUsagePct > 80 ? 'bg-red-500' : cpuUsagePct > 60 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                                style={{ width: `${cpuUsagePct}%` }}
                              />
                            </div>
                          </div>
                          {/* RAM */}
                          <div>
                            <div className="flex justify-between text-xs mb-0.5">
                              <span className="text-gray-500 flex items-center gap-1">
                                <MemoryStick size={9} /> {vm.status === 'running' ? Math.round(parseInt(vm.ram) * 0.65) : 0}/{vm.ram} GB
                              </span>
                            </div>
                            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-purple-500 rounded-full"
                                style={{ width: vm.status === 'running' ? '65%' : '0%' }}
                              />
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* IP */}
                      <td className="px-4 py-3 text-xs font-mono text-gray-300">{vm.ip}</td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {vm.status === 'stopped' ? (
                            <button
                              onClick={() => handleStatus(vm.id, 'running')}
                              className="p-1.5 text-green-400 hover:bg-green-900/30 rounded transition-colors"
                              title="Запустить"
                            >
                              <Play size={15} />
                            </button>
                          ) : vm.status === 'running' ? (
                            <button
                              onClick={() => handleStatus(vm.id, 'stopped')}
                              className="p-1.5 text-yellow-400 hover:bg-yellow-900/30 rounded transition-colors"
                              title={isAdmin ? 'Принудительно выключить (Force Stop)' : 'Остановить'}
                            >
                              <Square size={15} />
                            </button>
                          ) : null}

                          {/* Terminal button (running VMs only) */}
                          {vm.status === 'running' && (
                            <button
                              onClick={() => setTerminalVm(vm)}
                              className="flex items-center gap-1 text-xs px-2.5 py-1.5 text-green-400 bg-green-900/10 hover:bg-green-900/30 border border-green-800/40 rounded-lg transition-colors font-medium"
                              title="Открыть терминал"
                            >
                              <TerminalSquare size={13} />
                              Терминал
                            </button>
                          )}

                          {/* Force Stop (admin only, additional button) */}
                          {isAdmin && vm.status === 'running' && (
                            <button
                              onClick={() => handleStatus(vm.id, 'stopped')}
                              className="flex items-center gap-1 text-xs px-2 py-1 text-red-400 bg-red-900/10 hover:bg-red-900/30 border border-red-800/30 rounded transition-colors"
                              title="Force Stop"
                            >
                              <ShieldAlert size={11} />
                              Force Stop
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(vm.id, vm.name)}
                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                            title="Удалить"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create VM Modal */}
      {showCreate && (
        <CreateVMModal
          vdcs={vdcs}
          tenants={tenants}
          isAdmin={isAdmin}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadData(); }}
        />
      )}

      {/* Terminal Modal */}
      {terminalVm && token && (
        <TerminalModal
          vm={terminalVm}
          token={token}
          onClose={() => setTerminalVm(null)}
        />
      )}
    </div>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────
function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  const styles: Record<string, string> = {
    blue:   'bg-blue-500/10 border-blue-500/20',
    green:  'bg-green-500/10 border-green-500/20',
    gray:   'bg-gray-700/30 border-gray-700',
    purple: 'bg-purple-500/10 border-purple-500/20',
  };
  return (
    <div className={`card border p-4 ${styles[color]}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}

// ─── Create VM Modal ──────────────────────────────────────────────────────────
function CreateVMModal({ vdcs, tenants, isAdmin, onClose, onCreated }: {
  vdcs: OrgVDC[];
  tenants: Tenant[];
  isAdmin: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: '', org_vdc_id: vdcs[0]?.id || '',
    cpu: 2, ram: 4, disk: 50, os: OS_OPTIONS[0],
  });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const selectedVdc = vdcs.find((v) => v.id === form.org_vdc_id);
  const cpuFree  = selectedVdc ? parseInt(selectedVdc.cpu_limit)  - parseInt(selectedVdc.cpu_used)  : 0;
  const ramFree  = selectedVdc ? parseInt(selectedVdc.ram_limit)  - parseInt(selectedVdc.ram_used)  : 0;
  const diskFree = selectedVdc ? parseInt(selectedVdc.disk_limit) - parseInt(selectedVdc.disk_used) : 0;

  const getTenantName = (tid: string) => tenants.find((t) => t.id === tid)?.name || '—';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await vmsApi.create(form);
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания ВМ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Создать виртуальную машину" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Имя ВМ</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="vm-prod-01" required />
        </div>

        <div>
          <label className="label">Org VDC</label>
          <select className="input" value={form.org_vdc_id} onChange={(e) => setForm({ ...form, org_vdc_id: e.target.value })}>
            {vdcs.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}{isAdmin ? ` (${getTenantName(v.tenant_id)})` : ''} — CPU: {parseInt(v.cpu_limit) - parseInt(v.cpu_used)} free, RAM: {parseInt(v.ram_limit) - parseInt(v.ram_used)}GB free
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">CPU (vCPU)</label>
            <input type="number" className="input" min={1} max={cpuFree} value={form.cpu} onChange={(e) => setForm({ ...form, cpu: parseInt(e.target.value) })} />
            <p className="text-xs text-gray-600 mt-1">Макс: {cpuFree}</p>
          </div>
          <div>
            <label className="label">RAM (GB)</label>
            <input type="number" className="input" min={1} max={ramFree} value={form.ram} onChange={(e) => setForm({ ...form, ram: parseInt(e.target.value) })} />
            <p className="text-xs text-gray-600 mt-1">Макс: {ramFree}GB</p>
          </div>
          <div>
            <label className="label">Disk (GB)</label>
            <input type="number" className="input" min={10} max={diskFree} value={form.disk} onChange={(e) => setForm({ ...form, disk: parseInt(e.target.value) })} />
            <p className="text-xs text-gray-600 mt-1">Макс: {diskFree}GB</p>
          </div>
        </div>

        <div>
          <label className="label">Операционная система</label>
          <select className="input" value={form.os} onChange={(e) => setForm({ ...form, os: e.target.value })}>
            {OS_OPTIONS.map((os) => <option key={os} value={os}>{os}</option>)}
          </select>
        </div>

        {error && <div className="bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-4 py-3 text-sm">{error}</div>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Отмена</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? 'Создание...' : 'Создать ВМ'}</button>
        </div>
      </form>
    </Modal>
  );
}
