const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require('discord.js');
const fs = require('fs');
const yaml = require('js-yaml');
const config = yaml.load(fs.readFileSync('./addons/Vouch/config.yml', 'utf8'));
const vouchCountFile = './addons/Vouch/vouchCount.json';

// Function to read and update the vouch count
function updateVouchCount() {
    let vouchCount = { count: 0 };

    try {
        // Read the current count from the file
        const data = fs.readFileSync(vouchCountFile, 'utf8');
        vouchCount = JSON.parse(data);
    } catch (err) {
        console.error('Error reading vouch count file:', err.message);
    }

    // Increment the count
    vouchCount.count++;

    try {
        // Update the count in the file
        fs.writeFileSync(vouchCountFile, JSON.stringify(vouchCount, null, 2), 'utf8');
    } catch (err) {
        console.error('Error updating vouch count file:', err.message);
    }

    return vouchCount.count;
}

const commandData = new SlashCommandBuilder()
    .setName('vouch')
    .setDescription('Vouch for a user or the business.')
    .addStringOption(option =>
        option.setName('message')
            .setDescription('Your vouch message.')
            .setRequired(true))
    .addIntegerOption(option =>
        option.setName('stars')
            .setDescription('Number of stars (1-5).')
            .setRequired(true)
            .addChoices(
                { name: '⭐', value: 1 }, 
                { name: '⭐⭐', value: 2 }, 
                { name: '⭐⭐⭐', value: 3 },
                { name: '⭐⭐⭐⭐', value: 4 },
                { name: '⭐⭐⭐⭐⭐', value: 5 }));

// Conditionally add the user option
if (config.allowUserSpecificVouch) {
    commandData.addUserOption(option =>
        option.setName('user')
            .setDescription('The user you want to vouch for.')
            .setRequired(true));
}

if (config.uploadImage) {
commandData.addAttachmentOption(option =>
    option.setName('attachment')
        .setDescription('Attach an image/proof that will be displayed in the vouch message')
        .setRequired(config.uploadImage));
}

module.exports = {
    data: commandData,
    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });
        const messageContent = interaction.options.getString('message');
        const stars = interaction.options.getInteger('stars');
        const attachment = interaction.options.getAttachment('attachment');

        // Fetch author object for use in the embed
        const vouchAuthor = client.users.cache.get(interaction.user.id);

        // Update the vouch count and get the updated count
        const vouchCount = updateVouchCount();

        // Read customization options from the config
        const customizationOptions = config.customization || {};

        const member = interaction.guild.members.cache.get(interaction.user.id);

        if (!member.roles.cache.some(role => config.requiredRoles.includes(role.id))) return interaction.editReply({ content: 'You are not allowed to use this command!', ephemeral: true })

        // Read customization options
        const {
            vouchTitle = "🎉 Vouch (#${count})",
            vouchFooterText = "Vouched by ${authorTag}",
            userFieldTitle = "Vouched User",
            vouchedByFieldTitle = "Vouched By",
            vouchedAtFieldTitle = "Vouched at",
            starsFieldTitle = "Stars",
            messageDescription = "${messageContent}"
        } = customizationOptions;

        const vouchEmbed = new Discord.EmbedBuilder()
            .setColor(customizationOptions.embedColor)
            .setTitle(vouchTitle.replace("${count}", vouchCount))
            .setFooter({ text: vouchFooterText.replace("${authorTag}", vouchAuthor.tag), iconURL: vouchAuthor.displayAvatarURL() });

        // If user-specific vouching is enabled, include user information in the embed
        if (config.allowUserSpecificVouch) {
            const user = interaction.options.getUser('user');
            const vouchedUser = client.users.cache.get(user.id);

            // Set fields in the embed using customization options
            vouchEmbed.addFields(
                { name: userFieldTitle, value: `${vouchedUser}`, inline: true },
                { name: vouchedByFieldTitle, value: `${vouchAuthor}`, inline: true },
                { name: vouchedAtFieldTitle, value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                { name: starsFieldTitle, value: `${'⭐'.repeat(stars)} \`\`(${stars}/5)\`\``, inline: true }
            );
            vouchEmbed.setDescription(messageDescription.replace("${messageContent}", messageContent));
        } else {
            // Set fields in the embed using customization options
            vouchEmbed.addFields(
                { name: vouchedByFieldTitle, value: `${vouchAuthor}`, inline: true },
                { name: vouchedAtFieldTitle, value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                { name: starsFieldTitle, value: `${'⭐'.repeat(stars)} \`\`(${stars}/5)\`\``, inline: true }
            );
            vouchEmbed.setDescription(messageDescription.replace("${messageContent}", messageContent));
        }

        // If image upload is enabled and an attachment is present, add it to the embed
        if (config.uploadImage && attachment && attachment.contentType.startsWith('image')) {
            vouchEmbed.setImage(attachment.url);
        }

        // Send the embed to the specified channel
        const vouchChannel = client.channels.cache.get(config.vouchChannelId);
        if (vouchChannel) vouchChannel.send({ embeds: [vouchEmbed] });

        // Respond to the interaction
        interaction.editReply({ content: 'You successfully vouched!', ephemeral: true });
    },
};
