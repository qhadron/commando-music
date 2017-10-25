const { TemplateTag } = require('common-tags');

const URL_REGEX = /^http/;

const queues = require('../queues');
const config = require('../config');

function isURL(string) {
	return URL_REGEX.test(string);
}

function delay(ms) {
	return val =>
		new Promise(resolve => {
			setTimeout(() => resolve(val), ms);
		});
}

function delayedResolve() {
	let promise, resolve, reject;
	promise = new Promise((res, rej) => {
		resolve = res;
		reject = rej;
	});
	promise.resolve = resolve;
	promise.reject = reject;
	return promise;
}

function processMessage(msg) {
	if (config.deleteCommand && msg.deletable) {
		return msg.delete();
	}
}

const ESCAPE_REGEX = /([^\\]|(?:^))([*`_~])/g;

function escapeDiscord(string) {
	if (!string) return string;
	string = string.toString();
	for (let tmp = string.replace(ESCAPE_REGEX, String.raw`$1\$2`); string !== tmp; ) {
		string = tmp;
		tmp = string.replace(ESCAPE_REGEX, String.raw`$1\$2`);
	}
	return string;
}

const escape = new TemplateTag({
	onEndResult(res) {
		return escapeDiscord(res);
	}
});
const block = new TemplateTag({
	onEndResult(res) {
		return '```' + res + '```';
	}
});

function escapeUrl(str) {
	return encodeURI(str).replace(/[!'()*]/g, function(c) {
		return '%' + c.charCodeAt(0).toString(16);
	});
}
function getSongAsObject(song) {
	song = {
		url: escapeUrl(song.url),
		query: escapeDiscord(song.query),
		thumbnail: escapeUrl(song.imageUrl),
		author: escapeDiscord(song.author),
		title: escapeDiscord(song.title)
	};
	return song;
}
function sendSongInfo(channel, text, song) {
	song = getSongAsObject(song);
	return channel.send('', config.songInfoAsEmbed(song, config.client.user, text));
}
function songInfoAsEmbed(song) {
	song = getSongAsObject(song);
	return config.songInfoAsEmbed(song, config.client.user);
}

let Queue;

function getQueue(id, ...args) {
	if (!Queue) Queue = require('./structures/queue');
	let queue = queues.get(id);
	if (queue) return queue;
	queue = new Queue(...args);
	queue.on('finish', () => queues.delete(id));
	queues.set(id, queue);
	return queue;
}

module.exports = {
	isURL,
	delay,
	delayedResolve,
	processMessage,
	escapeDiscord,
	escapeUrl,
	formatTitle: x => config.formatTitle(escapeDiscord(x)),
	formatMention: x => config.formatMention(escapeDiscord(x)),
	formatChannelName: x => config.formatChannelName(escapeDiscord(x)),
	formatCommand: x => config.formatCommand(escapeDiscord(x)),
	formatUsername: x => config.formatUsername(escapeDiscord(x)),
	formatCode: x => config.formatCode(escapeDiscord(x)),
	getSongAsObject,
	sendSongInfo,
	songInfoAsEmbed,
	escape,
	block,
	getQueue
};
