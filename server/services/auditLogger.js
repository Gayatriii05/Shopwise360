// Audit log writer — fire-and-forget by design: a failed write (e.g. schema drift)
// logs to stderr and NEVER breaks the API request that triggered it.
const pool = require('../config/db');

function auditLog({ actorId, actorRole, action, entityType, entityId = null, details = {} }) {
  return pool.query(
    `INSERT INTO audit_log (actor_id, actor_role, action, entity_type, entity_id, details)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [actorId, actorRole, action, entityType, entityId, JSON.stringify(details)]
  ).then(() => ({ ok: true }))
    .catch((err) => {
      console.error('[audit] write failed:', err.message);
      return { ok: false };
    });
}

// Convenience binding for authenticated route handlers.
function recordAudit(req, action, entityType, entityId, details = {}) {
  return auditLog({
    actorId: req.user.id,
    actorRole: req.user.role,
    action,
    entityType,
    entityId,
    details
  });
}

module.exports = { auditLog, recordAudit };