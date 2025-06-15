const config = require('../config');

class PermissionManager {
    // PrÃ¼ft ob ein Benutzer eine bestimmte Aktion ausfÃ¼hren darf
    hasPermission(member, action) {
        // Admin hat immer alle Rechte
        if (member.permissions.has('Administrator')) {
            return true;
        }

        const roleIds = member.roles.cache.map(role => role.id);
        
        switch (action) {
            case 'CREATE_ORDER':
                return this.checkRoles(roleIds, config.permissions.createOrderRoles);
            
            case 'EDIT_ORDER':
                return this.checkRoles(roleIds, config.permissions.editOrderRoles);
            
            case 'DELETE_ORDER':
                return this.checkRoles(roleIds, config.permissions.deleteOrderRoles);
            
            default:
                return true;
        }
    }

    // PrÃ¼ft ob der Benutzer eine der erlaubten Rollen hat
    checkRoles(userRoles, allowedRoles) {
        // Wenn keine Rollen definiert sind, darf jeder
        if (!allowedRoles || allowedRoles.length === 0) {
            return true;
        }

        // PrÃ¼ft ob der Benutzer mindestens eine der erlaubten Rollen hat
        return userRoles.some(roleId => allowedRoles.includes(roleId));
    }

    // Gibt eine Fehlermeldung fÃ¼r fehlende Berechtigungen zurÃ¼ck
    getPermissionError(action) {
        const messages = {
            'CREATE_ORDER': 'Du hast keine Berechtigung, AuftrÃ¤ge zu erstellen.',
            'EDIT_ORDER': 'Du hast keine Berechtigung, AuftrÃ¤ge zu bearbeiten.',
            'DELETE_ORDER': 'Du hast keine Berechtigung, AuftrÃ¤ge zu lÃ¶schen.'
        };

        return messages[action] || 'Du hast keine Berechtigung fÃ¼r diese Aktion.';
    }

    // PrÃ¼ft ob der Kanal erlaubt ist
    isChannelAllowed(channelId) {
        const allowedChannels = config.discord.allowedChannels;
        
        // Wenn keine KanÃ¤le definiert sind, sind alle erlaubt
        if (!allowedChannels || allowedChannels.length === 0) {
            return true;
        }

        return allowedChannels.includes(channelId);
    }
}

module.exports = new PermissionManager();
