/**
 * Autoread Command - Per User
 * Har user ka apna autoread setting hai, jo botData mein save hoti hai.
 * Yeh ensure karta hai ki ek user ki setting doosre user ke bot par apply na ho.
 */

const { getChannelJid } = require('../lib/messageConfig');

// ============================================================
// AUTOREAD COMMAND (Toggle ON/OFF)
// ============================================================
async function autoreadCommand(sock, chatId, message, userId, botData, saveBotData, args) {
    try {
        // Sirf bot owner hi command use kar sakta hai
        if (!message.key.fromMe) {
            await sock.sendMessage(chatId, {
                text: '❌ This command is only available for the owner!',
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: getChannelJid(),
                        newsletterName: 'HJ-HACKER MD',
                        serverMessageId: -1
                    }
                }
            });
            return;
        }

        // Per-user setting initialize karein
        if (!botData.autoread) botData.autoread = {};

        const match = (args && args[0] ? args[0] : '').toLowerCase();

        if (match === 'on' || match === 'enable') {
            botData.autoread[userId] = true;
        } else if (match === 'off' || match === 'disable') {
            botData.autoread[userId] = false;
        } else {
            // Agar koi argument nahi diya, toh current status dikhayein
            await sock.sendMessage(chatId, {
                text: `📖 *Autoread Status:* ${botData.autoread[userId] ? '✅ ON' : '❌ OFF'}\n\nUse: *.autoread on/off*`,
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: getChannelJid(),
                        newsletterName: 'HJ-HACKER MD',
                        serverMessageId: -1
                    }
                }
            });
            return;
        }

        // Setting save karein
        if (typeof saveBotData === 'function') saveBotData();

        // Confirmation message
        await sock.sendMessage(chatId, {
            text: `✅ Auto-read has been ${botData.autoread[userId] ? 'enabled' : 'disabled'} for your bot!`,
            contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: getChannelJid(),
                    newsletterName: 'HJ-HACKER MD',
                    serverMessageId: -1
                }
            }
        });

    } catch (error) {
        console.error('Error in autoread command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Error processing command!',
            contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: getChannelJid(),
                    newsletterName: 'HJ-HACKER MD',
                    serverMessageId: -1
                }
            }
        });
    }
}

// ============================================================
// CHECK IF AUTOREAD ENABLED (Per-User)
// ============================================================
function isAutoreadEnabled(userId, botData) {
    try {
        if (!botData || !botData.autoread) return false;
        return !!botData.autoread[userId];
    } catch (error) {
        console.error('Error checking autoread status:', error);
        return false;
    }
}

// ============================================================
// HANDLE AUTOREAD (Per-User)
// ============================================================
async function handleAutoread(sock, message, userId, botData) {
    try {
        if (isAutoreadEnabled(userId, botData)) {
            await sock.readMessages([message.key]);
            return true;
        }
    } catch (e) {
        console.error('Autoread Error:', e.message);
    }
    return false;
}

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
    autoreadCommand,
    isAutoreadEnabled,
    handleAutoread
};
