const { validationResult } = require('express-validator');

// Consistent 4xx error shape for validation failures across all routes:
//   { error: "<first message>", errors: [{ field, msg }] }
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array().map((e) => ({ field: e.path || e.param, msg: e.msg }));
    return res.status(400).json({ error: details[0].msg, errors: details });
  }
  next();
}

module.exports = { handleValidation };