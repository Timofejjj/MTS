const express = require('express');
const { SHEETS } = require('../config/googleSheets');
const db = require('../services/sheetsService');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/audit
 * Admin: all logs | Client: own tenant's logs
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    let logs;
    if (req.user.role === 'admin') {
      logs = await db.getAll(SHEETS.AUDIT_LOG);
    } else {
      logs = await db.findWhere(
        SHEETS.AUDIT_LOG,
        (l) => l.tenant_id === req.user.tenant_id || l.user_id === req.user.id
      );
    }

    // Sort by timestamp descending
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Optional: limit
    const limit = parseInt(req.query.limit) || 100;
    res.json(logs.slice(0, limit));
  } catch (err) {
    console.error('Get audit log error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
