const mongoose = require('mongoose');

const schema = new mongoose.Schema ({
    guildID: String,
    totalTickets: Number,
    openTickets: Number,
    totalClaims: Number,
    totalMessages: Number,
    totalSuggestions: Number,
    totalSuggestionUpvotes: Number,
    totalSuggestionDownvotes: Number,
    totalReviews: Number,
    averageRating: Number,
    timesBotStarted: Number,
    averageCompletion: String,
    reviews: [],
});

module.exports = mongoose.model('guild', schema);