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
    enabled: commands.Ticket.Rename.Enabled,
    data: new SlashCommandBuilder()
        .setName('rename')
        .setDescription(commands.Ticket.Rename.Description)
        .addStringOption(option => option.setName('name').setDescription('name').setRequired(true)),
    async execute(interaction, client) {
        const ticketDB = await ticketModel.findOne({ channelID: interaction.channel.id });
        if(!ticketDB) return interaction.reply({ content: config.Locale.NotInTicketChannel, ephemeral: true })
    
    let supportRole = await utils.checkIfUserHasSupportRoles(interaction)
    if(!supportRole) return interaction.reply({ content: config.Locale.NoPermsMessage, ephemeral: true })

    await interaction.deferReply();

    let newName = interaction.options.getString("name");
    interaction.channel.setName(`${newName}`)

    const log = new Discord.EmbedBuilder()
    .setColor("Orange")
    .setTitle(config.Locale.ticketRenameTitle)
    .addFields([
        { name: `• ${config.Locale.logsExecutor}`, value: `> <@!${interaction.user.id}>\n> ${interaction.user.username}` },
        { name: `• ${config.Locale.logsTicket}`, value: `> <#${interaction.channel.id}>\n> #${interaction.channel.name}` },
      ])
    .setTimestamp()
    .setThumbnail(interaction.user.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 }))
    .setFooter({ text: `${interaction.user.username}`, iconURL: `${interaction.user.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 })}` })

    let logsChannel; 
    if(!config.renameTicket.ChannelID) logsChannel = interaction.guild.channels.cache.get(config.TicketSettings.LogsChannelID);
    if(config.renameTicket.ChannelID) logsChannel = interaction.guild.channels.cache.get(config.renameTicket.ChannelID);

    let renameLocale = config.Locale.ticketRenamed.replace(/{newName}/g, `${newName}`);
    const embed = new Discord.EmbedBuilder()
    .setColor("Green")
    .setDescription(renameLocale)

    interaction.editReply({ embeds: [embed] })
    if (logsChannel && config.renameTicket.Enabled) logsChannel.send({ embeds: [log] })
    }

// %%__USER__%%

}