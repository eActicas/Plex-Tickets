const Discord = require("discord.js");
const fs = require('fs');
const yaml = require("js-yaml")
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'))

module.exports.run = async (client) => {
    client.on('ready', async (client) => {
        console.log("This is an example addon! You can delete it in addons/example")
    });
};