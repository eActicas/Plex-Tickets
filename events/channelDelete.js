const Discord = require("discord.js");
const fs = require('fs');
const yaml = require("js-yaml")
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'))
const guildModel = require("../models/guildModel");
const ticketModel = require("../models/ticketModel");

module.exports = async (client, channel) => {
  const ticketDB = await ticketModel.findOne({ channelID: channel.id });
  if(!ticketDB) return

  const statsDB = await guildModel.findOne({ guildID: config.GuildID });

  statsDB.openTickets--;
  ticketDB.status = 'Closed';
  ticketDB.closedAt = Date.now();

  await ticketDB.save();
  await statsDB.save();

};