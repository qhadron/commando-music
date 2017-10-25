const ytdl = require('youtube-dl');
const ytdl_node = require('ytdl-core');
const {
	SEARCH_RESULT_COUNT,
	downloadVideo: DL_VIDEO,
	retries: RETRIES,
	MAX_QUEUE_SIZE,
	logger
} = require('../../config');
const config = require('../../config');
const { URL } = require('url');
const fetch = require('node-fetch');
const contentdisposition = require('content-disposition');
const { basename } = require('path');

const getYoutubeInfo = (query, max = MAX_QUEUE_SIZE) =>
	new Promise((resolve, reject) => {
		ytdl.exec(
			query,
			['--get-title', '--get-id', '--get-thumbnail', '--max-downloads', max],
			(err, output) => {
				if (err) {
					if (output) {
						logger.error(err);
					} else {
						reject(err);
					}
				}
				let info = output.split('\n');
				let results = [];
				for (let i = 0; i < info.length; i += 3) {
					// empty line
					if (!info[i]) break;
					results.push({
						title: info[i],
						url: `http://www.youtube.com/watch?v=${info[i + 1]}`,
						thumbnail: info[i + 2]
					});
				}
				resolve(results);
			}
		);
	});

const getSoundcloudInfo = (query, max = MAX_QUEUE_SIZE) =>
	new Promise((resolve, reject) => {
		ytdl.exec(
			query,
			[
				'--get-title',
				'--get-url',
				'--get-thumbnail',
				'-f',
				'bestaudio',
				'-x',
				'--max-downloads',
				max
			],
			(err, output) => {
				if (err) {
					if (output) {
						logger.error(err);
					} else {
						reject(err);
					}
				}
				let info = output.split('\n');
				let results = [];
				for (let i = 0; i < info.length; i += 3) {
					// empty line
					if (!info[i]) break;
					results.push({
						title: info[i],
						url: info[i + 1],
						thumbnail: info[i + 2]
					});
				}
				resolve(results);
			}
		);
	});

function defaultDownloader(url) {
	return () => fetch(url).then(res => res.body);
}

const youtubeDownloader = DL_VIDEO
	? url => {
			return () => {
				return ytdl(url, ['-x', '-f', 'bestaudio/best']);
			};
		}
	: url => {
			return () => {
				return ytdl_node(url, { quality: 'highest', filter: 'audioonly', RETRIES });
			};
		};

module.exports = class Song {
	constructor(url, title, imageUrl, stream = defaultDownloader(url), query = url) {
		this.url = url;
		this.query = query;
		this.title = title;
		this.imageUrl = imageUrl;
		this.stream = stream;
		this._streamResolved = false;
	}

	set stream(stream) {
		this._stream = stream;
	}

	get stream() {
		if (!this._stream) return this._stream;
		if (this._streamResolved) return this._stream;
		if (typeof this._stream.then === 'function') {
			return this._stream.then(res => {
				this.stream = res;
				// recurse to handle promise returned by promise
				return this.stream;
			});
		} else if (typeof this._stream === 'function') {
			this.stream = this._stream();
			// recurse to handle promise returned by function
			return this.stream;
		} else {
			this._streamResolved = true;
			return this._stream;
		}
	}

	static fromYoutubeUrl(url) {
		return new Promise((resolve, reject) => {
			ytdl.getInfo(url, (err, info) => {
				if (err) reject(err);
				resolve(new Song(url, info.title, info.thumbnail, youtubeDownloader(url)));
			});
		});
	}

	static fromSearch(query) {
		let search = `ytsearch${SEARCH_RESULT_COUNT}:${query}`;
		let promise = getYoutubeInfo(search).then(results => {
			return results.map(result => {
				return {
					title: result.title,
					url: result.url,
					thumbnail: result.thumbnail,
					song: new Song(
						result.url,
						result.title,
						result.thumbnail,
						youtubeDownloader(result.url),
						query
					)
				};
			});
		});
		return promise;
	}

	static fromYoutubePlaylist(url, max) {
		const parsed = new URL(url);
		const id = parsed.searchParams.get('list');
		const fixed = new URL(`https://www.youtube.com/playlist`);
		fixed.searchParams.set('list', id);
		let promise = getYoutubeInfo(fixed.toString(), max).then(results => {
			return results.map(
				result =>
					new Song(
						result.url,
						result.title,
						result.thumbnail,
						youtubeDownloader(result.url),
						url
					)
			);
		});
		return promise;
	}

	static async fromAudioUrl(url) {
		let res = await fetch(url, {
			headers: {
				Accept: 'audio/*',
				...config.headers
			}
		});
		// make sure request succeeded
		if (!res.ok) throw new Error(`Response status is ${res.status} and that's not ok!`);
		// update url to the final url after fetch
		url = res.url;
		// make sure response has right mime type
		let mime = res.headers.get('Content-Type');
		if (mime && !/audio\//.test(mime)) {
			throw new Error(`${url} returned invalid mime type ${mime}`);
		}
		// try to get title
		let title = null;
		// from content-disposition
		if (res.headers.has(`content-disposition`)) {
			let disposition = contentdisposition.parse(res.headers.get(`content-disposition`));
			if (disposition.parameters && disposition.parameters.filename) {
				title = disposition.parameters.filename;
			}
		}
		// from url fragment
		if (!title) {
			let name = null;
			try {
				name = basename(url);
			} finally {
				if (name) {
					title = name;
				}
			}
		}
		// last resport: set as default
		if (!title) {
			title = config.defaultTitle || url;
		}

		let imageUrl = config.defaultThumbnail;
		let stream = res.body;
		return new Song(url, title, imageUrl, stream);
	}

	static async fromSoundCloud(url, max) {
		const results = await getSoundcloudInfo(url, max);
		return results.map(result => new Song(result.url, result.title, result.thumbnail));
	}

	static async fromUrl(url, max = MAX_QUEUE_SIZE) {
		if (/youtube.\w+/.test(url)) {
			if (/list=/.test(url)) {
				return await Song.fromYoutubePlaylist(url, max);
			} else {
				return [await Song.fromYoutubeUrl(url)];
			}
		} else if (/soundcloud.com/.test(url)) {
			return await Song.fromSoundCloud(url, max);
		} else {
			let res = await Song.fromAudioUrl(url);
			if (res) return [res];
		}
	}
};
