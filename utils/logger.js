const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, '..', 'logs');
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    getTimestamp() {
        return new Date().toISOString();
    }

    formatMessage(level, message, meta = {}) {
        const timestamp = this.getTimestamp();
        const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
        return `[${timestamp}] [${level}] ${message} ${metaStr}\n`;
    }

    writeToFile(filename, message) {
        const filePath = path.join(this.logDir, filename);
        fs.appendFile(filePath, message, (err) => {
            if (err) console.error('Fehler beim Schreiben der Log-Datei:', err);
        });
    }

    log(level, message, meta = {}) {
        const formattedMessage = this.formatMessage(level, message, meta);
        
        // Console output mit Farben
        const colors = {
            INFO: '\x1b[36m',    // Cyan
            WARN: '\x1b[33m',    // Yellow
            ERROR: '\x1b[31m',   // Red
            SUCCESS: '\x1b[32m'  // Green
        };
        
        console.log(`${colors[level] || ''}${formattedMessage}\x1b[0m`);
        
        // Datei output
        this.writeToFile('bot.log', formattedMessage);
        
        if (level === 'ERROR') {
            this.writeToFile('error.log', formattedMessage);
        }
    }

    info(message, meta) {
        this.log('INFO', message, meta);
    }

    warn(message, meta) {
        this.log('WARN', message, meta);
    }

    error(message, error) {
        const meta = error instanceof Error ? {
            message: error.message,
            stack: error.stack
        } : { error };
        
        this.log('ERROR', message, meta);
    }

    success(message, meta) {
        this.log('SUCCESS', message, meta);
    }

    // Crash logging
    logCrash(error) {
        const crashMessage = this.formatMessage('CRASH', 'Kritischer Fehler', {
            message: error.message,
            stack: error.stack
        });
        
        this.writeToFile('crash.log', crashMessage);
        console.error('\x1b[31m' + crashMessage + '\x1b[0m');
    }
}

module.exports = new Logger();
