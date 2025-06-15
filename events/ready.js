const { Events, ActivityType } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        logger.success(`Bot ist online als ${client.user.tag}`);

        // Setze Bot-Status
        client.user.setPresence({
            activities: [{
                name: 'Crafting Orders',
                type: ActivityType.Watching
            }],
            status: 'online'
        });

        // Zeige Server-Informationen
        logger.info(`Aktiv auf ${client.guilds.cache.size} Server(n)`);
        
        client.guilds.cache.forEach(guild => {
            logger.info(`- ${guild.name} (${guild.id}) - ${guild.memberCount} Mitglieder`);
        });
    }
};
