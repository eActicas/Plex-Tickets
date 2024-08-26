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
const { Discord, ActionRowBuilder, EmbedBuilder, ButtonBuilder } = require("discord.js");
const fs = require('fs');
const yaml = require("js-yaml")
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'))
const commands = yaml.load(fs.readFileSync('./commands.yml', 'utf8'))
const fetch = require("node-fetch");
const ticketModel = require("../../models/ticketModel");

module.exports = {
    enabled: commands.Utility.Crypto.Enabled,
    data: new SlashCommandBuilder()
        .setName('crypto')
        .setDescription(commands.Utility.Crypto.Description)
        .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
        .addStringOption((option) => option.setName('currency').setDescription('Crypto Currency to pay in').addChoices(
            { name: 'BTC', value: 'BTC' }, 
            { name: 'ETH', value: 'ETH' }, 
            { name: 'USDT', value: 'USDT' },
            { name: 'LTC', value: 'LTC' },
        ).setRequired(true))
                .addNumberOption((option) => option.setName('price').setDescription(`Price in ${config.CryptoSettings.Currency}`).setRequired(true))
                .addStringOption(option => option.setName('service').setDescription('Service').setRequired(true))
                .addStringOption((option) => option.setName('address').setDescription('Wallet Address')),
    async execute(interaction, client) {
      await interaction.deferReply({ ephemeral: true });
      const ticketDB = await ticketModel.findOne({ channelID: interaction.channel.id });

        if(config.CryptoSettings.Enabled === false) return interaction.editReply({ content: "This command has been disabled in the config!", ephemeral: true })
        if (config.CryptoSettings.OnlyInTicketChannels && !ticketDB) return interaction.editReply({ content: config.Locale.NotInTicketChannel, ephemeral: true })
    
        let doesUserHaveRole = false
        for(let i = 0; i < config.CryptoSettings.AllowedRoles.length; i++) {
            role = interaction.guild.roles.cache.get(config.CryptoSettings.AllowedRoles[i]);
            if(role && interaction.member.roles.cache.has(config.CryptoSettings.AllowedRoles[i])) doesUserHaveRole = true;
          }
        if(doesUserHaveRole === false) return interaction.editReply({ content: config.Locale.NoPermsMessage, ephemeral: true })


        let user = interaction.options.getUser("user");
        let currency = interaction.options.getString("currency")
        let price = interaction.options.getNumber("price");
        let service = interaction.options.getString("service");
        let address = interaction.options.getString("address");
    
        let address2 = address || "";

        if (!address && currency === "BTC") address2 = config.CryptoAddresses.BTC || "";
        if (!address && currency === "ETH") address2 = config.CryptoAddresses.ETH || "";
        if (!address && currency === "USDT") address2 = config.CryptoAddresses.USDT || "";
        if (!address && currency === "LTC") address2 = config.CryptoAddresses.LTC || "";
    
        if (!address2) return interaction.editReply({ content: `No ${currency} address specified in the command or config!`, ephemeral: true });

        const fromCurrency = currency;
        const toCurrency = config.CryptoSettings.Currency;
        const conversionMethod = client.cryptoConvert[toCurrency][fromCurrency];
        const amount = price
        const convertedAmount = conversionMethod(amount);

        if(currency === "BTC") cryptoFullName = "bitcoin"
        if(currency === "ETH") cryptoFullName = "ethereum"
        if(currency === "USDT") cryptoFullName = "tether"
        if(currency === "LTC") cryptoFullName = "litecoin"

        const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setStyle('Link')
                .setURL(`https://quickchart.io/qr?text=${cryptoFullName.toLowerCase()}%3A${address2}%3Famount=${price}`) 
                .setLabel(config.Locale.cryptoQRCode))
  

        const embedSettings = config.CryptoSettings.Embed;
        const embed = new EmbedBuilder()
            if(embedSettings.Title) embed.setTitle(embedSettings.Title.replace('{seller.username}', interaction.user.username).replace('{user.username}', user.username).replace('{currency}', `${currency.toUpperCase()}`))
            if(embedSettings.Color) embed.setColor(embedSettings.Color);
            if(!embedSettings.Color) embed.setColor(config.EmbedColors);
            if(embedSettings.Description) embed.setDescription(embedSettings.Description)
      
    if(embedSettings.ThumbnailEnabled) {
        if (embedSettings.CustomThumbnail && embedSettings.CustomThumbnail !== '') {
            embed.setThumbnail(embedSettings.CustomThumbnail);
        } else {
            embed.setThumbnail(user.displayAvatarURL({ format: 'png', dynamic: true }));
        }
      }
        
        embed.addFields(embedSettings.Fields.map(field => ({
            name: field.name,
            value: field.value
                .replace('{seller}', `<@!${interaction.user.id}>`)
                .replace('{seller.username}', interaction.user.username)
                .replace('{user}', `<@!${user.id}>`)
                .replace('{user.username}', user.username)
                .replace('{service}', service)
                .replace('{price}', `${convertedAmount} (${price} ${config.CryptoSettings.Currency})`)
                .replace('{address}', `${address2}`)
        })));
        
        if (embedSettings.Timestamp) {
            embed.setTimestamp();
        }
        
        const footerText = embedSettings.Footer.text
            .replace('{user.username}', user.username)
        
        // Check if footer.text is not blank before setting the footer
        if (footerText.trim() !== '') {
            if (embedSettings.Footer.Enabled && embedSettings.Footer.CustomIconURL == '' && embedSettings.Footer.IconEnabled) {
                embed.setFooter({
                    text: footerText,
                    iconURL: user.displayAvatarURL({ format: 'png', dynamic: true }),
                });
            } else {
                embed.setFooter({
                    text: footerText,
                });
            }
        }
        
        // Additional customization options from config.yaml
        if (footerText.trim() !== '' && embedSettings.Footer.CustomIconURL !== '' && embedSettings.Footer.IconEnabled) {
            embed.setFooter({
                text: footerText,  // Include text if it's not empty
                iconURL: embedSettings.Footer.CustomIconURL,
            });
        }

        interaction.editReply({ content: "Successfully created a crypto payment!" });
        interaction.channel.send({ embeds: [embed], components: [row] })
    
        let logsChannel; 
        if(!config.cryptoPayments.ChannelID) logsChannel = interaction.guild.channels.cache.get(config.TicketSettings.LogsChannelID);
        if(config.cryptoPayments.ChannelID) logsChannel = interaction.guild.channels.cache.get(config.cryptoPayments.ChannelID);

        const log = new EmbedBuilder()
        .setColor("Green")
        .setTitle(config.Locale.cryptoLogTitle)
        .addFields([
            { name: `• ${config.Locale.logsExecutor}`, value: `> <@!${interaction.user.id}>\n> ${interaction.user.username}` },
            { name: `• ${config.Locale.PayPalUser}`, value: `> <@!${user.id}>\n> ${user.username}` },
            { name: `• ${config.Locale.PayPalPrice}`, value: `> ${config.CryptoSettings.CurrencySymbol}${price}\n> ${price} ${currency}` },
            { name: `• ${config.Locale.PayPalService}`, value: `> ${service}` },
          ])
        .setTimestamp()
        .setThumbnail(interaction.user.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 }))
        .setFooter({ text: `${interaction.user.username}`, iconURL: `${interaction.user.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 })}` })
        if (logsChannel && config.cryptoPayments.Enabled) logsChannel.send({ embeds: [log] })
    

    }

}