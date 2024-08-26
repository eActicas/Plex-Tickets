const { Discord, EmbedBuilder } = require("discord.js");
const fs = require('fs');
const yaml = require("js-yaml")
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'))
const color = require('ansi-colors');
const utils = require("../utils.js");
const ticketModel = require("../models/ticketModel");
const guildModel = require("../models/guildModel");
const { updateDailyStats } = require('../events/dailyStatsUpdater');

module.exports = async (client, message) => {
    if(!message.channel.type === 0) return;
    const ticketDB = await ticketModel.findOne({ channelID: message.channel.id });
    if(message.author.bot) return;


// WIP: Store all support users in userStats DB, to get specific user stats
    // let supportRole = utils.checkIfUserHasSupportRoles(message)
    // if(supportRole) {

    // }

// Custom Commands
if(config.CommandsEnabled) {
    config.CustomCommands.forEach(cmd => {

        let messageArray = message.content.split(" ");
        let command = messageArray[0].toLowerCase();
        messageArray.slice(1);
        let commandfile = command.slice(config.CommandsPrefix.length);
        if(message.content.startsWith(config.CommandsPrefix) && commandfile === cmd.command) {
            if(config.OnlyInTickets && !ticketDB) return;

          let logMsg = `\n\n[${new Date().toLocaleString()}] [CUSTOM COMMAND] Command: ${cmd.command}, User: ${message.author.username}`;
          fs.appendFile("./logs.txt", logMsg, (e) => { 
            if(e) console.log(e);
          });
  
          if(config.LogCommands) console.log(`${color.yellow(`[CUSTOM COMMAND] ${color.cyan(`${message.author.username}`)} used ${color.cyan(`${config.CommandsPrefix}${cmd.command}`)}`)}`);
  
          let respEmbed = new EmbedBuilder()
          .setColor(config.EmbedColors)
          .setDescription(`${cmd.response}`)
  
          if(cmd.deleteMsg) setTimeout(() => message.delete(), 100);
          if(cmd.replyToUser && cmd.Embed) message.reply({ embeds: [respEmbed] })
          if(cmd.replyToUser === false && cmd.Embed) message.channel.send({ embeds: [respEmbed] })
  
          if(cmd.replyToUser && cmd.Embed === false) message.reply({ content: `${cmd.response}` })
          if(cmd.replyToUser === false && cmd.Embed === false) message.channel.send({ content: `${cmd.response}` })
      }
})
}

// Count messages in tickets and update lastMessageSent, and check if alert command is active
if(ticketDB) {
  // Increment messages in the ticket
  if (!message.author.bot) {
    await ticketModel.findOneAndUpdate(
      { channelID: message.channel.id },
      { $set: { lastMessageSent: Date.now() }, $inc: { messages: 1 } },
      { new: true } // This option returns the modified document, not the original
    );
  }

  // Increment totalMessages in global stats
  await guildModel.findOneAndUpdate(
    { guildID: message.guild.id },
    { $inc: { totalMessages: 1 } }
  );

  const metricsToUpdate = ['totalMessages'];
  await updateDailyStats(config.GuildID, metricsToUpdate);

  // Alert command auto close, check for response in ticket
  if (config.TicketAlert.Enabled) {
    const filtered = await ticketModel.find({
      closeNotificationTime: { $exists: true, $ne: null },
      channelID: message.channel.id
    });

    for (const time of filtered) {
      if(!time) return;
      if(!time.channelID) return;
      if(time.closeNotificationTime === 0) return

      if(time.channelID === message.channel.id) {
      // Reset closeNotificationTime
      await ticketModel.findOneAndUpdate(
        { channelID: message.channel.id },
        { $unset: { closeReason: 1 }, $set: { closeNotificationTime: 0 } }
      );

      // Delete the notification message
      await message.channel.messages.fetch(time.closeNotificationMsgID).then(msg => {
        try {
          msg.delete();
        } catch (error) {
          console.error("Error deleting message:", error);
        }
      });
}

    }
  }
}

// Auto Responses
if (config.AutoResponse.Enabled && config.AutoResponse.Responses) {
  if (config.AutoResponse.OnlyInTickets && !ticketDB) {
    return;
  }

  const matchedWord = Object.keys(config.AutoResponse.Responses).find(o =>
    message.content.toLowerCase().includes(o.toLowerCase()) || message.content.toLowerCase().startsWith(o.toLowerCase())
  );

  if (matchedWord) {
    const responseMsg = config.AutoResponse.Responses[matchedWord];

    if (config.AutoResponse.MessageType === "EMBED") {
      const respEmbed = new EmbedBuilder()
        .setColor(config.EmbedColors)
        .setDescription(`<@!${message.author.id}>, ${responseMsg}`)
        .setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      message.reply({ embeds: [respEmbed] });
    } else if (config.AutoResponse.MessageType === "TEXT") {
      message.reply({ content: responseMsg });
    } else {
      console.log("Invalid message type for auto response message specified in the config!");
    }
  }
}


};