const mongoose = require('mongoose');

const stickyMessageSchema = new mongoose.Schema({
    channelId: { type: String, required: true, unique: true },
    message: { type: String, required: true },
    msgCount: { type: Number, default: 0 },
  });

module.exports = mongoose.model('StickyMessage', stickyMessageSchema);