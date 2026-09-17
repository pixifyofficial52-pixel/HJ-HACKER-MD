// HJ-HACKER MD — channel branding config
// The channel JID is resolved automatically at connect time from the invite code below.
const CHANNEL_INVITE = '0029Vb8U1NiHrDZlqZZuqr1s';
const CHANNEL_LINK = `https://whatsapp.com/channel/${CHANNEL_INVITE}`;
const CHANNEL_NAME = 'HJ-HACKER MD';

const state = {
    jid: '120363348739987203@newsletter', // fallback until resolved
    name: CHANNEL_NAME
};

const channelInfo = {
    contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        get forwardedNewsletterMessageInfo() {
            return {
                newsletterJid: state.jid,
                newsletterName: state.name,
                serverMessageId: -1
            };
        }
    }
};

module.exports = {
    channelInfo,
    CHANNEL_INVITE,
    CHANNEL_LINK,
    CHANNEL_NAME,
    getChannelJid: () => state.jid,
    setChannelJid: (jid, name) => {
        if (jid) state.jid = jid;
        if (name) state.name = name;
    }
};
