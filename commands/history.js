const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const database = require('../database');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('history')
        .setDescription('Zeigt die Historie eines Auftrags an.')
        .addIntegerOption(option =>
            option.setName('auftrag_id')
                .setDescription('Die ID des Auftrags')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const auftragId = interaction.options.getInteger('auftrag_id');

        try {
            // Historie abrufen (funktioniert auch für gelöschte Aufträge)
            const historie = await database.getAuftragHistorie(auftragId);
            
            if (historie.length === 0) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Keine Historie gefunden')
                    .setDescription(`Für Auftrag #${auftragId} existiert keine Historie.`)
                    .setColor(0xe74c3c)
                    .setTimestamp();

                return await interaction.editReply({ embeds: [errorEmbed] });
            }

            // Versuche Auftrag zu finden (kann null sein wenn gelöscht)
            const auftrag = await database.getAuftrag(auftragId);
            
            // Extrahiere Infos aus der Historie falls Auftrag gelöscht
            let auftragInfo = {
                gegenstand: 'Unbekannt',
                kunde: 'Unbekannt',
                menge: 'Unbekannt',
                status: 'Gelöscht'
            };

            if (auftrag) {
                // Auftrag existiert noch
                auftragInfo = {
                    gegenstand: auftrag.gegenstand,
                    kunde: auftrag.kunde,
                    menge: auftrag.menge,
                    status: auftrag.abgeschlossen ? 'Abgeschlossen' : 'In Bearbeitung',
                    fortschritt: auftrag.fortschritt
                };
            } else {
                // Versuche Infos aus dem ersten Historie-Eintrag zu extrahieren
                const erstelltEintrag = historie.find(h => h.aktion === 'ERSTELLT');
                if (erstelltEintrag && erstelltEintrag.details) {
                    // Parse: "Auftrag erstellt: 5x Pistole für TestKunde"
                    const match = erstelltEintrag.details.match(/(\d+)x (.+) für (.+)/);
                    if (match) {
                        auftragInfo.menge = match[1];
                        auftragInfo.gegenstand = match[2];
                        auftragInfo.kunde = match[3];
                    }
                }
                
                // Prüfe ob abgegeben wurde
                const abgegebenEintrag = historie.find(h => h.aktion === 'ABGEGEBEN');
                if (abgegebenEintrag) {
                    auftragInfo.status = 'Abgegeben/Gelöscht';
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(`Historie für Auftrag #${auftragId}`)
                .setDescription(`**${auftragInfo.gegenstand}** für **${auftragInfo.kunde}**`)
                .setColor(auftrag ? 0x3498db : 0x95a5a6)
                .setTimestamp()
                .setFooter({ text: 'Blackwater Crafting System' });

            // Aktueller/Letzter Status
            embed.addFields({
                name: auftrag ? 'Aktueller Status' : 'Letzter bekannter Status',
                value: [
                    `**Menge:** ${auftragInfo.menge}`,
                    auftrag && auftragInfo.fortschritt !== undefined ? 
                        `**Fortschritt:** ${auftragInfo.fortschritt}/${auftragInfo.menge} (${Math.round((auftragInfo.fortschritt / auftragInfo.menge) * 100)}%)` : 
                        '',
                    `**Status:** ${auftragInfo.status}`
                ].filter(line => line).join('\n'),
                inline: false
            });

            // Berechne Beiträge pro Benutzer
            const beitraege = {};
            let gesamtPositiverFortschritt = 0;
            let gesamtNegativerFortschritt = 0;
            
            // Finde auch wer erstellt und abgeschlossen hat
            let erstelltVon = null;
            let abgeschlossenVon = null;
            
            historie.forEach(eintrag => {
                if (eintrag.aktion === 'ERSTELLT') {
                    erstelltVon = eintrag.benutzer_name;
                } else if (eintrag.aktion === 'ABGESCHLOSSEN') {
                    abgeschlossenVon = eintrag.benutzer_name;
                } else if (eintrag.aktion === 'FORTSCHRITT' && eintrag.details) {
                    // Parse Fortschritt: "Fortschritt geändert: 0 → 5"
                    const match = eintrag.details.match(/(\d+) → (\d+)/);
                    if (match) {
                        const von = parseInt(match[1]);
                        const zu = parseInt(match[2]);
                        const differenz = zu - von;
                        
                        if (!beitraege[eintrag.benutzer_name]) {
                            beitraege[eintrag.benutzer_name] = {
                                plus: 0,
                                minus: 0,
                                aktionen: 0
                            };
                        }
                        
                        beitraege[eintrag.benutzer_name].aktionen++;
                        
                        if (differenz > 0) {
                            beitraege[eintrag.benutzer_name].plus += differenz;
                            gesamtPositiverFortschritt += differenz;
                        } else if (differenz < 0) {
                            beitraege[eintrag.benutzer_name].minus += Math.abs(differenz);
                            gesamtNegativerFortschritt += Math.abs(differenz);
                        }
                    }
                }
            });
            
            // Erstelle Beitrags-Zusammenfassung
            const beitraegeArray = Object.entries(beitraege)
                .sort((a, b) => b[1].plus - a[1].plus);
            
            if (beitraegeArray.length > 0 || erstelltVon || abgeschlossenVon) {
                let beitraegeText = '';
                
                // Spezielle Rollen
                if (erstelltVon) {
                    beitraegeText += `👑 **Erstellt von:** ${erstelltVon}\n`;
                }
                if (abgeschlossenVon) {
                    beitraegeText += `🏁 **Abgeschlossen von:** ${abgeschlossenVon}\n`;
                }
                
                if (beitraegeArray.length > 0) {
                    beitraegeText += '\n**Fortschrittsbeiträge:**\n';
                    beitraegeText += beitraegeArray.map(([name, stats]) => {
                        const prozent = gesamtPositiverFortschritt > 0 ? 
                            Math.round((stats.plus / gesamtPositiverFortschritt) * 100) : 0;
                        
                        let text = `**${name}**: `;
                        if (stats.plus > 0) text += `+${stats.plus} `;
                        if (stats.minus > 0) text += `-${stats.minus} `;
                        text += `(${prozent}% Anteil, ${stats.aktionen} Aktionen)`;
                        
                        return text;
                    }).join('\n');
                }
                
                if (gesamtPositiverFortschritt > 0 || gesamtNegativerFortschritt > 0) {
                    beitraegeText += `\n\n**Gesamt:** +${gesamtPositiverFortschritt}`;
                    if (gesamtNegativerFortschritt > 0) {
                        beitraegeText += ` / -${gesamtNegativerFortschritt}`;
                    }
                }
                
                embed.addFields({
                    name: '👥 Beiträge zum Auftrag',
                    value: beitraegeText.substring(0, 1024),
                    inline: false
                });
            }
            
            // Historie-Einträge
            const historieText = historie.map(eintrag => {
                const datum = new Date(eintrag.zeitstempel).toLocaleString('de-DE');
                const aktionIcon = {
                    'ERSTELLT': '🆕',
                    'FORTSCHRITT': '📊',
                    'ABGESCHLOSSEN': '✅',
                    'ABGEGEBEN': '📦'
                }[eintrag.aktion] || '❓';

                return `${aktionIcon} **${datum}**\n${eintrag.benutzer_name}: ${eintrag.details || eintrag.aktion}`;
            }).join('\n\n');

            // Discord hat ein Limit von 1024 Zeichen pro Feld
            if (historieText.length <= 1024) {
                embed.addFields({ name: 'Historie', value: historieText });
            } else {
                // Teile in mehrere Felder auf
                const chunks = historieText.match(/.{1,1024}/g);
                chunks.forEach((chunk, index) => {
                    embed.addFields({ name: `Historie (Teil ${index + 1})`, value: chunk });
                });
            }

            await interaction.editReply({ embeds: [embed] });

            logger.info(`Historie für Auftrag #${auftragId} abgerufen`, { 
                user: interaction.user.username,
                auftragExistiert: !!auftrag
            });

        } catch (error) {
            logger.error('Fehler beim Abrufen der Historie:', error);

            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Fehler')
                .setDescription('Es ist ein Fehler beim Abrufen der Historie aufgetreten.')
                .setColor(0xe74c3c)
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};