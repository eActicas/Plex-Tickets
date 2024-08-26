const mongoose = require('mongoose');

const schema = new mongoose.Schema ({
    guildID: String,
    url: String,
    port: String,
});

module.exports = mongoose.model('dashboard', schema);