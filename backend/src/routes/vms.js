const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { SHEETS } = require('../config/googleSheets');
const db = require('../services/sheetsService');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// VM statuses
const VM_STATUS = {
  RUNNING: 'running',
  STOPPED: 'stopped',
  PENDING: 'pending',
  ERROR: 'error',
};

// OS options available
const OS_OPTIONS = ['Ubuntu 22.04', 'Ubuntu 20.04', 'Debian 12', 'CentOS 8', 'Windows Server 2022'];

/**
 * Generate a random private IP in 10.x.x.x range
 */
function generateIP() {
  const b = Math.floor(Math.random() * 254) + 1;
  const c = Math.floor(Math.random() * 254) + 1;
  const d = Math.floor(Math.random() * 254) + 1;
  return `10.${b}.${c}.${d}`;
}

/**
 * GET /api/vms
 * Admin: all VMs | Client: own tenant's VMs
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    let vms;
    if (req.user.role === 'admin') {
      vms = await db.getAll(SHEETS.VMS);
    } else {
      vms = await db.findWhere(SHEETS.VMS, (v) => v.tenant_id === req.user.tenant_id);
    }
    res.json(vms);
  } catch (err) {
    console.error('Get VMs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/vms/:id
 * Get VM by id
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const vm = await db.findById(SHEETS.VMS, req.params.id);
    if (!vm) return res.status(404).json({ error: 'VM not found' });

    if (req.user.role !== 'admin' && vm.tenant_id !== req.user.tenant_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(vm);
  } catch (err) {
    console.error('Get VM error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/vms
 * Create a new VM (client within own org_vdc, admin anywhere)
 */
router.post(
  '/',
  authMiddleware,
  [
    body('name').notEmpty().withMessage('VM name required'),
    body('org_vdc_id').notEmpty().withMessage('org_vdc_id required'),
    body('cpu').isInt({ min: 1, max: 64 }).withMessage('cpu must be between 1 and 64'),
    body('ram').isInt({ min: 1, max: 512 }).withMessage('ram (GB) must be between 1 and 512'),
    body('disk').isInt({ min: 10, max: 10000 }).withMessage('disk (GB) must be between 10 and 10000'),
    body('os').notEmpty().withMessage('OS required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { name, org_vdc_id, cpu, ram, disk, os } = req.body;

      // Get OrgVDC
      const vdc = await db.findById(SHEETS.ORG_VDCS, org_vdc_id);
      if (!vdc) return res.status(404).json({ error: 'OrgVDC not found' });

      // Check tenant access
      if (req.user.role !== 'admin' && vdc.tenant_id !== req.user.tenant_id) {
        return res.status(403).json({ error: 'Forbidden: OrgVDC belongs to different tenant' });
      }

      // Check resource availability
      const cpuUsed = parseInt(vdc.cpu_used || 0);
      const ramUsed = parseInt(vdc.ram_used || 0);
      const diskUsed = parseInt(vdc.disk_used || 0);
      const cpuLimit = parseInt(vdc.cpu_limit);
      const ramLimit = parseInt(vdc.ram_limit);
      const diskLimit = parseInt(vdc.disk_limit);

      if (cpuUsed + parseInt(cpu) > cpuLimit) {
        return res.status(400).json({
          error: `Not enough CPU. Available: ${cpuLimit - cpuUsed} vCPU, Requested: ${cpu}`,
        });
      }
      if (ramUsed + parseInt(ram) > ramLimit) {
        return res.status(400).json({
          error: `Not enough RAM. Available: ${ramLimit - ramUsed}GB, Requested: ${ram}GB`,
        });
      }
      if (diskUsed + parseInt(disk) > diskLimit) {
        return res.status(400).json({
          error: `Not enough disk. Available: ${diskLimit - diskUsed}GB, Requested: ${disk}GB`,
        });
      }

      const newVm = {
        id: uuidv4(),
        tenant_id: vdc.tenant_id,
        org_vdc_id,
        name,
        status: VM_STATUS.RUNNING,
        cpu: String(cpu),
        ram: String(ram),
        disk: String(disk),
        ip: generateIP(),
        os: os || 'Ubuntu 22.04',
        created_at: new Date().toISOString(),
        owner_id: req.user.id,
      };

      await db.insert(SHEETS.VMS, newVm);

      // Update OrgVDC used resources
      await db.updateById(SHEETS.ORG_VDCS, org_vdc_id, {
        cpu_used: String(cpuUsed + parseInt(cpu)),
        ram_used: String(ramUsed + parseInt(ram)),
        disk_used: String(diskUsed + parseInt(disk)),
      });

      // Audit log
      await db.insert(SHEETS.AUDIT_LOG, {
        id: uuidv4(),
        user_id: req.user.id,
        tenant_id: vdc.tenant_id,
        action: 'CREATE_VM',
        resource_type: 'vm',
        resource_id: newVm.id,
        details: `Created VM: ${name} (${cpu} vCPU, ${ram}GB RAM, ${disk}GB Disk, OS: ${os})`,
        timestamp: new Date().toISOString(),
      });

      res.status(201).json(newVm);
    } catch (err) {
      console.error('Create VM error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * PATCH /api/vms/:id/status
 * Start/stop/restart VM
 */
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = Object.values(VM_STATUS);

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Valid: ${validStatuses.join(', ')}` });
    }

    const vm = await db.findById(SHEETS.VMS, req.params.id);
    if (!vm) return res.status(404).json({ error: 'VM not found' });

    if (req.user.role !== 'admin' && vm.tenant_id !== req.user.tenant_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await db.updateById(SHEETS.VMS, req.params.id, { status });

    await db.insert(SHEETS.AUDIT_LOG, {
      id: uuidv4(),
      user_id: req.user.id,
      tenant_id: vm.tenant_id,
      action: `VM_${status.toUpperCase()}`,
      resource_type: 'vm',
      resource_id: vm.id,
      details: `VM ${vm.name} status changed to ${status}`,
      timestamp: new Date().toISOString(),
    });

    res.json(updated);
  } catch (err) {
    console.error('Update VM status error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * DELETE /api/vms/:id
 * Delete VM and release resources
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const vm = await db.findById(SHEETS.VMS, req.params.id);
    if (!vm) return res.status(404).json({ error: 'VM not found' });

    if (req.user.role !== 'admin' && vm.tenant_id !== req.user.tenant_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await db.deleteById(SHEETS.VMS, req.params.id);

    // Release resources in OrgVDC
    const vdc = await db.findById(SHEETS.ORG_VDCS, vm.org_vdc_id);
    if (vdc) {
      await db.updateById(SHEETS.ORG_VDCS, vm.org_vdc_id, {
        cpu_used: String(Math.max(0, parseInt(vdc.cpu_used || 0) - parseInt(vm.cpu || 0))),
        ram_used: String(Math.max(0, parseInt(vdc.ram_used || 0) - parseInt(vm.ram || 0))),
        disk_used: String(Math.max(0, parseInt(vdc.disk_used || 0) - parseInt(vm.disk || 0))),
      });
    }

    await db.insert(SHEETS.AUDIT_LOG, {
      id: uuidv4(),
      user_id: req.user.id,
      tenant_id: vm.tenant_id,
      action: 'DELETE_VM',
      resource_type: 'vm',
      resource_id: vm.id,
      details: `Deleted VM: ${vm.name}`,
      timestamp: new Date().toISOString(),
    });

    res.json({ message: 'VM deleted successfully' });
  } catch (err) {
    console.error('Delete VM error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * GET /api/vms/os-options
 * Return available OS options
 */
router.get('/meta/os-options', (req, res) => {
  res.json(OS_OPTIONS);
});

module.exports = router;
