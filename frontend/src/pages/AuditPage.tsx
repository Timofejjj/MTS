import React, { useEffect, useState } from 'react';
import { ClipboardList, RefreshCw } from 'lucide-react';
import { AuditEntry } from '../types';
import { auditApi } from '../services/api';

const ACTION_COLORS: Record<string, string> = {
  CREATE_TENANT: 'text-blue-400',
  DELETE_TENANT: 'text-red-400',
  CREATE_ORG_VDC: 'text-purple-400',
  DELETE_ORG_VDC: 'text-red-400',
  CREATE_VM: 'text-green-400',
  DELETE_VM: 'text-red-400',
  VM_RUNNING: 'text-green-400',
  VM_STOPPED: 'text-yellow-400',
  VM_PENDING: 'text-yellow-400',
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await auditApi.get(200);
      setLogs(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Журнал аудита</h1>
          <p className="text-gray-500 text-sm mt-1">История действий в системе · {logs.length} записей</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Обновить
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : logs.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <ClipboardList size={48} className="text-gray-700 mb-4" />
          <p className="text-gray-400 font-medium">Журнал пуст</p>
          <p className="text-gray-600 text-sm mt-1">Действия будут отображены здесь</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Время</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Действие</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Ресурс</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Детали</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Пользователь</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`text-xs font-mono font-semibold ${ACTION_COLORS[log.action] || 'text-gray-400'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className="text-xs text-gray-400">
                        {log.resource_type}
                      </span>
                      <span className="text-xs text-gray-600 ml-2 font-mono">
                        {log.resource_id?.slice(0, 8)}...
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-300 max-w-sm truncate" title={log.details}>
                      {log.details}
                    </td>
                    <td className="px-6 py-3 text-xs text-gray-500 font-mono">
                      {log.user_id?.slice(0, 8)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
