require('dotenv').config();

module.exports = {
    // Discord Configuration
    discord: {
        token: process.env.DISCORD_TOKEN,
        guildId: process.env.GUILD_ID,
        allowedChannels: process.env.ALLOWED_CHANNELS ? process.env.ALLOWED_CHANNELS.split(',') : [],
        
        // Separate Webhooks für verschiedene Aktionen
        webhooks: {
            erstellt: process.env.WEBHOOK_ERSTELLT,
            fortschritt: process.env.WEBHOOK_FORTSCHRITT,
            abgeschlossen: process.env.WEBHOOK_ABGESCHLOSSEN,
            abgegeben: process.env.WEBHOOK_ABGEGEBEN,
            // Fallback auf alte URL falls neue nicht gesetzt
            default: process.env.WEBHOOK_URL
        }
    },

    // Database Configuration
    database: {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        charset: 'utf8mb4'  // UTF-8 Support für Umlaute
    },

    // Craft Items Configuration
    craftItems: [
        { name: 'Pistol Erweitertes Magazine', value: 'Pistol Erweitertes Magazine' },
        { name: 'SMG Erweitertes Magazine', value: 'SMG Erweitertes Magazine' },
        { name: 'SMG Trommel Magazine', value: 'SMG Trommel Magazine' },
        { name: 'Rifle Erweitertes Magazine', value: 'Rifle Erweitertes Magazine' },
        { name: 'Rifle Trommel Magazine', value: 'Rifle Trommel Magazine' },
        { name: 'SMG Scope', value: 'SMG Scope' },
        { name: 'Schalldämpfer', value: 'Schalldämpfer' },
        { name: 'Schutzweste', value: 'Schutzweste' },
        { name: 'Pistole', value: 'Pistole' },
        { name: '50er Pistole', value: '50er Pistole' },
        { name: 'Tec-9', value: 'Tec-9' }
    ],

    // Permissions
    permissions: {
        // Rolle IDs die Aufträge erstellen dürfen (leer = alle)
        createOrderRoles: [],
        // Rolle IDs die Aufträge bearbeiten dürfen (leer = alle)
        editOrderRoles: [],
        // Rolle IDs die Aufträge löschen dürfen (leer = alle)
        deleteOrderRoles: []
    }
};