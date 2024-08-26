const { Collection, Client, Discord, Intents, AttachmentBuilder, ActionRowBuilder, EmbedBuilder, ButtonBuilder } = require('discord.js');
const fs = require('fs');
const yaml = require("js-yaml")
const fetch = require("node-fetch");
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'))
const client = require("./index.js")
const color = require('ansi-colors');
const axios = require('axios')
const glob = require("glob");
let discordTranscripts;
if(config.TicketTranscriptSettings.TranscriptType === "HTML") discordTranscripts = require('discord-html-transcripts')

client.commands = new Collection();
client.slashCommands = new Collection();

client.cooldowns = new Collection();

const guildModel = require("./models/guildModel");
const ticketModel = require("./models/ticketModel");

const stripe = require('stripe')(config.StripeSettings.StripeSecretKey, {
  apiVersion: '2020-08-27',
});

client.stripe = stripe;

const paypal = require("paypal-rest-sdk");
paypal.configure({
  'mode': 'live',
  'client_id': config.PayPalSettings.PayPalClientID,
  'client_secret': config.PayPalSettings.PayPalSecretKey
});
client.paypal = paypal;


const CryptoConvert = require("crypto-convert")
if(!config.CryptoRates) console.log('\x1b[31m%s\x1b[0m', `[ERROR] Your config.yml file is outdated! CryptoRates is missing from the config in the crypto section`)
if(config.CryptoSettings.Enabled) {
const cryptoConvert = new CryptoConvert({
	cryptoInterval: 5000,
	fiatInterval: (60 * 1e3 * 60),
	calculateAverage: true,
	binance: config.CryptoRates.binance,
	bitfinex: config.CryptoRates.bitfinex,
	coinbase: config.CryptoRates.coinbase,
	kraken: config.CryptoRates.kraken,
	HTTPAgent: null 
});
client.cryptoConvert = cryptoConvert
}

//Slash Commands
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');

if(config.GuildID) {
const slashCommands = [];

const commandFolders = fs.readdirSync('./slashCommands');
for (const folder of commandFolders) {
  const commandFiles = fs.readdirSync(`./slashCommands/${folder}`).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {

  const command = require(`./slashCommands/${folder}/${file}`);
if(command.enabled) {
  slashCommands.push(command.data.toJSON());
  console.log(`[SLASH COMMAND] ${file} loaded!`);
  client.slashCommands.set(command.data.name, command);
}
}
}

glob('./addons/**/*.js', function (err, files) {
  if (err) return console.error(err);

  const loadedAddons = [];

  files.forEach(async file => {
    if (file.endsWith('.js')) {
      const folderName = file.match(/\/addons\/([^/]+)/)[1];

      if (!loadedAddons.includes(folderName)) {
        loadedAddons.push(folderName);
        console.log(`${color.green(`[ADDON] ${folderName} loaded!`)}`);
      }

      try {
        if (fs.existsSync(file)) {
          let addon = require(file);

          if (addon && addon.data && addon.data.toJSON) {
            await slashCommands.push(addon.data.toJSON());
            await client.slashCommands.set(addon.data.name, addon);
          } else if (addon && addon.run && typeof addon.run === 'function') {
            await addon.run(client);
          }
        }
      } catch (addonError) {
        console.error(`${color.red(`[ERROR] ${folderName}: ${addonError.message}`)}`);
        console.error(addonError.stack);
      }
    }
  });
});


  client.on('ready', async () => {

    const rest = new REST({
        version: '10'
    }).setToken(config.Token);
    (async () => {
        try {
                await rest.put(
                    Routes.applicationGuildCommands(client.user.id, config.GuildID), {
                        body: slashCommands
                    },
                );
        } catch (error) {
            if (error) {
              let logMsg = `\n\n[${new Date().toLocaleString()}] [ERROR] ${error.stack}`;
              await fs.appendFile("./logs.txt", logMsg, (e) => { 
                if(e) console.log(e);
              });
              console.log(error)
              await console.log('\x1b[31m%s\x1b[0m', `[ERROR] Slash commands are unavailable because application.commands scope wasn't selected when inviting the bot. Please use the link below to re-invite your bot.`)
              await console.log('\x1b[31m%s\x1b[0m', `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`)
            }
        }
    })();
  });
}
//





// Command and event handler etc..
fs.readdir('./events/', (err, files) => {
  if (err) return console.error

  files.forEach(async (file) => {
    if(!file.endsWith('.js') || file === 'dailyStatsUpdater.js') return;
      console.log(`[EVENT] ${file} loaded!`)

    const evt = require(`./events/${file}`);
    let evtName = file.split('.')[0];
    client.on(evtName, evt.bind(null, client));
  });
});


// Get average ticket rating
  exports.averageRating = async function (client) {
    try {
      const guild = await guildModel.findOne({ guildID: config.GuildID });
      if (!guild) return "0.0";
  
      const ratings = guild.reviews.map(review => review.rating);
      const nonZeroRatings = ratings.filter(rating => rating !== 0);
      const average = nonZeroRatings.length ? (nonZeroRatings.reduce((a, b) => a + b) / nonZeroRatings.length).toFixed(1) : "0.0";

      guild.averageRating = average;
      await guild.save();

      return average;
    } catch (error) {
      console.error('Error fetching guild data:', error);
      return "0.0";
    }
  };



// Check config for errors
exports.checkConfig = function(client){
  let foundErrors = [];
  let guild = client.guilds.cache.get(config.GuildID)

  var reg=/^#([0-9a-f]{3}){1,2}$/i;
  if(reg.test(config.EmbedColors) === false)  {
    console.log('\x1b[31m%s\x1b[0m', `[WARNING] EmbedColors is not a valid HEX Color!`)
    foundErrors.push("EmbedColors is not a valid HEX Color!");
  }

  // Check for invalid channels
  if(!guild.channels.cache.get(config.TicketSettings.LogsChannelID)) {
    console.log('\x1b[31m%s\x1b[0m', `[WARNING] TicketSettings.LogsChannelID is not a valid channel!`)
    foundErrors.push("TicketSettings.LogsChannelID is not a valid channel!");
  }
  if(config.ArchiveTickets.Enabled && !guild.channels.cache.get(config.ArchiveTickets.TranscriptChannelID)) {
    console.log('\x1b[31m%s\x1b[0m', `[WARNING] ArchiveTickets.TranscriptChannelID is not a valid channel!`)
    foundErrors.push("ArchiveTickets.TranscriptChannelID is not a valid channel!");
  }


  // Check if user has removed any buttons from the config
for (let i = 1; i <= 8; i++) {
  const button = config[`TicketButton${i}`];
  
  if (!button) {
    console.log('\x1b[31m%s\x1b[0m', `[ERROR] You have removed TicketButton${i} from the config which means that the bot won't function properly, You can set Enabled to false if you want to disable it instead.`)
    foundErrors.push(`TicketButton${i} removed from the config!`);
    process.exit();
  }
}


  // Check for invalid colors in all ticket buttons
  if(!["Blurple", "Gray", "Green", "Red"].includes(config.TicketButton1.ButtonColor)) {
    console.log('\x1b[31m%s\x1b[0m', `[WARNING] TicketButton1.ButtonColor is not a valid color! Valid colors: Blurple, Gray, Green, Red (CASE SENSITIVE)`)
    foundErrors.push("TicketButton1.ButtonColor is not a valid color!");
  }

  if(!["Blurple", "Gray", "Green", "Red"].includes(config.TicketButton2.ButtonColor) && config.TicketButton2.Enabled)  {
    console.log('\x1b[31m%s\x1b[0m', `[WARNING] TicketButton2.ButtonColor is not a valid color! Valid colors: Blurple, Gray, Green, Red (CASE SENSITIVE)`)
    foundErrors.push("TicketButton2.ButtonColor is not a valid color!");
  }

  if(!["Blurple", "Gray", "Green", "Red"].includes(config.TicketButton3.ButtonColor) && config.TicketButton3.Enabled) {
    console.log('\x1b[31m%s\x1b[0m', `[WARNING] TicketButton3.ButtonColor is not a valid color! Valid colors: Blurple, Gray, Green, Red (CASE SENSITIVE)`)
    foundErrors.push("TicketButton3.ButtonColor is not a valid color!");
  }

  if(!["Blurple", "Gray", "Green", "Red"].includes(config.TicketButton4.ButtonColor) && config.TicketButton4.Enabled) {
    console.log('\x1b[31m%s\x1b[0m', `[WARNING] TicketButton4.ButtonColor is not a valid color! Valid colors: Blurple, Gray, Green, Red (CASE SENSITIVE)`)
    foundErrors.push("TicketButton4.ButtonColor is not a valid color!");
  }

  if(!["Blurple", "Gray", "Green", "Red"].includes(config.TicketButton5.ButtonColor) && config.TicketButton5.Enabled) {
    console.log('\x1b[31m%s\x1b[0m', `[WARNING] TicketButton5.ButtonColor is not a valid color! Valid colors: Blurple, Gray, Green, Red (CASE SENSITIVE)`)
    foundErrors.push("TicketButton5.ButtonColor is not a valid color!");
  }


  // Check for invalid colors in all suggestion buttons
  if(!["Blurple", "Gray", "Green", "Red"].includes(config.SuggestionUpvote.ButtonColor) && config.SuggestionSettings.Enabled) {
    console.log('\x1b[31m%s\x1b[0m', `[WARNING] SuggestionUpvote.ButtonColor is not a valid color! Valid colors: Blurple, Gray, Green, Red (CASE SENSITIVE)`)
    foundErrors.push("SuggestionUpvote.ButtonColor is not a valid color!");
  }

  if(!["Blurple", "Gray", "Green", "Red"].includes(config.SuggestionDownvote.ButtonColor) && config.SuggestionSettings.Enabled) {
    console.log('\x1b[31m%s\x1b[0m', `[WARNING] SuggestionDownvote.ButtonColor is not a valid color! Valid colors: Blurple, Gray, Green, Red (CASE SENSITIVE)`)
    foundErrors.push("SuggestionDownvote.ButtonColor is not a valid color!");
  }

  if(!["Blurple", "Gray", "Green", "Red"].includes(config.SuggestionResetvote.ButtonColor) && config.SuggestionSettings.Enabled) {
    console.log('\x1b[31m%s\x1b[0m', `[WARNING] SuggestionResetvote.ButtonColor is not a valid color! Valid colors: Blurple, Gray, Green, Red (CASE SENSITIVE)`)
    foundErrors.push("SuggestionResetvote.ButtonColor is not a valid color!");
  }

// Check for invalid category channels in all ticket buttons
for (let i = 1; i <= 8; i++) {
  const ticketButton = config[`TicketButton${i}`];
  
  if (i !== 1 && !ticketButton.Enabled) continue;

  if (guild.channels.cache.get(ticketButton.TicketCategoryID)?.type !== 4) {
    console.log('\x1b[31m%s\x1b[0m', `[WARNING] TicketButton${i}.TicketCategoryID is not a valid category!`);
    foundErrors.push(`TicketButton${i}.TicketCategoryID is not a valid category!`);
  }
}




// Check for invalid closed category channels in all ticket buttons
for (let i = 1; i <= 8; i++) {
  const ticketButton = config[`TicketButton${i}`];
  
  if (i !== 1 && !ticketButton.Enabled) continue;

  if (config.TicketSettings.ArchiveTickets && guild.channels.cache.get(ticketButton.ClosedCategoryID)?.type !== 4) {
    console.log('\x1b[31m%s\x1b[0m', `[WARNING] TicketButton${i}.ClosedCategoryID is not a valid category!`);
    foundErrors.push(`TicketButton${i}.ClosedCategoryID is not a valid category!`);
  }
}


// Check for category descriptions longer than 100 characters
for (let i = 1; i <= 8; i++) {
  const ticketButton = config[`TicketButton${i}`];
  
  if (i !== 1 && !ticketButton.Enabled) continue;

  if (ticketButton.Description.length > 100) {
    console.log('\x1b[31m%s\x1b[0m', `[WARNING] TicketButton${i}.Description can't be longer than 100 characters!`);
    foundErrors.push(`TicketButton${i}.Description can't be longer than 100 characters!`);
  }
}

// Check if questions are present and valid
for (let i = 1; i <= 8; i++) {
  const button = config[`TicketButton${i}`];
  if (i !== 1 && !button.Enabled) continue;

  const customIdSet = new Set();
  if(button.Questions) button.Questions.forEach((question, index) => {
    if (question && !question.customId || typeof question.customId !== 'string' || /\s/.test(question.customId) || customIdSet.has(question.customId)) {
      console.log('\x1b[31m%s\x1b[0m', `[WARNING] TicketButton${i}.Questions[${index}] has an invalid or duplicate customId! CustomId must be unique, a non-empty string without spaces.`);
      foundErrors.push(`TicketButton${i}.Questions[${index}] has an invalid or duplicate customId! CustomId must be unique, a non-empty string without spaces.`);
    } else {
      customIdSet.add(question.customId);
    }

    // Check for valid style
    const validStyles = ['short', 'paragraph'];
    if (!validStyles.includes(question.style.toLowerCase())) {
      console.log('\x1b[31m%s\x1b[0m', `[WARNING] TicketButton${i}.Questions[${index}] has an invalid style! Style must be one of: ${validStyles.join(', ')}.`);
      foundErrors.push(`TicketButton${i}.Questions[${index}] has an invalid style! Style must be one of: ${validStyles.join(', ')}.`);
    }

  });
}

// Check for invalid support roles in all ticket buttons
for (let i = 1; i <= 8; i++) {
  const button = config[`TicketButton${i}`];
  
  if (i !== 1 && !button.Enabled) continue;

  // Check if SupportRoles is an array with the correct format
  if (!Array.isArray(button.SupportRoles) || !button.SupportRoles.every(roleid => typeof roleid === 'string')) {
    console.log('\x1b[31m%s\x1b[0m', `[WARNING] TicketButton${i}.SupportRoles is not in the correct format! Example of correct format: ["ROLE_ID", "ROLE_ID"] or ["ROLE_ID"]`);
    foundErrors.push(`TicketButton${i}.SupportRoles is not in the correct format! Example of correct format: ["ROLE_ID", "ROLE_ID"] or ["ROLE_ID"]`);
    continue;
  }

  button.SupportRoles.forEach(roleid => {
    const role = guild.roles.cache.get(roleid);
    
    if (!role) {
      console.log('\x1b[31m%s\x1b[0m', `[WARNING] TicketButton${i}.SupportRoles is not a valid role! (${roleid})`);
      foundErrors.push(`TicketButton${i}.SupportRoles is not a valid role!`);
    }
  });
}

// Check for invalid emojis in all ticket buttons
const emojiRegex = require('emoji-regex');
const discordEmojiRegex = /<a?:[a-zA-Z0-9_]+:(\d+)>/;

for (let i = 1; i <= 8; i++) {
  const ticketButton = config[`TicketButton${i}`];

  if (i !== 1 && !ticketButton.Enabled) continue;

  if (ticketButton.ButtonEmoji) {
    const emojiPattern = emojiRegex();
    const emojiMatch = emojiPattern.exec(ticketButton.ButtonEmoji);
    const discordEmojiMatch = ticketButton.ButtonEmoji.match(discordEmojiRegex);

    if (!emojiMatch && !discordEmojiMatch) {
      console.log('\x1b[31m%s\x1b[0m', `[WARNING] TicketButton${i}.ButtonEmoji contains an invalid emoji! (${ticketButton.ButtonEmoji})`);
      foundErrors.push(`TicketButton${i}.ButtonEmoji contains an invalid emoji!`);
    }
  }
}

// Check for more than 5 questions in all ticket buttons
for (let i = 1; i <= 8; i++) {
  const ticketButton = config[`TicketButton${i}`];

  if (i !== 1 && !ticketButton.Enabled) continue;
  
  if (Array.isArray(ticketButton.Questions) && ticketButton.Questions.length > 5) {
    console.log('\x1b[31m%s\x1b[0m', `[WARNING] TicketButton${i} has more than 5 questions! (Each category can only have a max of 5 questions, due to a Discord limitation)`);
    foundErrors.push(`TicketButton${i} has more than 5 questions!`);
  }
}



if(foundErrors.length > 0) {
let logMsg = `\n\n[${new Date().toLocaleString()}] [CONFIG ERROR(S)] \n${foundErrors.join("\n ").trim()}`;
fs.appendFile("./logs.txt", logMsg, (e) => { 
  if(e) console.log(e);
});
}
}

const path = require('path');
exports.checkDashboard = async function () {
  const folderPath = path.join(__dirname, 'addons', 'Dashboard');

  try {
    const files = await new Promise((resolve, reject) => {
      fs.readdir(folderPath, (error, files) => {
        if (error) {
          reject(error);
        } else {
          resolve(files);
        }
      });
    });

    return true;

  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    } else {
      throw error;
    }
  }
};

exports.saveTranscript = async function(interaction){
  let dashboardExists = await exports.checkDashboard();
  let attachment;
  let timestamp = "null"
if(interaction) {
  if(config.TicketTranscriptSettings.TranscriptType === "HTML") {
      attachment = await discordTranscripts.createTranscript(interaction.channel, {
        limit: -1,
        minify: false,
        saveImages: config.TicketTranscriptSettings.SaveImages,
        returnType: 'buffer',
        poweredBy: false,
        fileName: `${interaction.channel.name}.html`
      });

      if(config.TicketTranscriptSettings.SaveInFolder && dashboardExists) {
        timestamp = Date.now();
        fs.writeFileSync(`./addons/Dashboard/transcripts/transcript-${interaction.channel.id}-${timestamp}.html`, attachment);

        const ticketDB = await ticketModel.findOne({ channelID: interaction.channel.id });
        ticketDB.transcriptID = `${timestamp}`;
        await ticketDB.save();
      }

      attachment = new AttachmentBuilder(Buffer.from(attachment), { name: `${interaction.channel.name}-transcript.html` });
  } else if(config.TicketTranscriptSettings.TranscriptType === "TXT") {
      await interaction.channel.messages.fetch({ limit: 100 }).then(async fetched => {
          let a = fetched.filter(m => m.author.bot !== true).map(m => `${new Date(m.createdTimestamp).toLocaleString()} - ${m.author.username}: ${m.attachments.size > 0 ? m.attachments.first().proxyURL : m.content}`).reverse().join('\n');
          if (a.length < 1) a = "Nothing"
          if(config.TicketTranscriptSettings.SaveInFolder) fs.writeFileSync(`./transcripts/${interaction.channel.name}-transcript-${interaction.channel.id}.txt`, Buffer.from(a));
          attachment = new AttachmentBuilder(Buffer.from(a), { name: `${interaction.channel.name}-transcript.txt` });
  })
}
}

return { attachment, timestamp };
}

exports.saveTranscriptAlertCmd = async function(channel){
  let dashboardExists = await exports.checkDashboard();
  let attachment;
  let timestamp = "null"
  if(channel) {
    if(config.TicketTranscriptSettings.TranscriptType === "HTML") {
        attachment = await discordTranscripts.createTranscript(channel, {
            limit: -1,
            minify: false,
            saveImages: config.TicketTranscriptSettings.SaveImages,
            returnType: 'buffer',
            poweredBy: false,
            fileName: `${channel.name}.html`
        });

        if(config.TicketTranscriptSettings.SaveInFolder && dashboardExists) {
          timestamp = Date.now();
          fs.writeFileSync(`./addons/Dashboard/transcripts/transcript-${channel.id}-${timestamp}.html`, attachment);

          const ticketDB = await ticketModel.findOne({ channelID: channel.id });
          ticketDB.transcriptID = `${timestamp}`;
          await ticketDB.save();
        }

        attachment = new AttachmentBuilder(Buffer.from(attachment), { name: `${channel.name}-transcript.html` });
    } else if(config.TicketTranscriptSettings.TranscriptType === "TXT") {
        await channel.messages.fetch({ limit: 100 }).then(async fetched => {
            let a = fetched.filter(m => m.author.bot !== true).map(m => `${new Date(m.createdTimestamp).toLocaleString()} - ${m.author.username}: ${m.attachments.size > 0 ? m.attachments.first().proxyURL : m.content}`).reverse().join('\n');
            if (a.length < 1) a = "Nothing"
            if(config.TicketTranscriptSettings.SaveInFolder) fs.writeFileSync(`./transcripts/${channel.name}-transcript-${channel.id}.txt`, Buffer.from(a));
            attachment = new AttachmentBuilder(Buffer.from(a), { name: `${channel.name}-transcript.txt` });
    })
  }
  }
  return { attachment, timestamp };
}

const stripeModel = require('./models/stripeInvoicesModel');
const paypalModel = require('./models/paypalInvoicesModel');

// Check for new payments
    // Stripe payment detection
    exports.checkStripePayments = async function () {
      let guild = client.guilds.cache.get(config.GuildID);
    
      try {
        const filtered = await stripeModel.find({ status: 'open' });
    
        if (!filtered.length) return;
    
        for (const eachPayment of filtered) {
          let channel = guild.channels.cache.get(eachPayment.channelID);
          let user = guild.members.cache.get(eachPayment.userID);
          let session;
    
          if (user) {
            session = await client.stripe.invoices.retrieve(eachPayment.invoiceID);
    
            if (!session || !channel) {
              await stripeModel.deleteMany({ invoiceID: eachPayment.invoiceID });
            }
    
            if (session.status === 'paid') {
              await stripeModel.updateOne({ invoiceID: session.id }, { $set: { status: 'paid' } });
              await stripeModel.updateOne({ invoiceID: session.id }, { $set: { status: 'deleted' } });
            }
          }
    
          if (channel && user && session && session.status === 'paid') {
            await channel.messages.fetch(eachPayment.messageID).then(async msg => {
              const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setStyle('Link')
                  .setURL(`https://stripe.com`)
                  .setLabel(config.Locale.PayPalPayInvoice)
                  .setDisabled(true),
                  new ButtonBuilder()
                  .setCustomId(`${session.id}-paid`)
                  .setStyle('Success')
                  .setLabel(config.StripeSettings.StatusPaid)
                  .setDisabled(true));
    
              let customerRole = guild.roles.cache.get(config.StripeSettings.RoleToGive);
              if(customerRole) user.roles.add(customerRole)

              const embed = msg.embeds[0];
              const embedColor = EmbedBuilder.from(embed);
              embedColor.setColor("Green");
              await msg.edit({ embeds: [embedColor], components: [row] });
            });
          }
        }
      } catch (error) {
        console.error('Error in checkStripePayments:', error);
      }
    };
  
    
    exports.checkPayPalPayments = async function () {
      const guild = client.guilds.cache.get(config.GuildID);
    
      try {
        const filtered = await paypalModel.find({ status: 'DRAFT' });
    
        if (!filtered.length) return;
    
        for (const eachPayment of filtered) {
          const channel = guild.channels.cache.get(eachPayment.channelID);
          const user = guild.members.cache.get(eachPayment.userID);
    
          if (user) {
            client.paypal.invoice.get(eachPayment.invoiceID, async function (error, invoice) {
              if (error) {
                if (error.response.error === "invalid_client") {
                  console.log('\x1b[31m%s\x1b[0m', `[ERROR] The PayPal API Credentials you specified in the config are invalid! Make sure you use the "LIVE" mode!`);
                } else {
                  console.error(`An error occured while checking invoice with ID ${eachPayment.invoiceID}, (${error.message}), It has been automatically deleted from the database.`);
                  await paypalModel.deleteMany({ invoiceID: eachPayment.invoiceID });
                }
              } else {
                if (!channel || !invoice) {
                  await paypalModel.deleteMany({ invoiceID: invoice.id });
                }

                if (invoice.status === 'PAID') {
                  await paypalModel.updateOne({ invoiceID: invoice.id }, { $set: { status: 'paid' } });
                }
    
                if (invoice && channel && user && invoice.status === 'PAID') {
                  channel.messages.fetch(eachPayment.messageID)
                    .catch(e => { })
                    .then(async msg => {
                      const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                          .setStyle('Link')
                          .setURL(`https://paypal.com`)
                          .setLabel(config.Locale.PayPalPayInvoice)
                          .setDisabled(true),
                        new ButtonBuilder()
                          .setCustomId(`${invoice.id}-paid`)
                          .setStyle('Success')
                          .setLabel(config.PayPalSettings.StatusPaid)
                          .setDisabled(true));
    
                      const embed = msg.embeds[0];
                      const embedColor = EmbedBuilder.from(embed)
                        .setColor("Green");
    
                        let customerRole = guild.roles.cache.get(config.PayPalSettings.RoleToGive);
                        if(customerRole) user.roles.add(customerRole)

                      await msg.edit({ embeds: [embedColor], components: [row] });
                    });
                }
              }
            });
          }
        }
      } catch (error) {
        console.error('Error in checkPayPalPayments:', error);
      }
    };
    


exports.checkIfUserHasSupportRoles = async function(interaction, message) {
  let supportRole = false;
  let context = interaction || message;

  const ticketDB = await ticketModel.findOne({ channelID: context.channel.id });
  const ticketButton = ticketDB.button;

  for (let i = 1; i <= 8; i++) {
    const buttonConfig = config[`TicketButton${i}`];

    if (ticketButton === `TicketButton${i}`) {
      for (const roleId of buttonConfig.SupportRoles) {
        const role = context.guild.roles.cache.get(roleId);
        
        if (role && context.member.roles.cache.has(role.id)) {
          supportRole = true;
          break;
        }
      }
      break;
    }
  }
  
  return supportRole;
};


  client.login(config.Token).catch(error => {
    if (error.message.includes("Used disallowed intents")) {
      console.log('\x1b[31m%s\x1b[0m', `Used disallowed intents (READ HOW TO FIX): \n\nYou did not enable Privileged Gateway Intents in the Discord Developer Portal!\nTo fix this, you have to enable all the privileged gateway intents in your discord developer portal, you can do this by opening the discord developer portal, go to your application, click on bot on the left side, scroll down and enable Presence Intent, Server Members Intent, and Message Content Intent`);
      process.exit();
    } else if (error.message.includes("An invalid token was provided")) {
      console.log('\x1b[31m%s\x1b[0m', `[ERROR] The bot token specified in the config is incorrect!`)
      process.exit()
    } else {
      console.log('\x1b[31m%s\x1b[0m', `[ERROR] An error occured while attempting to login to the bot`)
      console.log(error)
      process.exit()
    }
  })

