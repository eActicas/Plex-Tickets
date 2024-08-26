const mongoose = require('mongoose');

const schema = new mongoose.Schema ({
    guildID: String,
    channelID: String,
    userID: String,
    ticketType: String,
    button: String,
    msgID: String,
    claimed: Boolean,
    claimUser: String,
    messages: Number,
    lastMessageSent: Date,
    status: String,
    closeUserID: String,
    archiveMsgID: String,
    questions: [
        {
            customId: String,
            required: Boolean,
            question: String,
            style: String,
            response: String,
        },
    ],
    ticketCreationDate: Date,
    closedAt: Date,
    identifier: String,
    closeReason: String,
    closeNotificationTime: Number,
    closeNotificationMsgID: String,
    closeNotificationUserID: String,
    transcriptID: String,
    priority: String,
    priorityName: String,
    priorityCooldown: Date,
}, {
    timestamps: true,
});

module.exports = mongoose.model('ticket', schema);