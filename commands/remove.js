const { Command } = require('discord.js-commando');

const { processMessage, sendSongInfo, formatCommand } = require('../lib/common');
const { oneLine } = require('common-tags');

const config = require('../config');
const queues = require('../queues');

module.exports = class extends Command {
	constructor(client) {
		super(client, {
			name: config.remove.name,
			aliases: config.remove.aliases,
			description: 'Remove a song from the queue',
			throttling: config.remove.throttling,
			group: config.group,
			memberName: config.remove.name,
			examples: [
				`${client.commandPrefix}${config.remove.name} 2 3 4`,
				`${client.commandPrefix}${config.remove.name} all`
			],
			guildOnly: true,
			argsPromptLimit: 0,
			argsType: 'single'
		});
	}
	async run(msg, args) {
		processMessage(msg);
		let queue = queues.get(msg.guild.id);
		if (queue) {
			if (args.length === 0) {
				return msg.say(
					this.usage(
						`index of song to remove, or ${formatCommand('all')} to remove all songs`
					)
				);
			}
			if (args.trim().toLowerCase() === 'all') {
				queue.clear();
				return msg.reply(oneLine`
					Removed all the songs in the current queue!
					Use ${formatCommand(config.play.name)} to add more songs!
				`);
			} else {
				try {
					args = args
						.split(' ')
						.map(n => Number.parseInt(n))
						.sort((a, b) => b - a);
				} catch (err) {
					return msg.reply(
						`, the number ${formatCommand(args)} you entered is invalid: ${err}`
					);
				}
				for (let arg of args) {
					if (arg < 1 || arg > (await queue.size)) {
						return msg.reply(
							oneLine`, the number ${formatCommand(arg)} you entered
								is out of range of the current queue!
								Use ${formatCommand(config.queue.name)}
								to see what's in the queue.`
						);
					}
					let removed = await queue.remove(arg - 1);
					sendSongInfo(
						msg.channel,
						`${msg.author.username} removed ${removed.title}:`,
						removed
					);
				}
			}
		} else {
			return msg.say(oneLine`
				There's nothing in the queue right now.
				Try ${formatCommand(config.play.name)} to add some music!
			`);
		}
	}
};
