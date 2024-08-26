const { Discord, StringSelectMenuBuilder, EmbedBuilder, ActionRowBuilder, TextInputBuilder, ModalBuilder } = require("discord.js");
const fs = require('fs');
const yaml = require("js-yaml")
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'))
const guildModel = require("../models/guildModel");
const ticketModel = require("../models/ticketModel");
const { updateDailyStats } = require('../events/dailyStatsUpdater');
const moment = require('moment-timezone');

module.exports = async (client, interaction, channel, buttonConfig) => {
    const ticket = await ticketModel.findOne({ channelID: channel.id });


    // Add 1 to globalStats.totalTickets when a new ticket gets created
    const statsDB = await guildModel.findOne({ guildID: config.GuildID });
    statsDB.totalTickets++;
    await statsDB.save();

    const metricsToUpdate = ['totalTickets'];
    await updateDailyStats(config.GuildID, metricsToUpdate);

    //

    // Sync globalStats.openTickets
    const openNow = await ticketModel.countDocuments({ status: 'Open', guildID: config.GuildID });

    if (statsDB.openTickets !== openNow) {
        statsDB.openTickets = openNow;
        await statsDB.save();
    }
    //

    // Send ticket question answers to the ticket
    if (ticket) {
        const ticketChannel = client.guilds.cache.get(ticket.guildID).channels.cache.get(ticket.channelID);
    

        if (config.WorkingHours && config.WorkingHours.Enabled && config.WorkingHours.AllowTicketsOutsideWorkingHours && config.WorkingHours.SendNoticeInTicket) {
          const workingHoursRegex = /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/;
          
          const currentDay = moment().tz(config.WorkingHours.Timezone).format('dddd');
          const workingHours = config.WorkingHours.Schedule[currentDay];
          
          if (!workingHours) {
              console.log('\x1b[31m%s\x1b[0m', `[ERROR] Working hours not configured for ${currentDay}. Contact support and provide your config.yml file.`);
              return;
          }
          
          const workingHoursMatch = workingHours.match(workingHoursRegex);
          
          if (!workingHoursMatch) {
              console.log('\x1b[31m%s\x1b[0m', `[ERROR] Invalid working hours configuration for ${currentDay} (format). Contact support and provide your config.yml file.`);
              return;
          }
      
          const currentTime = moment().tz(config.WorkingHours.Timezone);
          const startDate = currentTime.format('YYYY-MM-DD');
          
          const startTime = moment.tz(startDate + ' ' + workingHoursMatch[1], 'YYYY-MM-DD H:mm', config.WorkingHours.Timezone);
          const endTime = moment.tz(startDate + ' ' + workingHoursMatch[2], 'YYYY-MM-DD H:mm', config.WorkingHours.Timezone);
          
          if (!startTime.isValid() || !endTime.isValid() || startTime.isSameOrAfter(endTime)) {
              console.log('\x1b[31m%s\x1b[0m', `[ERROR] Invalid working hours configuration for ${currentDay}. Contact support and provide your config.yml file.`);
              return;
          }
          
          const withinWorkingHours = currentTime.isBetween(startTime, endTime);
      
          // Generate working hours placeholders for all days
          const workingHoursPlaceholders = {};
          for (const day in config.WorkingHours.Schedule) {
              const hours = config.WorkingHours.Schedule[day];
              const match = hours.match(workingHoursRegex);
              if (match) {
                  const start = moment.tz(startDate + ' ' + match[1], 'YYYY-MM-DD H:mm', config.WorkingHours.Timezone);
                  const end = moment.tz(startDate + ' ' + match[2], 'YYYY-MM-DD H:mm', config.WorkingHours.Timezone);
                  workingHoursPlaceholders[`{startTime-${day}}`] = `<t:${start.unix()}:t>`;
                  workingHoursPlaceholders[`{endTime-${day}}`] = `<t:${end.unix()}:t>`;
              } else {
                  console.log('\x1b[31m%s\x1b[0m', `[ERROR] Invalid working hours configuration for ${day} (format). Contact support and provide your config.yml file.`);
              }
          }
      
          // Replace placeholders in the locale string
          let workingHoursEmbedLocale = config.WorkingHours.outsideWorkingHoursMsg;
          for (const [placeholder, value] of Object.entries(workingHoursPlaceholders)) {
              workingHoursEmbedLocale = workingHoursEmbedLocale.replace(new RegExp(placeholder, 'g'), value);
          }
      
          // Replace current day placeholders
          workingHoursEmbedLocale = workingHoursEmbedLocale
              .replace(/{startTime-currentDay}/g, workingHoursPlaceholders[`{startTime-${currentDay}}`])
              .replace(/{endTime-currentDay}/g, workingHoursPlaceholders[`{endTime-${currentDay}}`]);
      
          if (!withinWorkingHours) {
              let workingHoursEmbed = new EmbedBuilder()
                  .setTitle(config.WorkingHours.outsideWorkingHoursTitle)
                  .setColor("Red")
                  .setDescription(workingHoursEmbedLocale)
                  .setFooter({
                      text: `${interaction.user.username}`,
                      iconURL: `${interaction.user.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 })}`
                  })
                  .setTimestamp();
              
              if (ticketChannel) ticketChannel.send({ embeds: [workingHoursEmbed] });
          }
      }

    // Check if the ticket has questions configured
    if (!ticket.questions || ticket.questions.length === 0) return;

    // Retrieve the buttonConfig using the parameter
    const buttonConfigValues = config[buttonConfig];
    if (!buttonConfigValues) {
        console.log(`Button config not found for key: ${buttonConfig}`);
        return;
    }

    // Check if the number of questions matches the configured questions
    if (ticket.questions.length !== buttonConfigValues.Questions.length) {
        console.log('Number of questions mismatch.');
        return;
    }
    
        // Check if the button values in the database match the configuration
        const mismatchedButtons = ticket.questions.some((question, index) => {
            const questionConfig = buttonConfigValues.Questions.find(configQuestion => configQuestion.customId === question.customId);
            return !questionConfig;
        });
    
        if (mismatchedButtons) {
            console.log('Button values in the database do not match the configuration.');
            return;
        }
    
    // Get the data entered by the user from the ticket responses
    const responses = ticket.questions.reduce((acc, question) => {
        acc[question.question] = question.response || config.Locale.notAnswered;
        return acc;
    }, {});
    
/*    // Check if the number of questions matches the configured questions
    if (Object.keys(responses).length !== ticket.questions.length) {
        console.log('Number of responses mismatch.');
        return;
    }*/

    // Check if the questions match the configured questions
    const mismatchedQuestions = ticket.questions.some(question => !responses.hasOwnProperty(question.question));
    if (mismatchedQuestions) {
        console.log('Questions do not match the configured questions.');
        return;
    }
    
        // Send the responses and questions in an embed to the ticket channel
        let ticketQuestionLocale = config.Locale.ticketQuestionsTitle.replace(/{category}/g, `${ticket.ticketType}`);
        const embed = new EmbedBuilder()
          .setTitle(ticketQuestionLocale)
          .setColor(config.EmbedColors);
    
        ticket.questions.forEach(question => {
          let response = responses[question.question];
          if (!response) response = config.Locale.notAnswered;
          embed.addFields({
            name: question.question,
            value: `\`\`\`${response}\`\`\``,
          });
        });
    
        if (ticketChannel) ticketChannel.send({ embeds: [embed] });
      }

};

// %%__FILEHASH__%%
// %%__NONCE__%%