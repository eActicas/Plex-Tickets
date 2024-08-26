const Discord = require('discord.js');
const fs = require('fs');
const yaml = require('js-yaml');
const config = yaml.load(fs.readFileSync('./addons/StickyMessages/config.yml', 'utf8'));
const StickyMessageModel = require('./StickyModel');

// Create a Map to store cooldown information for each channel
const cooldowns = new Map();

module.exports.run = async (client) => {
  if (config.Enabled === false) return;

  client.on('messageCreate', async (message) => {
    if (message.author.id === client.user.id) return;
    if (!message.guild) return;

    const stickyMessage = await StickyMessageModel.findOne({ channelId: message.channel.id });

    if (stickyMessage) {
      await StickyMessageModel.findByIdAndUpdate(stickyMessage._id, { $inc: { msgCount: 1 } });

      // Check if the channel has a cooldown active
      if (!cooldowns.has(message.channel.id) || cooldowns.get(message.channel.id) <= Date.now()) {
        // If no cooldown or cooldown has expired, reset the cooldown
        cooldowns.set(message.channel.id, Date.now() + 1 * 1000);

        if (stickyMessage.msgCount >= config.MaxMessages) {
          if (!config.EnableEmbeds) {
            await message.channel.messages.fetch().then(async (msgs) => {
              await msgs.forEach(async (msg) => {
                if (msg.author.id === client.user.id && msg.content.includes(stickyMessage.message)) {
                  await msg.delete().catch((e) => {});
                }
              });
            });
          } else if (config.EnableEmbeds) {
            await message.channel.messages.fetch().then(async (msgs) => {
              await msgs.forEach(async (msg) => {
                if (msg.author.id === client.user.id && msg.embeds.length > 0) {
                  for (const msgEmbed of msg.embeds) {
                    if (msgEmbed.description && msgEmbed.description.includes(stickyMessage.message)) {
                      await msg.delete().catch((e) => {});
                      break;
                    }
                  }
                }
              });
            });
          }

          const embed = new Discord.EmbedBuilder();
          if (config.EmbedSettings.Embed.Title) embed.setTitle(config.EmbedSettings.Embed.Title);
          embed.setDescription(stickyMessage.message);
          if (config.EmbedSettings.Embed.Color) embed.setColor(config.EmbedSettings.Embed.Color);
          if (config.EmbedSettings.Embed.Image) embed.setImage(config.EmbedSettings.Embed.PanelImage);
          if (config.EmbedSettings.Embed.CustomThumbnailURL) embed.setThumbnail(config.EmbedSettings.Embed.CustomThumbnailURL);
          if (config.EmbedSettings.Embed.Footer.Enabled && config.EmbedSettings.Embed.Footer.text) embed.setFooter({ text: `${config.EmbedSettings.Embed.Footer.text}` });
          if (config.EmbedSettings.Embed.Footer.Enabled && config.EmbedSettings.Embed.Footer.text && config.EmbedSettings.Embed.Footer.CustomIconURL) embed.setFooter({ text: `${config.EmbedSettings.Embed.Footer.text}`, iconURL: `${config.EmbedSettings.Embed.Footer.CustomIconURL}` });
          if (config.EmbedSettings.Embed.Timestamp) embed.setTimestamp();

          let sentMessage;
          if (config.EnableEmbeds === false) sentMessage = await message.channel.send({ content: `${config.StickiedMessageTitle}\n\n${stickyMessage.message}` });
          if (config.EnableEmbeds === true) sentMessage = await message.channel.send({ embeds: [embed] });

          await StickyMessageModel.findByIdAndUpdate(stickyMessage._id, { msgCount: 0, messageId: sentMessage.id });
        }
    } else {
        // Cooldown is still active, skip execution
        return;
    }
    }
  });
};
