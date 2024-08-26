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
const { Discord, ActionRowBuilder, ButtonBuilder, EmbedBuilder, MessageSelectMenu, Message, MessageAttachment, SnowflakeUtil } = require("discord.js");
const fs = require('fs');
const yaml = require("js-yaml")
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'))
const commands = yaml.load(fs.readFileSync('./commands.yml', 'utf8'))
const guildModel = require("../../models/guildModel");
const suggestionModel = require("../../models/suggestionModel");
const { updateDailyStats } = require('../../events/dailyStatsUpdater');

module.exports = {
    enabled: commands.General.Suggest.Enabled,
    data: new SlashCommandBuilder()
        .setName('suggest')
        .setDescription(`Submit a suggestion`)
        .addStringOption(option => option.setName('suggestion').setDescription('suggestion').setRequired(true)),
    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });
        if(config.SuggestionSettings.Enabled === false) return interaction.editReply({ content: "This command has been disabled in the config!", ephemeral: true })
    
        let suggestion = interaction.options.getString("suggestion");

        if(config.SuggestionUpvote.ButtonColor === "Blurple") config.SuggestionUpvote.ButtonColor = "Primary"
        if(config.SuggestionUpvote.ButtonColor === "Gray") config.SuggestionUpvote.ButtonColor = "Secondary"
        if(config.SuggestionUpvote.ButtonColor === "Green") config.SuggestionUpvote.ButtonColor = "Success"
        if(config.SuggestionUpvote.ButtonColor === "Red") config.SuggestionUpvote.ButtonColor = "Danger"
    
        if(config.SuggestionDownvote.ButtonColor === "Blurple") config.SuggestionDownvote.ButtonColor = "Primary"
        if(config.SuggestionDownvote.ButtonColor === "Gray") config.SuggestionDownvote.ButtonColor = "Secondary"
        if(config.SuggestionDownvote.ButtonColor === "Green") config.SuggestionDownvote.ButtonColor = "Success"
        if(config.SuggestionDownvote.ButtonColor === "Red") config.SuggestionDownvote.ButtonColor = "Danger"
    
        if(config.SuggestionResetvote.ButtonColor === "Blurple") config.SuggestionResetvote.ButtonColor = "Primary"
        if(config.SuggestionResetvote.ButtonColor === "Gray") config.SuggestionResetvote.ButtonColor = "Secondary"
        if(config.SuggestionResetvote.ButtonColor === "Green") config.SuggestionResetvote.ButtonColor = "Success"
        if(config.SuggestionResetvote.ButtonColor === "Red") config.SuggestionResetvote.ButtonColor = "Danger"

        let suggestc = client.channels.cache.get(config.SuggestionSettings.ChannelID)
        if(!suggestc) return interaction.editReply({ content: `Suggestion channel has not been setup! Please fix this in the bot's config!`, ephemeral: true })
        let avatarurl = interaction.user.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 });
    
        const upvoteButton = new ButtonBuilder()
        .setCustomId('upvote')
        .setLabel(config.SuggestionUpvote.ButtonName)
        .setStyle(config.SuggestionUpvote.ButtonColor)
        .setEmoji(config.SuggestionUpvote.ButtonEmoji)
    
        const downvoteButton = new ButtonBuilder()
        .setCustomId('downvote')
        .setLabel(config.SuggestionDownvote.ButtonName)
        .setStyle(config.SuggestionDownvote.ButtonColor)
        .setEmoji(config.SuggestionDownvote.ButtonEmoji)
    
      
        const resetvoteButton = new ButtonBuilder()
        .setCustomId('resetvote')
        .setLabel(config.SuggestionResetvote.ButtonName)
        .setStyle(config.SuggestionResetvote.ButtonColor)
        .setEmoji(config.SuggestionResetvote.ButtonEmoji)
  

        let row = new ActionRowBuilder().addComponents(upvoteButton, downvoteButton, resetvoteButton);

        const statsDB = await guildModel.findOne({ guildID: config.GuildID });

        let embed = new EmbedBuilder()
        embed.setColor(config.SuggestionStatusesEmbedColors.Pending)
        embed.setAuthor({ name: `${config.Locale.newSuggestionTitle} (#${statsDB.totalSuggestions})` })
        embed.addFields([
          { name: `• ${config.Locale.suggestionTitle}`, value: `> \`\`\`${suggestion}\`\`\`` },
        ]);

        if(config.SuggestionSettings.EnableAcceptDenySystem) embed.addFields([
          { name: `• ${config.Locale.suggestionInformation}`, value: `> **${config.Locale.suggestionFrom}** <@!${interaction.user.id}>\n> **${config.Locale.suggestionUpvotes}** 0\n> **${config.Locale.suggestionDownvotes}** 0\n> **${config.Locale.suggestionStatus}** ${config.SuggestionStatuses.Pending}` },
        ]);

        if(config.SuggestionSettings.EnableAcceptDenySystem === false) embed.addFields([
          { name: `• ${config.Locale.suggestionInformation}`, value: `> **${config.Locale.suggestionFrom}** <@!${interaction.user.id}>\n> **${config.Locale.suggestionUpvotes}** 0\n> **${config.Locale.suggestionDownvotes}** 0` },
        ]);
        embed.setThumbnail(avatarurl)
        embed.setFooter({ text: `${interaction.user.username}`, iconURL: `${interaction.user.displayAvatarURL({ dynamic: true })}` })
        embed.setTimestamp()
    
        const nonce = SnowflakeUtil.generate();

        if (suggestc) await suggestc.send({ embeds: [embed], components: [row], enforceNonce: true, nonce: nonce.toString() }).then(async function(msg) {

          const newModel = new suggestionModel({
            msgID: msg.id,
            userID: interaction.user.id,
            suggestion: suggestion,
            upVotes: 0,
            downVotes: 0,
            status: "Pending"
          });
          await newModel.save();

          if(config.SuggestionSettings.CreateThreads) await msg.startThread({
            name: `${interaction.user.username}'s suggestion discussion'`,
            autoArchiveDuration: 10080,
            type: 'GUILD_PUBLIC_THREAD'
        });
    
        
        const statsDB = await guildModel.findOne({ guildID: config.GuildID });
        statsDB.totalSuggestions++;
        await statsDB.save();
      })

      const metricsToUpdate = ['totalSuggestions'];
      await updateDailyStats(config.GuildID, metricsToUpdate);
    
      interaction.editReply({ content: config.Locale.suggestionSubmit, ephemeral: true })
    
    }

}