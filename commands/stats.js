const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const database = require('../database');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Zeigt erweiterte Statistiken über die Aufträge an.'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const stats = await database.getStatistics();
            const userStats = await database.getDetailedUserStatistics();

            const embed = new EmbedBuilder()
                .setTitle('Auftragsstatistiken')
                .setDescription('Übersicht über alle Aufträge')
                .addFields(
                    { name: 'Aktive Aufträge', value: `${stats.aktiv}`, inline: true },
                    { name: 'Abgeschlossene Aufträge', value: `${stats.abgeschlossen}`, inline: true },
                    { name: 'Gesamt erstellt', value: `${stats.gesamtErstellt}`, inline: true }
                )
                .setColor(0x3498db)
                .setTimestamp()
                .setFooter({ text: 'Blackwater Crafting System' });

            // Top Gegenstände hinzufügen
            if (stats.topGegenstaende.length > 0) {
                const topItems = stats.topGegenstaende
                    .map((item, index) => {
                        return `${index + 1}. **${item.gegenstand}**: ${item.total}x`;
                    })
                    .join('\n');
                
                embed.addFields({ name: 'Top 5 Gegenstände', value: topItems });
            }
            
            // Benutzer-Abgabe-Statistiken
            if (userStats.length > 0) {
                const abgabeStats = userStats
                    .slice(0, 5)
                    .map((user, index) => {
                        return `${index + 1}. **${user.benutzer_name}**\n   📦 Abgegeben: ${user.abgegeben} | ✅ Abgeschlossen: ${user.abgeschlossen} | 🆕 Erstellt: ${user.erstellt}`;
                    })
                    .join('\n');
                
                embed.addFields({ name: 'Benutzer-Statistiken (Top 5)', value: abgabeStats || 'Keine Daten' });
            }
            
            // Letzte Aktivitäten
            if (stats.letzteAktivitaet.length > 0) {
                const aktivitaeten = stats.letzteAktivitaet
                    .map(a => {
                        const aktionEmoji = {
                            'ERSTELLT': '🆕',
                            'FORTSCHRITT': '📊',
                            'ABGESCHLOSSEN': '✅',
                            'ABGEGEBEN': '📦'
                        }[a.aktion] || '❓';
                        return `${aktionEmoji} **${a.benutzer_name}** - ${a.aktion} (${new Date(a.zeitstempel).toLocaleString('de-DE')})`;
                    })
                    .join('\n');
                
                embed.addFields({ name: 'Letzte Aktivitäten', value: aktivitaeten });
            }

            await interaction.editReply({ embeds: [embed] });

            logger.info('Erweiterte Statistiken abgerufen', { user: interaction.user.username });

        } catch (error) {
            logger.error('Fehler beim Abrufen der Statistiken:', error);

            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Fehler')
                .setDescription('Es ist ein Fehler beim Abrufen der Statistiken aufgetreten.')
                .setColor(0xe74c3c)
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};