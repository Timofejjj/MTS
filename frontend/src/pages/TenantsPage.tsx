import React, { useEffect, useState } from 'react';
import { Plus, Building2, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Tenant } from '../types';
import { tenantsApi } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await tenantsApi.getAll();
      setTenants(Array.isArray(res.data) ? res.data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const toggleStatus = async (t: Tenant) => {
    const newStatus = t.status === 'active' ? 'suspended' : 'active';
    try {
      await tenantsApi.update(t.id, { status: newStatus });
      setTenants((prev) => prev.map((x) => x.id === t.id ? { ...x, status: newStatus as Tenant['status'] } : x));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Ошибка');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Удалить тенант "${name}"?`)) return;
    try {
      await tenantsApi.delete(id);
      setTenants((prev) => prev.filter((t) => t.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Ошибка удаления');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Тенанты</h1>
          <p className="text-gray-500 text-sm mt-1">Организации-арендаторы · {tenants.length} всего</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          Добавить тенант
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : tenants.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Building2 size={48} className="text-gray-700 mb-4" />
          <p className="text-gray-400 font-medium">Нет тенантов</p>
          <p className="text-gray-600 text-sm mt-1">Создайте первого клиента-организацию</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Организация</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Email</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Описание</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Статус</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Создан</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Building2 size={16} className="text-blue-400 shrink-0" />
                      <span className="font-medium text-white">{t.name}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5 ml-6">{t.id.slice(0, 8)}...</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">{t.contact_email}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{t.description || '—'}</td>
                  <td className="px-6 py-4"><StatusBadge status={t.status} /></td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(t.created_at).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleStatus(t)}
                        className={`p-1.5 rounded transition-colors ${
                          t.status === 'active'
                            ? 'text-green-400 hover:text-yellow-400 hover:bg-yellow-900/30'
                            : 'text-gray-500 hover:text-green-400 hover:bg-green-900/30'
                        }`}
                        title={t.status === 'active' ? 'Приостановить' : 'Активировать'}
                      >
                        {t.status === 'active' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                      </button>
                      <button
                        onClick={() => handleDelete(t.id, t.name)}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors"
                        title="Удалить"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateTenantModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadData(); }}
        />
      )}
    </div>
  );
}

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
          <input className="input" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="ООО Рога и Копыта" required />
        </div>
        <div>
          <label className="label">Контактный Email</label>
          <input type="email" className="input" value={form.contact_email}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            placeholder="contact@company.ru" required />
        </div>
        <div>
          <label className="label">Описание</label>
          <textarea className="input resize-none h-20" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Краткое описание клиента..." />
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
