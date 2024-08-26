const mongoose = require('mongoose');

const schema = new mongoose.Schema ({
    ticketCreatorID: String,
    guildID: String,
    ticketChannelID: String,
    userID: String,
    tCloseLogMsgID: String,
    reviewDMUserMsgID: String,
    rating: Number,
    reviewMessage: String,
    category: String,
    totalMessages: Number,
    transcriptID: String,
    alreadyRated: Boolean,
}, {
    timestamps: true,
});

module.exports = mongoose.model('review', schema);