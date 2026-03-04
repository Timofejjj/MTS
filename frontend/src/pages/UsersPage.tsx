import React, { useEffect, useState } from 'react';
import { Plus, Users, Trash2, Shield, User } from 'lucide-react';
import { User as UserType, Tenant } from '../types';
import { usersApi, tenantsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserType[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, tenantsRes] = await Promise.all([usersApi.getAll(), tenantsApi.getAll()]);
      setUsers(usersRes.data);
      setTenants(Array.isArray(tenantsRes.data) ? tenantsRes.data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleDelete = async (id: string, name: string) => {
    if (id === currentUser?.id) return alert('Нельзя удалить себя');
    if (!confirm(`Удалить пользователя "${name}"?`)) return;
    try {
      await usersApi.delete(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Ошибка удаления');
    }
  };

  const getTenantName = (tid: string) =>
    tenants.find((t) => t.id === tid)?.name || '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Пользователи</h1>
          <p className="text-gray-500 text-sm mt-1">{users.length} пользователей</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Добавить пользователя
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Пользователь</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Email</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Роль</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Тенант</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Создан</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {users.map((u) => (
                <tr key={u.id} className={`hover:bg-gray-800/40 transition-colors ${u.id === currentUser?.id ? 'bg-primary-500/5' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {u.role === 'admin' ? (
                        <Shield size={16} className="text-primary-500 shrink-0" />
                      ) : (
                        <User size={16} className="text-gray-500 shrink-0" />
                      )}
                      <span className="font-medium text-white">{u.name}</span>
                      {u.id === currentUser?.id && (
                        <span className="text-xs text-primary-400 bg-primary-500/10 border border-primary-500/20 px-1.5 py-0.5 rounded">ты</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      u.role === 'admin'
                        ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                        : 'bg-gray-700 text-gray-400 border border-gray-600'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">{u.tenant_id ? getTenantName(u.tenant_id) : '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('ru-RU') : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleDelete(u.id, u.name)}
                      disabled={u.id === currentUser?.id}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateUserModal
          tenants={tenants}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadData(); }}
        />
      )}
    </div>
  );
}

function CreateUserModal({
  tenants,
  onClose,
  onCreated,
}: {
  tenants: Tenant[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'client' as 'admin' | 'client',
    tenant_id: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await usersApi.create(form);
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Ошибка создания');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Создать пользователя" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Имя</label>
            <input className="input" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Иван Иванов" required />
          </div>
          <div>
            <label className="label">Роль</label>
            <select className="input" value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'client' })}>
              <option value="client">client</option>
              <option value="admin">admin</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="user@company.ru" required />
        </div>
        <div>
          <label className="label">Пароль</label>
          <input type="password" className="input" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Минимум 6 символов" required />
        </div>
        {form.role === 'client' && (
          <div>
            <label className="label">Тенант</label>
            <select className="input" value={form.tenant_id}
              onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}>
              <option value="">— Без тенанта —</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
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
