const { Router } = require('express');
const authController = require('../controllers/authController');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

// Placeholder route. Add authentication actions here as the module is implemented.
router.get('/status', asyncHandler(authController.getStatus));

module.exports = router;
