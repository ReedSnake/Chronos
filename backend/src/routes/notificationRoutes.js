const { Router } = require('express');
const requireAuth = require('../middlewares/requireAuth');
const authOrigin = require('../middlewares/authOrigin');
const asyncHandler = require('../utils/asyncHandler');
const notifications = require('../services/notificationService');
const router = Router();

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await notifications.list(req.authUser));
}));
router.patch('/read-all', authOrigin, requireAuth, asyncHandler(async (req, res) => {
  await notifications.markRead(req.authUser._id);
  res.json({ ok: true });
}));
router.patch('/:id/read', authOrigin, requireAuth, asyncHandler(async (req, res) => {
  await notifications.markRead(req.authUser._id, req.params.id);
  res.json({ ok: true });
}));
module.exports = router;
