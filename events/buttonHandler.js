const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const database = require('../database');
const webhook = require('../utils/webhook');
const permissions = require('../utils/permissions');
const logger = require('../utils/logger');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isButton()) return;

        const [action, auftragId] = interaction.customId.split('_');

        try {
            // Auftrag abrufen
            const auftrag = await database.getAuftrag(auftragId);
            if (!auftrag) {
                return await interaction.reply({ 
                    content: 'Fehler: Auftrag nicht gefunden.', 
                    ephemeral: true 
                });
            }

            const userInfo = {
                id: interaction.user.id,
                username: interaction.user.username
            };

            let updated = false;
            let webhookAction = null;

            switch (action) {
                case 'increment':
                    if (!permissions.hasPermission(interaction.member, 'EDIT_ORDER')) {
                        return await interaction.reply({ 
                            content: permissions.getPermissionError('EDIT_ORDER'), 
                            ephemeral: true 
                        });
                    }

                    if (auftrag.fortschritt < auftrag.menge) {
                        await database.updateFortschritt(auftragId, auftrag.fortschritt + 1, userInfo);
                        auftrag.fortschritt++;
                        updated = true;
                        webhookAction = 'FORTSCHRITT';
                        
                        // Auto-Abschluss bei 100%
                        if (auftrag.fortschritt === auftrag.menge && !auftrag.abgeschlossen) {
                            await database.completeAuftrag(auftragId, userInfo);
                            auftrag.abgeschlossen = true;
                            webhookAction = 'ABGESCHLOSSEN';
                        }
                    }
                    break;

                case 'decrement':
                    if (!permissions.hasPermission(interaction.member, 'EDIT_ORDER')) {
                        return await interaction.reply({ 
                            content: permissions.getPermissionError('EDIT_ORDER'), 
                            ephemeral: true 
                        });
                    }

                    if (auftrag.fortschritt > 0) {
                        await database.updateFortschritt(auftragId, auftrag.fortschritt - 1, userInfo);
                        auftrag.fortschritt--;
                        updated = true;
                        webhookAction = 'FORTSCHRITT';
                    }
                    break;

                case 'complete':
                    if (!permissions.hasPermission(interaction.member, 'EDIT_ORDER')) {
                        return await interaction.reply({ 
                            content: permissions.getPermissionError('EDIT_ORDER'), 
                            ephemeral: true 
                        });
                    }

                    if (!auftrag.abgeschlossen) {
                        // Hole aktuellen Stand aus DB nochmal (wichtig!)
                        const aktuellerAuftrag = await database.getAuftrag(auftragId);
                        
                        // Nur wenn wirklich noch Fortschritt fehlt
                        if (aktuellerAuftrag.fortschritt < aktuellerAuftrag.menge) {
                            const fehlendeStücke = aktuellerAuftrag.menge - aktuellerAuftrag.fortschritt;
                            
                            // Füge den fehlenden Fortschritt hinzu
                            await database.updateFortschritt(auftragId, aktuellerAuftrag.menge, userInfo);
                            
                            // Historie-Eintrag für die automatische Vervollständigung
                            await database.addHistorie(
                                auftragId, 
                                'FORTSCHRITT', 
                                userInfo.id, 
                                userInfo.username,
                                `Fortschritt geändert: ${aktuellerAuftrag.fortschritt} → ${aktuellerAuftrag.menge} (Automatisch beim Abschließen)`
                            );
                            
                            // Sende auch Webhook für den Fortschritt
                            await webhook.send('FORTSCHRITT', interaction.user, {
                                ...aktuellerAuftrag,
                                fortschritt: aktuellerAuftrag.menge
                            });
                        }
                        
                        // Jetzt als abgeschlossen markieren
                        await database.completeAuftrag(auftragId, userInfo);
                        auftrag.fortschritt = aktuellerAuftrag.menge;
                        auftrag.abgeschlossen = true;
                        updated = true;
                        webhookAction = 'ABGESCHLOSSEN';
                    }
                    break;

                case 'delete':
                    if (!permissions.hasPermission(interaction.member, 'DELETE_ORDER')) {
                        return await interaction.reply({ 
                            content: permissions.getPermissionError('DELETE_ORDER'), 
                            ephemeral: true 
                        });
                    }

                    // Bestätigungsdialog wäre hier sinnvoll
                    await database.deleteAuftrag(auftragId, userInfo);
                    await webhook.send('ABGEGEBEN', interaction.user, auftrag);
                    await interaction.message.delete();
                    
                    logger.info(`Auftrag #${auftragId} gelöscht`, { 
                        user: interaction.user.username 
                    });
                    return;
            }

            if (updated) {
                // Embed aktualisieren
                const fortschrittProzent = Math.round((auftrag.fortschritt / auftrag.menge) * 100);
                const embed = EmbedBuilder.from(interaction.message.embeds[0]);

                if (auftrag.abgeschlossen) {
                    embed
                        .setTitle('Herstellung abgeschlossen')
                        .setColor(0x2ecc71)
                        .spliceFields(3, 1, { 
                            name: 'Herstellungsfortschritt', 
                            value: `${auftrag.menge} / ${auftrag.menge} (100%)` 
                        });

                    // Nur noch den Löschen-Button anzeigen
                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`delete_${auftragId}`)
                                .setLabel('Auftrag Abgeben')
                                .setStyle(ButtonStyle.Danger)
                        );

                    await interaction.update({ embeds: [embed], components: [row] });
                } else {
                    // Fortschritt aktualisieren
                    embed.spliceFields(3, 1, { 
                        name: 'Herstellungsfortschritt', 
                        value: `${auftrag.fortschritt} / ${auftrag.menge} (${fortschrittProzent}%)` 
                    });

                    await interaction.update({ embeds: [embed] });
                }

                // Webhook senden
                if (webhookAction) {
                    await webhook.send(webhookAction, interaction.user, auftrag);
                }

                logger.info(`Auftrag #${auftragId} aktualisiert`, {
                    user: interaction.user.username,
                    action: action,
                    fortschritt: auftrag.fortschritt
                });
            } else {
                // Keine Änderung notwendig
                await interaction.deferUpdate();
            }

        } catch (error) {
            logger.error('Fehler bei Button-Interaktion:', error);
            
            try {
                await interaction.reply({ 
                    content: 'Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.', 
                    ephemeral: true 
                });
            } catch {
                // Falls reply fehlschlägt, ignorieren
            }
        }
    }
};