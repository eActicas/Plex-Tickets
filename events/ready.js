const fs = require('fs');
const yaml = require("js-yaml")
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'))
const color = require('ansi-colors');
const botVersion = require('../package.json');
const utils = require("../utils.js");
const Discord = require("discord.js");
const ms = require('ms');
const mongoose = require("mongoose");
const guildModel = require("../models/guildModel");
const ticketModel = require("../models/ticketModel");
const reviewsModel = require("../models/reviewsModel");
const weeklyStats = require("../models/weeklyStatsModel");
const dashboardModel = require("../models/dashboardModel");

module.exports = async client => {
    let guild = await client.guilds.cache.get(config.GuildID)
    if(!guild) {
        await console.log('\x1b[31m%s\x1b[0m', `[ERROR] The guild ID specified in the config is invalid or the bot is not in the server!\nYou can use the link below to invite the bot to your server:\nhttps://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`)
        await process.exit()
    }

    const connectToMongoDB = async () => {
      try {
        if (config.MongoURI) await mongoose.set('strictQuery', false);
    
        if (config.MongoURI) {
          await mongoose.connect(config.MongoURI);
        } else {
          throw new Error('[ERROR] MongoDB Connection String is not specified in the config! (MongoURI)');
        }
      } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `[ERROR] Failed to connect to MongoDB: ${error.message}\n${error.stack}`);
    
        if (error.message.includes('authentication failed')) {
          await console.error('Authentication failed. Make sure to check if you entered the correct username and password in the connection URL.');
          await process.exit(1)
        } else if (error.message.includes('network error')) {
          await console.error('Network error. Make sure the MongoDB server is reachable and the connection URL is correct.');
          await process.exit(1)
        } else if (error.message.includes('permission denied')) {
          await console.error('Permission denied. Make sure the MongoDB cluster has the necessary permissions to read and write.');
          await process.exit(1)
        } else {
          await console.error('An unexpected error occurred. Check the MongoDB connection URL and credentials.');
          await process.exit(1)
        }
      }
    };
    connectToMongoDB();


// Create guild model if it doesn't exist and save to db
const gModel = await guildModel.findOne({ guildID: config.GuildID });
if (!gModel || gModel?.length == 0) {
  const newModel = new guildModel({
    guildID: config.GuildID,
    totalTickets: 0,
    openTickets: 0,
    totalClaims: 0,
    totalMessages: 0,
    totalSuggestions: 0,
    totalSuggestionUpvotes: 0,
    totalSuggestionDownvotes: 0,
    totalReviews: 0,
    averageRating: 0.0,
    timesBotStarted: 0,
    averageCompletion: "N/A",
    ratings: []
  });
  await newModel.save();
}


    const statsDB = await guildModel.findOne({ guildID: config.GuildID });

    // Sync globalStats.openTickets
    const openNow = await ticketModel.countDocuments({ status: 'Open', guildID: config.GuildID });

    if (statsDB.openTickets !== openNow) {
        statsDB.openTickets = openNow;
        await statsDB.save();
    }
    //


// bot activity
let activType;

switch (config.BotActivitySettings.Type) {
  case "WATCHING":
    activType = Discord.ActivityType.Watching;
    break;
  case "PLAYING":
    activType = Discord.ActivityType.Playing;
    break;
  case "COMPETING":
    activType = Discord.ActivityType.Competing;
    break;
}

if (config.BotActivitySettings.Enabled && config.BotActivitySettings.Statuses?.length > 0) {
  let index = 0;

  
  const setActivity = async () => {
    client.user.setActivity(
      config.BotActivitySettings.Statuses[index]
        .replace(/{total-users}/g, `${guild.memberCount.toLocaleString('en-US')}`)
        .replace(/{total-tickets}/g, `${statsDB.totalTickets.toLocaleString('en-US')}`)
        .replace(/{total-channels}/g, `${client.channels.cache.size}`)
        .replace(/{open-tickets}/g, `${statsDB.openTickets.toLocaleString('en-US')}`)
        .replace(/{total-messages}/g, `${statsDB.totalMessages.toLocaleString('en-US')}`)
        .replace(/{average-rating}/g, `${await utils.averageRating(client)}`)
        .replace(/{average-completion}/g, `${statsDB.averageCompletion}`),
      { type: activType }
    );
    index = (index + 1) % config.BotActivitySettings.Statuses.length;
  };

  setActivity(); // Set initial activity

  setInterval(setActivity, config.BotActivitySettings.Interval * 1000);
} else if (config.BotActivitySettings.Enabled && config.BotActivitySettings.Statuses?.length === 1) {
  client.user.setActivity(
    config.BotActivitySettings.Statuses[0]
      .replace(/{total-users}/g, `${guild.memberCount.toLocaleString('en-US')}`)
      .replace(/{total-tickets}/g, `${statsDB.totalTickets.toLocaleString('en-US')}`)
      .replace(/{total-channels}/g, `${client.channels.cache.size}`)
      .replace(/{open-tickets}/g, `${statsDB.openTickets.toLocaleString('en-US')}`)
      .replace(/{total-messages}/g, `${statsDB.totalMessages.toLocaleString('en-US')}`)
      .replace(/{average-rating}/g, `${await utils.averageRating(client)}`)
      .replace(/{average-completion}/g, `${statsDB.averageCompletion}`),
    { type: activType }
  );
}
//

    client.guilds.cache.forEach(guild => {
        if(!config.GuildID.includes(guild.id)) {
        guild.leave();
        console.log('\x1b[31m%s\x1b[0m', `[INFO] Someone tried to invite the bot to another server! I automatically left it (${guild.name})`)
        }
    })
    if (guild && !guild.members.me.permissions.has("Administrator")) {
        console.log('\x1b[31m%s\x1b[0m', `[ERROR] The bot doesn't have enough permissions! Please give the bot ADMINISTRATOR permissions in your server or it won't function properly!`)
    }

let dashboardExists = await utils.checkDashboard();
    // BETA NOTICE
    // console.log(color.yellow.bold("NOTICE:"));
    // console.log(color.yellow.bold("You are currently using a beta version of Plex Tickets."));
    // console.log(color.yellow.bold("Please report bugs and provide feedback in our Discord server"));

    await console.log("――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――");
    await console.log("                                                                          ");
    if(config.LicenseKey) await console.log(`${color.green.bold.underline(`Plex Tickets v${botVersion.version} is now Online!`)} (${color.gray(`${config.LicenseKey.slice(0, -10)}`)})`);
    if(!config.LicenseKey) await console.log(`${color.green.bold.underline(`Plex Tickets v${botVersion.version} is now Online! `)}`);
    //await console.log("                                                                          ");
    await console.log(`• Join our discord server for support, ${color.cyan(`discord.gg/plexdev`)}`);
    await console.log(`• By using this bot you agree to all terms located here, ${color.yellow(`plexdevelopment.net/tos`)}`);
    await console.log(`• Addons for the bot can be found here, ${color.yellow(`plexdevelopment.net/store`)}`);
    if(config.Statistics) await console.log("                                                                          ");
    if(config.Statistics) await console.log(`${color.green.bold.underline(`Statistics:`)}`);
    if(config.Statistics) await console.log(`• The bot has been started a total of ${color.cyan.underline(`${statsDB.timesBotStarted.toLocaleString('en-US')}` )} times.`);
    if(config.Statistics) await console.log(`• A total of ${color.cyan.underline(`${statsDB.totalTickets.toLocaleString('en-US')}` )} tickets have been created.`);
    if(config.Statistics) await console.log(`• There are currently ${color.cyan.underline(`${statsDB.openTickets}` )} open tickets.`);
    if(config.Statistics) await console.log(`• A total of ${color.cyan.underline(`${statsDB.totalMessages.toLocaleString('en-US')}` )} messages have been sent in tickets.`);
    if(config.LicenseKey) await console.log("                                                                          ");
    if(config.LicenseKey) await console.log(`${color.green.bold.underline(`Source Code:`)}`);
    if(config.LicenseKey) await console.log(`• You can buy the full source code at ${color.yellow(`plexdevelopment.net/store/ptsourcecode`)}`);
    if(config.LicenseKey) await console.log(`• Use code ${color.green.bold.underline(`PLEX`)} for 10% OFF!`);
    if(dashboardExists) await console.log("                                                                          ");
    if(dashboardExists) await console.log(`${color.green.bold.underline(`Dashboard:`)}`);
    if(dashboardExists) await console.log(`• Dashboard addon has been detected and successfully loaded.`);
    if(!dashboardExists) await console.log("                                                                          ");
    if (!dashboardExists) await console.log(`${color.red.bold.underline(`Dashboard not detected:`)}`);
    if (!dashboardExists) await console.log(`• The dashboard unlocks additional features, including:`);
    if (!dashboardExists) await console.log(`  - User interface`);
    if (!dashboardExists) await console.log(`  - Viewing ticket transcripts online`);
    if (!dashboardExists) await console.log(`  - Viewing ticket history`);
    if (!dashboardExists) await console.log(`  - Viewing ticket reviews`);
    if (!dashboardExists) await console.log(`  - Managing user/role blacklists`);
    if (!dashboardExists) await console.log(`  - Embed Builder with live preview`);
    if (!dashboardExists) await console.log(`  - Status alerts for Websites, Servers, Bots`);
    if (!dashboardExists) await console.log(`  - Detailed analytics and statistics`);
    if (!dashboardExists) await console.log(`  - and more..`);
    if (!dashboardExists) await console.log(`• Explore these features and more by purchasing the dashboard addon at ${color.yellow(`plexdevelopment.net/store/dashboard`)}`);
    //const expirationDate = new Date("2023-07-31");
    //if(config.LicenseKey && new Date() <= expirationDate) await console.log(`\n${color.blue.bold.underline(`LIMITED TIME (07/31/2023):`)} \nGet all of our bot's full source codes in a bundle for a discounted price! \n- Plex Tickets\n- Plex Bot\n- Plex Licenses\n${color.yellow(`plexdevelopment.net/store/bundle`)}`);
    await console.log("                                                                          ");
    await console.log("――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――");
    //if(config.OwnerID) await console.log(`${color.yellow.bold(`• NOTICE:\nMessage commands will be removed from the bot soon!`)}`)
    //if(config.OwnerID) await console.log("                                                                          ");
    await utils.checkConfig(client)

    let logMsg = `\n\n[${new Date().toLocaleString()}] [READY] Bot is now ready!`;
    fs.appendFile("./logs.txt", logMsg, (e) => { 
      if(e) console.log(e);
    });

// Update channel stats
setInterval(async function() {

  const statsDB = await guildModel.findOne({ guildID: config.GuildID });

if(config.TotalTickets.Enabled) {
  let channel = guild.channels.cache.get(config.TotalTickets.ChannelID)
  let totalTicketsCountMsg = config.TotalTickets.ChannelName.replace(/{total-tickets}/g, `${statsDB.totalTickets.toLocaleString('en-US')}`)
  if (channel) channel.setName(totalTicketsCountMsg).catch(error => console.log(error));
}

if(config.OpenTickets.Enabled) {
  let channel = guild.channels.cache.get(config.OpenTickets.ChannelID)
  let openTicketsCountMsg = config.OpenTickets.ChannelName.replace(/{open-tickets}/g, `${statsDB.openTickets.toLocaleString('en-US')}`)
  if (channel) channel.setName(openTicketsCountMsg).catch(error => console.log(error));
}

if(config.AverageRating.Enabled) {
  const averageRating = await utils.averageRating(client);

  let channel = guild.channels.cache.get(config.AverageRating.ChannelID)
  let averageRatingMsg = config.AverageRating.ChannelName.replace(/{average-rating}/g, `${averageRating}`)
  if (channel) channel.setName(averageRatingMsg).catch(error => console.log(error));
}

if(config.AverageCompletion.Enabled) {
  let channel = guild.channels.cache.get(config.AverageCompletion.ChannelID)
  let averageCompletiongMsg = config.AverageCompletion.ChannelName.replace(/{average-completion}/g, `${statsDB.averageCompletion}`)
  if (channel) channel.setName(averageCompletiongMsg).catch(error => console.log(error));
}

// Alert Command notification automatically close ticket
if(config.TicketAlert.Enabled) {

const filtered = await ticketModel.find({ closeNotificationTime: { $exists: true } });
if (!filtered || filtered.length === 0) return;

if(!filtered) return
filtered.forEach(async time => {
  if(!time) return;
  if(!time.channelID) return;
  if(time.closeNotificationTime === 0 || !time.closeNotificationTime) return

  let date1 = new Date(time.closeNotificationTime);
  let date2 = new Date();

  let timeDifference = Math.abs(date1 - date2);
  let minutes = Math.floor(timeDifference / (1000 * 60));
  let ticketAlertTime = config.TicketAlert.Time;
  let timeValue = ms(ticketAlertTime) / (1000 * 60);

if(minutes > timeValue) {

  let ticketAuthor = await client.users.cache.get(time.userID)
  let closeUserID = await client.users.cache.get(time.closeUserID)
  let claimUser = await client.users.cache.get(time.claimUser)
  let totalMessages = await time.messages
  //let ticketCloseReason = await time.closeReason
  let channel = await guild.channels.cache.get(time.channelID)

  if(!channel || !closeUserID || !ticketAuthor) return

  const { attachment, timestamp } = await utils.saveTranscriptAlertCmd(channel)

    const logEmbed = new Discord.EmbedBuilder()
    logEmbed.setColor("Red")
    logEmbed.setTitle(config.Locale.ticketCloseTitle)

    if(closeUserID) logEmbed.addFields([
      { name: `• ${config.Locale.logsClosedBy}`, value: `> <@!${closeUserID.id}>\n> ${closeUserID.username}\n> 🕑 Automatically closed due to inactivity \`\`(/alert)\`\`` },
    ])

    logEmbed.addFields([
      { name: `• ${config.Locale.logsTicketAuthor}`, value: `> <@!${ticketAuthor.id}>\n> ${ticketAuthor.username}` },
    ])

    if(claimUser && config.ClaimingSystem.Enabled) logEmbed.addFields([
      { name: `• ${config.Locale.ticketClaimedBy}`, value: `> <@!${claimUser.id}>\n> ${claimUser.username}` },
    ])

    logEmbed.addFields([
      { name: `• ${config.Locale.logsTicket}`, value: `> #${channel.name}\n> ${time.ticketType}` },
    ])

    logEmbed.setTimestamp()
    logEmbed.setThumbnail(closeUserID.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 }))
    logEmbed.setFooter({ text: `${config.Locale.totalMessagesLog} ${totalMessages}`, iconURL: `${closeUserID.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 })}` })

    const embedOptions = { embeds: [logEmbed] };
    const dashboardDB = await dashboardModel.findOne({ guildID: config.GuildID });

    const shouldIncludeAttachment = totalMessages >= config.TicketTranscriptSettings.MessagesRequirement && !dashboardExists

    if (shouldIncludeAttachment) {
      embedOptions.files = [attachment];
  }

              // Add "View Transcript" button if the dashboard exists
              if (dashboardExists && totalMessages >= config.TicketTranscriptSettings.MessagesRequirement && config.TicketTranscriptSettings.TranscriptType === "HTML" && config.TicketTranscriptSettings.SaveInFolder === true ) {
                const viewTranscriptButton = new Discord.ButtonBuilder()
                    .setLabel(config.Locale.viewTranscriptButton)
                    .setStyle('Link')
                    .setURL(`${dashboardDB.url}/transcript?channelId=${time.channelID}&dateNow=${timestamp}`);
        
                const row = new Discord.ActionRowBuilder().addComponents(viewTranscriptButton);
        
                embedOptions.components = [row];
            }

    let closeLogMsgID;
    let logsChannel; 
    if(!config.ticketClose.ChannelID) logsChannel = guild.channels.cache.get(config.TicketSettings.LogsChannelID);
    if(config.ticketClose.ChannelID) logsChannel = guild.channels.cache.get(config.ticketClose.ChannelID);

    if(logsChannel && config.ticketClose.Enabled) await logsChannel.send(embedOptions).then(async function(msg) { closeLogMsgID = msg.id })

    client.emit('sendUserDM', time, attachment, closeLogMsgID);

    await channel.delete().catch(e => {})

    await ticketModel.updateOne(
      { channelID: time.channelID },
      {
        $set: {
          closeUserID: "alert", 
        },
        $unset: {
          closeNotificationTime: 1,
          closeNotificationMsgID: 1,
          closeNotificationUserID: 1
        }
      }
    );

}
})
}


// Calculate average ticket completion time
const formatDuration = (milliseconds) => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

const calculateAverageCompletionTime = async () => {
  const result = await ticketModel.aggregate([
    {
      $match: {
        closedAt: { $exists: true, $type: 'date' }, // Filter out documents without a valid closedAt date
        ticketCreationDate: { $exists: true, $type: 'date' }, // Filter out documents without a valid ticketCreationDate
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: { $subtract: ['$closedAt', '$ticketCreationDate'] } },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        average: { $divide: ['$total', '$count'] },
      },
    },
  ]);

  if (result.length > 0) {
    const averageCompletionTime = result[0].average;
    const formattedDuration = formatDuration(averageCompletionTime);
    return formattedDuration;
  }

  return null;
};

let completionTime = await calculateAverageCompletionTime();

statsDB.averageCompletion = `${completionTime}`;
await statsDB.save();

}, 300000);
// 300000

// Check and update ticket statuses on bot start
try {
  const channelsInServer = guild.channels.cache.filter(c => c.type === 0);
  const ticketChannelsInDB = await ticketModel.find({ guildID: config.GuildID });

  for (const ticketInDB of ticketChannelsInDB) {
    const channelExists = channelsInServer.some(c => String(c.id) === String(ticketInDB.channelID));

    // Check if a ticket is found in the database for the current channel
    if (!channelExists) {
      // If the ticket channel doesn't exist in the server, update its status to closed
      ticketInDB.status = 'Closed';
      await ticketInDB.save();
    }
  }
} catch (error) {
  console.error('Error checking and updating ticket statuses on bot start:', error);
}


// Function to clean up old documents from the database based on the configuration
async function cleanUpOldDocuments(collection, maxAgeInMonths) {
  const maxAge = new Date();
  maxAge.setMonth(maxAge.getMonth() - maxAgeInMonths);

  try {
      // Find and delete documents older than maxAge
      const result = await collection.deleteMany({
          updatedAt: { $lt: maxAge },
      });

      if(result.deletedCount > 1) console.log(`[DATABASE CLEANUP] ${result.deletedCount} documents deleted for collection: ${collection.modelName}.`);
  } catch (error) {
      console.error(`Error cleaning up old documents for collection ${collection.modelName}:`, error);
  }
}

// Clean up based on the configuration
if (config.cleanUpData.tickets.enabled) {
  cleanUpOldDocuments(ticketModel, config.cleanUpData.tickets.time);
}

if (config.cleanUpData.reviews.enabled) {
  cleanUpOldDocuments(reviewsModel, config.cleanUpData.reviews.time);
}

if (config.cleanUpData.weeklyStats.enabled) {
  cleanUpOldDocuments(weeklyStats, config.cleanUpData.weeklyStats.time);
}


    // Increase timesBotStarted by 1 everytime the bot starts
    statsDB.timesBotStarted++;
    await statsDB.save();

    // Send first start message
    if(statsDB.timesBotStarted === 1) {
      console.log(``)
      console.log(``)
      console.log(`Thank you for choosing ${color.yellow('Plex Tickets')}!`)
      console.log(`Since this is your first time starting the bot, Here is some important information:`)
      console.log(``)
      console.log(`If you need any help, Create a ticket in our discord server.`)
      console.log(`You can also look at our documentation for help, ${color.yellow(`docs.plexdevelopment.net`)}`)
      console.log(``)
      console.log(`${color.bold.red(`WARNING:\n Leaking, redistributing or re-selling any of our products is not allowed \nYour actions may have legal consequences if you violate our terms.\nif you are found doing it, your license will be permanently disabled!`)}`)
      console.log(`By using this bot you agree to all terms located here, ${color.yellow(`plexdevelopment.net/tos`)}`)
    }
}