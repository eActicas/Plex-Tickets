const Discord = require("discord.js");
const fs = require('fs');
const yaml = require("js-yaml")
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'))
const guildModel = require("../models/guildModel");
const { updateDailyStats } = require('../events/dailyStatsUpdater');

module.exports = async (client, interaction) => {

    // Add 1 to totalClaims everytime a ticket gets claimed
    const statsDB = await guildModel.findOne({ guildID: config.GuildID });
    statsDB.totalClaims++;
    await statsDB.save();

    const metricsToUpdate = ['totalClaims'];
    await updateDailyStats(config.GuildID, metricsToUpdate);

};