import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  Building2,
  Users,
  ClipboardList,
  Network,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { to: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Дашборд' },
  { to: '/vms', icon: <Server size={20} />, label: 'Виртуальные машины' },
  { to: '/org-vdcs', icon: <Network size={20} />, label: 'Org VDC' },
  { to: '/tenants', icon: <Building2 size={20} />, label: 'Тенанты', adminOnly: true },
  { to: '/users', icon: <Users size={20} />, label: 'Пользователи', adminOnly: true },
  { to: '/audit', icon: <ClipboardList size={20} />, label: 'Аудит' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-16'
        } flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-300 shrink-0`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-800">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center font-bold text-white text-sm">
                M
              </div>
              <span className="font-bold text-white text-sm">MTS Cloud</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`
              }
              title={!sidebarOpen ? item.label : undefined}
            >
              {item.icon}
              {sidebarOpen && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User info */}
        <div className="border-t border-gray-800 p-4">
          {sidebarOpen ? (
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    isAdmin
                      ? 'bg-primary-500/20 text-primary-400'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {isAdmin ? 'Admin' : 'Client'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="text-gray-500 hover:text-red-400 transition-colors p-1"
                title="Выйти"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-red-400 transition-colors w-full flex justify-center"
              title="Выйти"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-gray-800 bg-gray-900 shrink-0">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>MTS Cloud</span>
            <ChevronRight size={14} />
            <span className="text-white">IaaS Platform</span>
          </div>
          {isAdmin && (
            <span className="text-xs bg-primary-500/20 text-primary-400 border border-primary-500/30 px-2 py-1 rounded-full font-medium">
              Режим администратора
            </span>
          )}
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </main>
    </div>
  );
}
