const Discord = require("discord.js");
const fs = require('fs');
const yaml = require("js-yaml");
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
const guildModel = require("../models/guildModel");
const WeeklyStats = require('../models/weeklyStatsModel');

const updateDailyStats = async (guildID, metricsToUpdate) => {
  try {
    const currentDate = new Date();

    // Calculate the start of the current week (Monday)
    const startOfWeek = new Date(currentDate);
    const dayOfWeek = currentDate.getDay();
    startOfWeek.setDate(currentDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
    startOfWeek.setUTCHours(0, 0, 0, 0); // Set time to midnight

    // Find the weekly stats document for the current week and day
    let weeklyStats = await WeeklyStats.findOne({
      weekStartDate: startOfWeek
    });

    if (!weeklyStats) {
      // If no weekly stats document exists for the week, create a new one
      weeklyStats = new WeeklyStats({
        weekStartDate: startOfWeek,
        dailyMetrics: []
      });
    }

    // Find the daily metrics entry for the current date
    const currentDateWithoutTime = new Date(currentDate);
    currentDateWithoutTime.setUTCHours(0, 0, 0, 0); // Set time to midnight

    const dailyMetricIndex = weeklyStats.dailyMetrics.findIndex(entry => entry.timestamp.getTime() === currentDateWithoutTime.getTime());

    if (dailyMetricIndex !== -1) {
      // If an entry for the current date exists, update it
      metricsToUpdate.forEach(metric => {
        // Check if the metric exists in the current daily entry, and add it if not
        if (weeklyStats.dailyMetrics[dailyMetricIndex][metric] === undefined) {
          weeklyStats.dailyMetrics[dailyMetricIndex][metric] = 0;
        }
        weeklyStats.dailyMetrics[dailyMetricIndex][metric]++;
      });
    } else {
      // If no entry for the current date exists, create a new one
      const newDailyMetric = {
        timestamp: currentDateWithoutTime, // Set to midnight of the current day
        totalTickets: 0,
        ticketsClosed: 0,
        totalMessages: 0,
        totalReviews: 0,
        totalClaims: 0,
        totalSuggestions: 0,
        totalSuggestionUpvotes: 0,
        totalSuggestionDownvotes: 0,
        usersJoined: 0,
        usersLeft: 0,
        newBans: 0,
        newRoles: 0,
      };

      metricsToUpdate.forEach(metric => {
        // Check if the metric exists in the new daily entry, and add it if not
        if (newDailyMetric[metric] === undefined) {
          newDailyMetric[metric] = 0;
        }
        // Set the metric value to 1 for a new entry
        newDailyMetric[metric] = 1;
      });

      weeklyStats.dailyMetrics.push(newDailyMetric);
    }

    // Save the updated or new weekly stats document
    await weeklyStats.save();

  } catch (error) {
    console.error('Error updating daily stats:', error);
  }
};

module.exports = { updateDailyStats };