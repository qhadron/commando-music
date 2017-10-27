const { Command } = require('discord.js-commando');
const { RichEmbed } = require('discord.js');

const { oneLine } = require('common-tags');
const {
	processMessage,
	formatTitle,
	formatTextChannelName,
	formatVoiceChannelName,
	formatCommand,
	escapeDiscord,
	escapeUrl,
	isURL
} = require('../lib/common');

const config = require('../config');
const queues = require('../queues');

module.exports = class extends Command {
	constructor(client) {
		super(client, {
			name: config.queue.name,
			aliases: config.queue.aliases,
			description: 'Show the current queue',
			throttling: config.queue.throttling,
			group: config.group,
			memberName: config.queue.name,
			examples: [config.queue.name],
			guildOnly: true
		});
	}
	async run(msg) {
		processMessage(msg);
		let queue = queues.get(msg.guild.id);
		if (queue) {
			let songs = await queue.songs;
			let isPlaying = await queue.isPlaying;
			const embed = new RichEmbed()
				.setTitle('Current Queue')
				.setDescription(
					oneLine`Singing in ${formatVoiceChannelName(
						(queue.voiceChannel ? queue.voiceChannel.name : '<nowhere>')
					)},
					 speaking in ${formatTextChannelName(
							(queue.textChannel ? queue.textChannel.name : '<nowhere>')
						)}.
					 Volume is at ${(queue.volume * 100).toFixed(1)}%.`
				)
				.setColor('#ed2c56');
			if (songs.length === 0) {
				embed.description += `\n`;
				embed.description += `There are no songs! Use ${formatCommand(
					config.play.name
				)} to queue more songs.`;
			}
			songs.forEach((song, idx) => {
				const title = `${idx + 1}${isPlaying && idx == 0
					? `.(currently playing)`
					: '.'} ${formatTitle(song.title)}`;
				let link;
				if (song.query !== song.url && !isURL(song.query)) {
					link = `[${formatTitle(escapeDiscord(song.query))}](${escapeUrl(song.url)})`;
				} else {
					link = song.url;
				}
				const body = [];
				if (song.author) {
					body.push(`Requested by ${song.author}.`);
				}
				body.push(`Open ${link} in your browser.`);
				embed.addField(title, body.join('\n'));
			});
			return msg.channel.send('', embed);
		} else {
			return msg.say(oneLine`
				There's nothing in the queue right now.
				Try ${formatCommand(config.play.name)} to add some music!
			`);
		}
	}
};
