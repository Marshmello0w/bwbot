const mysql = require('mysql2/promise');
const config = require('./config');
const logger = require('./utils/logger');

class Database {
    constructor() {
        this.pool = null;
    }

    async connect() {
        try {
            this.pool = mysql.createPool(config.database);
            
            // Test connection
            const connection = await this.pool.getConnection();
            await connection.ping();
            connection.release();
            
            logger.info('Datenbankverbindung erfolgreich hergestellt');
            
            // Erstelle Tabellen falls nicht vorhanden
            await this.createTables();
            
            return true;
        } catch (error) {
            logger.error('Fehler beim Verbinden zur Datenbank:', error);
            throw error;
        }
    }

    async createTables() {
        const queries = [
            `CREATE TABLE IF NOT EXISTS auftraege (
                id INT AUTO_INCREMENT PRIMARY KEY,
                kunde VARCHAR(255) NOT NULL,
                gegenstand VARCHAR(255) NOT NULL,
                menge INT NOT NULL,
                fortschritt INT DEFAULT 0,
                sonstige_infos TEXT,
                abgeschlossen BOOLEAN DEFAULT FALSE,
                erstellt_von VARCHAR(255),
                erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                message_id VARCHAR(32),
                channel_id VARCHAR(32),
                INDEX idx_abgeschlossen (abgeschlossen),
                INDEX idx_erstellt_am (erstellt_am),
                INDEX idx_message_id (message_id)
            )`,
            
            `CREATE TABLE IF NOT EXISTS auftrag_historie (
                id INT AUTO_INCREMENT PRIMARY KEY,
                auftrag_id INT,
                aktion VARCHAR(50),
                benutzer_id VARCHAR(255),
                benutzer_name VARCHAR(255),
                details TEXT,
                zeitstempel TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (auftrag_id) REFERENCES auftraege(id) ON DELETE CASCADE,
                INDEX idx_auftrag_id (auftrag_id)
            )`
        ];

        for (const query of queries) {
            try {
                await this.pool.execute(query);
            } catch (error) {
                logger.error('Fehler beim Erstellen der Tabelle:', error);
            }
        }
    }

    // Auftrag erstellen
    async createAuftrag(kunde, gegenstand, menge, sonstigeInfos, erstelltVon) {
        try {
            const [result] = await this.pool.execute(
                'INSERT INTO auftraege (kunde, gegenstand, menge, fortschritt, sonstige_infos, erstellt_von) VALUES (?, ?, ?, ?, ?, ?)',
                [kunde, gegenstand, menge, 0, sonstigeInfos, erstelltVon]
            );
            
            // Historie eintragen
            await this.addHistorie(result.insertId, 'ERSTELLT', erstelltVon, erstelltVon, 
                `Auftrag erstellt: ${menge}x ${gegenstand} für ${kunde}`);
            
            return result.insertId;
        } catch (error) {
            logger.error('Fehler beim Erstellen des Auftrags:', error);
            throw error;
        }
    }

    // Auftrag abrufen
    async getAuftrag(id) {
        try {
            const [rows] = await this.pool.execute(
                'SELECT * FROM auftraege WHERE id = ?',
                [id]
            );
            return rows[0];
        } catch (error) {
            logger.error('Fehler beim Abrufen des Auftrags:', error);
            throw error;
        }
    }

    // Fortschritt aktualisieren
    async updateFortschritt(id, fortschritt, benutzerInfo) {
        try {
            const auftrag = await this.getAuftrag(id);
            if (!auftrag) throw new Error('Auftrag nicht gefunden');

            await this.pool.execute(
                'UPDATE auftraege SET fortschritt = ? WHERE id = ?',
                [fortschritt, id]
            );
            
            await this.addHistorie(id, 'FORTSCHRITT', benutzerInfo.id, benutzerInfo.username,
                `Fortschritt geändert: ${auftrag.fortschritt} → ${fortschritt}`);
            
            return true;
        } catch (error) {
            logger.error('Fehler beim Aktualisieren des Fortschritts:', error);
            throw error;
        }
    }

    // Auftrag abschließen
    async completeAuftrag(id, benutzerInfo) {
        try {
            const auftrag = await this.getAuftrag(id);
            if (!auftrag) throw new Error('Auftrag nicht gefunden');

            await this.pool.execute(
                'UPDATE auftraege SET fortschritt = ?, abgeschlossen = ? WHERE id = ?',
                [auftrag.menge, true, id]
            );
            
            await this.addHistorie(id, 'ABGESCHLOSSEN', benutzerInfo.id, benutzerInfo.username,
                'Auftrag wurde abgeschlossen');
            
            return true;
        } catch (error) {
            logger.error('Fehler beim Abschließen des Auftrags:', error);
            throw error;
        }
    }

    // Auftrag löschen
    async deleteAuftrag(id, benutzerInfo) {
        try {
            const auftrag = await this.getAuftrag(id);
            if (!auftrag) throw new Error('Auftrag nicht gefunden');

            // Historie vor dem Löschen speichern
            await this.addHistorie(id, 'ABGEGEBEN', benutzerInfo.id, benutzerInfo.username,
                'Auftrag wurde abgegeben und gelöscht');

            await this.pool.execute(
                'DELETE FROM auftraege WHERE id = ?',
                [id]
            );
            
            return auftrag;
        } catch (error) {
            logger.error('Fehler beim Löschen des Auftrags:', error);
            throw error;
        }
    }

    // Historie hinzufügen - mit besserem Error Handling
    async addHistorie(auftragId, aktion, benutzerId, benutzerName, details) {
        try {
            logger.info(`Füge Historie hinzu: Auftrag ${auftragId}, Aktion: ${aktion}, Benutzer: ${benutzerName}`);
            
            const [result] = await this.pool.execute(
                'INSERT INTO auftrag_historie (auftrag_id, aktion, benutzer_id, benutzer_name, details) VALUES (?, ?, ?, ?, ?)',
                [auftragId, aktion, benutzerId, benutzerName, details]
            );
            
            logger.success(`Historie erfolgreich hinzugefügt - ID: ${result.insertId}`);
            return result.insertId;
        } catch (error) {
            logger.error('KRITISCH: Fehler beim Hinzufügen zur Historie:', error);
            logger.error('Daten:', { auftragId, aktion, benutzerId, benutzerName, details });
            // Werfe den Fehler weiter, damit wir ihn sehen
            throw error;
        }
    }

    // Aktive Aufträge abrufen
    async getActiveAuftraege(limit = 50) {
        try {
            const [rows] = await this.pool.execute(
                'SELECT * FROM auftraege WHERE abgeschlossen = FALSE ORDER BY erstellt_am DESC LIMIT ?',
                [limit]
            );
            return rows;
        } catch (error) {
            logger.error('Fehler beim Abrufen aktiver Aufträge:', error);
            throw error;
        }
    }

    // Statistiken abrufen (nutzt auch Historie für bessere Daten)
    async getStatistics() {
        try {
            const [aktiveAuftraege] = await this.pool.execute(
                'SELECT COUNT(*) as count FROM auftraege WHERE abgeschlossen = FALSE'
            );
            
            const [abgeschlosseneAuftraege] = await this.pool.execute(
                'SELECT COUNT(*) as count FROM auftraege WHERE abgeschlossen = TRUE'
            );
            
            // Gesamtanzahl aller jemals erstellten Aufträge (aus Historie)
            const [gesamtAuftraege] = await this.pool.execute(
                'SELECT COUNT(DISTINCT auftrag_id) as count FROM auftrag_historie WHERE aktion = "ERSTELLT"'
            );
            
            const [topGegenstaende] = await this.pool.execute(
                `SELECT gegenstand, SUM(menge) as total 
                 FROM auftraege 
                 GROUP BY gegenstand 
                 ORDER BY total DESC 
                 LIMIT 5`
            );
            
            // Zusätzliche Statistiken aus Historie
            const [letzteAktivitaet] = await this.pool.execute(
                `SELECT benutzer_name, aktion, zeitstempel 
                 FROM auftrag_historie 
                 ORDER BY zeitstempel DESC 
                 LIMIT 5`
            );
            
            const [aktivsteBenutzer] = await this.pool.execute(
                `SELECT benutzer_name, COUNT(*) as aktionen 
                 FROM auftrag_historie 
                 GROUP BY benutzer_name 
                 ORDER BY aktionen DESC 
                 LIMIT 5`
            );
            
            return {
                aktiv: aktiveAuftraege[0].count,
                abgeschlossen: abgeschlosseneAuftraege[0].count,
                gesamtErstellt: gesamtAuftraege[0].count,
                topGegenstaende,
                letzteAktivitaet,
                aktivsteBenutzer
            };
        } catch (error) {
            logger.error('Fehler beim Abrufen der Statistiken:', error);
            throw error;
        }
    }
    
    // Erweiterte Historie-Funktionen
    async getAuftragHistorie(auftragId) {
        try {
            const [historie] = await this.pool.execute(
                `SELECT * FROM auftrag_historie 
                 WHERE auftrag_id = ? 
                 ORDER BY zeitstempel ASC`,
                [auftragId]
            );
            return historie;
        } catch (error) {
            logger.error('Fehler beim Abrufen der Historie:', error);
            throw error;
        }
    }
    
    // Persistente Auftragsliste (auch gelöschte)
    async getAllAuftraege(includeDeleted = false) {
        try {
            let query = 'SELECT * FROM auftraege';
            if (!includeDeleted) {
                query += ' WHERE abgeschlossen = FALSE';
            }
            query += ' ORDER BY erstellt_am DESC LIMIT 100';
            
            const [rows] = await this.pool.execute(query);
            return rows;
        } catch (error) {
            logger.error('Fehler beim Abrufen aller Aufträge:', error);
            throw error;
        }
    }

    // Message ID speichern
    async updateMessageId(auftragId, messageId, channelId) {
        try {
            await this.pool.execute(
                'UPDATE auftraege SET message_id = ?, channel_id = ? WHERE id = ?',
                [messageId, channelId, auftragId]
            );
            return true;
        } catch (error) {
            logger.error('Fehler beim Speichern der Message ID:', error);
            throw error;
        }
    }
    
    // Aufträge mit Message IDs abrufen
    async getAuftraegeWithMessages() {
        try {
            const [rows] = await this.pool.execute(
                'SELECT * FROM auftraege WHERE message_id IS NOT NULL AND abgeschlossen = FALSE'
            );
            return rows;
        } catch (error) {
            logger.error('Fehler beim Abrufen der Aufträge mit Messages:', error);
            throw error;
        }
    }

    // Benutzer-Abgabe-Statistiken
    async getUserAbgabeStatistics() {
        try {
            const [stats] = await this.pool.execute(
                `SELECT 
                    benutzer_name,
                    COUNT(*) as anzahl_abgegeben,
                    GROUP_CONCAT(CONCAT('#', auftrag_id) ORDER BY zeitstempel DESC SEPARATOR ', ') as auftrag_ids
                 FROM auftrag_historie 
                 WHERE aktion = 'ABGEGEBEN'
                 GROUP BY benutzer_name
                 ORDER BY anzahl_abgegeben DESC`
            );
            return stats;
        } catch (error) {
            logger.error('Fehler beim Abrufen der Abgabe-Statistiken:', error);
            throw error;
        }
    }
    
    // Erweiterte Statistiken mit Benutzer-Details
    async getDetailedUserStatistics() {
        try {
            // Abgabe-Statistiken pro Benutzer
            const [abgabeStats] = await this.pool.execute(
                `SELECT 
                    h.benutzer_name,
                    COUNT(DISTINCT CASE WHEN h.aktion = 'ABGEGEBEN' THEN h.auftrag_id END) as abgegeben,
                    COUNT(DISTINCT CASE WHEN h.aktion = 'ERSTELLT' THEN h.auftrag_id END) as erstellt,
                    COUNT(DISTINCT CASE WHEN h.aktion = 'ABGESCHLOSSEN' THEN h.auftrag_id END) as abgeschlossen,
                    COUNT(*) as gesamt_aktionen
                 FROM auftrag_historie h
                 GROUP BY h.benutzer_name
                 ORDER BY abgegeben DESC`
            );
            
            return abgabeStats;
        } catch (error) {
            logger.error('Fehler beim Abrufen der detaillierten Benutzer-Statistiken:', error);
            throw error;
        }
    }
}

module.exports = new Database();