const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const database = require('../database');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('list')
        .setDescription('Zeigt alle aktiven Aufträge an.')
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Maximale Anzahl der angezeigten Aufträge')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(50)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const limit = interaction.options.getInteger('limit') || 10;

        try {
            const auftraege = await database.getActiveAuftraege(limit);

            if (auftraege.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('📋 Aktive Aufträge')
                    .setDescription('Es gibt aktuell keine aktiven Aufträge.')
                    .setColor(0x95a5a6)
                    .setTimestamp();

                return await interaction.editReply({ embeds: [embed] });
            }

            const embed = new EmbedBuilder()
                .setTitle('Aktive Aufträge')
                .setDescription(`Zeige ${auftraege.length} von maximal ${limit} Aufträgen`)
                .setColor(0x3498db)
                .setTimestamp()
                .setFooter({ text: 'Blackwater Crafting System' });

            // Aufträge als Felder hinzufügen
            auftraege.forEach(auftrag => {
                const fortschrittProzent = Math.round((auftrag.fortschritt / auftrag.menge) * 100);
                const fortschrittBar = this.createProgressBar(fortschrittProzent);
                
                embed.addFields({
                    name: `#${auftrag.id} - ${auftrag.gegenstand}`,
                    value: [
                        `**Kunde:** ${auftrag.kunde}`,
                        `**Fortschritt:** ${auftrag.fortschritt}/${auftrag.menge} ${fortschrittBar} ${fortschrittProzent}%`,
                        `**Erstellt von:** ${auftrag.erstellt_von || 'Unbekannt'}`,
                        `**Erstellt:** ${new Date(auftrag.erstellt_am).toLocaleString('de-DE')}`
                    ].join('\n'),
                    inline: false
                });
            });

            await interaction.editReply({ embeds: [embed] });

            logger.info('Auftragsliste abgerufen', { 
                user: interaction.user.username,
                count: auftraege.length 
            });

        } catch (error) {
            logger.error('Fehler beim Abrufen der Auftragsliste:', error);

            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Fehler')
                .setDescription('Es ist ein Fehler beim Abrufen der Aufträge aufgetreten.')
                .setColor(0xe74c3c)
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    createProgressBar(percent) {
        const filled = Math.round(percent / 10);
        const empty = 10 - filled;
        return '█'.repeat(filled) + '░'.repeat(empty);
    }
};