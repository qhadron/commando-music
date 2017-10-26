const { Command } = require('discord.js-commando');

const { processMessage, getQueue, formatCode } = require('../lib/common');

const config = require('../config');

module.exports = class extends Command {
	constructor(client) {
		super(client, {
			name: config.volume.name,
			aliases: config.volume.aliases,
			description: 'Set the volume, or show the current volume if none specified.',
			throttling: config.volume.throttling,
			group: config.group,
			memberName: config.volume.name,
			examples: [
				`${client.commandPrefix}${config.volume.name} 10`,
				`${client.commandPrefix}${config.volume.name}`
			],
			guildOnly: true,
			args: [
				{
					key: 'volume',
					prompt: `Set the music volume`,
					type: 'float',
					max: 200,
					min: 0,
					default: -1,
					wait: 0
				}
			]
		});
	}
	async run(msg, args) {
		processMessage(msg);
		const vol = args.volume;
		let queue = getQueue(msg.guild.id, msg.channel);
		if (vol === -1) {
			return msg.channel.send(`Current volume is ${formatCode(vol)}`);
		} else {
			queue.volume = vol / 100;
			return msg.channel.send(`Set the volume to ${(queue.volume * 100).toFixed(1)}%`);
		}
	}
};
