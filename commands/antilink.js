/**
 * Anti-Link Command - Per User, Per Group
 * Har user ke bot ka apna antilink setting hai, har group ke liye alag.
 */

const { getChannelJid } = require('../lib/messageConfig');

async function antilinkCommand(sock, from, msg, isAdmin, botData, saveBotData, userId, args) {
    try {
        if (!isAdmin || !from.endsWith('@g.us')) {
            return await sock.sendMessage(from, {
                text: "❌ Only admin can use this command in groups."
            }, { quoted: msg });
        }

        // 👇 Per-user antilink settings initialize karein
        if (!botData.antilinkGroups) botData.antilinkGroups = {};
        if (!botData.antilinkGroups[userId]) botData.antilinkGroups[userId] = {};

        const action = args[0]?.toLowerCase();
        const userGroups = botData.antilinkGroups[userId];

        if (action === 'on' || action === 'del') {
            userGroups[from] = 'del';
            if (typeof saveBotData === 'function') saveBotData();
            await sock.sendMessage(from, { text: "✅ Anti-Link (Delete Only) Enabled!" }, { quoted: msg });
        } else if (action === 'kick') {
            userGroups[from] = 'kick';
            if (typeof saveBotData === 'function') saveBotData();
            await sock.sendMessage(from, { text: "✅ Anti-Link (Kick + Delete) Enabled!" }, { quoted: msg });
        } else if (action === 'off') {
            delete userGroups[from];
            if (typeof saveBotData === 'function') saveBotData();
            await sock.sendMessage(from, { text: "❌ Anti-Link Disabled!" }, { quoted: msg });
        } else {
            await sock.sendMessage(from, {
                text: "❌ Usage: .antilink [on/off/kick]\n\n*Note:* This will delete all links from non-admins."
            }, { quoted: msg });
        }

    } catch (error) {
        console.error('Error in antilink command:', error);
        await sock.sendMessage(from, {
            text: '❌ Error processing command!'
        }, { quoted: msg });
    }
}

module.exports = antilinkCommand;
