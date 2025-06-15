const axios = require('axios');
const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const logger = require('./logger');

class WebhookManager {
    constructor() {
        this.webhooks = config.discord.webhooks;
    }

    // Hole die richtige Webhook URL basierend auf der Aktion
    getWebhookUrl(aktion) {
        const webhookMap = {
            'ERSTELLT': this.webhooks.erstellt,
            'FORTSCHRITT': this.webhooks.fortschritt,
            'ABGESCHLOSSEN': this.webhooks.abgeschlossen,
            'ABGEGEBEN': this.webhooks.abgegeben
        };

        // Nutze spezifischen Webhook oder Fallback auf default
        return webhookMap[aktion] || this.webhooks.default || this.webhooks.erstellt;
    }

    async send(aktion, benutzer, auftrag) {
        try {
            const webhookUrl = this.getWebhookUrl(aktion);
            
            if (!webhookUrl) {
                logger.error(`Kein Webhook für Aktion ${aktion} konfiguriert`);
                return;
            }

            // Erstelle spezifische Embeds je nach Aktion
            let embed;
            
            switch(aktion) {
                case 'ERSTELLT':
                    embed = this.createErstelltEmbed(benutzer, auftrag);
                    break;
                case 'FORTSCHRITT':
                    embed = this.createFortschrittEmbed(benutzer, auftrag);
                    break;
                case 'ABGESCHLOSSEN':
                    embed = this.createAbgeschlossenEmbed(benutzer, auftrag);
                    break;
                case 'ABGEGEBEN':
                    embed = this.createAbgegebenEmbed(benutzer, auftrag);
                    break;
                default:
                    embed = this.createDefaultEmbed(aktion, benutzer, auftrag);
            }

            const data = {
                embeds: [embed.toJSON()]
            };

            await axios.post(webhookUrl, data);
            logger.success(`Webhook gesendet: ${aktion} an ${webhookUrl.split('/').slice(-2,-1)[0]}...`);
        } catch (error) {
            logger.error('Fehler beim Senden des Webhooks:', error);
        }
    }

    // Embed für neuen Auftrag
    createErstelltEmbed(benutzer, auftrag) {
        return new EmbedBuilder()
            .setTitle('📝 Neuer Auftrag erstellt')
            .setDescription(`Ein neuer Auftrag wurde von ${benutzer.username} erstellt.`)
            .addFields(
                { name: 'Auftrag ID', value: `#${auftrag.id}`, inline: true },
                { name: 'Kunde', value: auftrag.kunde, inline: true },
                { name: 'Gegenstand', value: auftrag.gegenstand, inline: true },
                { name: 'Menge', value: `${auftrag.menge}`, inline: true },
                { name: 'Sonstige Infos', value: auftrag.sonstige_infos || 'Keine' }
            )
            .setColor(0x3498db) // Blau
            .setTimestamp()
            .setFooter({ text: `Erstellt von ${benutzer.username}`, iconURL: benutzer.displayAvatarURL() });
    }

    // Embed für Fortschritts-Update
    createFortschrittEmbed(benutzer, auftrag) {
        const prozent = Math.round((auftrag.fortschritt / auftrag.menge) * 100);
        const fortschrittBar = this.createProgressBar(prozent);
        
        return new EmbedBuilder()
            .setTitle('📊 Fortschritt aktualisiert')
            .setDescription(`Der Fortschritt wurde von ${benutzer.username} aktualisiert.`)
            .addFields(
                { name: 'Auftrag', value: `#${auftrag.id} - ${auftrag.gegenstand}`, inline: true },
                { name: 'Kunde', value: auftrag.kunde, inline: true },
                { name: 'Fortschritt', value: `${auftrag.fortschritt} / ${auftrag.menge}`, inline: true },
                { name: 'Prozent', value: `${fortschrittBar} ${prozent}%` }
            )
            .setColor(0x9b59b6) // Lila
            .setTimestamp()
            .setFooter({ text: `Aktualisiert von ${benutzer.username}`, iconURL: benutzer.displayAvatarURL() });
    }

    // Embed für abgeschlossenen Auftrag
    createAbgeschlossenEmbed(benutzer, auftrag) {
        return new EmbedBuilder()
            .setTitle('✅ Auftrag abgeschlossen')
            .setDescription(`Der Auftrag wurde erfolgreich abgeschlossen!`)
            .addFields(
                { name: 'Auftrag ID', value: `#${auftrag.id}`, inline: true },
                { name: 'Kunde', value: auftrag.kunde, inline: true },
                { name: 'Gegenstand', value: auftrag.gegenstand, inline: true },
                { name: 'Menge', value: `${auftrag.menge} Stück`, inline: true },
                { name: 'Status', value: '✅ Fertiggestellt', inline: true },
                { name: 'Sonstige Infos', value: auftrag.sonstige_infos || 'Keine' }
            )
            .setColor(0x2ecc71) // Grün
            .setTimestamp()
            .setFooter({ text: `Abgeschlossen von ${benutzer.username}`, iconURL: benutzer.displayAvatarURL() });
    }

    // Embed für abgegebenen/gelöschten Auftrag
    createAbgegebenEmbed(benutzer, auftrag) {
        return new EmbedBuilder()
            .setTitle('📦 Auftrag abgegeben')
            .setDescription(`Der Auftrag wurde an den Kunden übergeben und aus dem System entfernt.`)
            .addFields(
                { name: 'Auftrag ID', value: `#${auftrag.id}`, inline: true },
                { name: 'Kunde', value: auftrag.kunde, inline: true },
                { name: 'Gegenstand', value: auftrag.gegenstand, inline: true },
                { name: 'Menge', value: `${auftrag.menge} Stück`, inline: true },
                { name: 'War abgeschlossen', value: auftrag.abgeschlossen ? 'Ja' : 'Nein', inline: true }
            )
            .setColor(0xe74c3c) // Rot
            .setTimestamp()
            .setFooter({ text: `Abgegeben von ${benutzer.username}`, iconURL: benutzer.displayAvatarURL() });
    }

    // Default Embed (Fallback)
    createDefaultEmbed(aktion, benutzer, auftrag) {
        return new EmbedBuilder()
            .setTitle(`Auftrag ${aktion}`)
            .setDescription(`Der Auftrag wurde ${aktion} von ${benutzer.username}.`)
            .addFields(
                { name: 'Auftrag ID', value: `#${auftrag.id}`, inline: true },
                { name: 'Kunde', value: auftrag.kunde, inline: true },
                { name: 'Gegenstand', value: auftrag.gegenstand, inline: true },
                { name: 'Menge', value: `${auftrag.menge}`, inline: true },
                { name: 'Fortschritt', value: `${auftrag.fortschritt} / ${auftrag.menge}`, inline: true },
                { name: 'Status', value: auftrag.abgeschlossen ? 'Abgeschlossen' : 'In Bearbeitung', inline: true },
                { name: 'Sonstige Infos', value: auftrag.sonstige_infos || 'Keine' }
            )
            .setColor(this.getColorByAction(aktion))
            .setTimestamp()
            .setFooter({ text: `Bearbeitet von ${benutzer.username}`, iconURL: benutzer.displayAvatarURL() });
    }

    // Progress Bar erstellen
    createProgressBar(percent) {
        const filled = Math.round(percent / 10);
        const empty = 10 - filled;
        return '█'.repeat(filled) + '░'.repeat(empty);
    }

    getColorByAction(aktion) {
        const colors = {
            'ERSTELLT': 0x3498db,      // Blau
            'AKTUALISIERT': 0xf39c12,  // Orange
            'ABGESCHLOSSEN': 0x2ecc71, // Grün
            'ABGEGEBEN': 0xe74c3c,     // Rot
            'FORTSCHRITT': 0x9b59b6    // Lila
        };
        return colors[aktion] || 0x95a5a6; // Standard: Grau
    }

    // Statistik Webhook (nutzt default webhook)
    async sendStatistics(stats) {
        try {
            const webhookUrl = this.webhooks.default || this.webhooks.erstellt;
            
            const embed = new EmbedBuilder()
                .setTitle('Auftragsstatistiken')
                .addFields(
                    { name: 'Aktive Aufträge', value: `${stats.aktiv}`, inline: true },
                    { name: 'Abgeschlossene Aufträge', value: `${stats.abgeschlossen}`, inline: true },
                    { name: 'Gesamt', value: `${stats.aktiv + stats.abgeschlossen}`, inline: true }
                )
                .setColor(0x3498db)
                .setTimestamp();

            if (stats.topGegenstaende.length > 0) {
                const topItems = stats.topGegenstaende
                    .map((item, index) => `${index + 1}. **${item.gegenstand}**: ${item.total}x`)
                    .join('\n');
                embed.addFields({ name: 'Top 5 Gegenstände', value: topItems });
            }

            await axios.post(webhookUrl, {
                embeds: [embed.toJSON()]
            });
        } catch (error) {
            logger.error('Fehler beim Senden der Statistik:', error);
        }
    }
}

module.exports = new WebhookManager();