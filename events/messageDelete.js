const { Discord, EmbedBuilder } = require("discord.js");
const fs = require('fs');
const yaml = require("js-yaml")
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'))
const color = require('ansi-colors');
const utils = require("../utils.js");
const guildModel = require("../models/guildModel");
const suggestionModel = require("../models/suggestionModel");


module.exports = async (client, message) => {

    // Check if the deleted message is in the suggestion database, and if it is, delete it from the db
    const suggestion = await suggestionModel.findOne({ msgID: message.id });
    if (suggestion) await suggestionModel.findOneAndDelete({ msgID: message.id });

}