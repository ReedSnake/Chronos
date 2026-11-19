const { Router } = require('express');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const asyncHandler = require('../utils/asyncHandler');
const authRateLimit = require('../middlewares/authRateLimit');
const authOrigin = require('../middlewares/authOrigin');
const requireAuth = require('../middlewares/requireAuth');

const router = Router();

router.get('/status', asyncHandler(authController.getStatus));
router.post('/register', authOrigin, authRateLimit({ limit: 5 }), asyncHandler(authController.register));
router.post('/resend-verification', authOrigin, authRateLimit({ limit: 5 }), asyncHandler(authController.resendVerification));
router.post('/verify-email', authOrigin, authRateLimit({ limit: 10 }), asyncHandler(authController.verifyEmail));
router.post('/login', authOrigin, authRateLimit({ limit: 10 }), asyncHandler(authController.login));
router.get('/me', requireAuth, asyncHandler(userController.getMe));
router.post('/logout', authOrigin, asyncHandler(authController.logout));

module.exports = router;
