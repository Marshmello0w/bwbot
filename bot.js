const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const database = require('./database');
const logger = require('./utils/logger');

// Client erstellen
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds
    ] 
});

// Command Collection
client.commands = new Collection();

// Commands laden
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        logger.info(`Command geladen: ${command.data.name}`);
    } else {
        logger.warn(`Command ${file} fehlt "data" oder "execute" property`);
    }
}

// Events laden
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
    
    logger.info(`Event geladen: ${event.name}`);
}

// Command Handler
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        logger.error(`Command nicht gefunden: ${interaction.commandName}`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        logger.error(`Fehler beim Ausführen von ${interaction.commandName}:`, error);
        
        const errorMessage = {
            content: 'Es ist ein Fehler bei der Ausführung dieses Befehls aufgetreten!',
            flags: 64  // Ephemeral flag
        };

        try {
            if (interaction.deferred) {
                await interaction.editReply(errorMessage);
            } else if (interaction.replied) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        } catch (replyError) {
            logger.error('Fehler beim Senden der Fehlermeldung:', replyError);
        }
    }
});

// Startup Prozess
async function start() {
    try {
        // Datenbank verbinden
        await database.connect();
        
        // Bot einloggen
        await client.login(config.discord.token);
        
        // Commands registrieren
        const guild = await client.guilds.fetch(config.discord.guildId);
        if (guild) {
            const commands = client.commands.map(cmd => cmd.data);
            await guild.commands.set(commands);
            logger.success(`${commands.length} Commands in Guild ${guild.name} registriert`);
        }
        
    } catch (error) {
        logger.error('Fehler beim Starten des Bots:', error);
        process.exit(1);
    }
}

// Error Handler
process.on('unhandledRejection', (reason, promise) => {
    logger.logCrash(new Error(`Unhandled Rejection: ${reason}`));
});

process.on('uncaughtException', (error) => {
    logger.logCrash(error);
    // Bei kritischen Fehlern Bot neustarten
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});

// Graceful Shutdown
process.on('SIGINT', async () => {
    logger.info('Bot wird heruntergefahren...');
    
    try {
        client.destroy();
        if (database.pool) {
            await database.pool.end();
        }
        logger.success('Bot erfolgreich heruntergefahren');
        process.exit(0);
    } catch (error) {
        logger.error('Fehler beim Herunterfahren:', error);
        process.exit(1);
    }
});

// Bot starten
start();