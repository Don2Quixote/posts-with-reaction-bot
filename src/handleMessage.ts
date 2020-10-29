import * as crypto from 'crypto'
import { TelegrafContext } from 'telegraf/typings/context'
import { InlineKeyboardMarkup } from 'telegram-typings'
import { Database as sqliteDatabase } from 'sqlite3'

import { State, processData } from './database'

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

export default async function handleMessage(ctx: TelegrafContext, db: sqliteDatabase) {
    let chatProcess = await processData.get(db);

    console.log(State[chatProcess.state]);
    console.log(chatProcess);

    if (chatProcess.state == State.notStarted) {
        if (ctx.message.text == '/start') {
            await processData.init(db);
            ctx.reply('👉 Укажите @username канала, в котором нужно опубликовать пост', {
                reply_markup: {
                    keyboard: [
                        [ { text: '❌ Отмена' } ]
                    ],
                    resize_keyboard: true
                }
            });
        } else {
            ctx.reply('ℹ️ Чтобы создать пост, введите команду /start');
        }
    } else if (ctx.message.text == '❌ Отмена') {
        await processData.drop(db);
        ctx.reply('ℹ️ Создание поста отменено', {
            reply_markup: {
                remove_keyboard: true
            }
        });
    } else if (chatProcess.state == State.expectingChannel) {
        if (!ctx.message.text) return;
        let botInChannel = true;
        try {
            await ctx.telegram.getChatAdministrators(ctx.message.text);
        } catch (e) {
            botInChannel = false;
        }
        if (botInChannel) {
            await processData.setChannel(db, ctx.message.text);
            ctx.reply('👉 Отправьте сообщение с текстом для поста');
        } else {
            ctx.reply('❌ Бот не состоит в этом канале');
        }
    } else if (chatProcess.state == State.expectingText) {
        if (!ctx.message.text) return;
        if (ctx.message.text.length <= 1000) {
            await processData.setText(db, ctx.message.text);
            let replyText =
                '👉 Отправьте картинку для поста\n' +
                '\n' +
                'ℹ️ Если картинка не нужна, отправьте сообщение с текстом "нет"';
            ctx.reply(replyText);
        } else {
            ctx.reply('❌ Максимальная длина текста для поста - 1000 символов');
        }
    } else if (chatProcess.state == State.expectingImage) {
        let replyText =
            '👉 Укажите ссылки в формате\n' +
            'Название ссылки1 - ссылка1\n' +
            'Название ссылки2 - ссылка2\n' +
            '\n' +
            '👉 Например\n' +
            'Google - https://google.com\n' +
            '\n' +
            'ℹ️ Если ссылка не нужна, отправьте сообщение с текстом "нет"';
        if (ctx.message.photo) {
            await processData.setImage(db, ctx.message.photo[0].file_id);
            ctx.reply(replyText);
        } else if (ctx.message.text && ctx.message.text.toLowerCase() == 'нет') {
            await processData.setImage(db, null);
            ctx.reply(replyText);
        } else {
            ctx.reply('❌ Вы должны отправить картинку');
        }
    } else if (chatProcess.state == State.expectingLinks) {
        if (!ctx.message.text) return;
        let replyText =
            '👉 Отправьте эмодзи для кнопок-реакций (не более 3ёх)\n' +
            '\n' +
            '👉 Например:\n' +
            '👍/😐/👎\n' +
            '\n' +
            'ℹ️ Если кнопки-реакции не нужны, отправьте сообщение с текстом "нет"';
        if (ctx.message.text.toLowerCase() == 'нет') {
            await processData.setLinks(db, null);
            ctx.reply(replyText);
        } else {
            let links = ctx.message.text.split('\n');
            let rawLinks: {name: string, url: string}[] = [];
            for (let link of links) {
                if (link.includes(' - ')) {
                    let splitted = link.split(' - ');
                    rawLinks.push({
                        name: splitted[0],
                        url: splitted[1]
                    });
                } else {
                    ctx.reply('❌ Кажется, где-то вы допустили ошибку');
                    return;
                }
            }
            let keyboard = generatePostKeyboard(rawLinks, []);
            if (keyboard.length) {
                try {
                    await ctx.reply('ℹ️ Клавиатура будет выглядеть так', {
                        reply_markup: {
                            inline_keyboard: keyboard
                        }
                    });
                } catch (e) {
                    ctx.reply('❌ Кажется, где-то вы допустили ошибку');
                    return;
                }
            }
            await processData.setLinks(db, rawLinks);
            ctx.reply(replyText);
        }
    } else if (chatProcess.state == State.expectingReactionButtons) {
        if (!ctx.message.text) return;
        if (ctx.message.text.toLowerCase() == 'нет') {
            await processData.setReactionButtons(db, null);
            await ctx.reply('🎉 Пост будет выглядеть так');
            if (chatProcess.image) {
                await ctx.replyWithPhoto(chatProcess.image, {
                    caption: chatProcess.text,
                    reply_markup: {
                        inline_keyboard: generatePostKeyboard(chatProcess.links, [])
                    }
                });
            } else {
                await ctx.reply(chatProcess.text, {
                    reply_markup: {
                        inline_keyboard: generatePostKeyboard(chatProcess.links, [])
                    }
                });
            }
            await ctx.reply('✉️ Отправить?', {
                reply_markup: {
                    keyboard: [
                        [ { text: '❌ Отмена' }, { text: '✅ Отправить' } ]
                    ],
                    resize_keyboard: true
                }
            });
        } else {
            let reactions = ctx.message.text.split('/');
            if (reactions.length > 3) {
                ctx.reply('❌ Нельзя указать более 3ёх эмодзи');
            } else if (reactions.filter(r => r.length == 0).length) {
                ctx.reply('❌ Ошибка');
            } else {
                await processData.setReactionButtons(db, reactions);
                await ctx.reply('🎉 Пост будет выглядеть так');
                if (chatProcess.image) {
                    await ctx.replyWithPhoto(chatProcess.image, {
                        caption: chatProcess.text,
                        reply_markup: {
                            inline_keyboard: generatePostKeyboard(chatProcess.links, reactions)
                        }
                    });
                } else {
                    await ctx.reply(chatProcess.text, {
                        reply_markup: {
                            inline_keyboard: generatePostKeyboard(chatProcess.links, reactions)
                        }
                    });
                }
                await ctx.reply('✉️ Отправить?', {
                    reply_markup: {
                        keyboard: [
                            [ { text: '❌ Отмена' }, { text: '✅ Отправить' } ]
                        ],
                        resize_keyboard: true
                    }
                });
            }
        }
    } else if (chatProcess.state == State.readyToPost) {
        if (!ctx.message.text) return;
        if (ctx.message.text.toLowerCase().includes('отправить')) {
            let postId = crypto.randomBytes(8).toString('hex');
            if (chatProcess.image) {
                await ctx.telegram.sendPhoto(chatProcess.channel, chatProcess.image, {
                    caption: chatProcess.text,
                    reply_markup: {
                        inline_keyboard: generatePostKeyboard(chatProcess.links, chatProcess.reactionButtons, postId)
                    }
                });
            } else {
                await ctx.telegram.sendMessage(chatProcess.channel, chatProcess.text, {
                    reply_markup: {
                        inline_keyboard: generatePostKeyboard(chatProcess.links, chatProcess.reactionButtons, postId)
                    }
                });
            }
            await processData.drop(db);
            ctx.reply('🎉 Пост отправлен!', {
                reply_markup: {
                    remove_keyboard: true
                }
            });
        } else {
            ctx.reply('Выберите, что делать с постом', {
                reply_markup: {
                    keyboard: [
                        [ { text: '❌ Отмена' }, { text: '✅ Отправить' } ]
                    ],
                    resize_keyboard: true
                }
            });
        }
    } else {
        throw 'Error: no such chatProcess.state registered - ' + chatProcess.state;
    }
}

