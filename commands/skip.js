const { Command } = require('discord.js-commando');

const { processMessage, sendSongInfo, formatCommand } = require('../lib/common');
const { oneLine } = require('common-tags');

const config = require('../config');
const queues = require('../queues');

module.exports = class extends Command {
	constructor(client) {
		super(client, {
			name: config.skip.name,
			aliases: config.skip.aliases,
			description: 'Skip the currently playing song',
			throttling: config.skip.throttling,
			group: config.group,
			memberName: config.skip.name,
			examples: [config.skip.name],
			guildOnly: true
		});
	}
	async run(msg) {
		processMessage(msg);
		let queue = queues.get(msg.guild.id);
		if (queue && queue.currentSong) {
			let last = queue.currentSong;
			sendSongInfo(msg.channel, `${msg.author.username} skipped ${last.title}!`, last);
			await queue.skip();
		} else {
			return msg.say(oneLine`
				There's nothing in the queue right now.
				Try ${formatCommand(config.play.name)} to add some music!
				`);
		}
	}
};
