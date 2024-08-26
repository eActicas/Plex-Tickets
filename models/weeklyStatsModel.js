const mongoose = require('mongoose');

const dailyMetricsSchema = new mongoose.Schema({
  timestamp: { type: Date },
  totalTickets: { type: Number, default: 0 },
  ticketsClosed: { type: Number, default: 0 },
  totalMessages: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  totalClaims: { type: Number, default: 0 },
  totalSuggestions: { type: Number, default: 0 },
  totalSuggestionUpvotes: { type: Number, default: 0 },
  totalSuggestionDownvotes: { type: Number, default: 0 },
  usersJoined: { type: Number, default: 0 },
  usersLeft: { type: Number, default: 0 },
  newBans: { type: Number, default: 0 },
  newRoles: { type: Number, default: 0 },
});

const weeklyStatsSchema = new mongoose.Schema({
  weekStartDate: { type: Date, required: true, unique: true },
  dailyMetrics: [dailyMetricsSchema],
}, {
  timestamps: true, // %%__NONCE__%%
});
  

module.exports = mongoose.model('weeklyStat', weeklyStatsSchema);