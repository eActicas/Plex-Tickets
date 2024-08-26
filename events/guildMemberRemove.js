const Discord = require("discord.js");
const fs = require('fs');
const yaml = require("js-yaml")
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'))
const ticketModel = require("../models/ticketModel");
const { updateDailyStats } = require('../events/dailyStatsUpdater');

module.exports = async (client, member) => {

    try {
        // Query the database for open tickets associated with the leaving member
        const userOpenTickets = await ticketModel.find({ userID: member.id, status: 'Open' });
    
        for (const ticket of userOpenTickets) {
          // Update the ticket and send an embed
          const logsChannel = member.guild.channels.cache.get(ticket.channelID);
    
          const ticketDeleteButton = new Discord.ButtonBuilder()
            .setCustomId('deleteTicket')
            .setLabel(config.Locale.deleteTicketButton)
            .setEmoji(config.ButtonEmojis.deleteTicket)
            .setStyle(config.ButtonColors.deleteTicket);
    
          const row = new Discord.ActionRowBuilder().addComponents(ticketDeleteButton);
    
          // Update the close reason and send the embed
          await ticketModel.findOneAndUpdate(
            { channelID: ticket.channelID },
            { closeReason: 'User left the server' }
          );
    
          const userLeftDescLocale = config.Locale.userLeftDescription.replace(/{username}/g, `${member.user.username}`);
          const embed = new Discord.EmbedBuilder()
            .setColor(config.EmbedColors)
            .setTitle(config.Locale.userLeftTitle)
            .setDescription(userLeftDescLocale)
            .setFooter({ text: `${member.user.username}`, iconURL: `${member.user.displayAvatarURL({ dynamic: true })}` })
            .setTimestamp();
    
          logsChannel.send({ embeds: [embed], components: [row] });
        }
      } catch (error) {
        console.error('Error handling member leave event:', error);
      }

      const metricsToUpdate = ['usersLeft'];
      await updateDailyStats(config.GuildID, metricsToUpdate);

    };