const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const database = require('../database');
const webhook = require('../utils/webhook');
const permissions = require('../utils/permissions');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('craft')
        .setDescription('Startet eine Herstellung.')
        .addStringOption(option =>
            option.setName('kunde')
                .setDescription('Name des Kunden')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('gegenstand')
                .setDescription('Der Gegenstand, der hergestellt wird')
                .setRequired(true)
                .addChoices(...config.craftItems))
        .addIntegerOption(option =>
            option.setName('menge')
                .setDescription('Anzahl der zu herstellenden Gegenstände')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(9999))
        .addStringOption(option =>
            option.setName('sonstige_infos')
                .setDescription('Optional: Weitere Informationen zum Auftrag')
                .setRequired(false)),

    async execute(interaction) {
        // Kanal-Berechtigung prüfen
        if (!permissions.isChannelAllowed(interaction.channelId)) {
            return await interaction.reply({ 
                content: 'Dieser Befehl kann in diesem Kanal nicht verwendet werden.', 
                ephemeral: true 
            });
        }

        // Benutzer-Berechtigung prüfen
        if (!permissions.hasPermission(interaction.member, 'CREATE_ORDER')) {
            return await interaction.reply({ 
                content: permissions.getPermissionError('CREATE_ORDER'), 
                ephemeral: true 
            });
        }

        try {
            // Defer the reply SOFORT für längere Verarbeitung
            await interaction.deferReply();

            const kunde = interaction.options.getString('kunde');
            const gegenstand = interaction.options.getString('gegenstand');
            const menge = interaction.options.getInteger('menge');
            const sonstigeInfos = interaction.options.getString('sonstige_infos') || 'Keine zusätzlichen Informationen';
            // Auftrag in Datenbank speichern
            const auftragId = await database.createAuftrag(
                kunde, 
                gegenstand, 
                menge, 
                sonstigeInfos,
                `${interaction.user.username}#${interaction.user.discriminator}`
            );

            // Embed erstellen
            const embed = new EmbedBuilder()
                .setTitle('Herstellung in Bearbeitung')
                .setDescription(`Auftrag #${auftragId}`)
                .addFields(
                    { name: 'Kunde', value: kunde, inline: true },
                    { name: 'Gegenstand', value: gegenstand, inline: true },
                    { name: 'Menge', value: `${menge}`, inline: true },
                    { name: 'Herstellungsfortschritt', value: `0 / ${menge} (0%)` },
                    { name: 'Sonstige Informationen', value: sonstigeInfos },
                    { name: 'Erstellt von', value: interaction.user.username, inline: true },
                    { name: 'Erstellt am', value: new Date().toLocaleString('de-DE'), inline: true }
                )
                .setColor(0x3498db)
                .setFooter({ text: 'Blackwater Crafting System' })
                .setTimestamp();

            // Buttons erstellen
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`increment_${auftragId}`)
                        .setLabel('Fortschritt +')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`decrement_${auftragId}`)
                        .setLabel('Fortschritt -')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`complete_${auftragId}`)
                        .setLabel('Abschließen')
                        .setStyle(ButtonStyle.Success)
                );

            const reply = await interaction.editReply({ embeds: [embed], components: [row] });
            
            // Message ID in Datenbank speichern
            await database.updateMessageId(auftragId, reply.id, interaction.channelId);

            // Webhook senden
            await webhook.send('ERSTELLT', interaction.user, {
                id: auftragId,
                kunde,
                gegenstand,
                menge,
                fortschritt: 0,
                sonstige_infos: sonstigeInfos,
                abgeschlossen: false
            });

            logger.info(`Auftrag #${auftragId} erstellt`, {
                user: interaction.user.username,
                kunde,
                gegenstand,
                menge
            });

        } catch (error) {
            logger.error('Fehler beim Erstellen des Auftrags:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Fehler')
                .setDescription('Es ist ein Fehler beim Erstellen des Auftrags aufgetreten.')
                .setColor(0xe74c3c)
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed], components: [] });
        }
    }
};