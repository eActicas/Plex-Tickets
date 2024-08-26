if (process.platform !== "win32") require("child_process").exec("npm install");


const color = require('ansi-colors');
const axios = require('axios');
console.log(`${color.yellow(`Starting bot, this can take a while..`)}`);
const fs = require('fs');

const version = Number(process.version.split('.')[0].replace('v', ''));
if (version < 18) {
  console.log(`${color.red(`[ERROR] Plex Tickets requires a NodeJS version of 18 or higher!\nYou can check your NodeJS by running the "node -v" command in your terminal.`)}`);

  // Add update instructions
  console.log(`${color.blue(`\n[INFO] To update Node.js, follow the instructions below for your operating system:`)}`);
  console.log(`${color.green(`- Windows:`)} Download and run the installer from ${color.cyan(`https://nodejs.org/`)}`);
  console.log(`${color.green(`- Ubuntu/Debian:`)} Run the following commands in the Terminal:`);
  console.log(`${color.cyan(`  - sudo apt update`)}`);
  console.log(`${color.cyan(`  - sudo apt upgrade nodejs`)}`);
  console.log(`${color.green(`- CentOS:`)} Run the following commands in the Terminal:`);
  console.log(`${color.cyan(`  - sudo yum update`)}`);
  console.log(`${color.cyan(`  - sudo yum install -y nodejs`)}`);

  let logMsg = `\n\n[${new Date().toLocaleString()}] [ERROR] Plex Tickets requires a NodeJS version of 18 or higher!`;
  fs.appendFile("./logs.txt", logMsg, (e) => { 
    if(e) console.log(e);
  });

  process.exit()
}

const packageFile = require('./package.json');
let logMsg = `\n\n[${new Date().toLocaleString()}] [STARTING] Attempting to start the bot..\nNodeJS Version: ${process.version}\nBot Version: ${packageFile.version}`;
fs.appendFile("./logs.txt", logMsg, (e) => { 
  if(e) console.log(e);
});

const { Collection, Client, Discord, ActionRowBuilder, ButtonBuilder, GatewayIntentBits } = require('discord.js');
const yaml = require("js-yaml")
const client = new Client({ 
  restRequestTimeout: 60000,
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.GuildMembers, 
    GatewayIntentBits.GuildPresences, 
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ] 
});

let config = ""
try {
  config = yaml.load(fs.readFileSync('./config.yml', 'utf8'))
  } catch (e) {
    if (e instanceof yaml.YAMLException) {
      console.error(color.red('An error was found in your config.yml file'), e.message);
      console.error(``);
      console.error(color.yellow(`Error position: Line ${e.mark.line + 1}, Column ${e.mark.column + 1}`));
      console.error(``);

      console.error(color.red('IMPORTANT INFORMATION:'));
      console.error(color.yellow('YAML files are strict about how text is spaced and positioned.'));
      console.error(color.yellow('Make sure every line is correctly lined up.'));
      console.error(color.yellow('Use spaces for indentation and keep them consistent.'));
      console.error(color.yellow('Check that each section starts with the right number of spaces.'));
      console.error(color.yellow('The message above should display the part that is not formatted properly, and the location.'));
    } else {
      console.error(color.red('Error reading configuration file:'), e.message);
    }
    process.exit(1); // Exit the process on error
  }

module.exports = client
require("./utils.js");

const utils = require("./utils.js");
const createTranscriptFolder = async () => {
  let dashboardExists = await utils.checkDashboard();
  if(config.TicketTranscriptSettings.SaveInFolder && !dashboardExists && !fs.existsSync('./transcripts')) fs.mkdirSync('./transcripts');
  if(dashboardExists && !fs.existsSync('./addons/Dashboard/transcripts')) fs.mkdirSync('./addons/Dashboard/transcripts');
};
createTranscriptFolder()


async function uploadToHaste(textToUpload) {
  try {
    const response = await axios.post('https://paste.plexdevelopment.net/documents', textToUpload);
    return response.data.key;
  } catch (error) {
    if (error.response) {
      console.error('Error uploading to Haste-server. Status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else {
      console.error('Error uploading to Haste-server:', error.message);
    }
    return null;
  }
}

const filePath = './logs.txt';
const maxLength = 300; // Maximum lines of content

async function handleAndUploadError(errorType, error) {
  console.log(error);

  const errorPrefix = `[${new Date().toLocaleString()}] [${errorType}] [v${packageFile.version}]`;
  const errorMsg = `\n\n${errorPrefix}\n${error.stack}`;
  fs.appendFile("./logs.txt", errorMsg, (e) => {
    if (e) console.log(e);
  });

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading file:', err.message);
      return;
    }

    // Truncate older lines if content exceeds maxLength
    const lines = data.split('\n');
    const truncatedContent = lines.length > maxLength ? lines.slice(-maxLength).join('\n') : data;

    uploadToHaste(truncatedContent).then(key => {
      if (key) {
        const hasteURL = `https://paste.plexdevelopment.net/${key}`;
        console.log(`${color.green.bold(`[v${packageFile.version}]`)} ${color.red(`If you require assistance, create a ticket in our Discord server and share this link:`)} ${color.yellow(hasteURL)}\n\n`);
      } else {
        console.log('Paste Upload failed.');
      }
    });
  });
}

client.on('warn', async (error) => {
  handleAndUploadError('WARN', error);
});

client.on('error', async (error) => {
  handleAndUploadError('ERROR', error);
});

process.on('unhandledRejection', async (error) => {
  handleAndUploadError('unhandledRejection', error);
});

process.on('uncaughtException', async (error) => {
  handleAndUploadError('uncaughtException', error);
});