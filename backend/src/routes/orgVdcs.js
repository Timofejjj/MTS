const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { SHEETS } = require('../config/googleSheets');
const db = require('../services/sheetsService');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/org-vdcs
 * Admin: all OrgVDCs | Client: own tenant's OrgVDCs
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    let vdcs;
    if (req.user.role === 'admin') {
      vdcs = await db.getAll(SHEETS.ORG_VDCS);
    } else {
      vdcs = await db.findWhere(SHEETS.ORG_VDCS, (v) => v.tenant_id === req.user.tenant_id);
    }
    res.json(vdcs);
  } catch (err) {
    console.error('Get org vdcs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/org-vdcs/:id
 * Get OrgVDC by id
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const vdc = await db.findById(SHEETS.ORG_VDCS, req.params.id);
    if (!vdc) return res.status(404).json({ error: 'OrgVDC not found' });

    if (req.user.role !== 'admin' && vdc.tenant_id !== req.user.tenant_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(vdc);
  } catch (err) {
    console.error('Get org vdc error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/org-vdcs
 * Admin only: create OrgVDC for a tenant
 */
router.post(
  '/',
  authMiddleware,
  adminOnly,
  [
    body('tenant_id').notEmpty().withMessage('tenant_id required'),
    body('name').notEmpty().withMessage('Name required'),
    body('cpu_limit').isInt({ min: 1 }).withMessage('cpu_limit must be positive integer'),
    body('ram_limit').isInt({ min: 1 }).withMessage('ram_limit must be positive integer (GB)'),
    body('disk_limit').isInt({ min: 1 }).withMessage('disk_limit must be positive integer (GB)'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { tenant_id, name, cpu_limit, ram_limit, disk_limit } = req.body;

      // Verify tenant exists
      const tenant = await db.findById(SHEETS.TENANTS, tenant_id);
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

      const newVdc = {
        id: uuidv4(),
        tenant_id,
        name,
        cpu_limit: String(cpu_limit),
        ram_limit: String(ram_limit),
        disk_limit: String(disk_limit),
        cpu_used: '0',
        ram_used: '0',
        disk_used: '0',
        created_at: new Date().toISOString(),
      };

      await db.insert(SHEETS.ORG_VDCS, newVdc);

      await db.insert(SHEETS.AUDIT_LOG, {
        id: uuidv4(),
        user_id: req.user.id,
        tenant_id,
        action: 'CREATE_ORG_VDC',
        resource_type: 'org_vdc',
        resource_id: newVdc.id,
        details: `Created OrgVDC: ${name} (CPU: ${cpu_limit}, RAM: ${ram_limit}GB, Disk: ${disk_limit}GB)`,
        timestamp: new Date().toISOString(),
      });

      res.status(201).json(newVdc);
    } catch (err) {
      console.error('Create org vdc error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * PUT /api/org-vdcs/:id
 * Admin only: update OrgVDC resource limits
 */
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, cpu_limit, ram_limit, disk_limit } = req.body;
    const updated = await db.updateById(SHEETS.ORG_VDCS, req.params.id, {
      ...(name && { name }),
      ...(cpu_limit !== undefined && { cpu_limit: String(cpu_limit) }),
      ...(ram_limit !== undefined && { ram_limit: String(ram_limit) }),
      ...(disk_limit !== undefined && { disk_limit: String(disk_limit) }),
    });

    res.json(updated);
  } catch (err) {
    console.error('Update org vdc error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * DELETE /api/org-vdcs/:id
 * Admin only: delete OrgVDC
 */
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await db.deleteById(SHEETS.ORG_VDCS, req.params.id);
    res.json({ message: 'OrgVDC deleted successfully' });
  } catch (err) {
    console.error('Delete org vdc error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

module.exports = router;
