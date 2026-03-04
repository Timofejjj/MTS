import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';

import LoginPage         from './pages/LoginPage';
import DashboardPage     from './pages/DashboardPage';
import VMsPage           from './pages/VMsPage';
import OrgVDCsPage       from './pages/OrgVDCsPage';
import TenantsPage       from './pages/TenantsPage';
import UsersPage         from './pages/UsersPage';
import AuditPage         from './pages/AuditPage';
import InfrastructurePage from './pages/InfrastructurePage';

function PrivateRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, isLoading, isAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;

  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />

      {/* Common routes */}
      <Route path="/dashboard"      element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
      <Route path="/vms"            element={<PrivateRoute><VMsPage /></PrivateRoute>} />
      <Route path="/org-vdcs"       element={<PrivateRoute><OrgVDCsPage /></PrivateRoute>} />
      <Route path="/audit"          element={<PrivateRoute><AuditPage /></PrivateRoute>} />

      {/* Admin-only routes */}
      <Route path="/infrastructure" element={<PrivateRoute adminOnly><InfrastructurePage /></PrivateRoute>} />
      <Route path="/tenants"        element={<PrivateRoute adminOnly><TenantsPage /></PrivateRoute>} />
      <Route path="/users"          element={<PrivateRoute adminOnly><UsersPage /></PrivateRoute>} />

      <Route path="/"  element={<Navigate to="/dashboard" replace />} />
      <Route path="*"  element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
