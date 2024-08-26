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
const { ActionRowBuilder, ButtonBuilder, EmbedBuilder } = require("discord.js");
const Discord = require ("discord.js")
const fs = require('fs');
const yaml = require("js-yaml")
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'))
const commands = yaml.load(fs.readFileSync('./commands.yml', 'utf8'))
const utils = require("../../utils.js");
const paypalModel = require("../../models/paypalInvoicesModel");
const stripeModel = require("../../models/stripeInvoicesModel");
const ticketModel = require("../../models/ticketModel");

module.exports = {
    enabled: commands.Utility.Invoice.Enabled,
    data: new SlashCommandBuilder()
        .setName('invoice')
        .setDescription(commands.Utility.Invoice.Description)
        .addSubcommand(subcommand =>
            subcommand
                .setName('paypal')
                .setDescription('PayPal Invoice')
                .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
                .addNumberOption((option) => option.setName('price').setDescription('Price').setRequired(true))
                .addStringOption(option => option.setName('service').setDescription('Service').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stripe')
                .setDescription('Stripe Invoice')
                .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
                .addStringOption(option => option.setName('email').setDescription('Customer Email').setRequired(true))
                .addNumberOption((option) => option.setName('price').setDescription('Price').setRequired(true))
                .addStringOption(option => option.setName('service').setDescription('Service').setRequired(true))),
    async execute(interaction, client) {

      const ticketDB = await ticketModel.findOne({ channelID: interaction.channel.id });

        let subCmd = interaction.options.getSubcommand()
        let user = interaction.options.getUser("user");
        let price = interaction.options.getNumber("price");
        let service = interaction.options.getString("service");
        let customerEmail = interaction.options.getString("email");

if(subCmd === "paypal") {

        if(config.PayPalSettings.Enabled === false) return interaction.reply({ content: "This command has been disabled in the config!", ephemeral: true })
        if(config.PayPalSettings.OnlyInTicketChannels && !ticketDB) return interaction.reply({ content: config.Locale.NotInTicketChannel, ephemeral: true })

        let doesUserHaveRole = false
        for(let i = 0; i < config.PayPalSettings.AllowedRoles.length; i++) {
            role = interaction.guild.roles.cache.get(config.PayPalSettings.AllowedRoles[i]);
            if(role && interaction.member.roles.cache.has(config.PayPalSettings.AllowedRoles[i])) doesUserHaveRole = true;
          }
        if(doesUserHaveRole === false) return interaction.reply({ content: config.Locale.NoPermsMessage, ephemeral: true })
    
        await interaction.deferReply();

        let logoURL;
        if(!config.PayPalSettings.Logo) logoURL = interaction.guild.iconURL()
        if(config.PayPalSettings.Logo) logoURL = config.PayPalSettings.Logo

        let invoiceObject = {
          "merchant_info": {
            "email": config.PayPalSettings.Email,
            "business_name": interaction.guild.name,
          },
          "items": [{
            "name": service,
            "quantity": 1.0,
            "unit_price": {
              "currency": config.PayPalSettings.Currency,
              "value": price
            },
          }],
          "logo_url": logoURL,
          "note": config.PayPalSettings.Description,
          "payment_term": {
            "term_type": "NET_45"
          },
          "tax_inclusive": false,
          "shipping_info": {}
        }

        client.paypal.invoice.create(invoiceObject, async (err, invoice) => {
          if (err) {
            if (err.response.error === 'invalid_client') {
              console.log('\x1b[31m%s\x1b[0m', `[ERROR] The PayPal API Credentials you specified in the config are invalid! Make sure you use the "LIVE" mode!`);
            } else {
              console.error('PayPal API Error:', err);
              if (err.response.details) {
                console.error('Error Details:', err.response.details);
              }
            }
          } else {
            client.paypal.invoice.send(invoice.id, function(error, rv) {
              if (err) {
                console.log(err);
              } else {

                const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setStyle('Link')
                        .setURL(`https://www.paypal.com/invoice/payerView/details/${invoice.id}`) 
                        .setLabel(config.Locale.PayPalPayInvoice),
                    new ButtonBuilder()
                        .setCustomId(`${invoice.id}-unpaid`)
                        .setStyle('Danger')
                        .setLabel(config.PayPalSettings.StatusUnpaid)
                        .setDisabled(true))

                const embedSettings = config.PayPalSettings.Embed;
                const embed = new EmbedBuilder()
                    if(embedSettings.Title) embed.setTitle(embedSettings.Title.replace('{seller.username}', interaction.user.username).replace('{user.username}', user.username))
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
                        .replace('{price}', `${config.PayPalSettings.CurrencySymbol}${price} (${config.PayPalSettings.Currency})`)
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







                interaction.editReply({ embeds: [embed], components: [row] }).then(async function(msg) {

                  const newModel = new paypalModel({
                    invoiceID: invoice.id,
                    userID: user.id,
                    sellerID: interaction.user.id,
                    channelID: interaction.channel.id,
                    messageID: msg.id,
                    price: price,
                    service: service,
                    status: invoice.status,
                  });
                  await newModel.save();

                    let logsChannel; 
                    if(!config.paypalInvoice.ChannelID) logsChannel = interaction.guild.channels.cache.get(config.TicketSettings.LogsChannelID);
                    if(config.paypalInvoice.ChannelID) logsChannel = interaction.guild.channels.cache.get(config.paypalInvoice.ChannelID);

                    const log = new EmbedBuilder()
                    .setColor("Green")
                    .setTitle(config.Locale.PayPalLogTitle)
                    .addFields([
                        { name: `• ${config.Locale.logsExecutor}`, value: `> <@!${interaction.user.id}>\n> ${interaction.user.username}` },
                        { name: `• ${config.Locale.PayPalUser}`, value: `> <@!${user.id}>\n> ${user.username}` },
                        { name: `• ${config.Locale.PayPalPrice}`, value: `> ${config.PayPalSettings.CurrencySymbol}${price}` },
                        { name: `• ${config.Locale.PayPalService}`, value: `> ${service}` },
                      ])
                    .setTimestamp()
                    .setThumbnail(interaction.user.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 }))
                    .setFooter({ text: `${interaction.user.username}`, iconURL: `${interaction.user.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 })}` })

                    if (logsChannel && config.paypalInvoice.Enabled) logsChannel.send({ embeds: [log] })

                    let checkInvoice = setInterval(async () => {
                      await utils.checkPayPalPayments()

                      const invoiceDB = await paypalModel.findOne({ invoiceID: invoice.id });

                      if(invoiceDB && invoiceDB?.status === "paid") {
                        await clearInterval(checkInvoice);
                        await paypalModel.findOneAndDelete({ invoiceID: invoice.id });
                        return
                      }
    
                      if(invoiceDB && invoiceDB?.status === "deleted") {
                        await clearInterval(checkInvoice);
                        await paypalModel.findOneAndDelete({ invoiceID: invoice.id });
                        return
                      }
            
                  }, 20000);

                    })
                  }
                })
              }
            })



          } else if(subCmd === "stripe") {
            if(config.StripeSettings.Enabled === false) return interaction.reply({ content: "This command has been disabled in the config!", ephemeral: true })
            if(config.StripeSettings.OnlyInTicketChannels && !ticketDB) return interaction.reply({ content: config.Locale.NotInTicketChannel, ephemeral: true })
        
            let doesUserHaveRole = false
            for(let i = 0; i < config.StripeSettings.AllowedRoles.length; i++) {
                role = interaction.guild.roles.cache.get(config.StripeSettings.AllowedRoles[i]);
                if(role && interaction.member.roles.cache.has(config.StripeSettings.AllowedRoles[i])) doesUserHaveRole = true;
              }
            if(doesUserHaveRole === false) return interaction.reply({ content: config.Locale.NoPermsMessage, ephemeral: true })
    
            let fixpriced = price * 100
    
            await interaction.deferReply();
    
            client.stripe.customers.create({ email: customerEmail, name: user.username, description: `Discord User ID: ${user.id}` })
            .then((customer) => {
              return client.stripe.invoiceItems.create({
                  customer: customer.id,
                  amount: fixpriced,
                  currency: config.StripeSettings.Currency,
                  description: service,
                })
                .then((invoiceItem) => {
                  return client.stripe.invoices.create({
                    collection_method: 'send_invoice',
                    days_until_due: 30,
                    customer: invoiceItem.customer,
                    payment_settings: {
                      payment_method_types: config.StripeSettings.PaymentMethods,
                    },
                  });
                })
                .then(async (invoice) => {
                  await client.stripe.invoices.sendInvoice(invoice.id)
                  let invoice2 = await client.stripe.invoices.retrieve(invoice.id);
                  
                  const row = new Discord.ActionRowBuilder()
                  .addComponents(
                      new ButtonBuilder()
                          .setStyle('Link')
                          .setURL(`${invoice2.hosted_invoice_url}`) 
                          .setLabel(config.Locale.PayPalPayInvoice),
                      new ButtonBuilder()
                          .setCustomId(`${invoice.id}-unpaid`)
                          .setStyle('Danger')
                          .setLabel(config.PayPalSettings.StatusUnpaid)
                          .setDisabled(true))


                          const embedSettings = config.StripeSettings.Embed;
                          const embed = new EmbedBuilder()
                              if(embedSettings.Title) embed.setTitle(embedSettings.Title.replace('{seller.username}', interaction.user.username).replace('{user.username}', user.username))
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
                                  .replace('{price}', `${config.StripeSettings.CurrencySymbol}${price} (${config.StripeSettings.Currency})`)
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



                          interaction.editReply({ embeds: [embed], components: [row] }).then(async function(msg) {
        
                          let logsChannel; 
                          if(!config.stripeInvoice.ChannelID) logsChannel = interaction.guild.channels.cache.get(config.TicketSettings.LogsChannelID);
                          if(config.stripeInvoice.ChannelID) logsChannel = interaction.guild.channels.cache.get(config.stripeInvoice.ChannelID);
          
                          const log = new Discord.EmbedBuilder()
                          .setColor("Green")
                          .setTitle(config.Locale.StripeLogTitle)
                          .addFields([
                            { name: `• ${config.Locale.logsExecutor}`, value: `> <@!${interaction.user.id}>\n> ${interaction.user.username}` },
                            { name: `• ${config.Locale.PayPalUser}`, value: `> <@!${user.id}>\n> ${user.username}` },
                            { name: `• ${config.Locale.PayPalPrice}`, value: `> ${config.StripeSettings.CurrencySymbol}${price}` },
                            { name: `• ${config.Locale.PayPalService}`, value: `> ${service}` },
                          ])
                          .setTimestamp()
                          .setThumbnail(interaction.user.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 }))
                          .setFooter({ text: `${interaction.user.username}`, iconURL: `${interaction.user.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 })}` })
                          if (logsChannel && config.stripeInvoice.Enabled) logsChannel.send({ embeds: [log] })

                        const newModel = new stripeModel({
                          invoiceID: invoice2.id,
                          userID: user.id,
                          sellerID: interaction.user.id,
                          channelID: interaction.channel.id,
                          messageID: msg.id,
                          customerID: invoice2.customer,
                          price: price,
                          service: service,
                          status: invoice2.status,
                        });
                        await newModel.save();

                      })
        
                      let checkInvoice = setInterval(async () => {
                        await utils.checkStripePayments()
              
                        const invoiceDB = await stripeModel.findOne({ invoiceID: invoice2.id });

                        if(invoiceDB && invoiceDB?.status === "paid") {
                          await clearInterval(checkInvoice);
                          await stripeModel.findOneAndDelete({ invoiceID: invoice2.id });
                          return
                        }
        
                        if(invoiceDB && invoiceDB?.status === "deleted") {
                          await clearInterval(checkInvoice);
                          await stripeModel.findOneAndDelete({ invoiceID: invoice2.id });
                          return
                        }
              
                    }, 20000);
    
                })
                .catch((err) => {
                  console.log(err)
                });
            });
    
        }

}
}