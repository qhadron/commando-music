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

const YOUTUBE_PROPS = [
	{ arg: '--get-title', key: 'title' },
	{ arg: '--get-id', key: 'id' },
	{ arg: '--get-thumbnail', key: 'thumbnail' },
	{ arg: '--get-duration', key: 'duration' }
];

const SOUNDCLOUD_PROPS = [
	{ arg: '--get-title', key: 'title' },
	{ arg: '--get-url', key: 'url' },
	{ arg: '--get-thumbnail', key: 'thumbnail' },
	{ arg: '--get-duration', key: 'duration' }
];

function ytdlGetInfo(query, args, props, max) {
	return new Promise((resolve, reject) => {
		ytdl.exec(
			query,
			[...args, '--max-downloads', max, ...props.map(prop => prop.arg)],
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
				for (let i = 0; i < info.length; ) {
					// empty line
					if (!info[i]) break;
					let result = {};
					for (let prop of props) {
						result[prop.key] = info[i];
						i += 1;
					}
					results.push(result);
				}
				resolve(results);
			}
		);
	});
}

function getYoutubeInfo(query, max = MAX_QUEUE_SIZE) {
	return ytdlGetInfo(query, [], YOUTUBE_PROPS, max).then(results =>
		results.map(result => {
			result.url = `https://youtube.com/watch?v=${result.id}`;
			return result;
		})
	);
}

function getSoundcloudInfo(query, max = MAX_QUEUE_SIZE) {
	return ytdlGetInfo(query, ['-x', '-f', 'bestaudio'], SOUNDCLOUD_PROPS, max);
}

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
				return ytdl_node(url, { quality: 'highest', filter: 'audioonly', retries: RETRIES });
			};
		};

module.exports = class Song {
	constructor(info, stream = defaultDownloader(info.url)) {
		info.query = info.query || info.url;
		this.info = info;
		this.stream = stream;
		this._streamResolved = false;
	}

	set info(info) {
		if (this._info) {
			for (let key of this._info) {
				delete this[key];
			}
		}
		this._info = info;
		// for easy access
		Object.assign(this, info);
	}

	get info() {
		return this._info;
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
		return getYoutubeInfo(url).then(([result]) => {
			return new Song(result, youtubeDownloader(result.url));
		});
	}

	static fromSearch(query) {
		let search = `ytsearch${SEARCH_RESULT_COUNT}:${query}`;
		let promise = getYoutubeInfo(search).then(results => {
			return results.map(result => {
				return {
					...result,
					song: new Song(
						{
							...result,
							query: query
						},
						youtubeDownloader(result.url)
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
		return getYoutubeInfo(fixed.toString(), max).then(results => {
			return results.map(
				result => new Song({ ...result, query: url }, youtubeDownloader(result.url))
			);
		});
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
		let resolved_url = res.url;
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

		let thumbnail = config.defaultThumbnail;
		return new Song({ url: resolved_url, title, thumbnail, query: url });
	}

	static async fromSoundCloud(url, max) {
		const results = await getSoundcloudInfo(url, max);
		return results.map(result => new Song({ ...result, query: url }));
	}

	static async fromUrl(url, max = MAX_QUEUE_SIZE) {
		if (/youtube.\w+|youtu\.be/.test(url)) {
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
