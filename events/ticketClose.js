const { Discord, ActionRowBuilder, ButtonBuilder, EmbedBuilder, StringSelectMenuBuilder, Message, MessageAttachment, ModalBuilder, TextInputBuilder } = require("discord.js");
const fs = require('fs');
const yaml = require("js-yaml")
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'))
const utils = require("../utils.js");
const guildModel = require("../models/guildModel");
const ticketModel = require("../models/ticketModel");
const reviewsModel = require("../models/reviewsModel");
const dashboardModel = require("../models/dashboardModel");
const { updateDailyStats } = require('../events/dailyStatsUpdater');

module.exports = async (client, interaction) => {
  if(interaction.customId !== 'closeTicket') await interaction.deferReply()

  const statsDB = await guildModel.findOne({ guildID: config.GuildID });
  const ticketDB = await ticketModel.findOne({ channelID: interaction.channel.id });
  const dashboardDB = await dashboardModel.findOne({ guildID: config.GuildID });

    async function CloseTicket() {
      const { attachment, timestamp } = await utils.saveTranscript(interaction)

        let ticketAuthor = await client.users.cache.get(ticketDB.userID)
        let closeUserID = await client.users.cache.get(ticketDB.closeUserID)
        let claimUser = await client.users.cache.get(ticketDB.claimUser)
        let totalMessages = await ticketDB.messages
      
          const logEmbed = new EmbedBuilder()
          logEmbed.setColor("Red")
          logEmbed.setTitle(config.Locale.ticketCloseTitle)

          if(closeUserID) logEmbed.addFields([
            { name: `• ${config.Locale.logsClosedBy}`, value: `> <@!${closeUserID.id}>\n> ${closeUserID.username}` },
          ])

          if(config.ArchiveTickets.Enabled) logEmbed.addFields([
            { name: `• ${config.Locale.logsDeletedBy}`, value: `> <@!${interaction.user.id}>\n> ${interaction.user.username}` },
          ])

          logEmbed.addFields([
            { name: `• ${config.Locale.logsTicketAuthor}`, value: `> <@!${ticketAuthor.id}>\n> ${ticketAuthor.username}` },
          ])


          if(claimUser && config.ClaimingSystem.Enabled) logEmbed.addFields([
            { name: `• ${config.Locale.ticketClaimedBy}`, value: `> <@!${claimUser.id}>\n> ${claimUser.username}` },
          ])

          logEmbed.addFields([
            { name: `• ${config.Locale.logsTicket}`, value: `> #${interaction.channel.name}\n> ${ticketDB.ticketType}` },
          ])
      
          logEmbed.setTimestamp()
          logEmbed.setThumbnail(interaction.user.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 }))
          logEmbed.setFooter({ text: `${config.Locale.totalMessagesLog} ${totalMessages}`, iconURL: `${interaction.user.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 })}` })

          let closeLogMsgID;
          let logsChannel; 
          if(!config.ticketClose.ChannelID) logsChannel = interaction.guild.channels.cache.get(config.TicketSettings.LogsChannelID);
          if(config.ticketClose.ChannelID) logsChannel = interaction.guild.channels.cache.get(config.ticketClose.ChannelID);

          const dashboardExists = await utils.checkDashboard();

          if (logsChannel && config.ticketClose.Enabled) {
              const embedOptions = { embeds: [logEmbed] };
          
              const shouldIncludeAttachment = totalMessages >= config.TicketTranscriptSettings.MessagesRequirement && !dashboardExists
          
              if (shouldIncludeAttachment) {
                  embedOptions.files = [attachment];
              }
          
              // Add "View Transcript" button if the dashboard exists
              if (dashboardExists && totalMessages >= config.TicketTranscriptSettings.MessagesRequirement && config.TicketTranscriptSettings.TranscriptType === "HTML" && config.TicketTranscriptSettings.SaveInFolder === true ) {
                  const viewTranscriptButton = new ButtonBuilder()
                      .setLabel(config.Locale.viewTranscriptButton)
                      .setStyle('Link')
                      .setURL(`${dashboardDB.url}/transcript?channelId=${ticketDB.channelID}&dateNow=${timestamp}`);
          
                  const row = new ActionRowBuilder().addComponents(viewTranscriptButton);
          
                  embedOptions.components = [row];
              }
          
              await logsChannel.send(embedOptions).then(async function (msg) {
                  closeLogMsgID = msg.id;
              });
          }

          client.emit('sendUserDM', ticketDB, attachment, closeLogMsgID, timestamp);

      let dTime = config.TicketSettings.DeleteTime * 1000 
      let deleteTicketCountdown = config.Locale.deletingTicketMsg.replace(/{time}/g, `${config.TicketSettings.DeleteTime}`);
      const delEmbed = new EmbedBuilder()
          .setDescription(deleteTicketCountdown)
          .setColor("Red")

      const ticketDeleteButton = new ButtonBuilder()
      .setCustomId('closeTicket')
      .setLabel(config.Locale.CloseTicketButton)
      .setStyle(config.ButtonColors.closeTicket)
      .setEmoji(config.ButtonEmojis.closeTicket)
      .setDisabled(true)
      
      let row1 = new ActionRowBuilder().addComponents(ticketDeleteButton);

      await interaction.channel.messages.fetch(ticketDB.msgID).then(msg => {
        msg.edit({ components: [row1] })
  })

    if(config.ArchiveTickets.Enabled === false) await interaction.followUp({ embeds: [delEmbed] })

      setTimeout(async () => {
        await interaction.channel.delete().catch(e => {})
    }, dTime)

    const metricsToUpdate = ['ticketsClosed'];
    await updateDailyStats(config.GuildID, metricsToUpdate);

      let logMsg = `\n\n[${new Date().toLocaleString()}] [TICKET CLOSED] A ticket has been successfully closed`;
      fs.appendFile("./logs.txt", logMsg, (e) => { 
        if(e) console.log(e);
      });

    // Sync globalStats.openTickets
    const openNow = await ticketModel.countDocuments({ status: 'Open', guildID: config.GuildID });

    if (statsDB.openTickets !== openNow) {
        statsDB.openTickets = openNow;
        await statsDB.save();
    }
    //

}

async function ArchiveTicket() {
  const tButton = ticketDB.button;
  const ticketAuthor = client.users.cache.get(ticketDB.userID);

  const reOpenButton = new ButtonBuilder()
      .setCustomId('reOpen')
      .setLabel(config.Locale.reOpenButton)
      .setEmoji(config.ButtonEmojis.reOpenTicket)
      .setStyle(config.ButtonColors.reOpenTicket);

  const transcriptButton = new ButtonBuilder()
      .setCustomId('createTranscript')
      .setLabel(config.Locale.transcriptButton)
      .setEmoji(config.ButtonEmojis.createTranscript)
      .setStyle(config.ButtonColors.createTranscript);

  const deleteButton = new ButtonBuilder()
      .setCustomId('deleteTicket')
      .setLabel(config.Locale.deleteTicketButton)
      .setEmoji(config.ButtonEmojis.deleteTicket)
      .setStyle(config.ButtonColors.deleteTicket);

  const row = new ActionRowBuilder().addComponents(reOpenButton, transcriptButton, deleteButton);

  const ticketClosedLocale = config.Locale.ticketClosedBy.replace(/{user}/g, `<@!${interaction.user.id}>`).replace(/{username}/g, `${interaction.user.username}`);

  const embed = new EmbedBuilder()
      .setColor("Red")
      .setTitle(config.Locale.ticketClosedCloseDM)
      .setDescription(ticketClosedLocale)
      .setFooter({ text: `${interaction.user.username}`, iconURL: `${interaction.user.displayAvatarURL({ dynamic: true })}` })
      .setTimestamp();

  if (config.ArchiveTickets.ViewClosedTicket === false) {
      await interaction.channel.permissionOverwrites.cache.filter(o => o.type === 1).map(o => o.delete());
  }

  if (config.ArchiveTickets.ViewClosedTicket) {
      await interaction.channel.permissionOverwrites.cache.filter(o => o.type === 1 && o.id !== client.user.id).map(o => o.edit({ SendMessages: false, ViewChannel: true }));
  }

  let msgID;
  await interaction.followUp({ embeds: [embed], components: [row], ephemeral: false, fetchReply: true }).then(async function (msg) { msgID = msg.id });

  ticketDB.archiveMsgID = msgID;
  await ticketDB.save();

  if (config.ArchiveTickets.TicketOpenLimit === false) {
      ticketDB.status = "Closed";
      await ticketDB.save();
  }

  if (config.ArchiveTickets.RenameClosedTicket) interaction.channel.setName(`closed-${ticketAuthor.username}`);

  switch (tButton) {
      case "TicketButton1":
      case "TicketButton2":
      case "TicketButton3":
      case "TicketButton4":
      case "TicketButton5":
      case "TicketButton6":
      case "TicketButton7":
      case "TicketButton8":
          const tButtonConfig = config[tButton];
          if (tButtonConfig && tButtonConfig.ClosedCategoryID) {
              await interaction.channel.setParent(tButtonConfig.ClosedCategoryID, { lockPermissions: false });
              await tButtonConfig.SupportRoles.forEach(async (sRoles) => {
                  const role = interaction.guild.roles.cache.get(sRoles);
                  if (role) {
                      await interaction.channel.permissionOverwrites.edit(role, {
                          SendMessages: false,
                          ViewChannel: true
                      });
                  }
              });
          }
          break;
  }
}

      // If ArchiveTickets is enabled
      if(config.ArchiveTickets.Enabled === true && interaction.customId === 'deleteTicket') {
        CloseTicket()

      } else if(config.ArchiveTickets.Enabled === true && interaction.customId !== 'deleteTicket') {
        ArchiveTicket()

      } else if(config.ArchiveTickets.Enabled === false) {
        CloseTicket()
      }

};