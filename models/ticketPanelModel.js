const mongoose = require('mongoose');

const schema = new mongoose.Schema ({
    guildID: String,
    msgID: String,
    selectMenuOptions: [],
});

module.exports = mongoose.model('ticketPanel', schema);