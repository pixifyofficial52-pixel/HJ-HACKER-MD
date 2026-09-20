const os = require('os');

async function pingCommand(sock, from, msg) {
    try {
        // Pehle "Testing Speed..." bhejein
        const start = Date.now();
        const { key } = await sock.sendMessage(from, { text: '⚡ *Testing Speed...*' }, { quoted: msg });

        // Response time calculate karein
        const end = Date.now();
        const responseTime = end - start;

        // System stats
        const ramUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
        const ramTotal = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
        const uptime = process.uptime();

        // Uptime format
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        const uptimeStr = `${hours > 0 ? hours + 'h ' : ''}${minutes}m ${seconds}s`;

        // Node version aur status
        const nodeVersion = process.version;
        const status = sock.user ? 'ONLINE 🟢' : 'OFFLINE 🔴';

        // Stylish card
        const card = `╭━━━〔 ⚡ 𝗦𝗣𝗘𝗘𝗗 𝗠𝗢𝗡𝗜𝗧𝗢𝗥 〕━━━┈⊷\n` +
                     `┃\n` +
                     `┃  ⚡ *𝗥𝗘𝗦𝗣𝗢𝗡𝗦𝗘 𝗧𝗜𝗠𝗘*\n` +
                     `┃  ━━━━━━━━━━━━━━━━━━\n` +
                     `┃  🚀 *${responseTime} ms*\n` +
                     `┃  ━━━━━━━━━━━━━━━━━━\n` +
                     `┃\n` +
                     `┃  📊 *𝗦𝗬𝗦𝗧𝗘𝗠 𝗦𝗧𝗔𝗧𝗦*\n` +
                     `┃  ━━━━━━━━━━━━━━━━━━\n` +
                     `┃  💾 𝗥𝗔𝗠: ${ramUsed} MB / ${ramTotal} GB\n` +
                     `┃  ⏱️ 𝗨𝗽𝘁𝗶𝗺𝗲: ${uptimeStr}\n` +
                     `┃  📡 𝗦𝘁𝗮𝘁𝘂𝘀: ${status}\n` +
                     `┃  ⚙️ 𝗥𝘂𝗻𝘁𝗶𝗺𝗲: ${nodeVersion}\n` +
                     `┃  ━━━━━━━━━━━━━━━━━━\n` +
                     `┃\n` +
                     `┃  ✅ *Connection is healthy*\n` +
                     `┃\n` +
                     `╰━━━━━〔 𝗛𝗝-𝗛𝗔𝗖𝗞𝗘𝗥 𝗠𝗗 〕━━━┈⊷`;

        // Purane message ko edit karke stylish card bhejein
        await sock.sendMessage(from, { text: card, edit: key });

    } catch (e) {
        console.error('Ping command error:', e);
    }
}

module.exports = pingCommand;
