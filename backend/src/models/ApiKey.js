const { Schema, model } = require('mongoose');
const { API_SCOPES } = require('../constants/apiScopes');

const apiKeySchema = new Schema({
  integrationId: {
    type: Schema.Types.ObjectId,
    ref: 'Integration',
    required: true,
    immutable: true,
    index: true,
  },
  ownerUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    immutable: true,
    index: true,
  },
  label: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 120,
  },
  prefix: {
    type: String,
    required: true,
    unique: true,
    immutable: true,
    match: /^ck_[A-Za-z0-9_-]{12}$/,
  },
  secretHash: {
    type: String,
    required: true,
    select: false,
    match: /^[a-f0-9]{64}$/,
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
    enum: ['active', 'inactive', 'revoked'],
    default: 'active',
  },
  lastUsedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
}, {
  collection: 'api_keys',
  timestamps: true,
});

apiKeySchema.index({ integrationId: 1, createdAt: -1 });
apiKeySchema.index({ ownerUserId: 1, createdAt: -1 });

module.exports = model('ApiKey', apiKeySchema);
