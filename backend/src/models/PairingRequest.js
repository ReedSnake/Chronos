const { Schema, model } = require('mongoose');
const { API_SCOPES } = require('../constants/apiScopes');

const pairingRequestSchema = new Schema({
  integrationId: {
    type: Schema.Types.ObjectId,
    ref: 'Integration',
    required: true,
    immutable: true,
    index: true,
  },
  grantId: {
    type: Schema.Types.ObjectId,
    ref: 'IntegrationAccessGrant',
    default: null,
    index: true,
  },
  targetUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  targetEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    index: true,
  },
  requestedByApiKeyId: {
    type: Schema.Types.ObjectId,
    ref: 'ApiKey',
    required: true,
    immutable: true,
  },
  scopes: {
    type: [{ type: String, enum: API_SCOPES }],
    required: true,
    validate: {
      validator: (scopes) => Array.isArray(scopes)
        && scopes.length > 0
        && new Set(scopes).size === scopes.length,
      message: 'At least one unique scope is required',
    },
  },
  tokenHash: {
    type: String,
    required: true,
    unique: true,
    select: false,
    match: /^[a-f0-9]{64}$/,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'superseded', 'cancelled'],
    default: 'pending',
    required: true,
  },
  expiresAt: { type: Date, required: true },
  resolvedAt: { type: Date, default: null },
}, {
  collection: 'pairing_requests',
  timestamps: true,
});

// TTL cleanup is eventual; service queries always enforce expiresAt explicitly.
pairingRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
pairingRequestSchema.index({ targetUserId: 1, status: 1, expiresAt: 1 });
pairingRequestSchema.index({ targetEmail: 1, status: 1, expiresAt: 1 });

module.exports = model('PairingRequest', pairingRequestSchema);
