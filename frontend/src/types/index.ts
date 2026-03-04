// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  role: 'admin' | 'client';
  tenant_id: string;
  name: string;
  created_at?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
}

// ─── Tenant ───────────────────────────────────────────────────────────────────
export interface Tenant {
  id: string;
  name: string;
  status: 'active' | 'suspended';
  created_at: string;
  contact_email: string;
  description: string;
}

// ─── OrgVDC ───────────────────────────────────────────────────────────────────
export interface OrgVDC {
  id: string;
  tenant_id: string;
  name: string;
  cpu_limit: string;
  ram_limit: string;
  disk_limit: string;
  cpu_used: string;
  ram_used: string;
  disk_used: string;
  created_at: string;
}

// ─── Virtual Machine ──────────────────────────────────────────────────────────
export type VMStatus = 'running' | 'stopped' | 'pending' | 'error';

export interface VM {
  id: string;
  tenant_id: string;
  org_vdc_id: string;
  name: string;
  status: VMStatus;
  cpu: string;
  ram: string;
  disk: string;
  ip: string;
  os: string;
  created_at: string;
  owner_id: string;
}

// ─── Audit Log ────────────────────────────────────────────────────────────────
export interface AuditEntry {
  id: string;
  user_id: string;
  tenant_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: string;
  timestamp: string;
}

// ─── Stats ────────────────────────────────────────────────────────────────────
export interface ResourceStats {
  limit: number;
  used: number;
  free: number;
}

export interface AdminStats {
  tenants: { total: number; active: number };
  org_vdcs: { total: number };
  vms: { total: number; running: number; stopped: number };
  users: { total: number; admins: number; clients: number };
  resources: {
    cpu: ResourceStats;
    ram: ResourceStats;
    disk: ResourceStats;
  };
}

export interface ClientStats {
  org_vdcs: { total: number };
  vms: { total: number; running: number; stopped: number };
  resources: {
    cpu: ResourceStats;
    ram: ResourceStats;
    disk: ResourceStats;
  };
}
