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
const Discord = require ("discord.js")
const fs = require('fs');
const yaml = require("js-yaml")
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'))
const commands = yaml.load(fs.readFileSync('./commands.yml', 'utf8'))
const utils = require("../../utils.js");
const ticketModel = require("../../models/ticketModel");

module.exports = {
    enabled: commands.Ticket.Pin.Enabled,
    data: new SlashCommandBuilder()
        .setName('pin')
        .setDescription(commands.Ticket.Pin.Description),
    async execute(interaction, client) {
        const ticketDB = await ticketModel.findOne({ channelID: interaction.channel.id });
        if(!ticketDB) return interaction.reply({ content: config.Locale.NotInTicketChannel, ephemeral: true })
    
        let supportRole = await utils.checkIfUserHasSupportRoles(interaction)
        if(!supportRole) return interaction.reply({ content: config.Locale.NoPermsMessage, ephemeral: true })
    
        if(interaction.channel.name.startsWith("📌")) return interaction.reply({ content: config.Locale.ticketAlreadyPinned, ephemeral: true})
    
        await interaction.deferReply();

        interaction.channel.setPosition(1)
        interaction.channel.setName(`📌${interaction.channel.name}`)
    
        const embed = new Discord.EmbedBuilder()
        .setColor("Green")
        .setDescription(config.Locale.ticketPinned)
        interaction.editReply({ embeds: [embed] })

    }

}