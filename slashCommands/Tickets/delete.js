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
const dashboardModel = require("../../models/dashboardModel");

module.exports = {
    enabled: commands.Ticket.Delete.Enabled,
    data: new SlashCommandBuilder()
        .setName('delete')
        .setDescription(commands.Ticket.Delete.Description),
    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });
        const ticketDB = await ticketModel.findOne({ channelID: interaction.channel.id });
        if(!ticketDB) return interaction.editReply({ content: config.Locale.NotInTicketChannel, ephemeral: true })
    
        let supportRole = await utils.checkIfUserHasSupportRoles(interaction)
        
        if (!supportRole) {
          return interaction.editReply({ content: config.Locale.NoPermsMessage, ephemeral: true });
        }

        let ticketAuthor = client.users.cache.get(ticketDB.userID)
        const logEmbed = new Discord.EmbedBuilder()
        logEmbed.setColor("Red")
        logEmbed.setTitle(config.Locale.ticketForceDeleted)
        logEmbed.addFields([
            { name: `• ${config.Locale.logsDeletedBy}`, value: `> <@!${interaction.user.id}>\n> ${interaction.user.username}` },
            { name: `• ${config.Locale.logsTicketAuthor}`, value: `> <@!${ticketAuthor.id}>\n> ${ticketAuthor.username}` },
            { name: `• ${config.Locale.logsTicket}`, value:  `> #${interaction.channel.name}\n> ${ticketDB.ticketType}` },
          ])
        logEmbed.setTimestamp()
        logEmbed.setThumbnail(interaction.user.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 }))
        logEmbed.setFooter({ text: `${config.Locale.totalMessagesLog} ${ticketDB.messages}`, iconURL: `${interaction.user.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 })}` })
    
        const { attachment, timestamp } = await utils.saveTranscript(interaction)

        const dashboardExists = await utils.checkDashboard();
        const dashboardDB = await dashboardModel.findOne({ guildID: config.GuildID });

        let logsChannel; 
        if(!config.deleteTicket.ChannelID) logsChannel = interaction.guild.channels.cache.get(config.TicketSettings.LogsChannelID);
        if(config.deleteTicket.ChannelID) logsChannel = interaction.guild.channels.cache.get(config.deleteTicket.ChannelID);
    
        const embedOptions = { embeds: [logEmbed] };

        const shouldIncludeAttachment = ticketDB.messages >= config.TicketTranscriptSettings.MessagesRequirement && !dashboardExists && !config.TicketSettings.DeleteCommandTranscript

        if (shouldIncludeAttachment) {
            embedOptions.files = [attachment];
        }

              // Add "View Transcript" button if the dashboard exists
              if (dashboardExists && ticketDB.messages >= config.TicketTranscriptSettings.MessagesRequirement && config.TicketTranscriptSettings.TranscriptType === "HTML" && config.TicketTranscriptSettings.SaveInFolder === true ) {
                const viewTranscriptButton = new Discord.ButtonBuilder()
                    .setLabel(config.Locale.viewTranscriptButton)
                    .setStyle('Link')
                    .setURL(`${dashboardDB.url}/transcript?channelId=${ticketDB.channelID}&dateNow=${timestamp}`);
        
                const row = new Discord.ActionRowBuilder().addComponents(viewTranscriptButton);
        
                embedOptions.components = [row];
            }
        
        if(logsChannel && config.deleteTicket.Enabled) await logsChannel.send(embedOptions)

        let dTime = config.TicketSettings.DeleteTime * 1000 
        let deleteTicketCountdown = config.Locale.deletingTicketMsg.replace(/{time}/g, `${config.TicketSettings.DeleteTime}`);
        const delEmbed = new Discord.EmbedBuilder()
            .setDescription(deleteTicketCountdown)
            .setColor("Red")
        await interaction.editReply({ embeds: [delEmbed] })
    
        await setTimeout(() => interaction.channel.delete().catch(e => {}), dTime);

    }

}