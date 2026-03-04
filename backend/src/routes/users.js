const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { SHEETS } = require('../config/googleSheets');
const db = require('../services/sheetsService');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/users
 * Admin: all users | Client: own profile only
 */
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const users = await db.getAll(SHEETS.USERS);
    // Don't expose password hashes
    const safe = users.map(({ password_hash, ...u }) => u);
    res.json(safe);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/users
 * Admin only: create user with any role
 */
router.post(
  '/',
  authMiddleware,
  adminOnly,
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
    body('name').notEmpty().withMessage('Name required'),
    body('role').isIn(['admin', 'client']).withMessage('Role must be admin or client'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email, password, name, role, tenant_id } = req.body;

      const existing = await db.findOne(SHEETS.USERS, (u) => u.email === email);
      if (existing) {
        return res.status(409).json({ error: 'User with this email already exists' });
      }

      const password_hash = await bcrypt.hash(password, 10);
      const newUser = {
        id: uuidv4(),
        email,
        password_hash,
        role,
        tenant_id: tenant_id || '',
        name,
        created_at: new Date().toISOString(),
      };

      await db.insert(SHEETS.USERS, newUser);

      const { password_hash: _, ...safe } = newUser;
      res.status(201).json(safe);
    } catch (err) {
      console.error('Create user error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * PUT /api/users/:id
 * Admin: update any user | Client: update own profile
 */
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updates = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.body.tenant_id && req.user.role === 'admin') updates.tenant_id = req.body.tenant_id;
    if (req.body.role && req.user.role === 'admin') updates.role = req.body.role;
    if (req.body.password) {
      updates.password_hash = await bcrypt.hash(req.body.password, 10);
    }

    const updated = await db.updateById(SHEETS.USERS, req.params.id, updates);
    const { password_hash, ...safe } = updated;
    res.json(safe);
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * DELETE /api/users/:id
 * Admin only: delete user
 */
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    await db.deleteById(SHEETS.USERS, req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

module.exports = router;
