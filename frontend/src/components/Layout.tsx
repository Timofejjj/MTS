import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Server, Building2, Users, ClipboardList,
  Network, LogOut, Menu, X, ChevronRight, Cpu, ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  adminOnly?: boolean;
  dividerBefore?: boolean;
}

const navItems: NavItem[] = [
  { to: '/dashboard',      icon: <LayoutDashboard size={18} />, label: 'Дашборд' },
  { to: '/vms',            icon: <Server size={18} />,          label: 'Виртуальные машины' },
  { to: '/org-vdcs',       icon: <Network size={18} />,         label: 'Org VDC' },
  { to: '/audit',          icon: <ClipboardList size={18} />,   label: 'Аудит' },

  // Admin section
  { to: '/infrastructure', icon: <Cpu size={18} />,             label: 'Инфраструктура',  adminOnly: true, dividerBefore: true },
  { to: '/tenants',        icon: <Building2 size={18} />,       label: 'Тенанты',          adminOnly: true },
  { to: '/users',          icon: <Users size={18} />,           label: 'Пользователи',     adminOnly: true },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => { logout(); navigate('/login'); };
  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-60' : 'w-14'} flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-300 shrink-0`}>

        {/* Logo */}
        <div className="flex items-center justify-between h-14 px-3 border-b border-gray-800">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-primary-500 rounded-lg flex items-center justify-center font-black text-white text-sm shadow shadow-primary-500/40">M</div>
              <div>
                <span className="font-bold text-white text-sm">MTS Cloud</span>
                <p className="text-xs text-gray-600 leading-none">IaaS Platform</p>
              </div>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-500 hover:text-white transition-colors p-1 rounded ml-auto">
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
          {visibleItems.map((item) => (
            <React.Fragment key={item.to}>
              {item.dividerBefore && sidebarOpen && (
                <div className="px-2 pt-3 pb-1">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert size={10} />
                    Администрирование
                  </p>
                </div>
              )}
              {item.dividerBefore && !sidebarOpen && (
                <div className="border-t border-gray-800 my-2" />
              )}
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-sm ${
                    isActive
                      ? 'bg-primary-500/15 text-primary-400 border border-primary-500/25'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`
                }
                title={!sidebarOpen ? item.label : undefined}
              >
                <span className="shrink-0">{item.icon}</span>
                {sidebarOpen && <span className="font-medium truncate">{item.label}</span>}
              </NavLink>
            </React.Fragment>
          ))}
        </nav>

        {/* User info */}
        <div className="border-t border-gray-800 p-3">
          {sidebarOpen ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${isAdmin ? 'bg-primary-500/20 text-primary-400' : 'bg-gray-700 text-gray-400'}`}>
                    {isAdmin ? 'Admin' : 'Client'}
                  </span>
                </div>
                <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <button onClick={handleLogout} className="text-gray-500 hover:text-red-400 transition-colors p-1.5 rounded hover:bg-red-900/20 shrink-0" title="Выйти">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button onClick={handleLogout} className="text-gray-500 hover:text-red-400 transition-colors w-full flex justify-center p-1" title="Выйти">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-gray-800 bg-gray-900 shrink-0">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>MTS Cloud</span>
            <ChevronRight size={13} />
            <span className="text-gray-200">IaaS Platform</span>
          </div>
          {isAdmin && (
            <span className="text-xs bg-primary-500/15 text-primary-400 border border-primary-500/25 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
              <ShieldAlert size={11} />
              Режим администратора
            </span>
          )}
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </main>
    </div>
  );
}
