const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require("discord.js");
const fs = require('fs');
const yaml = require("js-yaml");
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
const commands = yaml.load(fs.readFileSync('./commands.yml', 'utf8'));
const utils = require("../../utils.js");

module.exports = {
  enabled: commands.General.Help.Enabled,
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription(commands.General.Help.Description),
  async execute(interaction) {
    await interaction.deferReply();

    let icon = interaction.guild.iconURL();
    let helpEmbed = new Discord.EmbedBuilder()
      .setTitle(`${config.HelpCommand.Title.replace(/{botName}/g, `${config.BotName}`)}`)
      .setColor(config.HelpCommand.EmbedColor || config.EmbedColors);

    const addCommandFields = (categoryConfig, category, commandList) => {
      const enabledCommands = commandList.filter(cmd => cmd.Enabled);
      if (enabledCommands.length > 0) {
        const commandNames = enabledCommands.map(cmd => `\`${cmd.Name}\``).join(', ');
        let categoryName = categoryConfig.Name;
        if (categoryConfig.ShowCount) {
          categoryName += ` (${enabledCommands.length})`;
        }
        helpEmbed.addFields({ name: categoryName, value: commandNames });
        return enabledCommands.length;
      }
      return 0;
    };


// Commands list
    addCommandFields(
      config.HelpCommand.GeneralCategory,
      config.HelpCommand.GeneralCategory.Name,
      [
        { Name: 'help', Enabled: commands.General.Help.Enabled },
        { Name: 'ping', Enabled: commands.General.Ping.Enabled },
        { Name: 'suggest', Enabled: commands.General.Suggest.Enabled },
        { Name: 'stats', Enabled: commands.General.Stats.Enabled }
      ]
    );

    addCommandFields(
      config.HelpCommand.TicketCategory,
      config.HelpCommand.TicketCategory.Name,
      [
        { Name: 'add', Enabled: commands.Ticket.Add.Enabled },
        { Name: 'remove', Enabled: commands.Ticket.Remove.Enabled },
        { Name: 'panel', Enabled: commands.Ticket.Panel.Enabled },
        { Name: 'rename', Enabled: commands.Ticket.Rename.Enabled },
        { Name: 'close', Enabled: commands.Ticket.Close.Enabled },
        { Name: 'pin', Enabled: commands.Ticket.Pin.Enabled },
        { Name: 'delete', Enabled: commands.Ticket.Delete.Enabled },
        { Name: 'alert', Enabled: commands.Ticket.Alert.Enabled },
        { Name: 'priority', Enabled: commands.Ticket.Priority.Enabled }
      ]
    );

    addCommandFields(
      config.HelpCommand.UtilityCategory,
      config.HelpCommand.UtilityCategory.Name,
      [
        { Name: 'invoice', Enabled: commands.Utility.Invoice.Enabled },
        { Name: 'crypto', Enabled: commands.Utility.Crypto.Enabled },
        { Name: 'calculate', Enabled: commands.Utility.Calculate.Enabled },
        { Name: 'blacklist', Enabled: commands.Utility.Blacklist.Enabled }
      ]
    );

    if (config.HelpCommand.GuildIcon && icon) {
      helpEmbed.setThumbnail(icon);
    }

    if (config.HelpCommand.FooterTimestamp) {
      helpEmbed.setTimestamp();
    }

    const footerMsg = config.HelpCommand.FooterMsg
      .replace(/{guildName}/g, interaction.guild.name)
      .replace(/{userTag}/g, interaction.user.username);

    helpEmbed.setFooter({ text: footerMsg, icon: config.HelpCommand.FooterIcon });

    interaction.editReply({ embeds: [helpEmbed] });
  }
};