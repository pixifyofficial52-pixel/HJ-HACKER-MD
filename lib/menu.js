// Full command menu — sent as a TEXT message so WhatsApp never truncates it
// (image captions are cut at ~1000 characters, which is why only ~25 commands used to show).
const { channelInfo, CHANNEL_NAME } = require('./messageConfig');

const MENU_IMAGE = 'https://i.ibb.co/cKn3SBVp/file-000000000ec082308b1fcfad7672387e.png';

const SECTIONS = [
    { title: 'MAIN', items: ['menu', 'ping', 'owner', 'pair (number)', 'autoreacts [on/off]', 'antilink [on/off/kick]', 'antidelete [on/off]', 'anticall [on/off]', 'autoread [on/off]', 'status [on/off]'] },
    { title: 'DOWNLOAD', items: ['apk (name)', 'tiktok (url)', 'insta (url)', 'facebook (url)', 'song (name)', 'video (name)', 'gdrive (url)', 'mf (url)'] },
    { title: 'FUN & TOOLS', items: ['joke', 'meme', 'emojimix (e1+e2)', 'character (mention)', 'translate (reply)', 'hack', 'dp (mention)', 'vv (reply view once)'] },
    { title: 'GROUP', items: ['kick (mention)', 'hidetag (text)', 'tagall', 'groupinfo', 'accept', 'antilink [on/off/kick]'] },
    { title: 'OWNER', items: ['private', 'public', 'setname (name)', 'setpp (reply img)', 'fullpp (reply img)', 'chid (link)', 'follow (link)', 'report (number)', 'reportch (link)'] }
];

function buildMenu({ user, prefix, toBold, flags, isOwner, isPublic }) {
    const line = (t) => `┃ ⋄ ${toBold(prefix + t)}\n`;
    let text = `╭━━━〔 ${toBold('HJ-HACKER MD')} 〕━━━┈⊷\n` +
        `┃ ⋄ ${toBold('USER:')} ${user}\n` +
        `┃ ⋄ ${toBold('MODE:')} ${isPublic ? 'PUBLIC 🌐' : 'PRIVATE 🔒'}\n` +
        `┃ ⋄ ${toBold('PREFIX:')} [ ${prefix} ]\n` +
        `┃ ⋄ ${toBold('COMMANDS:')} ${SECTIONS.reduce((n, s) => n + s.items.length, 0)}\n` +
        `╰━━━━━━━━━━━━━━━━━━┈⊷\n\n`;

    for (const s of SECTIONS) {
        text += `╭━━━〔 ${toBold(s.title)} 〕━━━┈⊷\n`;
        for (const it of s.items) text += line(it);
        text += `╰━━━━━━━━━━━━━━━━━━┈⊷\n\n`;
    }

    text += `🤖 ${toBold('Active Features:')}\n` +
        `• ${toBold('Auto-React:')} ${flags.autoReact ? '✅' : '❌'}\n` +
        `• ${toBold('Anti-Delete:')} ${flags.antiDelete ? '✅' : '❌'}\n` +
        `• ${toBold('Auto-Status:')} ${flags.autoStatus ? '✅' : '❌'}\n\n`;

    if (!isOwner) {
        text += `🔒 ${toBold('NOTE:')} Only the bot owner can use these commands.\n` +
            `👉 Apna bot banane ke liye: *${prefix}pair 92XXXXXXXXXX*\n\n`;
    }

    text += `📢 ${toBold('CHANNEL:')} ${CHANNEL_NAME} _(forwarded badge upar tap karein)_\n` +
        `⚡ ${toBold('POWERED BY: HJ-HACKER')}`;
    return text;
}

async function sendMenu(sock, from, msg, opts) {
    const text = buildMenu(opts);
    // Image header (short caption) + full menu as text = nothing gets cut off.
    try {
        await sock.sendMessage(from, {
            image: { url: MENU_IMAGE },
            caption: `${opts.toBold('HJ-HACKER MD')} • ${SECTIONS.reduce((n, s) => n + s.items.length, 0)} commands`,
            ...channelInfo
        }, { quoted: msg });
    } catch (_) {}
    await sock.sendMessage(from, { text, ...channelInfo }, { quoted: msg });
}

module.exports = { sendMenu, buildMenu, SECTIONS };
