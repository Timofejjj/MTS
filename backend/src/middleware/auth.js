const jwt = require('jsonwebtoken');

/**
 * Verify JWT token and attach user to request
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}

/**
 * Restrict access to admin role only
 */
function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
}

/**
 * Restrict access to a specific tenant (or admin can access all)
 */
function tenantAccess(req, res, next) {
  const tenantId = req.params.tenantId || req.body.tenant_id;

  if (req.user?.role === 'admin') {
    return next(); // Admins bypass tenant checks
  }

  if (req.user?.tenant_id !== tenantId) {
    return res.status(403).json({ error: 'Forbidden: Access to this tenant is not allowed' });
  }

  next();
}

module.exports = { authMiddleware, adminOnly, tenantAccess };
