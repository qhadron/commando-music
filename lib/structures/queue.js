const { EventEmitter } = require('events');

const { oneLine } = require('common-tags');
const {
	formatTitle,
	formatMention,
	formatCommand,
	sendSongInfo,
	delayedResolve
} = require('../common');

const { MAX_QUEUE_SIZE, PASSES, BITRATE, logger } = require('../../config');
const config = require('../../config');

const Song = require('./song');

module.exports = class Queue extends EventEmitter {
	constructor(textChannel, voiceChannel = null, volume = 1) {
		super();
		this._q = [];
		this._currentStream = null;
		this._src = null;
		this._isPlaying = false;

		this.textChannel = textChannel;
		this.voiceChannel = voiceChannel;
		this.volume = volume;
		this._tasks = [];
	}

	async _checkQueue() {
		while (this._tasks.length > 0) {
			logger.log(`TASKCOUNT: ${this._tasks.length} tasks`);
			const { task, name, p } = this._tasks.shift();
			logger.log(`EXECUTING: ${name}`);
			try {
				let res = await task();
				logger.log(`FINISHED:  ${name}`);
				p.resolve(res);
			} catch (err) {
				logger.log(`ERROR: ${err}`);
				p.reject(err);
			}
		}
	}

	_exec({ task, name } = { task: null, name: null }) {
		let p = delayedResolve();
		if (task) {
			logger.log(`ADDED:     ${name}`);
			this._tasks.push({ task, name, p });
		} else {
			if (this._tasks.length === 0) {
				p.resolve();
				return p;
			}
		}
		if (this._currentOperation) {
			this._currentOperation = this._currentOperation.then(() => this._checkQueue());
			if (!task) {
				this._currentOperation.then(() => p.resolve());
			}
		} else {
			this._currentOperation = this._checkQueue();
		}
		return p;
	}

	get size() {
		return this._exec().then(() => this._q.length + (this.currentSong ? 1 : 0));
	}
	get isPlaying() {
		let res = this._exec();
		return res.then(() => {
			logger.log(`Is playing: ${this._isPlaying}`);
			return this._isPlaying;
		});
	}
	get currentSong() {
		return this._src || null;
	}
	set volume(val) {
		this._volume = val;
		if (this._volume > 2) this._volume = 2;
		if (this._volume < 0) this._volume = 0;
		if (this._isPlaying) {
			this._dispatcher.setVolumeLogarithmic(this._volume);
		}
	}
	get volume() {
		return this._volume;
	}
	set voiceChannel(channel) {
		if (channel === this._voiceChannel) return;
		this._voiceChannel = channel;
		if (this._isPlaying) {
			this.pause();
			this._leave();
			this._join();
			this.resume();
			// TODO
			throw new Error('not implemented');
		}
	}
	get voiceChannel() {
		return this._voiceChannel;
	}
	get songs() {
		return this._currentOperation.then(() => {
			let songs = Array.from(this._q);
			if (this.currentSong) {
				songs.unshift(this.currentSong);
			}
			return songs;
		});
	}

	async enqueue(song, author = null) {
		if (!(song instanceof Song)) {
			throw new TypeError(`Tried to enqueue \`${song}\` which is not a valid song!`);
		}
		let pos = await this._exec({
			task: async () => {
				if (this._q.length >= MAX_QUEUE_SIZE) {
					this.textChannel.send(oneLine`
				${author ? `${formatMention(author)}, the` : 'The'}
				limit of ${MAX_QUEUE_SIZE} is already reached.
			`);
					throw new RangeError(
						`Max limit of ${MAX_QUEUE_SIZE} already reached. Configure options.limit to avoid this error`
					);
				}
				if (author) song.author = author.username;
				return this._q.push(song);
			},
			name: `Enqueue ${song.title}`
		});
		return this.textChannel.send(
			oneLine`
				${author ? `${formatMention(author)} added` : `Added`}
				${formatTitle(song.title)} to 
				#${pos}
				in the queue.`
		);
	}

	get conencted() {
		return this._connection && this._connection.status === 1;
	}

	async play() {
		if (this._isPlaying) return;
		if (this._src) return await this.resume();
		if (this.size < 1) {
			return await this.textChannel.send(
				`The queue is empty! Use the ${formatCommand(
					config.play.name
				)} commmand to add songs to the queue!`
			);
		}
		logger.log(`Calling playnext`);
		return await this._playNext();
	}

	async _join() {}

	async join(voiceChannel = this.voiceChannel, textChannel = this.textChannel) {
		this.textChannel = textChannel;
		this.voiceChannel = voiceChannel;
	}

	_playNext() {
		logger.log(`Playing next`);
		return this._exec({
			task: async () => {
				if (!this._connection) {
					this._connection = await this.voiceChannel.join();
				}

				if (this._isPlaying) return;
				this._src = this._q.shift();

				sendSongInfo(this.textChannel, `Now Playing...`, this._src);

				let stream = await this._src.stream;

				stream.on('error', err => {
					logger.error(err);
					this.textChannel.send(`Failed to play ${formatTitle(this._src.title)}.`);
				});

				this._dispatcher = this._connection
					.playStream(stream, {
						passes: PASSES,
						bitrate: BITRATE
					})
					.on('end', () => this._onSongEnd())
					.on('error', err => {
						logger.error(err);
						this.textChannel.send(`Failed to play ${formatTitle(this._src.title)}.`);
					});
				this._isPlaying = true;
				this._dispatcher.setVolumeLogarithmic(this.volume);

				//TODO add auto play next item in queue
				//TODO add queue empty message
			},
			name: `Play Next`
		});
	}

	// TODO add checks
	async _leave() {
		if (this._connection) {
			await this.voiceChannel.leave();
			this._connection = null;
		}
	}

	async leave() {
		await this._leave();
	}

	_onSongEnd() {
		return this._exec({
			task: async () => {
				this._isPlaying = false;
				this._src = null;
				if (this._q.length > 0) {
					this._playNext();
				} else {
					await this.textChannel.send(
						`Finished playing all the queued songs, leaving...`
					);
					this.leave();
					this.emit('finish');
				}
			},
			name: `On Song End ${this._src && this._src.title}`
		});
	}

	pause() {
		if (this._dispatcher) {
			this._src.stream.pause();
			this._dispatcher.pause();
			this._isPlaying = false;
		}
	}

	async resume() {
		if (this._dispatcher && this._dispatcher.paused) {
			await this.textChannel.send(`Resuming ${formatTitle(this._src.title)}...`);
			this._src.stream.resume();
			this._dispatcher.resume();
			this._isPlaying = true;
		}
	}

	skip() {
		if (this._dispatcher) {
			this._dispatcher.end('user');
		}
	}

	clear() {
		return this._exec({
			task: () => {
				this._q.splice(0, this._q.length);
				this.skip();
			},
			name: `Clear`
		});
	}

	remove(idx) {
		return this._exec({
			task: () => {
				let removed;
				if (this._isPlaying) {
					if (idx === 0) {
						removed = this.currentSong;
						this.skip();
					} else {
						[removed] = this._q.splice(idx - 1, 1);
					}
				} else {
					[removed] = this._q.splice(idx, 1);
				}
				return removed;
			},
			name: `Remove ${idx}`
		});
	}
};
