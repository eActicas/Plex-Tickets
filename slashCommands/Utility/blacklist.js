const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const Discord = require('discord.js');
const fs = require('fs');
const yaml = require('js-yaml');
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
const commands = yaml.load(fs.readFileSync('./commands.yml', 'utf8'));
const ticketModel = require('../../models/ticketModel');
const blacklistModel = require('../../models/blacklistedUsersModel');

// Function to create an embed for the list of blacklisted users
function createBlacklistedUsersEmbed(blacklistedUsers, currentPage, totalPages) {
  const itemsPerPage = 10;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  const embed = new Discord.EmbedBuilder();

  if (blacklistedUsers.length !== 0) {
    embed.setTitle('Blacklisted Users');
    embed.setColor(config.EmbedColors);
    embed.setDescription('List of currently blacklisted users');
    embed.setFooter({ text: `Page ${currentPage}/${totalPages}` });

    // Check if startIndex is within the range of blacklistedUsers.length
    if (startIndex < blacklistedUsers.length) {
      const fields = [];
    
      for (let i = startIndex; i < endIndex && i < blacklistedUsers.length; i++) {
        const user = blacklistedUsers[i];
        fields.push({ name: 'User', value: `<@!${user.userId}>`, inline: false });
      }
    
      if (fields.length > 0) {
        embed.addFields(fields);
      }
    }
  } else {
    embed.setColor('Red');
    embed.setDescription('There are currently no users blacklisted.');
    embed.setFooter({ text: `Page ${currentPage}/${totalPages}` });
  }

  return embed;
}

module.exports = {
  enabled: commands.Utility.Blacklist.Enabled,
  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Manage user blacklist')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Add a user to the blacklist')
        .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Remove a user from the blacklist')
        .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('List all currently blacklisted users')
    ),
  async execute(interaction, client) {
    try {
      await interaction.deferReply({ ephemeral: true });
      if (!interaction.member.permissions.has('ManageChannels')) return interaction.editReply({ content: config.Locale.NoPermsMessage, ephemeral: true });

      const subcommand = interaction.options.getSubcommand();
      const user = interaction.options.getUser('user');

      const itemsPerPage = 5;
      
      // Find or create the blacklisted user record
      let blacklistedUser = await blacklistModel.findOne({ userId: user?.id });

      if (!blacklistedUser) {
        blacklistedUser = new blacklistModel({ userId: user?.id });
      }

      if (subcommand === 'add') {
        if (blacklistedUser.blacklisted) {
          const alreadyBlacklistedLocale = config.Locale.alreadyBlacklisted.replace(/{user}/g, `<@!${user.id}>`).replace(/{username}/g, `${user.username}`);
          const alreadyBlacklisted = new Discord.EmbedBuilder().setColor('Red').setDescription(alreadyBlacklistedLocale);
          return interaction.editReply({ embeds: [alreadyBlacklisted], ephemeral: true });
        }

        blacklistedUser.blacklisted = true;
        await blacklistedUser.save();

        const successfullyBlacklistedLocale = config.Locale.successfullyBlacklisted.replace(/{user}/g, `<@!${user.id}>`).replace(/{username}/g, `${user.username}`);
        const embed = new Discord.EmbedBuilder().setColor('Green').setDescription(successfullyBlacklistedLocale);

        interaction.editReply({ embeds: [embed], ephemeral: true });
      } else if (subcommand === 'remove') {
        if (!blacklistedUser.blacklisted) {
          const notBlacklistedLocale = config.Locale.notBlacklisted.replace(/{user}/g, `<@!${user.id}>`).replace(/{username}/g, `${user.username}`);
          const notBlacklisted = new Discord.EmbedBuilder().setColor('Red').setDescription(notBlacklistedLocale);
          return interaction.editReply({ embeds: [notBlacklisted], ephemeral: true });
        }

        blacklistedUser.blacklisted = false;
        await blacklistedUser.save();

        const successfullyUnblacklistedLocale = config.Locale.successfullyUnblacklisted.replace(/{user}/g, `<@!${user.id}>`).replace(/{username}/g, `${user.username}`);
        const embed = new Discord.EmbedBuilder().setColor('Green').setDescription(successfullyUnblacklistedLocale);

        interaction.editReply({ embeds: [embed], ephemeral: true });
      } else if (subcommand === 'list') {
        const blacklistedUsers = await blacklistModel.find({ blacklisted: true });

        const totalPages = Math.max(1, Math.ceil(blacklistedUsers.length / itemsPerPage));
        let currentPage = 1;
    
        const calculateIndices = () => {
          const startIndex = (currentPage - 1) * itemsPerPage;
          const endIndex = Math.min(startIndex + itemsPerPage, blacklistedUsers.length);
      
          if (startIndex >= blacklistedUsers.length) {
              const lastPageStartIndex = Math.max(0, blacklistedUsers.length - itemsPerPage);
              return { startIndex: lastPageStartIndex, endIndex: blacklistedUsers.length };
          }
      
          return { startIndex, endIndex };
      };
    
      if (blacklistedUsers.length !== 0) {
        const paginationButtons = new Discord.ActionRowBuilder().addComponents(
            new Discord.ButtonBuilder()
                .setCustomId('prevPage')
                .setLabel('Previous Page')
                .setStyle('Primary'),
            new Discord.ButtonBuilder()
                .setCustomId('nextPage')
                .setLabel('Next Page')
                .setStyle('Primary'),
        );
    
        const { startIndex, endIndex } = calculateIndices();
        const embed = createBlacklistedUsersEmbed(blacklistedUsers.slice(startIndex, endIndex), currentPage, totalPages);
        
        const initialMessageOptions = {
            embeds: [embed],
            components: [paginationButtons],
        };
    
        await interaction.editReply(initialMessageOptions);
    
        const collectorFilter = (buttonInteraction) => {
            return buttonInteraction.user.id === interaction.user.id && ['prevPage', 'nextPage'].includes(buttonInteraction.customId);
        };
    
        const collector = interaction.channel.createMessageComponentCollector({
            filter: collectorFilter,
            time: 180000,
        });
    
        collector.on('collect', async (buttonInteraction) => {
          if (buttonInteraction.customId === 'prevPage' && currentPage > 1) {
              currentPage--;
          } else if (buttonInteraction.customId === 'nextPage' && currentPage < totalPages) {
              currentPage++;
          }
      
          const { startIndex, endIndex } = calculateIndices();
      
          const updatedEmbed = createBlacklistedUsersEmbed(blacklistedUsers.slice(startIndex, endIndex), currentPage, totalPages);
      
          // Remove existing fields and add new fields for the current page
          updatedEmbed.fields = [];
      
          for (let i = startIndex; i < endIndex && i < blacklistedUsers.length; i++) {
              const user = blacklistedUsers[i];
              updatedEmbed.addFields({ name: 'User', value: `<@!${user.userId}>`, inline: false });
          }
      
          // Add the remaining users to the fields
          if (endIndex < blacklistedUsers.length) {
              updatedEmbed.addFields(
                  blacklistedUsers
                      .slice(endIndex, Math.min(endIndex + itemsPerPage, blacklistedUsers.length))
                      .map(user => ({ name: 'User', value: `<@!${user.userId}>`, inline: false }))
              );
          }
      
          try {
              await buttonInteraction.update({ embeds: [updatedEmbed], components: [paginationButtons] });
          } catch (updateError) {
              console.error('Error updating button interaction:', updateError);
              collector.stop();
          }
      });
      
    } else {
        const embed = createBlacklistedUsersEmbed(blacklistedUsers, currentPage, totalPages);
        await interaction.editReply({ embeds: [embed] });
    }
    }
} catch (error) {
    console.error('Error managing blacklisted user:', error);
    interaction.editReply({ content: "Error managing blacklisted user, Try again.", ephemeral: true });
}
},
};