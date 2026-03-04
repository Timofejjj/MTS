const express = require('express');
const { SHEETS } = require('../config/googleSheets');
const db = require('../services/sheetsService');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/stats
 * Admin: platform-wide stats | Client: own tenant stats
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      // Platform-wide stats
      const [tenants, vdcs, vms, users] = await Promise.all([
        db.getAll(SHEETS.TENANTS),
        db.getAll(SHEETS.ORG_VDCS),
        db.getAll(SHEETS.VMS),
        db.getAll(SHEETS.USERS),
      ]);

      const totalCpuLimit = vdcs.reduce((s, v) => s + parseInt(v.cpu_limit || 0), 0);
      const totalRamLimit = vdcs.reduce((s, v) => s + parseInt(v.ram_limit || 0), 0);
      const totalDiskLimit = vdcs.reduce((s, v) => s + parseInt(v.disk_limit || 0), 0);
      const totalCpuUsed = vdcs.reduce((s, v) => s + parseInt(v.cpu_used || 0), 0);
      const totalRamUsed = vdcs.reduce((s, v) => s + parseInt(v.ram_used || 0), 0);
      const totalDiskUsed = vdcs.reduce((s, v) => s + parseInt(v.disk_used || 0), 0);

      return res.json({
        tenants: {
          total: tenants.length,
          active: tenants.filter((t) => t.status === 'active').length,
        },
        org_vdcs: { total: vdcs.length },
        vms: {
          total: vms.length,
          running: vms.filter((v) => v.status === 'running').length,
          stopped: vms.filter((v) => v.status === 'stopped').length,
        },
        users: {
          total: users.length,
          admins: users.filter((u) => u.role === 'admin').length,
          clients: users.filter((u) => u.role === 'client').length,
        },
        resources: {
          cpu: { limit: totalCpuLimit, used: totalCpuUsed, free: totalCpuLimit - totalCpuUsed },
          ram: { limit: totalRamLimit, used: totalRamUsed, free: totalRamLimit - totalRamUsed },
          disk: { limit: totalDiskLimit, used: totalDiskUsed, free: totalDiskLimit - totalDiskUsed },
        },
      });
    }

    // Client tenant stats
    const [vdcs, vms] = await Promise.all([
      db.findWhere(SHEETS.ORG_VDCS, (v) => v.tenant_id === req.user.tenant_id),
      db.findWhere(SHEETS.VMS, (v) => v.tenant_id === req.user.tenant_id),
    ]);

    const cpuLimit = vdcs.reduce((s, v) => s + parseInt(v.cpu_limit || 0), 0);
    const ramLimit = vdcs.reduce((s, v) => s + parseInt(v.ram_limit || 0), 0);
    const diskLimit = vdcs.reduce((s, v) => s + parseInt(v.disk_limit || 0), 0);
    const cpuUsed = vdcs.reduce((s, v) => s + parseInt(v.cpu_used || 0), 0);
    const ramUsed = vdcs.reduce((s, v) => s + parseInt(v.ram_used || 0), 0);
    const diskUsed = vdcs.reduce((s, v) => s + parseInt(v.disk_used || 0), 0);

    res.json({
      org_vdcs: { total: vdcs.length },
      vms: {
        total: vms.length,
        running: vms.filter((v) => v.status === 'running').length,
        stopped: vms.filter((v) => v.status === 'stopped').length,
      },
      resources: {
        cpu: { limit: cpuLimit, used: cpuUsed, free: cpuLimit - cpuUsed },
        ram: { limit: ramLimit, used: ramUsed, free: ramLimit - ramUsed },
        disk: { limit: diskLimit, used: diskUsed, free: diskLimit - diskUsed },
      },
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
