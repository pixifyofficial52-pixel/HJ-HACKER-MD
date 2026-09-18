// .pair <number>  — lets ANY user (even in public mode) connect their own bot from WhatsApp.
// The pairing code is sent back into the same chat.
async function pairCommand(sock, from, msg, q, ctx) {
    const { sessions, BotSession, botData, saveBotData, channelInfo } = ctx;
    const number = (q || '').replace(/\D/g, '');

    if (!number || number.length < 8) {
        await sock.sendMessage(from, {
            text: `📱 *PAIR YOUR OWN BOT*\n\nUsage: *.pair 923001234567*\n_(country code ke sath number likhein, + ke baghair)_`,
            ...channelInfo
        }, { quoted: msg });
        return;
    }

    const userId = number;
    if (sessions[userId] && sessions[userId].isConnected) {
        await sock.sendMessage(from, { text: `✅ *${number}* is already connected as a bot.`, ...channelInfo }, { quoted: msg });
        return;
    }
    if (sessions[userId] && sessions[userId].isInitializing) {
        await sock.sendMessage(from, { text: `⏳ Pairing for *${number}* is already in progress. Please wait...`, ...channelInfo }, { quoted: msg });
        return;
    }

    if (!sessions[userId]) sessions[userId] = new BotSession(userId);
    if (!botData.statusSettings[userId]) {
        botData.statusSettings[userId] = { autoStatus: false, autoSeen: false, autoLike: false, autoDownload: false, isPublic: false };
        saveBotData();
    }

    await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });
    await sock.sendMessage(from, { text: `🔄 *Generating pairing code for ${number}...*`, ...channelInfo }, { quoted: msg });

    const session = sessions[userId];
    session.onPairingCode = async (code) => {
        try {
            await sock.sendMessage(from, {
                text: `✅ *PAIRING CODE GENERATED*\n\n🔑 *CODE:* ${code}\n\n📲 WhatsApp > Linked Devices > Link with phone number > enter this code.`,
                ...channelInfo
            }, { quoted: msg });
            await sock.sendMessage(from, { text: code });
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
        } catch (_) {}
    };
    session.onPairingError = async (err) => {
        try {
            await sock.sendMessage(from, { text: `❌ *PAIRING FAILED*\n\n${err}\n\nTry again with *.pair ${number}*`, ...channelInfo }, { quoted: msg });
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
        } catch (_) {}
    };

    await session.initialize(number);
}

module.exports = pairCommand;
