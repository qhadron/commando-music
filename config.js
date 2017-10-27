const { RichEmbed } = require('discord.js');

const options = {
	group: 'music',
	groupDescription: 'Music commands',
	throttling: {
		usages: 2,
		duration: 5
	},
	/** how many times to retry connection */
	retires: 20,
	/** delete our status message? */
	deleteStatus: true,
	/** if deleting the status, how long to wait after an edit? */
	statusDuration: 10000,
	/** max queue size */
	MAX_QUEUE_SIZE: 10,
	/** how many times to send audio packets to avoid packet loss */
	PASSES: 2,
	/** audio bitrate of the voice connection */
	BITRATE: 'auto',
	/** number of search results */
	SEARCH_RESULT_COUNT: 5,
	/** additioanl headers when fetching direct links for files */
	headers: {
		'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36`
	},
	/** how long to wait for the user to pick a result in ms (i.e. searching) */
	SELECTION_DELAY: 60000,
	/** download video and play only the audio? (allows higest audio quality but more error prone) */
	downloadVideo: false,
	/** delete the user's original command? */
	deleteCommand: true,
	/** options for the play command */
	play: {
		/** command name */
		name: 'play',
		aliases: []
	},
	/** options for the pause command */
	pause: {
		/** command name */
		name: 'pause',
		aliases: []
	},
	/** options for the skip command */
	skip: {
		/** command name */
		name: 'skip',
		aliases: []
	},
	/** options for the queue command */
	queue: {
		/** command name */
		name: 'queue',
		aliases: []
	},
	/** options for the volume command */
	volume: {
		/** command name */
		name: 'volume',
		aliases: []
	},
	/** options for the remove command */
	remove: {
		/** command name */
		name: 'remove',
		aliases: []
	},
	/** default thumbnail */
	defaultThumbnail: `https://i.imgur.com/Ctq8sIH.png`,
	/** default title. If null then set to the song's url */
	defualtTitle: null,
	// In the following functions, arguments are escaped for discord already
	formatMention(author) {
		return author;
	},
	formatTitle(title) {
		return `**${title}**`;
	},
	formatChannelName(name) {
		return `__**${name}**__`;
	},
	formatCommand(cmd) {
		return `\`${cmd}\``;
	},
	formatUsername(username) {
		return `**@${username}**`;
	},
	formatCode(code) {
		return `\`${code}\``;
	},
	/**
	 * @param {Object} song Information about the current Song. All fields are fully escaped
	 * @param {string} song.url url of song (fully escaped)
	 * @param {string} song.title title of song (i.e. video title / filename)
	 * @param {string} song.query user's search terms when queueing this song (may be same as url)
	 * @param {string} song.thumbnail thumbnail of song
	 * @param {string?} song.duration formatted duration of song (may be null)
	 * @param {string?} song.author person who queued the song (may be null)
	 * @param {Client} client the bot's discord.js.ClientUser
	 * @param {string?} message a message that sometimes needs to be displayed to the user
	 * @return {RichEmbed} discord.js RichEmbed
	*/
	songInfoAsEmbed(song, client, message) {
		const embed = new RichEmbed();
		embed
			.setAuthor(message, client.displayAvatarURL)
			songInfoAsEmbed(song, client, message) {
		const embed = new RichEmbed();
		embed
			.setAuthor(message, client.displayAvatarURL)
			.addField('Title', song.title, true)
			.addField('Length', song.duration, true)
			.addField('Source', song.url, true)
			.addField('Requested by', song.author, true)
			.setColor('#ed2c56');
		if (song.thumbnail) embed.setThumbnail(song.thumbnail);
		return embed;
	},
	logger: console
	};

options.play.throttling = options.throttling;
options.pause.throttling = options.throttling;
options.queue.throttling = options.throttling;
options.remove.throttling = options.throttling;
options.skip.throttling = options.throttling;

module.exports = options;
