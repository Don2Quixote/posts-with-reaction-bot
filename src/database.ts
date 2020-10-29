import { Database as sqliteDatabase } from 'sqlite3'

function createTableChatProcess(db: sqliteDatabase) {
    return new Promise((resolve, reject) => {
        db.run('CREATE TABLE IF NOT EXISTS chatProcess(state INTEGER, channel TEXT, text TEXT, image TEXT)', (err: Error) => err ?
            reject(err)
            : db.run(`INSERT INTO chatProcess (state) VALUES (${State.notStarted})`, (err: Error) => err ?
            reject(err)
            : resolve(true)
        ))
    });
}

function createTableProcessLinks(db: sqliteDatabase) {
    return new Promise((resolve, reject) => {
        db.run('CREATE TABLE IF NOT EXISTS processLinks(name TEXT, url TEXT)', (err: Error) => {
            if (err) reject(err);
            else resolve(true);
        });
    });
}

function createTableProcessReactionButtons(db: sqliteDatabase) {
    return new Promise((resolve, reject) => {
        db.run('CREATE TABLE IF NOT EXISTS processReactionButtons(reactionButton TEXT)', (err: Error) => {
            if (err) reject(err);
            else resolve(true);
        });
    });
}

function createTableVotes(db: sqliteDatabase) {
    return new Promise((resolve, reject) => {
        db.run('CREATE TABLE IF NOT EXISTS votes(postId TEXT, userId INTEGER)', (err: Error) => {
            if (err) reject(err);
            else resolve(true);
        });
    });
}

export async function initDatabase(db: sqliteDatabase) {
    await createTableChatProcess(db);
    await createTableProcessLinks(db);
    await createTableProcessReactionButtons(db);
    await createTableVotes(db);
    return true;
}

export enum State {
    notStarted,
    expectingChannel,
    expectingText,
    expectingImage,
    expectingLinks,
    expectingReactionButtons,
    readyToPost
}

interface IChatProcess {
    state: State,
    channel?: string,
    text?: string,
    image?: string
    links?: {name: string, url: string}[]
    reactionButtons?: string[]
}

export function getProcess(db: sqliteDatabase): Promise<IChatProcess> {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM chatProcess', (err: Error, chatProcess: IChatProcess) => {
            if (err) reject(err);
            else {
                db.all('SELECT * FROM processLinks limit 4', (err: Error, links: {name: string, url: string}[]) => {
                    if (err) reject(err);
                    else {
                        db.all('SELECT * FROM processReactionButtons limit 3', (err: Error, reactionButtons: {reactionButton: string}[]) => {
                            if (err) reject(err);
                            else {
                                chatProcess.links = links;
                                chatProcess.reactionButtons = reactionButtons.map((r) => r.reactionButton);
                                resolve(chatProcess);
                            }
                        });
                    }
                });
            }
        });
    });
}

export function initProcess(db: sqliteDatabase): Promise<boolean> {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE chatProcess SET state = ${State.expectingChannel}`, (err: Error) => err ?
            reject(err)
            : resolve(true)
        )
    });
}

export function cancelProcess(db: sqliteDatabase): Promise<boolean> {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM processLinks', (err: Error) => err ?
            reject(err)
            : db.run('DELETE FROM processReactionButtons', (err: Error) => err ?
            reject(err)
            : db.run(`UPDATE chatProcess SET state = ${State.notStarted}`, (err: Error) => err ?
            reject(err)
            : resolve(true)
            ))
        );
    });
}

export function setProcessChannel(db: sqliteDatabase, channel: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE chatProcess SET channel = '${channel}', state = ${State.expectingText}`, (err: Error) => err ?
            reject(err)
            : resolve(true)
        )
    });
}

export function setProcessText(db: sqliteDatabase, text: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE chatProcess SET text = '${text}', state = ${State.expectingImage}`, (err: Error) => err ?
            reject(err)
            : resolve(true)
        );
    });
}

export function setProcessImage(db: sqliteDatabase, image: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE chatProcess SET image = ${image ? `'${image}'` : 'null'}, state = ${State.expectingLinks}`, (err: Error) => err ?
            reject(err)
            : resolve(true)
        );
    });
}

export function setProcessLinks(db: sqliteDatabase, links: {name: string, url: string}[]): Promise<boolean> {
    return new Promise((resolve, reject) => {
        if (links) {
            let query =
                'INSERT INTO processLinks (name, url)\n' +
                'VALUES ';
            for (let l in links) {
                query += `('${links[l].name}', '${links[l].url}')`;
                if (+l != links.length - 1) {
                    query += ', ';
                }
            }
            db.run(query, (err: Error) => err ?
                reject(err)
                : db.run(`UPDATE chatProcess SET state = ${State.expectingReactionButtons}`, (err: Error) => err ?
                reject(err)
                : resolve(true)
            ));
        } else {
            db.run(`UPDATE chatProcess SET state = ${State.expectingReactionButtons}`, (err: Error) => err ?
                reject(err)
                : resolve(true)
            );
        }
    });
}

export function setProcessReactionButtons(db: sqliteDatabase, reactionButtons: string[]): Promise<boolean> {
    return new Promise((resolve, reject) => {
        if (reactionButtons && reactionButtons.length) {
            let query =
                'INSERT INTO processReactionButtons (reactionButton) ' +
                'VALUES ';
            for (let rb in reactionButtons) {
                query += `('${reactionButtons[rb]}')`;
                if (+rb != reactionButtons.length - 1) {
                    query += ', ';
                }
            }
            console.log(query);
            db.run(query, (err: Error) => err ?
                reject(err)
                : db.run(`UPDATE chatProcess SET state = ${State.readyToPost}`, (err: Error) => err ?
                reject(err)
                : resolve(true)
            ));
        } else {
            db.run(`UPDATE chatProcess SET state = ${State.readyToPost}`, (err: Error) => err ?
                reject(err)
                : resolve(true)
            );
        }
    });
}

export function dropProcess(db: sqliteDatabase): Promise<boolean> {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM processLinks', (err: Error) => err ?
            reject(err)
            : db.run('DELETE FROM processReactionButtons', (err: Error) => err ?
            reject(err)
            : db.run(
                'UPDATE chatProcess SET ' +
                `state = ${State.notStarted}, ` +
                'channel = null, ' +
                'text = null, ' + 
                'image = null', (err: Error) => err ?
            reject(err)
            : resolve(true)
        )));
    });
}

export function getVotes(db: sqliteDatabase, postId: string): Promise<number[]> {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM votes WHERE postId = '${postId}'`, (err: Error, rows) => err ?
            reject(err)
            : resolve(rows.map(r => r.userId))
        );
    });
}

export function addVote(db: sqliteDatabase, postId: string, userId: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO votes VALUES ('${postId}', ${userId})`, (err: Error) => err ?
            reject(err)
            : resolve(true)
        );
    });
}

export const processData = {
    get: getProcess,
    init: initProcess,
    cancel: cancelProcess,
    setChannel: setProcessChannel,
    setText: setProcessText,
    setImage: setProcessImage,
    setLinks: setProcessLinks,
    setReactionButtons: setProcessReactionButtons,
    drop: dropProcess
}

