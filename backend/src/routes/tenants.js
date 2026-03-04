const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { SHEETS } = require('../config/googleSheets');
const db = require('../services/sheetsService');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/tenants
 * Admin: get all tenants | Client: get own tenant
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const tenants = await db.getAll(SHEETS.TENANTS);
      return res.json(tenants);
    }

    // Client sees only their tenant
    if (!req.user.tenant_id) {
      return res.json(null);
    }
    const tenant = await db.findById(SHEETS.TENANTS, req.user.tenant_id);
    return res.json(tenant);
  } catch (err) {
    console.error('Get tenants error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/tenants/:id
 * Get tenant by id (admin or own tenant)
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.tenant_id !== req.params.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const tenant = await db.findById(SHEETS.TENANTS, req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    res.json(tenant);
  } catch (err) {
    console.error('Get tenant error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/tenants
 * Admin only: create a new tenant (organization)
 */
router.post(
  '/',
  authMiddleware,
  adminOnly,
  [
    body('name').notEmpty().withMessage('Tenant name required'),
    body('contact_email').isEmail().withMessage('Valid contact email required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { name, contact_email, description } = req.body;

      const newTenant = {
        id: uuidv4(),
        name,
        status: 'active',
        created_at: new Date().toISOString(),
        contact_email,
        description: description || '',
      };

      await db.insert(SHEETS.TENANTS, newTenant);

      // Log action
      await db.insert(SHEETS.AUDIT_LOG, {
        id: uuidv4(),
        user_id: req.user.id,
        tenant_id: newTenant.id,
        action: 'CREATE_TENANT',
        resource_type: 'tenant',
        resource_id: newTenant.id,
        details: `Created tenant: ${name}`,
        timestamp: new Date().toISOString(),
      });

      res.status(201).json(newTenant);
    } catch (err) {
      console.error('Create tenant error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * PUT /api/tenants/:id
 * Admin only: update tenant
 */
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, status, contact_email, description } = req.body;
    const updated = await db.updateById(SHEETS.TENANTS, req.params.id, {
      ...(name && { name }),
      ...(status && { status }),
      ...(contact_email && { contact_email }),
      ...(description !== undefined && { description }),
    });

    res.json(updated);
  } catch (err) {
    console.error('Update tenant error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * DELETE /api/tenants/:id
 * Admin only: delete tenant
 */
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await db.deleteById(SHEETS.TENANTS, req.params.id);
    res.json({ message: 'Tenant deleted successfully' });
  } catch (err) {
    console.error('Delete tenant error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

module.exports = router;
