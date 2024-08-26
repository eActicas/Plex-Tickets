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
const ms = require('ms');
const ticketModel = require("../../models/ticketModel");

module.exports = {
    enabled: commands.Ticket.Alert.Enabled,
    data: new SlashCommandBuilder()
        .setName('alert')
        .setDescription(commands.Ticket.Alert.Description),
    async execute(interaction, client) {
        const ticketDB = await ticketModel.findOne({ channelID: interaction.channel.id });
        if(!ticketDB) return interaction.reply({ content: config.Locale.NotInTicketChannel, ephemeral: true })
        if(config.TicketAlert.Enabled === false) return interaction.reply({ content: "This command has been disabled in the config!", ephemeral: true })

        
        let supportRole = await utils.checkIfUserHasSupportRoles(interaction)
        if(!supportRole) return interaction.reply({ content: config.Locale.NoPermsMessage, ephemeral: true })
    
        await interaction.deferReply()

        let ticketCreator = await client.users.cache.get(ticketDB.userID)
    
        const ticketDeleteButton = new Discord.ButtonBuilder()
        .setCustomId('closeTicket')
        .setLabel(config.Locale.CloseTicketButton)
        .setStyle(config.ButtonColors.closeTicket)
        .setEmoji(config.ButtonEmojis.closeTicket)
        
        let row = new Discord.ActionRowBuilder().addComponents(ticketDeleteButton);

        const durationInSeconds = Math.floor(ms(config.TicketAlert.Time) / 1000);
        const unixTimestamp = Math.floor(Date.now() / 1000) + durationInSeconds;

        let descLocale = config.TicketAlert.Message.replace(/{time}/g, `<t:${unixTimestamp}:R>`);
        const embed = new Discord.EmbedBuilder()
        .setColor(config.EmbedColors)
        .setAuthor({ name: `${config.TicketAlert.Title}`, iconURL: `https://i.imgur.com/FxQkyLb.png` })
        .setDescription(descLocale)
        .setTimestamp()

        let DMdescLocale = config.TicketAlert.DMMessage.replace(/{time}/g, `<t:${unixTimestamp}:R>`).replace(/{channel}/g, `<#${interaction.channel.id}>`);
        const DMembed = new Discord.EmbedBuilder()
        .setColor(config.EmbedColors)
        .setAuthor({ name: `${config.TicketAlert.Title}`, iconURL: `https://i.imgur.com/FxQkyLb.png` })
        .setDescription(DMdescLocale)
        .setTimestamp()

        if(config.TicketAlert.DMUser) try {
            ticketCreator.send({ embeds: [DMembed] })
        }catch(e){
            console.log('\x1b[33m%s\x1b[0m', "[INFO] I tried to DM a user, but their DM's are locked.");
            let logMsg = `\n\n[${new Date().toLocaleString()}] [ERROR] ${e.stack}`;
            await fs.appendFile("./logs.txt", logMsg, (e) => { 
              if(e) console.log(e);
            });
            }

        interaction.editReply({ content: `<@!${ticketCreator.id}>`, embeds: [embed], components: [row], fetchReply: true }).then(async function(msg) {

            try {
                const filter = { channelID: interaction.channel.id };
                const update = {
                  closeNotificationTime: Date.now(),
                  closeNotificationMsgID: msg.id,
                  closeNotificationUserID: interaction.user.id,
                  channelID: interaction.channel.id,
                  closeUserID: interaction.user.id,
                  closeReason: "Closed automatically after time has passed with no response (Alert command)"
                };
              
                const options = { upsert: true, new: true, setDefaultsOnInsert: true };
              
                await ticketModel.findOneAndUpdate(filter, update, options);
              
              } catch (error) {
                console.error('Error updating ticket:', error);
              }
        })
    }

}