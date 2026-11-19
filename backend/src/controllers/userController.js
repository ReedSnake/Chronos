const userService = require('../services/userService');
const {
  validateProfile, validateCountry, validateSettings, validateUserId,
} = require('../validators/userValidators');

function getMe(req, res) {
  res.status(200).json({ user: userService.ownProfile(req.authUser) });
}

async function getById(req, res) {
  res.status(200).json({ user: await userService.getPublicProfile(validateUserId(req.params.id)) });
}

async function updateMe(req, res) {
  res.status(200).json({ user: await userService.updateProfile(req.authUser._id, validateProfile(req.body)) });
}

async function updateCountry(req, res) {
  res.status(200).json({ user: await userService.updateCountry(req.authUser._id, validateCountry(req.body)) });
}

async function updateSettings(req, res) {
  res.status(200).json({ user: await userService.updateSettings(req.authUser._id, validateSettings(req.body)) });
}

async function uploadAvatar(req, res) {
  const user = await userService.setAvatar(req.authUser._id, req.body, req.get('content-type')?.split(';')[0].toLowerCase());
  res.status(200).json({ user });
}

async function getAvatar(req, res) {
  const avatar = await userService.getAvatar(validateUserId(req.params.id));
  res.set('Content-Type', avatar.contentType);
  res.set('Cache-Control', 'public, max-age=3600');
  res.set('X-Content-Type-Options', 'nosniff');
  res.status(200).send(avatar.data);
}

async function removeAvatar(req, res) {
  res.status(200).json({ user: await userService.removeAvatar(req.authUser._id) });
}

async function deleteMe(req, res) {
  await userService.deleteAccount(req.authUser._id, req, res);
  res.status(204).end();
}

module.exports = {
  getMe, getById, updateMe, updateCountry, updateSettings,
  uploadAvatar, getAvatar, removeAvatar, deleteMe,
};
