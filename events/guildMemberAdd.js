const Discord = require("discord.js");
const fs = require('fs');
const yaml = require("js-yaml")
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'))
const { updateDailyStats } = require('../events/dailyStatsUpdater');

module.exports = async (client, member) => {

    const metricsToUpdate = ['usersJoined'];
    await updateDailyStats(config.GuildID, metricsToUpdate);

    };