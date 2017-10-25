const { Command } = require('discord.js-commando');

const { oneLine } = require('common-tags');
const { processMessage, formatTitle, formatMention, formatCommand } = require('../lib/common');

const config = require('../config');
const queues = require('../queues');

module.exports = class extends Command {
	constructor(client) {
		super(client, {
			name: config.pause.name,
			aliases: config.pause.aliases,
			description: 'Pause the currently playing song',
			throttling: config.pause.throttling,
			group: config.group,
			memberName: config.pause.name,
			examples: [config.pause.name],
			guildOnly: true
		});
	}
	async run(msg) {
		processMessage(msg);
		let queue = queues.get(msg.guild.id);
		if (queue) {
			await queue.pause();
			msg.say(
				oneLine`
				${formatMention(msg.author)} paused ${formatTitle(queue.currentSong.title)}.
				Use ${formatCommand(config.play.name)} to start playing again!
				`
			);
		} else {
			return msg.say(oneLine`
				There's nothing in the queue right now.
				Try ${formatCommand(config.play.name)} to add some music!
				`);
		}
	}
};
