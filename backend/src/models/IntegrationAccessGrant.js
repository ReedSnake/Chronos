const { Schema, model } = require('mongoose');
const { API_SCOPES } = require('../constants/apiScopes');

const integrationAccessGrantSchema = new Schema({
  integrationId: {
    type: Schema.Types.ObjectId,
    ref: 'Integration',
    required: true,
    immutable: true,
    index: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    immutable: true,
    index: true,
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
  status: {
    type: String,
    enum: ['pending', 'active', 'revoked'],
    required: true,
    default: 'pending',
  },
  requestedAt: { type: Date, required: true, default: Date.now },
  grantedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
}, {
  collection: 'integration_access_grants',
  timestamps: true,
});

integrationAccessGrantSchema.index({ integrationId: 1, userId: 1 }, { unique: true });
integrationAccessGrantSchema.index({ userId: 1, status: 1, updatedAt: -1 });

module.exports = model('IntegrationAccessGrant', integrationAccessGrantSchema);
