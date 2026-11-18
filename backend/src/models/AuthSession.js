const { Schema, model } = require('mongoose');

const authSessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  expiresAt: { type: Date, required: true },
}, { collection: 'auth_sessions', timestamps: true });

// TTL is for storage cleanup; authorization also checks the expiry on every request.
authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = model('AuthSession', authSessionSchema);
