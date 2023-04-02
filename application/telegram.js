const TelegramBot = require('node-telegram-bot-api');
const info = require("./config");

class Telegram {
    constructor() {
        //this.chatId = 5888268655;
        this.chatId = 5888268655;

        // Create a bot that uses 'polling' to fetch new updates
        this.bot = new TelegramBot("6280246289:AAF2RBu0XwP18PYFMh3tnJR3kO55SGP7d4s", { polling: true });
        this.listen();
        this.send({ message: `${info.id} started at ${new Date()}  🐶🐶🐶` });
    }
    getRandomEmoji = () => {
        let emojis = ["✌", "😂", "😝", "😁", "😱", "👉", "🙌", "🍻", "🔥", "🌈", "☀", "🎈", "🌹", "💄", "🎀", "⚽", "🎾", "🏁", "😡", "👿", "🐻", "🐶", "🐬", "🐟", "🍀", "👀", "🚗", "🍎", "💝", "💙", "👌", "❤", "😍", "😉", "😓", "😳", "💪", "💩", "🍸", "🔑", "💖", "🌟", "🎉", "🌺", "🎶", "👠", "🏈", "⚾", "🏆", "👽", "💀", "🐵", "🐮", "🐩", "🐎", "💣", "👃", "👂", "🍓", "💘", "💜", "👊", "💋", "😘", "😜", "😵", "🙏", "👋", "🚽", "💃", "💎", "🚀", "🌙", "🎁", "⛄", "🌊", "⛵", "🏀", "🎱", "💰", "👶", "👸", "🐰", "🐷", "🐍", "🐫", "🔫", "👄", "🚲", "🍉", "💛", "💚"];
        let getRandom = Math.floor(Math.random() * emojis.length);
        return emojis[getRandom];
    }
    listen = () => {
        this.bot.on('message', async (msg) => {
            this.chatId = msg.chat.id;
        });
    }
    send = (data) => {
        this.bot.sendMessage(this.chatId, data.message);
    }

}




module.exports = new Telegram;