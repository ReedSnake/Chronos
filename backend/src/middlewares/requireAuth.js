const authService = require('../services/authService');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

module.exports = asyncHandler(async (req, res, next) => {
  const user = await authService.findAuthenticatedUser(req);
  if (!user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  req.authUser = user;
  next();
});
