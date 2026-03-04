import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: { email: string; password: string; name: string; tenant_id?: string }) =>
    api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
};

// ─── Stats ────────────────────────────────────────────────────────────────────
export const statsApi = {
  get: () => api.get('/stats'),
};

// ─── Tenants ──────────────────────────────────────────────────────────────────
export const tenantsApi = {
  getAll: () => api.get('/tenants'),
  getById: (id: string) => api.get(`/tenants/${id}`),
  create: (data: { name: string; contact_email: string; description?: string }) =>
    api.post('/tenants', data),
  update: (id: string, data: Partial<{ name: string; status: string; contact_email: string; description: string }>) =>
    api.put(`/tenants/${id}`, data),
  delete: (id: string) => api.delete(`/tenants/${id}`),
};

// ─── OrgVDCs ──────────────────────────────────────────────────────────────────
export const orgVdcsApi = {
  getAll: () => api.get('/org-vdcs'),
  getById: (id: string) => api.get(`/org-vdcs/${id}`),
  create: (data: {
    tenant_id: string;
    name: string;
    cpu_limit: number;
    ram_limit: number;
    disk_limit: number;
  }) => api.post('/org-vdcs', data),
  update: (
    id: string,
    data: Partial<{ name: string; cpu_limit: number; ram_limit: number; disk_limit: number }>
  ) => api.put(`/org-vdcs/${id}`, data),
  delete: (id: string) => api.delete(`/org-vdcs/${id}`),
};

// ─── VMs ──────────────────────────────────────────────────────────────────────
export const vmsApi = {
  getAll: () => api.get('/vms'),
  getById: (id: string) => api.get(`/vms/${id}`),
  create: (data: {
    name: string;
    org_vdc_id: string;
    cpu: number;
    ram: number;
    disk: number;
    os: string;
  }) => api.post('/vms', data),
  setStatus: (id: string, status: string) =>
    api.patch(`/vms/${id}/status`, { status }),
  delete: (id: string) => api.delete(`/vms/${id}`),
  osOptions: () => api.get('/vms/meta/os-options'),
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const usersApi = {
  getAll: () => api.get('/users'),
  create: (data: {
    email: string;
    password: string;
    name: string;
    role: 'admin' | 'client';
    tenant_id?: string;
  }) => api.post('/users', data),
  update: (id: string, data: Partial<{ name: string; role: string; tenant_id: string; password: string }>) =>
    api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
};

// ─── Audit ────────────────────────────────────────────────────────────────────
export const auditApi = {
  get: (limit?: number) => api.get(`/audit${limit ? `?limit=${limit}` : ''}`),
};

export default api;
