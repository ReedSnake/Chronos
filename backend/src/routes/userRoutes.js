const { Router, raw } = require('express');
const userController = require('../controllers/userController');
const requireAuth = require('../middlewares/requireAuth');
const authOrigin = require('../middlewares/authOrigin');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();
router.get('/me', requireAuth, asyncHandler(userController.getMe));
router.patch('/me', authOrigin, requireAuth, asyncHandler(userController.updateMe));
router.put('/me/country', authOrigin, requireAuth, asyncHandler(userController.updateCountry));
router.patch('/me/settings', authOrigin, requireAuth, asyncHandler(userController.updateSettings));
router.put('/me/avatar', authOrigin, requireAuth, raw({ type: '*/*', limit: '2mb' }), asyncHandler(userController.uploadAvatar));
router.delete('/me/avatar', authOrigin, requireAuth, asyncHandler(userController.removeAvatar));
router.delete('/me', authOrigin, requireAuth, asyncHandler(userController.deleteMe));
router.get('/:id/avatar', asyncHandler(userController.getAvatar));
router.get('/:id', requireAuth, asyncHandler(userController.getById));
module.exports = router;
