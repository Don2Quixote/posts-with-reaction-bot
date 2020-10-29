import { TelegrafContext } from 'telegraf/typings/context'
import { InlineKeyboardMarkup } from 'telegram-typings'
import { Database as sqliteDatabase } from 'sqlite3'

import { getVotes, addVote } from './database'

function generatePostKeyboard(links?: {name: string, url: string}[], reactionButtons?: string[], postId?: string): InlineKeyboardMarkup['inline_keyboard'] {
    let keyboard = [];

    if (links && links.length == 1) {
        keyboard.push([
            { text: links[0].name, url: links[0].url }
        ]);
    } else if (links && links.length == 2) {
        keyboard.push([
            { text: links[0].name, url: links[0].url },
            { text: links[1].name, url: links[1].url }
        ]);
    } else if (links && links.length == 3) {
        keyboard.push([
            { text: links[0].name, url: links[0].url },
            { text: links[1].name, url: links[1].url }
        ]);
        keyboard.push([
            { text: links[2].name, url: links[2].url },
        ]);
    } else if (links && links.length == 4) {
        keyboard.push([
            { text: links[0].name, url: links[0].url },
            { text: links[1].name, url: links[1].url }
        ]);
        keyboard.push([
            { text: links[2].name, url: links[2].url },
            { text: links[3].name, url: links[3].url }
        ]);
    }

    if (reactionButtons && reactionButtons.length > 0) {
        let reactionButtonsKeyboardRow = [];
        for (let rb in reactionButtons) {
            reactionButtonsKeyboardRow.push({
                text: reactionButtons[rb] + ' 0',
                callback_data: postId ? `${postId}:${+rb+1}` : '#'
            });
        }
        keyboard.push(reactionButtonsKeyboardRow);
    }

    return keyboard;
}

/* "ctx: any" because ctx.update.callback_query.message.reply_markup is not in typings */
export default async function handleReaction(ctx: any, db: sqliteDatabase) {
    let [postId, requiredEmojiPosition, emojiVotes] = ctx.update.callback_query.data.split(':');

    let votes = await getVotes(db, postId);
    if (!votes.includes(ctx.from.id)) {
        let keyboard = ctx.update.callback_query.message.reply_markup.inline_keyboard;
        console.log(keyboard);
        let newKeyboard = [];
        for (let row in keyboard) {
            if (keyboard[row][0].url) newKeyboard.push(keyboard[row]);
            else {
                newKeyboard.push([]);
                for (let item in keyboard[row]) {
                    console.log(keyboard[row][item]);
                    let [post_id, emojiPosition] = keyboard[row][item].callback_data.split(':');
                    if (emojiPosition == requiredEmojiPosition) {
                        let splitted = keyboard[row][item].text.split(' ');
                        let votes = splitted[splitted.length - 1];
                        let emoji = splitted.slice(0, splitted.length - 1).join(' ');
                        newKeyboard[newKeyboard.length - 1].push({
                            text: emoji + ' ' + (+votes + 1).toString(),
                            callback_data: keyboard[row][item].callback_data
                        });
                    } else {
                        newKeyboard[newKeyboard.length - 1].push(keyboard[row][item]);
                    }
                }
            }
        }
        await addVote(db, postId, ctx.from.id);
        ctx.editMessageReplyMarkup({
            inline_keyboard: newKeyboard
        });
        ctx.answerCbQuery('');
    } else {
        ctx.answerCbQuery('Вы уже поставили свою отметку');
    }
}
