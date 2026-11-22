const { Schema, model } = require('mongoose');

const integrationSchema = new Schema({
  ownerUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    immutable: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 120,
  },
  status: {
    type: String,
    enum: ['active', 'disabled'],
    default: 'active',
  },
}, {
  collection: 'integrations',
  timestamps: true,
});

integrationSchema.index({ ownerUserId: 1, createdAt: -1 });

module.exports = model('Integration', integrationSchema);
