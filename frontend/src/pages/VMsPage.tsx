import React, { useEffect, useState } from 'react';
import { Plus, Play, Square, Trash2, Server, Cpu, MemoryStick, HardDrive } from 'lucide-react';
import { VM, OrgVDC } from '../types';
import { vmsApi, orgVdcsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

const OS_OPTIONS = ['Ubuntu 22.04', 'Ubuntu 20.04', 'Debian 12', 'CentOS 8', 'Windows Server 2022'];

export default function VMsPage() {
  const { isAdmin } = useAuth();
  const [vms, setVms] = useState<VM[]>([]);
  const [vdcs, setVdcs] = useState<OrgVDC[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [vmsRes, vdcsRes] = await Promise.all([vmsApi.getAll(), orgVdcsApi.getAll()]);
      setVms(vmsRes.data);
      setVdcs(Array.isArray(vdcsRes.data) ? vdcsRes.data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleStatus = async (id: string, status: string) => {
    try {
      await vmsApi.setStatus(id, status);
      setVms((prev) => prev.map((vm) => vm.id === id ? { ...vm, status: status as VM['status'] } : vm));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Ошибка');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Удалить VM "${name}"?`)) return;
    try {
      await vmsApi.delete(id);
      setVms((prev) => prev.filter((vm) => vm.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Ошибка удаления');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Виртуальные машины</h1>
          <p className="text-gray-500 text-sm mt-1">{vms.length} ВМ всего</p>
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
            {vdcs.length === 0
              ? 'Сначала создайте Org VDC для размещения ВМ'
              : 'Нажмите "Создать ВМ" чтобы начать'}
          </p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Имя</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Статус</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">ОС</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Ресурсы</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">IP</th>
                  {isAdmin && <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Тенант</th>}
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {vms.map((vm) => {
                  const vdc = vdcs.find((v) => v.id === vm.org_vdc_id);
                  return (
                    <tr key={vm.id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{vm.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{vdc?.name || vm.org_vdc_id}</div>
                      </td>
                      <td className="px-6 py-4"><StatusBadge status={vm.status} /></td>
                      <td className="px-6 py-4 text-sm text-gray-300">{vm.os}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span className="flex items-center gap-1"><Cpu size={12} />{vm.cpu} vCPU</span>
                          <span className="flex items-center gap-1"><MemoryStick size={12} />{vm.ram}GB</span>
                          <span className="flex items-center gap-1"><HardDrive size={12} />{vm.disk}GB</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-300">{vm.ip}</td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-sm text-gray-400">{vm.tenant_id.slice(0, 8)}...</td>
                      )}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {vm.status === 'stopped' ? (
                            <button
                              onClick={() => handleStatus(vm.id, 'running')}
                              className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-900/30 rounded transition-colors"
                              title="Запустить"
                            >
                              <Play size={16} />
                            </button>
                          ) : vm.status === 'running' ? (
                            <button
                              onClick={() => handleStatus(vm.id, 'stopped')}
                              className="p-1.5 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/30 rounded transition-colors"
                              title="Остановить"
                            >
                              <Square size={16} />
                            </button>
                          ) : null}
                          <button
                            onClick={() => handleDelete(vm.id, vm.name)}
                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors"
                            title="Удалить"
                          >
                            <Trash2 size={16} />
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
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadData(); }}
        />
      )}
    </div>
  );
}

// ─── Create VM Modal ──────────────────────────────────────────────────────────

function CreateVMModal({
  vdcs,
  onClose,
  onCreated,
}: {
  vdcs: OrgVDC[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    org_vdc_id: vdcs[0]?.id || '',
    cpu: 2,
    ram: 4,
    disk: 50,
    os: OS_OPTIONS[0],
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedVdc = vdcs.find((v) => v.id === form.org_vdc_id);
  const cpuFree = selectedVdc ? parseInt(selectedVdc.cpu_limit) - parseInt(selectedVdc.cpu_used) : 0;
  const ramFree = selectedVdc ? parseInt(selectedVdc.ram_limit) - parseInt(selectedVdc.ram_used) : 0;
  const diskFree = selectedVdc ? parseInt(selectedVdc.disk_limit) - parseInt(selectedVdc.disk_used) : 0;

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
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="vm-prod-01"
            required
          />
        </div>

        <div>
          <label className="label">Org VDC</label>
          <select
            className="input"
            value={form.org_vdc_id}
            onChange={(e) => setForm({ ...form, org_vdc_id: e.target.value })}
          >
            {vdcs.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} (CPU: {parseInt(v.cpu_limit) - parseInt(v.cpu_used)} free, RAM: {parseInt(v.ram_limit) - parseInt(v.ram_used)}GB free)
              </option>
            ))}
          </select>
        </div>

        {/* Resource inputs */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">CPU (vCPU)</label>
            <input
              type="number"
              className="input"
              min={1}
              max={cpuFree}
              value={form.cpu}
              onChange={(e) => setForm({ ...form, cpu: parseInt(e.target.value) })}
            />
            <p className="text-xs text-gray-600 mt-1">Макс: {cpuFree}</p>
          </div>
          <div>
            <label className="label">RAM (GB)</label>
            <input
              type="number"
              className="input"
              min={1}
              max={ramFree}
              value={form.ram}
              onChange={(e) => setForm({ ...form, ram: parseInt(e.target.value) })}
            />
            <p className="text-xs text-gray-600 mt-1">Макс: {ramFree}GB</p>
          </div>
          <div>
            <label className="label">Disk (GB)</label>
            <input
              type="number"
              className="input"
              min={10}
              max={diskFree}
              value={form.disk}
              onChange={(e) => setForm({ ...form, disk: parseInt(e.target.value) })}
            />
            <p className="text-xs text-gray-600 mt-1">Макс: {diskFree}GB</p>
          </div>
        </div>

        <div>
          <label className="label">Операционная система</label>
          <select
            className="input"
            value={form.os}
            onChange={(e) => setForm({ ...form, os: e.target.value })}
          >
            {OS_OPTIONS.map((os) => (
              <option key={os} value={os}>{os}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Отмена
          </button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Создание...' : 'Создать ВМ'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
