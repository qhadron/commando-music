const { Command } = require('discord.js-commando');

const {
	isURL,
	processMessage,
	delay,
	formatTitle,
	formatMention,
	formatCode,
	getQueue,
	escapeDiscord,
	block,
	sendNowPlaying
} = require('../lib/common');
const { oneLine } = require('common-tags');
const Song = require('../lib/structures/song');

const config = require('../config');
const logger = config.logger;

module.exports = class extends Command {
	constructor(client) {
		super(client, {
			name: config.play.name,
			aliases: config.play.aliases,
			description: 'Play from a youtube link or a search query',
			throttling: config.play.throttling,
			group: config.group,
			memberName: config.play.name,
			details: `Play music from url or search terms!`,
			examples: [
				`${config.play.name} the big black`,
				`${config.play.name} https://www.youtube.com/watch?v=kyUtGNIFx5c`
			],
			guildOnly: true,
			argsType: 'multiple',
			format: oneLine`
				${client.commandPrefix}${config.play.name} <url...> |
				${client.commandPrefix}${config.play.name} <search terms>... |
				${client.commandPrefix}${config.play.name}`
		});
	}

	async run(msg, args) {
		processMessage(msg);
		// start typing to indicate handling response
		msg.channel.startTyping();
		let status = await msg.say(`Playing ${args.join(' ')}...`);

		try {
			let queue = getQueue(msg.guild.id, msg.channel);

			if (queue.voiceChannel && !queue.voiceChannel.members.has(msg.author.id)) {
				return await status.edit(
					`${formatMention(
						msg.author
					)}, you're not in my voice channel! Stop messing around.`
				);
			}

			let result;

			if (args.every(arg => isURL(arg))) {
				for (let query of args) {
					result = await this._handleURL(query, queue, msg);
					if (!result) {
						await status.edit(
							`${formatMention(
								msg.author
							)}, I couldn't find a song from your url ${formatCode(query)}. Sorry!`
						);
						break;
					}
				}
			} else {
				let query = args.join(' ');
				await status.edit(`Looking for ${formatCode(query)}...`);
				result = await this._handleSearch(query, queue, msg, status);
				if (!result) {
					await status.edit(
						`${formatMention(msg.author)}, I couldn't recognize ${formatCode(
							query
						)}. Sorry!`
					);
				}
			}

			let isPlaying = await queue.isPlaying;
			logger.log(`ISPLAYING: queue is${isPlaying ? ' ' : ' not '}playing`);

			if (!isPlaying) {
				if (args.length > 0 && !result) {
					return await msg.say(
						`${formatMention(
							msg.author
						)}, no songs have been successfully added, so I can't start playing`
					);
				}
				if (!msg.member.voiceChannel) {
					return await status.edit(
						`${formatMention(
							msg.author
						)}, you must join a voice channel for music to start playing!`
					);
				}

				if (!queue.voiceChannel) {
					queue.voiceChannel = msg.member.voiceChannel;
				}

				await queue.play();
			} else {
				sendNowPlaying(msg.channel, queue.currentSong);
			}
		} finally {
			msg.channel.stopTyping();
			if (config.deleteStatus) {
				let id;
				id = setInterval(async () => {
					if (!status.deletable) {
						clearInterval(id);
						return;
					}
					let deleteTime = status.editedAt || status.createdAt;
					if (Date.now() - deleteTime.getTime() > config.statusDuration) {
						status.delete();
						clearInterval(id);
					}
				}, config.statusDuration / 10);
			}
		}
	}

	async _handleURL(url, queue, msg) {
		let list;
		try {
			list = await Song.fromUrl(url);
		} catch (err) {
			logger.error(err);
			msg.reply(
				oneLine`I got the following error when trying to get your file:
				${block`${escapeDiscord(err.toString())}`}`
			);
			return false;
		}
		if (!list || list.length === 0) {
			return false;
		}
		await queue.enqueue(list, msg.author);
		return true;
	}

	async _handleSearch(query, queue, msg, status) {
		let list;
		try {
			list = await Song.fromSearch(query);
		} catch (err) {
			logger.error(err);
			await status.edit(
				oneLine`The following error occurred while looking for ${formatCode(query)}:
				${block`${escapeDiscord(err)}`}`
			);
		}
		let prompt = [
			`Found the following results:`,
			...list.map((item, idx) => `\`${idx + 1}\`. ${formatTitle(item.title)}`),
			'',
			'`c`. Cancel',
			'',
			'Reply a number from above or `c` to Cancel'
		].join('\n');
		await status.edit(prompt);
		let listener;

		let choice = await new Promise(resolve => {
			listener = reply => {
				if (reply.author !== msg.author) return;
				let match = reply.content.toLowerCase().match(/^(\d+)|(c)$/);
				if (!match) return;

				let result = match[1] || match[2];

				if (result === 'c') {
					result = null;
				} else {
					result = Number.parseInt(result);
					if (!(result > 0 && result <= list.length)) return;
					result -= 1;
				}

				if (reply.deletable) reply.delete().then(() => resolve(result));
				else resolve(result);
			};
			delay(config.SELECTION_DELAY)(null).then(resolve);
			msg.client.on('message', listener);
		});

		msg.client.removeListener('message', listener);

		if (choice !== null) {
			await queue.enqueue(list[choice].song, msg.author);
			return true;
		} else {
			await msg.reply(`cancelled search for ${formatCode(query)}...`);
			return false;
		}
	}
};
