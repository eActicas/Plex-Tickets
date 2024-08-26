const { Discord, ActionRowBuilder, ButtonBuilder, EmbedBuilder, StringSelectMenuBuilder, Message, MessageAttachment, ModalBuilder, TextInputBuilder } = require("discord.js");
const fs = require('fs');
const yaml = require("js-yaml")
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'))
const utils = require("../utils.js");
const guildModel = require("../models/guildModel");
const ticketModel = require("../models/ticketModel");
const reviewsModel = require("../models/reviewsModel");
const dashboardModel = require("../models/dashboardModel");

module.exports = async (client, ticketDB, attachment, closeLogMsgID, timestamp) => {

        let guild = client.guilds.cache.get(config.GuildID)

        let ticketAuthor = await client.users.cache.get(ticketDB.userID)
        let claimUser = await client.users.cache.get(ticketDB.claimUser)
        const dashboardDB = await dashboardModel.findOne({ guildID: config.GuildID });

        if (ticketAuthor) {
            let ticketCloseLocale = config.TicketUserCloseDM.CloseEmbedMsg.replace(/{guildName}/g, `${guild.name}`).replace(/{closedAt}/g, `<t:${(Date.now() / 1000 | 0)}:R>`);
            let ticketCloseReviewLocale = config.TicketReviewSettings.CloseEmbedReviewMsg.replace(/{guildName}/g, `${guild.name}`).replace(/{closedAt}/g, `<t:${(Date.now() / 1000 | 0)}:R>`);
            if (config.TicketUserCloseDM.Enabled !== false || config.TicketReviewSettings.Enabled !== false) {
                try {
                    // Rating System
                    const starMenu = new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('ratingSelect')
                                .setPlaceholder(config.Locale.selectReview)
                                .setMinValues(1)
                                .setMaxValues(1)
                                .addOptions([
                                    {
                                        label: '5 Star',
                                        value: 'five_star',
                                        emoji: '⭐',
                                    },
                                    {
                                        label: '4 Star',
                                        value: 'four_star',
                                        emoji: '⭐',
                                    },
                                    {
                                        label: '3 Star',
                                        value: 'three_star',
                                        emoji: '⭐',
                                    },
                                    {
                                        label: '2 Star',
                                        value: 'two_star',
                                        emoji: '⭐',
                                    },
                                    {
                                        label: '1 Star',
                                        value: 'one_star',
                                        emoji: '⭐',
                                    },
                                ]),
                        );
    
                        if (!claimUser) claimUser = config.Locale.notClaimedCloseDM;

                        let meetRequirement = true;
                        if (config.TicketReviewRequirements.Enabled) {
                            if (ticketDB.messages < config.TicketReviewRequirements.TotalMessages) meetRequirement = false;
                        }

                        const dmCloseEmbed = new EmbedBuilder();
                        dmCloseEmbed.setTitle(config.Locale.ticketClosedCloseDM);
                        dmCloseEmbed.setDescription(ticketCloseLocale);
                        if (config.TicketUserCloseDM.Enabled && config.TicketUserCloseDM.TicketInformation) dmCloseEmbed.addFields([
                            { name: `${config.Locale.ticketInformationCloseDM}`, value: `> ${config.Locale.categoryCloseDM} ${ticketDB.ticketType}\n> ${config.Locale.claimedByCloseDM} ${claimUser}\n> ${config.Locale.totalMessagesLog} ${ticketDB.messages}` },
                        ]);
                        dmCloseEmbed.setColor(config.EmbedColors);
                        
                        const dmCloseReviewEmbed = new EmbedBuilder();
                        dmCloseReviewEmbed.setTitle(config.Locale.ticketClosedCloseDM);
                        if(meetRequirement) dmCloseReviewEmbed.setDescription(ticketCloseReviewLocale);
                        if(!meetRequirement) dmCloseReviewEmbed.setDescription(ticketCloseLocale);
                        if (config.TicketUserCloseDM.Enabled && config.TicketUserCloseDM.TicketInformation) dmCloseReviewEmbed.addFields([
                            { name: `${config.Locale.ticketInformationCloseDM}`, value: `> ${config.Locale.categoryCloseDM} ${ticketDB.ticketType}\n> ${config.Locale.claimedByCloseDM} ${claimUser}\n> ${config.Locale.totalMessagesLog} ${ticketDB.messages}` },
                        ]);
                        dmCloseReviewEmbed.setColor(config.EmbedColors);
                        

                        const dashboardExists = await utils.checkDashboard();

                        // Check if the transcript link should be added to the embed
                        if (config.TicketUserCloseDM.SendTranscript && dashboardExists) {
                            const transcriptLink = `> [${config.Locale.dmTranscriptClickhere}](${dashboardDB.url}/transcript?channelId=${ticketDB.channelID}&dateNow=${timestamp})`;
                            dmCloseEmbed.addFields([{ name: `${config.Locale.dmTranscriptField}`, value: transcriptLink }]);
                            dmCloseReviewEmbed.addFields([{ name: `${config.Locale.dmTranscriptField}`, value: transcriptLink }]);
                        }

                        const embedOptions = { embeds: [dmCloseEmbed] };
                        const embedOptionsReview = { embeds: [dmCloseReviewEmbed] };
                    
                        
                        // Check if the transcript should be sent as an attachment
                        if (!dashboardExists && config.TicketUserCloseDM.SendTranscript) {
                            embedOptions.files = [attachment];
                            embedOptionsReview.files = [attachment];
                        }
                        
                        // Check the conditions for adding starMenu;
                        if (config.TicketReviewSettings.Enabled && meetRequirement) {
                            embedOptionsReview.components = [starMenu];
                        }
                        
                        let reviewDMUserMsg;

                        if (config.TicketReviewSettings.Enabled) {
                                await ticketAuthor.send(embedOptionsReview).then(async function (msg) {
                                    reviewDMUserMsg = msg.id;
                                });
                            } else if (config.TicketUserCloseDM.Enabled) {
                                await ticketAuthor.send(embedOptions)
                        }
    
                    if (config.TicketReviewSettings.Enabled) {
                        const newModelR = new reviewsModel({
                            ticketCreatorID: ticketAuthor.id,
                            guildID: config.GuildID,
                            ticketChannelID: ticketDB.channelID,
                            userID: ticketAuthor.id,
                            tCloseLogMsgID: closeLogMsgID,
                            reviewDMUserMsgID: reviewDMUserMsg,
                            category: ticketDB.ticketType,
                            totalMessages: ticketDB.messages,
                            transcriptID: timestamp,
                        });
                        await newModelR.save();
                    }
                } catch (e) {
                  //console.log(e)
                    console.log('\x1b[33m%s\x1b[0m', "[INFO] I tried to DM a user, but their DM's are locked.");
                    let logMsg = `\n\n[${new Date().toLocaleString()}] [ERROR] ${e.stack}`;
                    await fs.appendFile("./logs.txt", logMsg, (e) => {
                        if (e) console.log(e);
                    });
                }
            }
        }

};