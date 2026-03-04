import React, { useEffect, useState } from 'react';
import { Plus, Building2, Trash2, ToggleLeft, ToggleRight, Edit2, Cpu, MemoryStick, HardDrive, Server } from 'lucide-react';
import { Tenant, OrgVDC, VM } from '../types';
import { tenantsApi, orgVdcsApi, vmsApi } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import DonutChart from '../components/DonutChart';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TenantRow extends Tenant {
  vmCount: number;
  vdcs: OrgVDC[];
  cpuLimit: number;
  ramLimit: number;
  diskLimit: number;
  cpuUsed: number;
  ramUsed: number;
  diskUsed: number;
}

export default function TenantsPage() {
  const [rows, setRows]       = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTenant, setEditTenant] = useState<TenantRow | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tenantsRes, vdcsRes, vmsRes] = await Promise.all([
        tenantsApi.getAll(),
        orgVdcsApi.getAll(),
        vmsApi.getAll(),
      ]);

      const tenants: Tenant[] = Array.isArray(tenantsRes.data) ? tenantsRes.data : [];
      const vdcs:    OrgVDC[] = Array.isArray(vdcsRes.data)    ? vdcsRes.data    : [];
      const vms:     VM[]     = vmsRes.data;

      const enriched: TenantRow[] = tenants.map((t) => {
        const tenantVdcs = vdcs.filter((v) => v.tenant_id === t.id);
        const tenantVms  = vms.filter((v)  => v.tenant_id === t.id);
        return {
          ...t,
          vmCount:   tenantVms.length,
          vdcs:      tenantVdcs,
          cpuLimit:  tenantVdcs.reduce((s, v) => s + parseInt(v.cpu_limit  || '0'), 0),
          ramLimit:  tenantVdcs.reduce((s, v) => s + parseInt(v.ram_limit  || '0'), 0),
          diskLimit: tenantVdcs.reduce((s, v) => s + parseInt(v.disk_limit || '0'), 0),
          cpuUsed:   tenantVdcs.reduce((s, v) => s + parseInt(v.cpu_used   || '0'), 0),
          ramUsed:   tenantVdcs.reduce((s, v) => s + parseInt(v.ram_used   || '0'), 0),
          diskUsed:  tenantVdcs.reduce((s, v) => s + parseInt(v.disk_used  || '0'), 0),
        };
      });

      setRows(enriched);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const toggleStatus = async (t: TenantRow) => {
    const newStatus = t.status === 'active' ? 'suspended' : 'active';
    try {
      await tenantsApi.update(t.id, { status: newStatus });
      setRows((prev) => prev.map((r) => r.id === t.id ? { ...r, status: newStatus as Tenant['status'] } : r));
    } catch (err: any) { alert(err.response?.data?.error || 'Ошибка'); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Удалить тенант "${name}"?`)) return;
    try {
      await tenantsApi.delete(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) { alert(err.response?.data?.error || 'Ошибка удаления'); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Управление организациями</h1>
          <p className="text-gray-500 text-sm mt-1">Тенанты платформы · {rows.length} организаций</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Добавить тенант
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card border border-blue-500/20 bg-blue-500/5 p-4">
          <p className="text-xs text-gray-500">Всего тенантов</p>
          <p className="text-3xl font-bold text-white mt-1">{rows.length}</p>
          <p className="text-xs text-gray-600 mt-1">{rows.filter(r => r.status === 'active').length} активных</p>
        </div>
        <div className="card border border-green-500/20 bg-green-500/5 p-4">
          <p className="text-xs text-gray-500">Всего ВМ</p>
          <p className="text-3xl font-bold text-white mt-1">{rows.reduce((s, r) => s + r.vmCount, 0)}</p>
          <p className="text-xs text-gray-600 mt-1">на всех тенантах</p>
        </div>
        <div className="card border border-purple-500/20 bg-purple-500/5 p-4">
          <p className="text-xs text-gray-500">Выдано CPU / RAM</p>
          <p className="text-2xl font-bold text-white mt-1">
            {rows.reduce((s, r) => s + r.cpuLimit, 0)} / {rows.reduce((s, r) => s + r.ramLimit, 0)} ГБ
          </p>
          <p className="text-xs text-gray-600 mt-1">суммарные квоты</p>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Building2 size={48} className="text-gray-700 mb-4" />
          <p className="text-gray-400 font-medium">Нет тенантов</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Организация</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Статус</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                    <span className="flex items-center gap-1"><Server size={12} /> ВМ</span>
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Выданные квоты</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Использование</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {rows.map((row) => (
                  <TenantTableRow
                    key={row.id}
                    row={row}
                    onEdit={() => setEditTenant(row)}
                    onToggle={() => toggleStatus(row)}
                    onDelete={() => handleDelete(row.id, row.name)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateTenantModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadData(); }} />
      )}
      {editTenant && (
        <EditQuotaModal tenant={editTenant} onClose={() => setEditTenant(null)} onSaved={() => { setEditTenant(null); loadData(); }} />
      )}
    </div>
  );
}

// ─── Table Row ────────────────────────────────────────────────────────────────
function TenantTableRow({ row, onEdit, onToggle, onDelete }: {
  row: TenantRow;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const cpuPct  = row.cpuLimit  > 0 ? Math.round((row.cpuUsed  / row.cpuLimit)  * 100) : 0;
  const ramPct  = row.ramLimit  > 0 ? Math.round((row.ramUsed  / row.ramLimit)  * 100) : 0;
  const diskPct = row.diskLimit > 0 ? Math.round((row.diskUsed / row.diskLimit) * 100) : 0;

  return (
    <tr className="hover:bg-gray-800/40 transition-colors">
      {/* Name + ID */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center shrink-0">
            <Building2 size={14} className="text-blue-400" />
          </div>
          <div>
            <p className="font-semibold text-white">{row.name}</p>
            <p className="text-xs font-mono text-gray-600 mt-0.5">ID: {row.id.slice(0, 12)}...</p>
            <p className="text-xs text-gray-500">{row.contact_email}</p>
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-6 py-4"><StatusBadge status={row.status} /></td>

      {/* VM Count */}
      <td className="px-6 py-4">
        <span className="flex items-center gap-1.5">
          <span className="text-xl font-bold text-white">{row.vmCount}</span>
          <span className="text-xs text-gray-500">ВМ</span>
        </span>
        <p className="text-xs text-gray-600 mt-0.5">{row.vdcs.length} VDC</p>
      </td>

      {/* Quota */}
      <td className="px-6 py-4">
        {row.cpuLimit > 0 ? (
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-1.5 text-gray-300">
              <Cpu size={11} className="text-blue-400" />
              <span className="font-medium">{row.cpuLimit}</span>
              <span className="text-gray-500">vCPU</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-300">
              <MemoryStick size={11} className="text-purple-400" />
              <span className="font-medium">{row.ramLimit}</span>
              <span className="text-gray-500">GB RAM</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-300">
              <HardDrive size={11} className="text-green-400" />
              <span className="font-medium">{row.diskLimit}</span>
              <span className="text-gray-500">GB Disk</span>
            </div>
          </div>
        ) : (
          <span className="text-xs text-gray-600">— нет VDC —</span>
        )}
      </td>

      {/* Usage mini bars */}
      <td className="px-6 py-4">
        {row.cpuLimit > 0 ? (
          <div className="space-y-1.5 w-32">
            <UsageMiniBar label="CPU" pct={cpuPct} />
            <UsageMiniBar label="RAM" pct={ramPct} />
            <UsageMiniBar label="Disk" pct={diskPct} />
          </div>
        ) : (
          <span className="text-xs text-gray-600">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg transition-colors"
            title="Изменить лимиты"
          >
            <Edit2 size={12} />
            Изменить лимиты
          </button>
          <button
            onClick={onToggle}
            className={`p-1.5 rounded transition-colors ${row.status === 'active' ? 'text-green-400 hover:text-yellow-400 hover:bg-yellow-900/20' : 'text-gray-500 hover:text-green-400 hover:bg-green-900/20'}`}
            title={row.status === 'active' ? 'Приостановить' : 'Активировать'}
          >
            {row.status === 'active' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
            title="Удалить"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function UsageMiniBar({ label, pct }: { label: string; pct: number }) {
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-orange-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-blue-500';
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-600 w-7">{label}</span>
      <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-7 text-right">{pct}%</span>
    </div>
  );
}

// ─── Edit Quota Modal ─────────────────────────────────────────────────────────
function EditQuotaModal({ tenant, onClose, onSaved }: {
  tenant: TenantRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [cpuLimit,  setCpuLimit]  = useState(tenant.cpuLimit  || 8);
  const [ramLimit,  setRamLimit]  = useState(tenant.ramLimit  || 16);
  const [diskLimit, setDiskLimit] = useState(tenant.diskLimit || 100);
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (tenant.vdcs.length === 0) {
        // Create a new VDC for this tenant
        const { orgVdcsApi: api } = await import('../services/api');
        await api.create({ tenant_id: tenant.id, name: `${tenant.name}-VDC-01`, cpu_limit: cpuLimit, ram_limit: ramLimit, disk_limit: diskLimit });
      } else {
        // Update all VDCs proportionally (or just update the first one if single)
        if (tenant.vdcs.length === 1) {
          const { orgVdcsApi: api } = await import('../services/api');
          await api.update(tenant.vdcs[0].id, { cpu_limit: cpuLimit, ram_limit: ramLimit, disk_limit: diskLimit });
        } else {
          // Multiple VDCs — update first one with delta
          const { orgVdcsApi: api } = await import('../services/api');
          await api.update(tenant.vdcs[0].id, { cpu_limit: cpuLimit, ram_limit: ramLimit, disk_limit: diskLimit });
        }
      }
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Изменение лимитов: ${tenant.name}`} onClose={onClose} size="md">
      <form onSubmit={handleSave} className="space-y-5">
        {/* Preview */}
        {tenant.cpuLimit > 0 && (
          <div className="p-3 bg-gray-800/60 rounded-lg border border-gray-700/50 text-sm">
            <p className="text-gray-400 mb-2 text-xs uppercase font-medium">Текущие лимиты</p>
            <div className="flex gap-4 text-gray-300">
              <span><Cpu size={11} className="inline text-blue-400 mr-1" />{tenant.cpuLimit} vCPU</span>
              <span><MemoryStick size={11} className="inline text-purple-400 mr-1" />{tenant.ramLimit} GB RAM</span>
              <span><HardDrive size={11} className="inline text-green-400 mr-1" />{tenant.diskLimit} GB Disk</span>
            </div>
          </div>
        )}

        {/* Inputs */}
        <div>
          <label className="label flex items-center gap-1.5"><Cpu size={13} className="text-blue-400" /> Максимум CPU (vCPU)</label>
          <input
            type="number" min={tenant.cpuUsed || 1} max={512}
            className="input text-lg font-semibold"
            value={cpuLimit}
            onChange={(e) => setCpuLimit(parseInt(e.target.value) || 1)}
          />
          {tenant.cpuUsed > 0 && <p className="text-xs text-gray-600 mt-1">Уже используется: {tenant.cpuUsed} vCPU (минимум)</p>}
        </div>

        <div>
          <label className="label flex items-center gap-1.5"><MemoryStick size={13} className="text-purple-400" /> Максимум RAM (ГБ)</label>
          <input
            type="number" min={tenant.ramUsed || 1} max={1024}
            className="input text-lg font-semibold"
            value={ramLimit}
            onChange={(e) => setRamLimit(parseInt(e.target.value) || 1)}
          />
          {tenant.ramUsed > 0 && <p className="text-xs text-gray-600 mt-1">Уже используется: {tenant.ramUsed} ГБ (минимум)</p>}
        </div>

        <div>
          <label className="label flex items-center gap-1.5"><HardDrive size={13} className="text-green-400" /> Максимум Disk (ГБ)</label>
          <input
            type="number" min={tenant.diskUsed || 10} max={100000}
            className="input text-lg font-semibold"
            value={diskLimit}
            onChange={(e) => setDiskLimit(parseInt(e.target.value) || 10)}
          />
        </div>

        {/* Preview new values */}
        <div className="p-3 bg-blue-500/5 rounded-lg border border-blue-500/20 text-sm">
          <p className="text-xs text-blue-400 mb-1 font-medium">Новые лимиты будут:</p>
          <div className="flex gap-4 text-white font-semibold">
            <span>{cpuLimit} vCPU</span>
            <span>{ramLimit} GB RAM</span>
            <span>{diskLimit} GB Disk</span>
          </div>
        </div>

        {error && <div className="bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-4 py-3 text-sm">{error}</div>}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Отмена</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Create Tenant Modal ──────────────────────────────────────────────────────
function CreateTenantModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', contact_email: '', description: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await tenantsApi.create(form);
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Создать тенант" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Название организации</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ООО Рога и Копыта" required />
        </div>
        <div>
          <label className="label">Контактный Email</label>
          <input type="email" className="input" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder="contact@company.ru" required />
        </div>
        <div>
          <label className="label">Описание</label>
          <textarea className="input resize-none h-20" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Краткое описание клиента..." />
        </div>
        {error && <div className="bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-4 py-3 text-sm">{error}</div>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Отмена</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? 'Создание...' : 'Создать'}</button>
        </div>
      </form>
    </Modal>
  );
}
