const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { writeFile } = require('fs/promises');

const messageStore = new Map();
const MAX_STORE_SIZE = 1000;
const TEMP_MEDIA_DIR = path.join(__dirname, '../tmp');

const toBold = (text) => {
    const boldChars = {
        'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵', 'i': '𝗶', 'j': '𝗷', 'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽', 'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁', 'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇',
        'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚', 'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝘀', 't': '𝘁', 'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇',
        '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰', '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵'
    };
    return text.split('').map(c => boldChars[c] || c).join('');
};

if (!fs.existsSync(TEMP_MEDIA_DIR)) {
    fs.mkdirSync(TEMP_MEDIA_DIR, { recursive: true });
}

const getFolderSizeInMB = (folderPath) => {
    try {
        const files = fs.readdirSync(folderPath);
        let totalSize = 0;
        for (const file of files) {
            const filePath = path.join(folderPath, file);
            if (fs.statSync(filePath).isFile()) {
                totalSize += fs.statSync(filePath).size;
            }
        }
        return totalSize / (1024 * 1024);
    } catch (err) {
        return 0;
    }
};

const cleanTempFolderIfLarge = () => {
    try {
        if (getFolderSizeInMB(TEMP_MEDIA_DIR) > 100) {
            const files = fs.readdirSync(TEMP_MEDIA_DIR);
            for (const file of files) {
                fs.unlinkSync(path.join(TEMP_MEDIA_DIR, file));
            }
        }
    } catch (err) {}
};

setInterval(cleanTempFolderIfLarge, 60 * 1000);

// ============================================================
// PER-USER SETTING CHECK
// ============================================================
function isAntideleteEnabled(userId, botData) {
    if (!botData || !botData.antiDelete) return false;
    return !!botData.antiDelete[userId];
}

// ============================================================
// ANTIDELETE COMMAND
// ============================================================
async function handleAntideleteCommand(sock, chatId, message, isAdmin, botData, saveBotData, userId, args) {
    if (!botData.antiDelete) botData.antiDelete = {};
    
    const match = args[0]?.toLowerCase();
    const currentStatus = isAntideleteEnabled(userId, botData);

    if (!match) {
        return sock.sendMessage(chatId, {
            text: `╭━━━〔 ${toBold("ANTI-DELETE SETUP")} 〕━━━┈⊷\n` +
                   `┃ ⋄ ${toBold("Status:")} ${currentStatus ? '✅ Enabled' : '❌ Disabled'}\n` +
                   `┃\n` +
                   `┃ ⋄ ${toBold(".antidelete on")} - Enable\n` +
                   `┃ ⋄ ${toBold(".antidelete off")} - Disable\n` +
                   `╰━━━━━━━━━━━━━━━━━━┈⊷`
        }, {quoted: message});
    }

    if (match === 'on') {
        botData.antiDelete[userId] = true;
    } else if (match === 'off') {
        botData.antiDelete[userId] = false;
    } else {
        return sock.sendMessage(chatId, { text: '*Invalid command. Use .antidelete to see usage.*' }, {quoted:message});
    }

    if (typeof saveBotData === 'function') saveBotData();

    return sock.sendMessage(chatId, { 
        text: `*Antidelete ${match === 'on' ? 'enabled' : 'disabled'} for your bot*` 
    }, {quoted:message});
}

// ============================================================
// STORE MESSAGE (Per-User)
// ============================================================
async function storeMessage(message, userId, botData) {
    try {
        if (!isAntideleteEnabled(userId, botData)) return;
        if (!message.key?.id) return;

        const messageId = `${userId}_${message.key.id}`; // 👈 userId ke saath unique
        let content = '';
        let mediaType = '';
        let mediaPath = '';
        const sender = message.key.participant || message.key.remoteJid;

        const msg = message.message?.ephemeralMessage?.message || 
                    message.message?.viewOnceMessage?.message || 
                    message.message?.viewOnceMessageV2?.message || 
                    message.message;

        if (!msg) return;

        if (msg.conversation) {
            content = msg.conversation;
        } else if (msg.extendedTextMessage?.text) {
            content = msg.extendedTextMessage.text;
        } else if (msg.imageMessage) {
            mediaType = 'image';
            content = msg.imageMessage.caption || '';
            try {
                const buffer = await downloadContentFromMessage(msg.imageMessage, 'image');
                mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.jpg`);
                await writeFile(mediaPath, buffer);
            } catch (e) { console.error('Antidelete download error:', e); }
        } else if (msg.stickerMessage) {
            mediaType = 'sticker';
            try {
                const buffer = await downloadContentFromMessage(msg.stickerMessage, 'sticker');
                mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.webp`);
                await writeFile(mediaPath, buffer);
            } catch (e) { console.error('Antidelete download error:', e); }
        } else if (msg.videoMessage) {
            mediaType = 'video';
            content = msg.videoMessage.caption || '';
            try {
                const buffer = await downloadContentFromMessage(msg.videoMessage, 'video');
                mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.mp4`);
                await writeFile(mediaPath, buffer);
            } catch (e) { console.error('Antidelete download error:', e); }
        } else if (msg.audioMessage) {
            mediaType = 'audio';
            try {
                const buffer = await downloadContentFromMessage(msg.audioMessage, 'audio');
                mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.mp3`);
                await writeFile(mediaPath, buffer);
            } catch (e) { console.error('Antidelete download error:', e); }
        }

        if (messageStore.size >= MAX_STORE_SIZE) {
            const firstKey = messageStore.keys().next().value;
            messageStore.delete(firstKey);
        }

        messageStore.set(messageId, {
            content,
            mediaType,
            mediaPath,
            sender,
            userId, // 👈 userId store karein
            group: message.key.remoteJid.endsWith('@g.us') ? message.key.remoteJid : null,
            timestamp: new Date().toISOString()
        });
    } catch (err) {}
}

// ============================================================
// HANDLE MESSAGE REVOCATION (Per-User)
// ============================================================
async function handleMessageRevocation(sock, revocationMessage, userId, botData) {
    try {
        if (!isAntideleteEnabled(userId, botData)) return;

        const rawMessageId = revocationMessage.message.protocolMessage.key.id;
        const messageId = `${userId}_${rawMessageId}`; // 👈 userId ke saath match karein
        const deletedBy = revocationMessage.participant || revocationMessage.key.participant || revocationMessage.key.remoteJid;
        const ownerNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        if (deletedBy.includes(sock.user.id) || deletedBy === ownerNumber) return;

        const original = messageStore.get(messageId);
        if (!original) return;

        const sender = original.sender;
        const senderName = sender.split('@')[0];
        
        let report = `╭━━━〔 ${toBold("ANTI-DELETE REPORT")} 〕━━━┈⊷\n` +
                     `┃ 👤 ${toBold("Sender:")} @${senderName}\n` +
                     `┃ 🗑️ ${toBold("Deleted By:")} @${deletedBy.split('@')[0]}\n` +
                     `┃ 🕒 ${toBold("Time:")} ${new Date().toLocaleTimeString()}\n` +
                     `┃ 📂 ${toBold("Type:")} ${original.mediaType || 'Text'}\n` +
                     `╰━━━━━━━━━━━━━━━━━━┈⊷\n\n`;

        if (original.content) {
            report += `📝 ${toBold("Message Content:")}\n${original.content}`;
        }

        await sock.sendMessage(ownerNumber, { text: report, mentions: [deletedBy, sender] });

        if (original.mediaType && fs.existsSync(original.mediaPath)) {
            const mediaOptions = { caption: `*Deleted ${original.mediaType}* from @${senderName}`, mentions: [sender] };
            if (original.mediaType === 'image') await sock.sendMessage(ownerNumber, { image: { url: original.mediaPath }, ...mediaOptions });
            else if (original.mediaType === 'sticker') await sock.sendMessage(ownerNumber, { sticker: { url: original.mediaPath }, ...mediaOptions });
            else if (original.mediaType === 'video') await sock.sendMessage(ownerNumber, { video: { url: original.mediaPath }, ...mediaOptions });
            else if (original.mediaType === 'audio') await sock.sendMessage(ownerNumber, { audio: { url: original.mediaPath }, mimetype: 'audio/mp4', ...mediaOptions });
            
            setTimeout(() => {
                try { if (fs.existsSync(original.mediaPath)) fs.unlinkSync(original.mediaPath); } catch (err) {}
            }, 5000);
        }
        messageStore.delete(messageId);
    } catch (err) {}
}

module.exports = handleAntideleteCommand;
module.exports.storeMessage = storeMessage;
module.exports.handleMessageRevocation = handleMessageRevocation;
