const { Schema, model } = require('mongoose');

const avatarSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  contentType: { type: String, required: true, enum: ['image/jpeg', 'image/png', 'image/webp'] },
  data: { type: Buffer, required: true },
}, { collection: 'user_avatars', timestamps: true });

module.exports = model('Avatar', avatarSchema);
