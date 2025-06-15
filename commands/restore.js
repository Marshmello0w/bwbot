const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const database = require('../database');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('restore')
        .setDescription('Stellt alle aktiven Aufträge nach einem Neustart wieder her.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // Hole alle aktiven Aufträge mit gespeicherten Message IDs
            const auftraege = await database.getAuftraegeWithMessages();
            
            let wiederhergestellt = 0;
            let fehler = 0;

            for (const auftrag of auftraege) {
                try {
                    // Versuche den Kanal zu finden
                    const channel = await interaction.client.channels.fetch(auftrag.channel_id);
                    if (!channel) continue;

                    // Versuche die alte Nachricht zu finden und zu löschen
                    try {
                        const oldMessage = await channel.messages.fetch(auftrag.message_id);
                        await oldMessage.delete();
                    } catch (e) {
                        // Nachricht existiert nicht mehr, das ist ok
                    }

                    // Erstelle neues Embed
                    const fortschrittProzent = Math.round((auftrag.fortschritt / auftrag.menge) * 100);
                    
                    const embed = new EmbedBuilder()
                        .setTitle(auftrag.abgeschlossen ? 'Herstellung abgeschlossen' : 'Herstellung in Bearbeitung')
                        .setDescription(`Auftrag #${auftrag.id}`)
                        .addFields(
                            { name: 'Kunde', value: auftrag.kunde, inline: true },
                            { name: 'Gegenstand', value: auftrag.gegenstand, inline: true },
                            { name: 'Menge', value: `${auftrag.menge}`, inline: true },
                            { name: 'Herstellungsfortschritt', value: `${auftrag.fortschritt} / ${auftrag.menge} (${fortschrittProzent}%)` },
                            { name: 'Sonstige Informationen', value: auftrag.sonstige_infos || 'Keine' },
                            { name: 'Erstellt von', value: auftrag.erstellt_von || 'Unbekannt', inline: true },
                            { name: 'Erstellt am', value: new Date(auftrag.erstellt_am).toLocaleString('de-DE'), inline: true }
                        )
                        .setColor(auftrag.abgeschlossen ? 0x2ecc71 : 0x3498db)
                        .setFooter({ text: 'Blackwater Crafting System - Wiederhergestellt' })
                        .setTimestamp();

                    // Buttons erstellen
                    let row;
                    if (auftrag.abgeschlossen) {
                        row = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`delete_${auftrag.id}`)
                                    .setLabel('Auftrag Abgeben')
                                    .setStyle(ButtonStyle.Danger)
                            );
                    } else {
                        row = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`increment_${auftrag.id}`)
                                    .setLabel('Fortschritt +')
                                    .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                    .setCustomId(`decrement_${auftrag.id}`)
                                    .setLabel('Fortschritt -')
                                    .setStyle(ButtonStyle.Danger),
                                new ButtonBuilder()
                                    .setCustomId(`complete_${auftrag.id}`)
                                    .setLabel('Abschließen')
                                    .setStyle(ButtonStyle.Success)
                            );
                    }

                    // Neue Nachricht senden
                    const newMessage = await channel.send({ embeds: [embed], components: [row] });
                    
                    // Neue Message ID speichern
                    await database.updateMessageId(auftrag.id, newMessage.id, channel.id);
                    
                    wiederhergestellt++;
                } catch (error) {
                    logger.error(`Fehler beim Wiederherstellen von Auftrag #${auftrag.id}:`, error);
                    fehler++;
                }
            }

            const resultEmbed = new EmbedBuilder()
                .setTitle('Wiederherstellung abgeschlossen')
                .setDescription(`Die aktiven Aufträge wurden wiederhergestellt.`)
                .addFields(
                    { name: 'Wiederhergestellt', value: `${wiederhergestellt}`, inline: true },
                    { name: 'Fehler', value: `${fehler}`, inline: true },
                    { name: 'Gesamt', value: `${auftraege.length}`, inline: true }
                )
                .setColor(wiederhergestellt > 0 ? 0x2ecc71 : 0xe74c3c)
                .setTimestamp();

            await interaction.editReply({ embeds: [resultEmbed] });

            logger.info(`Aufträge wiederhergestellt`, {
                user: interaction.user.username,
                wiederhergestellt,
                fehler
            });

        } catch (error) {
            logger.error('Fehler beim Wiederherstellen der Aufträge:', error);

            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Fehler')
                .setDescription('Es ist ein Fehler beim Wiederherstellen der Aufträge aufgetreten.')
                .setColor(0xe74c3c)
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};