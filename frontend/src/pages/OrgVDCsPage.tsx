import React, { useEffect, useState } from 'react';
import { Plus, Network, Trash2, Edit2 } from 'lucide-react';
import { OrgVDC, Tenant } from '../types';
import { orgVdcsApi, tenantsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ResourceBar from '../components/ResourceBar';
import Modal from '../components/Modal';

export default function OrgVDCsPage() {
  const { isAdmin } = useAuth();
  const [vdcs, setVdcs] = useState<OrgVDC[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editVdc, setEditVdc] = useState<OrgVDC | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [vdcsRes, tenantsRes] = await Promise.all([
        orgVdcsApi.getAll(),
        tenantsApi.getAll(),
      ]);
      setVdcs(Array.isArray(vdcsRes.data) ? vdcsRes.data : []);
      const t = tenantsRes.data;
      setTenants(Array.isArray(t) ? t : t ? [t] : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Удалить Org VDC "${name}"?`)) return;
    try {
      await orgVdcsApi.delete(id);
      setVdcs((prev) => prev.filter((v) => v.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Ошибка удаления');
    }
  };

  const getTenantName = (tid: string) =>
    tenants.find((t) => t.id === tid)?.name || tid.slice(0, 8) + '...';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Org VDC</h1>
          <p className="text-gray-500 text-sm mt-1">
            Виртуальные дата-центры организаций · {vdcs.length} всего
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={18} />
            Создать VDC
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : vdcs.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Network size={48} className="text-gray-700 mb-4" />
          <p className="text-gray-400 font-medium">Нет Org VDC</p>
          {isAdmin && (
            <p className="text-gray-600 text-sm mt-1">
              Создайте VDC для тенанта чтобы начать выделять ресурсы
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {vdcs.map((vdc) => (
            <div key={vdc.id} className="card space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Network size={16} className="text-purple-400" />
                    <h3 className="font-semibold text-white">{vdc.name}</h3>
                  </div>
                  {isAdmin && (
                    <p className="text-xs text-gray-500 mt-1">Тенант: {getTenantName(vdc.tenant_id)}</p>
                  )}
                  <p className="text-xs text-gray-600 mt-0.5">
                    Создан: {new Date(vdc.created_at).toLocaleDateString('ru-RU')}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditVdc(vdc)}
                      className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-900/30 rounded transition-colors"
                      title="Изменить лимиты"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(vdc.id, vdc.name)}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors"
                      title="Удалить"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-2 border-t border-gray-800">
                <ResourceBar
                  label="CPU"
                  used={parseInt(vdc.cpu_used || '0')}
                  limit={parseInt(vdc.cpu_limit || '0')}
                  unit=" vCPU"
                />
                <ResourceBar
                  label="RAM"
                  used={parseInt(vdc.ram_used || '0')}
                  limit={parseInt(vdc.ram_limit || '0')}
                  unit=" GB"
                />
                <ResourceBar
                  label="Disk"
                  used={parseInt(vdc.disk_used || '0')}
                  limit={parseInt(vdc.disk_limit || '0')}
                  unit=" GB"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && isAdmin && (
        <CreateOrgVDCModal
          tenants={tenants}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadData(); }}
        />
      )}

      {editVdc && isAdmin && (
        <EditOrgVDCModal
          vdc={editVdc}
          onClose={() => setEditVdc(null)}
          onSaved={() => { setEditVdc(null); loadData(); }}
        />
      )}
    </div>
  );
}

// ─── Create Modal ──────────────────────────────────────────────────────────────

function CreateOrgVDCModal({
  tenants,
  onClose,
  onCreated,
}: {
  tenants: Tenant[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    tenant_id: tenants[0]?.id || '',
    name: '',
    cpu_limit: 16,
    ram_limit: 32,
    disk_limit: 500,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await orgVdcsApi.create(form);
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания VDC');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Создать Org VDC" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Тенант</label>
          <select
            className="input"
            value={form.tenant_id}
            onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Название VDC</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="prod-vdc-01"
            required
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">CPU лимит</label>
            <input type="number" className="input" min={1} value={form.cpu_limit}
              onChange={(e) => setForm({ ...form, cpu_limit: parseInt(e.target.value) })} />
            <p className="text-xs text-gray-600 mt-1">vCPU</p>
          </div>
          <div>
            <label className="label">RAM лимит</label>
            <input type="number" className="input" min={1} value={form.ram_limit}
              onChange={(e) => setForm({ ...form, ram_limit: parseInt(e.target.value) })} />
            <p className="text-xs text-gray-600 mt-1">GB</p>
          </div>
          <div>
            <label className="label">Disk лимит</label>
            <input type="number" className="input" min={10} value={form.disk_limit}
              onChange={(e) => setForm({ ...form, disk_limit: parseInt(e.target.value) })} />
            <p className="text-xs text-gray-600 mt-1">GB</p>
          </div>
        </div>
        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-4 py-3 text-sm">{error}</div>
        )}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Отмена</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Создание...' : 'Создать'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditOrgVDCModal({
  vdc,
  onClose,
  onSaved,
}: {
  vdc: OrgVDC;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    cpu_limit: parseInt(vdc.cpu_limit),
    ram_limit: parseInt(vdc.ram_limit),
    disk_limit: parseInt(vdc.disk_limit),
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await orgVdcsApi.update(vdc.id, form);
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка обновления');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Изменить лимиты: ${vdc.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">CPU лимит</label>
            <input type="number" className="input" min={parseInt(vdc.cpu_used) || 1} value={form.cpu_limit}
              onChange={(e) => setForm({ ...form, cpu_limit: parseInt(e.target.value) })} />
          </div>
          <div>
            <label className="label">RAM (GB)</label>
            <input type="number" className="input" min={parseInt(vdc.ram_used) || 1} value={form.ram_limit}
              onChange={(e) => setForm({ ...form, ram_limit: parseInt(e.target.value) })} />
          </div>
          <div>
            <label className="label">Disk (GB)</label>
            <input type="number" className="input" min={parseInt(vdc.disk_used) || 10} value={form.disk_limit}
              onChange={(e) => setForm({ ...form, disk_limit: parseInt(e.target.value) })} />
          </div>
        </div>
        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-4 py-3 text-sm">{error}</div>
        )}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Отмена</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
