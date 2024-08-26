/*
 _____  _             _______ _      _        _       
|  __ \| |           |__   __(_)    | |      | |      
| |__) | | _____  __    | |   _  ___| | _____| |_ ___ 
|  ___/| |/ _ \ \/ /    | |  | |/ __| |/ / _ \ __/ __|
| |    | |  __/>  <     | |  | | (__|   <  __/ |_\__ \
|_|    |_|\___/_/\_\    |_|  |_|\___|_|\_\___|\__|___/
                                        
Thank you for purchasing Plex Tickets!
If you find any issues, need support, or have a suggestion for the bot, please join our support server and create a ticket,

*/

const { SlashCommandBuilder } = require('@discordjs/builders');
const { Discord, EmbedBuilder } = require("discord.js");
const fs = require('fs');
const yaml = require("js-yaml")
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'))
const commands = yaml.load(fs.readFileSync('./commands.yml', 'utf8'))
const utils = require("../../utils.js");
const ticketModel = require("../../models/ticketModel");

module.exports = {
    enabled: commands.Ticket.Close.Enabled,
    data: new SlashCommandBuilder()
        .setName('close')
        .setDescription(commands.Ticket.Close.Description),
    async execute(interaction, client) {
    const ticketDB = await ticketModel.findOne({ channelID: interaction.channel.id });
    if(!ticketDB) return interaction.reply({ content: config.Locale.NotInTicketChannel, ephemeral: true })

    let supportRole = await utils.checkIfUserHasSupportRoles(interaction)

    if (config.TicketSettings.RestrictTicketClose && !supportRole) {
      return interaction.reply({ content: config.Locale.restrictTicketClose, ephemeral: true });
    }

    // set closerUserID in the tickets db
    await ticketModel.updateOne({ channelID: interaction.channel.id }, { $set: { closeUserID: interaction.user.id, closedAt: Date.now() } });

    await client.emit('ticketClose', interaction);

    }

}