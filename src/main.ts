import * as dotenv from 'dotenv'
dotenv.config();
import { Telegraf } from 'telegraf'
import * as sqlite from 'sqlite3'

import { initDatabase } from './database'
import handleMessage from './handleMessage'
import handleReaction from './handleReaction'

let db = new sqlite.Database('database.db');

const bot = new Telegraf(process.env.TOKEN);

bot.on('message', async (ctx) => {
    console.log(ctx.from.username, ctx.from.id);
    if (ctx.from.id == parseInt(process.env.ADMIN_ID)) {
        try {
            await handleMessage(ctx, db);
        } catch (e) {
            console.log(e);
            ctx.reply('❌ Серверная ошибка. Обратитесь к разработчику');
        }
    }
});

bot.on('callback_query', async (ctx) => {
    /* TODO: Handle reactions here */
    handleReaction(ctx, db);
});

(async function start() {
    await initDatabase(db);
    bot.launch();
})();

