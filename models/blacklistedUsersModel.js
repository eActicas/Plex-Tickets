const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    blacklisted: { type: Boolean, default: false },
  }, {
    timestamps: true,
});

module.exports = mongoose.model('blacklistedUser', schema);