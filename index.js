require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, jidNormalizedUser, Browsers, delay } = require('@whiskeysockets/baileys');
const P = require('pino');
const { OpenAI } = require('openai');

// ============================================
// ALL 40 COMMANDS HARDCODED
// ============================================
const commands = {
    // Download Commands
    song: require('./commands/song'),
    video: require('./commands/video'),
    insta: require('./commands/instagram'),
    tiktok: require('./commands/tiktok'),
    facebook: require('./commands/facebook'),
    apk: require('./commands/apk'),
    gdrive: require('./commands/gdrive'),
    mf: require('./commands/mf'),
    
    // Tools
    vv: require('./commands/vv'),
    dp: require('./commands/dp'),
    emojimix: require('./commands/emojimix'),
    character: require('./commands/character'),
    translate: require('./commands/translate').handleTranslateCommand,
    joke: require('./commands/joke'),
    meme: require('./commands/meme'),
    
    // Group Admin
    kick: require('./commands/kick'),
    tagall: require('./commands/tagall'),
    hidetag: require('./commands/hidetag'),
    groupinfo: require('./commands/groupinfo'),
    antilink: require('./commands/antilink'),
    setname: require('./commands/setname'),
    setpp: require('./commands/setpp'),
    fullpp: require('./commands/fullpp'),
    accept: require('./commands/accept'),
    
    // Owner
    owner: require('./commands/owner'),
    ping: require('./commands/ping'),
    private: require('./commands/private'),
    public: require('./commands/public'),
    autoread: require('./commands/autoread').autoreadCommand,
    autoreacts: require('./commands/autoreacts'),
    antidelete: require('./commands/antidelete'),
    anticall: require('./commands/anticall'),
    status: require('./commands/status'),
    autostatus: require('./commands/status'),
    
    // Other
    follow: require('./commands/follow'),
    report: require('./commands/report'),
    reportch: require('./commands/reportch'),
    hack: require('./commands/hack'),
    chid: require('./commands/chid')
};

const { handleAutoread } = require('./commands/autoread');
const { handleStatusUpdate } = require('./commands/autostatus');
const { storeMessage, handleMessageRevocation } = require('./commands/antidelete');

const app = express();
const server = http.createServer(app);

// ============================================
// TELEGRAM BOT (OPTIONAL)
// ============================================
const tgToken = process.env.TELEGRAM_TOKEN || "";
let tgBot = null;
if (tgToken && tgToken.trim() !== "" && tgToken !== " Past Your Bot Token here ") {
    try {
        tgBot = new TelegramBot(tgToken, { polling: true });
        console.log('✅ Telegram bot connected');
    } catch (e) {
        console.log('⚠️ Telegram bot failed:', e.message);
    }
} else {
    console.log('⚠️ Telegram token not set - Telegram features disabled');
}

const getStats = () => {
    const totalUsers = botData.telegramUsers ? botData.telegramUsers.length : 0;
    const totalActive = Object.values(sessions).filter(s => s.isConnected).length;
    return `👋 𝗪𝗘𝗟𝗖𝗢𝗠𝗘 𝗧𝗢 𝗛𝗝-𝗛𝗔𝗖𝗞𝗘𝗥 𝗠𝗗\n\n` +
           `╭━━━〔 𝗕𝗢𝗧 𝗦𝗧𝗔𝗧𝗨𝗦 〕━━━┈⊷\n` +
           `┃ ⋄ 𝗧𝗢𝗧𝗔𝗟 𝗨𝗦𝗘𝗥: ${totalUsers}\n` +
           `┃ ⋄ 𝗧𝗢𝗧𝗔𝗟 𝗔𝗖𝗧𝗜𝗩𝗘 𝗕𝗢𝗧𝗦: ${totalActive}\n` +
           `╰━━━━━━━━━━━━━━━━━━┈⊷`;
};

if (tgBot) {
    tgBot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;

        if (!botData.telegramUsers) botData.telegramUsers = [];
        if (!botData.telegramUsers.includes(chatId)) {
            botData.telegramUsers.push(chatId);
            saveBotData();
        }

        if (text === '/start') {
            const welcomeMsg = "👋 *WELCOME TO HJ-HACKER MD-BOT*\n\n🚀 *FAST & SECURE WHATSAPP AUTOMATION*\n\n📱 *ENTER YOUR WHATSAPP NUMBER*\n_(Example: 923000000000)_";
            await tgBot.sendMessage(chatId, welcomeMsg, {
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: [[{ text: "📊 BOT STATS" }]],
                    resize_keyboard: true
                }
            });
            return;
        }

        if (text === '📊 BOT STATS') {
            await tgBot.sendMessage(chatId, getStats());
            return;
        }

        if (/^\d+$/.test(text)) {
            const userId = chatId.toString();
            if (!sessions[userId]) {
                sessions[userId] = new BotSession(userId);
            }
            
            if (!botData.statusSettings[userId]) {
                botData.statusSettings[userId] = { 
                    autoStatus: false, autoSeen: false, autoLike: false,
                    autoDownload: false, isPublic: false
                };
                saveBotData();
            }

            const loadingMsg = await tgBot.sendMessage(chatId, "🔄 *Connecting to WhatsApp Servers...*", { parse_mode: 'Markdown' });
            
            let frames = ["⏳", "⌛", "🔄", "⚙️"];
            let i = 0;
            const animInterval = setInterval(async () => {
                try {
                    await tgBot.editMessageText(`${frames[i % frames.length]} *Generating Pairing Code for ${text}...*`, {
                        chat_id: chatId, message_id: loadingMsg.message_id, parse_mode: 'Markdown'
                    });
                    i++;
                } catch (e) { clearInterval(animInterval); }
            }, 1500);
            
            sessions[userId].tgChatId = chatId;
            sessions[userId].tgLoadingMsgId = loadingMsg.message_id;
            sessions[userId].tgAnimInterval = animInterval;
            await sessions[userId].initialize(text);
        }
    });
}

const io = socketIo(server, {
    cors: { origin: "*" },
    transports: ['websocket', 'polling']
});

let openai = null;
if (process.env.OPENAI_API_KEY) {
    try {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: process.env.AI_BASE_URL || "https://api.openai.com/v1"
        });
    } catch (e) {}
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const AUTH_DIR = './sessions';
const DATA_FILE = './data/bot_data.json';
fs.ensureDirSync(AUTH_DIR);
fs.ensureDirSync('./data');

let botData = { antilinkGroups: {}, totalBots: 0, registeredBots: [], statusSettings: {}, antiDelete: {}, userNames: {}, antiCall: {}, telegramUsers: [] };
if (fs.existsSync(DATA_FILE)) {
    try { botData = fs.readJsonSync(DATA_FILE); } catch (e) {}
}

function saveBotData() {
    fs.writeJsonSync(DATA_FILE, botData);
}

const sessions = {}; 
const userSockets = {}; 
const messageLogs = {}; 

async function loadExistingSessions() {
    try {
        const authDirs = await fs.readdir(AUTH_DIR);
        for (const userId of authDirs) {
            const authPath = path.join(AUTH_DIR, userId);
            const stats = await fs.stat(authPath);
            if (stats.isDirectory()) {
                const credsFile = path.join(authPath, 'creds.json');
                if (fs.existsSync(credsFile)) {
                    console.log(`[System] Found existing session: ${userId}`);
                    if (!sessions[userId]) {
                        sessions[userId] = new BotSession(userId);
                        sessions[userId].initialize().catch(err => {
                            console.error(`[System] Failed to init ${userId}:`, err.message);
                        });
                    }
                }
            }
        }
    } catch (err) {
        console.error('[System] Error loading sessions:', err.message);
    }
}

const toBold = (text) => {
    const boldChars = {
        'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵', 'i': '𝗶', 'j': '𝗷', 'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽', 'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁', 'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇',
        'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗴', 'H': '𝗵', 'I': '𝗶', 'J': '𝗷', 'K': '𝗸', 'L': '𝗹', 'M': '𝗺', 'N': '𝗻', 'O': '𝗼', 'P': '𝗽', 'Q': '𝗤', 'R': '𝗿', 'S': '𝘀', 't': '𝘁', 'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇',
        '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰', '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵'
    };
    return text.split('').map(c => boldChars[c] || c).join('');
};

class BotSession {
    constructor(userId) {
        this.userId = userId;
        this.sock = null;
        this.isConnected = false;
        this.aiEnabled = false; 
        this.autoReact = botData.statusSettings[userId]?.autoReact || false;
        this.isPublic = botData.statusSettings[userId]?.isPublic || false; 
        this.authPath = path.join(AUTH_DIR, userId);
        this.processedMessages = new Set();
        this.activeInterval = null;
        this.isInitializing = false;
        this.userChats = {}; 
        this.lastConnectMessageTime = null;
        this.tgChatId = null;
        this.tgLoadingMsgId = null;
        this.tgAnimInterval = null;
    }

    sendLog(message, type = 'info') {
        const logEntry = { timestamp: new Date().toLocaleTimeString(), message, type };
        const socketId = userSockets[this.userId];
        if (socketId) io.to(socketId).emit('console', logEntry);
        console.log(`[${this.userId}] ${message}`);
    }

    sendConnectionStatus() {
        const socketId = userSockets[this.userId];
        if (socketId) {
            io.to(socketId).emit('connection-status', { connected: this.isConnected, user: this.userId });
        }
        io.emit('total-active', Object.values(sessions).filter(s => s.isConnected).length);
        io.emit('total-users', botData.telegramUsers ? botData.telegramUsers.length : 0);
    }

    async getAIResponse(userJid, userMessage) {
        if (!openai) return "❌ AI is not configured.";
        try {
            const completion = await openai.chat.completions.create({
                model: process.env.AI_MODEL || "gpt-3.5-turbo",
                messages: [{ role: "system", content: "Helpful assistant." }, { role: "user", content: userMessage }],
                max_tokens: 150
            });
            return completion.choices[0].message.content.trim();
        } catch (error) {
            return "❌ AI Error: " + error.message;
        }
    }

    startActiveCheck() {
        if (this.activeInterval) clearInterval(this.activeInterval);
        this.activeInterval = setInterval(async () => {
            if (this.isConnected && this.sock?.user) {
                try {
                    const botNumber = jidNormalizedUser(this.sock.user.id);
                    await this.sock.sendMessage(botNumber, { text: "𝗛𝗝-𝗛𝗔𝗖𝗞𝗘𝗥 𝗠𝗗-𝗕𝗢𝗧 𝗜𝗦 𝗢𝗡𝗟𝗜𝗡𝗘 🚀\n\n_24/7 Active System Working..._" });
                    this.sendLog("Keep-alive sent ✅", "success");
                } catch (e) {
                    this.sendLog("Keep-alive failed: " + e.message, "error");
                }
            }
        }, 60 * 60 * 1000);
    }

    // ============================================
    // DYNAMIC MENU BUILDER
    // ============================================
    buildMenu() {
        const cmdList = Object.keys(commands).sort();
        
        const groups = {
            'DOWNLOAD': ['song', 'video', 'insta', 'tiktok', 'facebook', 'apk', 'gdrive', 'mf'],
            'TOOLS': ['vv', 'dp', 'emojimix', 'character', 'translate', 'joke', 'meme'],
            'GROUP': ['kick', 'tagall', 'hidetag', 'groupinfo', 'antilink', 'setname', 'setpp', 'fullpp', 'accept'],
            'OWNER': ['owner', 'ping', 'private', 'public', 'autoread', 'autoreacts', 'antidelete', 'anticall', 'status', 'autostatus'],
            'OTHER': ['follow', 'report', 'reportch', 'hack', 'chid']
        };
        
        let menuText = `╭━━━〔 ${toBold("HJ-HACKER MD")} 〕━━━┈⊷\n`;
        menuText += `┃ ⋄ ${toBold("USER:")} ${this.userId}\n`;
        menuText += `┃ ⋄ ${toBold("PREFIX:")} [ . ]\n`;
        menuText += `┃ ⋄ ${toBold("COMMANDS:")} ${cmdList.length}\n`;
        menuText += `╰━━━━━━━━━━━━━━━━━━┈⊷\n\n`;
        
        const groupedCmds = Object.values(groups).flat();
        
        for (const [groupName, groupCmds] of Object.entries(groups)) {
            const available = groupCmds.filter(c => cmdList.includes(c));
            if (available.length === 0) continue;
            
            menuText += `╭━━━〔 ${toBold(groupName)} 〕━━━┈⊷\n`;
            for (const cmd of available) {
                menuText += `┃ ⋄ ${toBold("." + cmd)}\n`;
            }
            menuText += `╰━━━━━━━━━━━━━━━━━━┈⊷\n\n`;
        }
        
        const ungrouped = cmdList.filter(c => !groupedCmds.includes(c) && c !== 'menu');
        if (ungrouped.length > 0) {
            menuText += `╭━━━〔 ${toBold("MORE")} 〕━━━┈⊷\n`;
            for (const cmd of ungrouped) {
                menuText += `┃ ⋄ ${toBold("." + cmd)}\n`;
            }
            menuText += `╰━━━━━━━━━━━━━━━━━━┈⊷\n\n`;
        }
        
        menuText += `🤖 ${toBold("Active Features:")}\n`;
        menuText += `• ${toBold("Auto-React:")} ${this.autoReact ? '✅' : '❌'}\n`;
        menuText += `• ${toBold("Anti-Delete:")} ${botData.antiDelete[this.userId] ? '✅' : '❌'}\n`;
        menuText += `• ${toBold("Auto-Status:")} ${(botData.statusSettings[this.userId] && botData.statusSettings[this.userId].autoStatus) ? '✅' : '❌'}\n\n`;
        menuText += `🔗 ${toBold("CHANNEL:")}\n`;
        menuText += `> https://whatsapp.com/channel/0029Vb8U1NiHrDZlqZZuqr1s\n`;
        menuText += `⚡ ${toBold("POWERED BY: HJ-HACKER")}`;
        
        return menuText;
    }

    async initialize(pairingNumber = null) {
        if (this.isInitializing) return;
        this.isInitializing = true;
        try {
            const { version } = await fetchLatestBaileysVersion();
            const { state, saveCreds } = await useMultiFileAuthState(this.authPath);
            
            this.sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'fatal' })),
                },
                printQRInTerminal: false,
                logger: P({ level: 'fatal' }),
                browser: Browsers.ubuntu('Chrome'),
                syncFullHistory: false,
                shouldSyncHistoryMessage: () => false,
                markOnlineOnConnect: true,
                keepAliveIntervalMs: 30000,
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 60000,
                emitOwnEvents: true,
                retryRequestDelayMs: 5000,
                maxMsgRetryCount: 5,
                linkPreviewImageThumbnailWidth: 192,
                transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
                getMessage: async (key) => {
                    if (messageLogs[key.id]) return { conversation: messageLogs[key.id].text };
                    return { conversation: 'Bot is active' };
                }
            });

            if (pairingNumber && !state.creds.registered) {
                await delay(3000);
                try {
                    let code = await this.sock.requestPairingCode(pairingNumber);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    this.sendLog(`🔑 Pairing Code: ${code}`, 'success');
                    
                    if (this.tgChatId && tgBot) {
                        if (this.tgAnimInterval) clearInterval(this.tgAnimInterval);
                        const pairingMsg = `✅ *PAIRING CODE*\n\n🔑 *CODE:* \`${code}\``;
                        if (this.tgLoadingMsgId) {
                            await tgBot.editMessageText(pairingMsg, { chat_id: this.tgChatId, message_id: this.tgLoadingMsgId, parse_mode: 'Markdown' });
                        } else {
                            await tgBot.sendMessage(this.tgChatId, pairingMsg, { parse_mode: 'Markdown' });
                        }
                    }
                    const socketId = userSockets[this.userId];
                    if (socketId) io.to(socketId).emit('pairing-code', code);
                } catch (err) {
                    this.sendLog(`❌ Pairing error: ${err.message}`, 'error');
                }
            }

            this.sock.ev.on('creds.update', saveCreds);

            this.sock.ev.on('call', async (calls) => {
                if (botData.antiCall[this.userId]) {
                    for (const call of calls) {
                        if (call.status === 'offer') {
                            try {
                                await this.sock.rejectCall(call.id, call.from);
                            } catch (e) {}
                        }
                    }
                }
            });

            this.sock.ev.on('messages.upsert', async (m) => {
                if (m.type !== 'notify') return;
                
                for (const msg of m.messages) {
                    (async () => {
                    try {
                        const from = msg.key.remoteJid;
                        const isMe = msg.key.fromMe;
                        const botNumber = jidNormalizedUser(this.sock.user.id);
                        const isAdmin = isMe;

                        if (!msg.message) return;
                        const type = Object.keys(msg.message)[0];
                        const body = (type === 'conversation') ? msg.message.conversation : 
                                     (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : 
                                     (type === 'imageMessage') ? msg.message.imageMessage.caption : 
                                     (type === 'videoMessage') ? msg.message.videoMessage.caption : '';
                        
                        messageLogs[msg.key.id] = { text: body, from };

                        // Auto features
                        try {
                            if (from === 'status@broadcast') {
                                await handleStatusUpdate(this.sock, { messages: [msg] }, botData, this.userId);
                            }
                        } catch (e) {}

                        try {
                            await handleAutoread(this.sock, msg, this.userId, botData);
                        } catch (e) {}

                        try {
                            if (type === 'protocolMessage' && msg.message.protocolMessage.type === 0) {
                                await handleMessageRevocation(this.sock, msg, botData, this.userId);
                            } else {
                                await storeMessage(msg, this.userId);
                            }
                        } catch (e) {}

                        // AI Response
                        if (this.aiEnabled && !isMe && !from.endsWith('@g.us')) {
                            const response = await this.getAIResponse(from, body);
                            await this.sock.sendMessage(from, { text: response }, { quoted: msg });
                        }

                        // Auto React
                        if (this.autoReact && !isMe) {
                            const emojis = ['❤️', '🔥', '✨', '✅', '🙌', '🌟', '⚡', '🤖', '👑', '💯'];
                            const emoji = emojis[Math.floor(Math.random() * emojis.length)];
                            await this.sock.sendMessage(from, { react: { text: emoji, key: msg.key } });
                        }

                        // Anti-Link
                        if (from.endsWith('@g.us') && botData.antilinkGroups[from] && !isMe) {
                            const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(chat\.whatsapp\.com\/[^\s]+)/gi;
                            linkRegex.lastIndex = 0;
                            const hasLink = linkRegex.test(body);
                            
                            if (hasLink) {
                                try {
                                    const { isAdmin: checkAdmin } = require('./lib/isAdmin');
                                    const sender = msg.key.participant || msg.participant || msg.key.remoteJid;
                                    const senderIsAdmin = await checkAdmin(this.sock, from, sender);
                                    
                                    if (!senderIsAdmin) {
                                        await this.sock.sendMessage(from, { delete: msg.key });
                                        if (botData.antilinkGroups[from] === 'kick') {
                                            await this.sock.groupParticipantsUpdate(from, [sender], 'remove');
                                        }
                                    }
                                } catch (e) {
                                    this.sendLog(`Anti-link error: ${e.message}`, 'error');
                                }
                            }
                        }

                        // Command Handler
                        const prefix = '.';
                        if (body && body.startsWith(prefix)) {
                            const args = body.slice(prefix.length).trim().split(/ +/);
                            const commandName = args.shift().toLowerCase();
                            const q = args.join(' ');

                            // Menu (built-in)
                            if (commandName === 'menu' || commandName === 'help') {
                                try {
                                    const menuEmojis = ['📥', '⏳', '📜'];
                                    for (const emoji of menuEmojis) {
                                        await this.sock.sendMessage(from, { react: { text: emoji, key: msg.key } });
                                    }
                                    const menuText = this.buildMenu();
                                    try {
                                        await this.sock.sendMessage(from, { 
                                            image: { url: 'https://i.ibb.co/cKn3SBVp/file-000000000ec082308b1fcfad7672387e.png' }, 
                                            caption: menuText 
                                        });
                                    } catch (e) { 
                                        await this.sock.sendMessage(from, { text: menuText }); 
                                    }
                                } catch (e) {
                                    this.sendLog('Menu error: ' + e.message, 'error');
                                }
                                continue;
                            }

                            // Command execution
                            if (commands[commandName]) {
                                try {
                                    const cmdFunc = commands[commandName];
                                    
                                    // Handle different command signatures
                                    if (['antilink'].includes(commandName)) {
                                        await cmdFunc(this.sock, from, msg, isAdmin, botData, saveBotData, args);
                                    } else if (['anticall', 'antidelete', 'setname'].includes(commandName)) {
                                        await cmdFunc(this.sock, from, msg, isAdmin, botData, saveBotData, this.userId, args);
                                    } else if (['status', 'autostatus'].includes(commandName)) {
                                        await cmdFunc(this.sock, from, msg, isAdmin, botData, saveBotData, this.userId, args);
                                    } else if (commandName === 'autoreacts') {
                                        await cmdFunc(this.sock, from, msg, isAdmin, this, args);
                                    } else if (['private', 'public'].includes(commandName)) {
                                        await cmdFunc(this.sock, from, msg, isAdmin, this);
                                        if (!botData.statusSettings[this.userId]) botData.statusSettings[this.userId] = {};
                                        botData.statusSettings[this.userId].isPublic = (commandName === 'public');
                                        saveBotData();
                                    } else if (['hidetag', 'tagall'].includes(commandName)) {
                                        await cmdFunc(this.sock, from, msg, isAdmin, q);
                                    } else if (commandName === 'kick') {
                                        await cmdFunc(this.sock, from, msg, isAdmin);
                                    } else if (['gdrive', 'mf'].includes(commandName)) {
                                        await cmdFunc(this.sock, from, msg, q);
                                    } else if (commandName === 'accept') {
                                        await cmdFunc(this.sock, from, msg, isAdmin);
                                    } else if (commandName === 'chid') {
                                        await cmdFunc(this.sock, from, msg, args);
                                    } else if (['follow', 'reportch'].includes(commandName)) {
                                        await cmdFunc(this.sock, from, msg, isAdmin, sessions, args);
                                    } else if (commandName === 'report') {
                                        await cmdFunc(this.sock, from, msg, isAdmin, args);
                                    } else if (['setpp', 'fullpp'].includes(commandName)) {
                                        await cmdFunc(this.sock, from, msg, isAdmin);
                                    } else {
                                        // Default 3-arg pattern
                                        await cmdFunc(this.sock, from, msg);
                                    }
                                } catch (e) {
                                    this.sendLog(`Command ${commandName} error: ${e.message}`, 'error');
                                    try {
                                        await this.sock.sendMessage(from, { text: `❌ Error in .${commandName}: ${e.message}` }, { quoted: msg });
                                    } catch (_) {}
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Message Processing Error:', e);
                    }
                })();
            }
        });

            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                if (qr) {
                    const socketId = userSockets[this.userId];
                    if (socketId) io.to(socketId).emit('qr', qr);
                }

                if (connection === 'close') {
                    this.isConnected = false;
                    this.isInitializing = false;
                    this.sendLog(`Connection closed`, 'warning');
                    this.sendConnectionStatus();
                    const statusCode = (lastDisconnect.error)?.output?.statusCode;
                    
                    if (statusCode === DisconnectReason.loggedOut) {
                        try { if (fs.existsSync(this.authPath)) fs.removeSync(this.authPath); } catch (e) {}
                        delete sessions[this.userId];
                    } else if (statusCode === 401) {
                        setTimeout(() => this.initialize(), 10000);
                    } else if (statusCode === DisconnectReason.restartRequired || statusCode === 428) {
                        setTimeout(() => this.initialize(), 3000);
                    } else if (statusCode === 515) {
                        this.initialize();
                    } else {
                        setTimeout(() => this.initialize(), 5000);
                    }
                } else if (connection === 'open') {
                    this.isConnected = true;
                    this.isInitializing = false;
                    this.sendLog('Connected! ✅', 'success');
                    this.sendConnectionStatus();
                    this.startActiveCheck();
                    
                    const botNumber = jidNormalizedUser(this.sock.user.id);
                    
                    if (this.tgChatId && tgBot) {
                        await tgBot.sendMessage(this.tgChatId, "✅ WHATSAPP CONNECTED!");
                    }

                    setTimeout(async () => {
                        if (!this.isConnected || !this.sock) return;
                        try {
                            await this.sock.query({
                                tag: 'iq',
                                attrs: { to: '@s.whatsapp.net', type: 'set', xmlns: 'status' },
                                content: [{ tag: 'status', attrs: {}, content: Buffer.from("HJ-HACKER MD-BOT", 'utf-8') }]
                            });
                        } catch (e) {}
                    }, 5000);

                    if (!this.lastConnectMessageTime || (Date.now() - this.lastConnectMessageTime > 60 * 60 * 1000)) {
                        await this.sock.sendMessage(botNumber, { text: "𝗕𝗢𝗧 𝗖𝗢𝗡𝗡𝗘𝗖𝗧𝗘𝗗 ✅\n\nType .menu" });
                        this.lastConnectMessageTime = Date.now();
                    }
                }
            });
        } catch (err) {
            this.isInitializing = false;
            this.sendLog(`Init failed: ${err.message}. Retry in 10s...`, 'error');
            setTimeout(() => this.initialize(), 10000);
        }
    }
}

io.on('connection', (socket) => {
    socket.on('set-user', (userId) => {
        userSockets[userId] = socket.id;
        if (!sessions[userId]) sessions[userId] = new BotSession(userId);
        sessions[userId].sendConnectionStatus();
    });

    socket.on('pair-request', async ({ userId, number }) => {
        if (sessions[userId]) {
            if (!botData.statusSettings[userId]) {
                botData.statusSettings[userId] = { autoStatus: false, autoSeen: false, autoLike: false, autoDownload: false, isPublic: false };
                saveBotData();
            }
            await sessions[userId].initialize(number);
        }
    });

    socket.on('logout', async (userId) => {
        if (sessions[userId]) {
            if (sessions[userId].sock) {
                try { await sessions[userId].sock.logout(); } catch (e) {}
            }
            const authPath = path.join(AUTH_DIR, userId);
            if (fs.existsSync(authPath)) fs.removeSync(authPath);
            delete sessions[userId];
            io.emit('total-active', Object.values(sessions).filter(s => s.isConnected).length);
        }
    });

    socket.on('disconnect', () => {
        for (const userId in userSockets) {
            if (userSockets[userId] === socket.id) {
                delete userSockets[userId];
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📦 Loaded ${Object.keys(commands).length} commands`);
    loadExistingSessions();
    
    process.on('uncaughtException', (err) => {
        console.error('Uncaught Exception:', err);
    });

    process.on('unhandledRejection', (reason) => {
        console.error('Unhandled Rejection:', reason);
    });

    const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
    setInterval(async () => {
        try {
            await axios.get(APP_URL);
            console.log("Anti-Sleep Ping ⚡");
        } catch (e) {}
    }, 5 * 60 * 1000);
});
