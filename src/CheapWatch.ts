import * as EventEmitter from 'events';
import * as fs from 'fs';
import { promisify } from 'util';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

export default class CheapWatch extends EventEmitter {
	// root directory
	dir: string;
	// function to limit watching to certain directories/files
	filter?: Filter;
	// whether to actually watch for changes, or just report all matching files and their stats
	watch = true;
	// number of milliseconds to use to debounce events from FSWatcher
	debounce = 10;
	// paths of all files/dirs -> stats
	paths = new Map<string, fs.Stats>();

	// paths of all directories -> FSWatcher instances
	private _watchers = new Map<string, fs.FSWatcher>();
	// paths of files/dirs with pending debounced events -> setTimeout timer ids
	private _timeouts = new Map<string, NodeJS.Timer>();
	// queue of paths of pending FSWatcher events to handle
	private _queue: string[] = [];
	// current status of instance
	private _status = Status.Created;

	constructor(data: object /* = { dir, filter, watch, debounce } */) {
		super();
		Object.assign(this, data);
		if (typeof this.dir !== 'string') {
			throw new TypeError('dir must be a string');
		}
		if (this.filter && typeof this.filter !== 'function') {
			throw new TypeError('filter must be a function');
		}
		if (typeof this.watch !== 'boolean') {
			throw new TypeError('watch must be a boolean');
		}
		if (typeof this.debounce !== 'number') {
			throw new TypeError('debounce must be a number');
		}
	}

	// recurse directory, get stats, set up FSWatcher instances
	async init(): Promise<void> {
		if (this._status !== Status.Created) {
			throw new Error('cannot call init() twice');
		}
		this._status = Status.Initing;
		await this._recurse(this.dir);
		this._status = Status.Ready;
	}

	// close all FSWatchers
	close(): void {
		if (this._status === Status.Created || this._status === Status.Initing) {
			throw new Error('cannot call close() before init() finishes');
		}
		if (this._status === Status.Closed) {
			throw new Error('cannot call close() twice');
		}
		this._status = Status.Closed;
		for (const watcher of this._watchers.values()) {
			watcher.close();
		}
	}

	// recurse a given directory
	private async _recurse(full: string): Promise<void> {
		const path = full.slice(this.dir.length + 1);
		const stats = await stat(full);
		if (path) {
			if (this.filter && !(await this.filter({ path, stats }))) {
				return;
			}
			this.paths.set(path, stats);
		}
		if (stats.isDirectory()) {
			if (this.watch) {
				this._watchers.set(
					path,
					fs.watch(full, this._handle.bind(this, full)).on('error', () => {}),
				);
			}
			await Promise.all(
				(await readdir(full)).map(sub => this._recurse(full + '/' + sub)),
			);
		}
	}

	// handle FSWatcher event for given directory
	private _handle(dir: string, event: string, file: string): void {
		this._debounce(dir);
		this._debounce(dir + '/' + file);
	}

	// debounce and enqueue event for given path
	private _debounce(path: string): void {
		if (this._timeouts.has(path)) {
			clearTimeout(this._timeouts.get(path));
		}
		this._timeouts.set(
			path,
			setTimeout(() => {
				this._timeouts.delete(path);
				this._enqueue(path);
			}, this.debounce),
		);
	}

	// add an FSWatcher event to the queue, and handle queued events
	private async _enqueue(full: string): Promise<void> {
		this._queue.push(full);
		if (this._status !== Status.Ready) {
			return;
		}
		this._status = Status.Processing;
		while (this._queue.length) {
			const full = this._queue.shift();
			const path = full.slice(this.dir.length + 1);
			const stats = await stat(full).catch(() => {});
			if (stats) {
				if (this.filter && !(await this.filter({ path, stats }))) {
					continue;
				}
				const isNew = !this.paths.has(path);
				this.paths.set(path, stats);
				if (path) {
					this.emit('+', { path, stats, isNew });
				}
				if (stats.isDirectory() && !this._watchers.has(path)) {
					// note the new directory
					// start watching it, and report any files in it
					await this._recurse(full);
					for (const [newPath, stats] of this.paths.entries()) {
						if (newPath.startsWith(path + '/')) {
							this.emit('+', { path: newPath, stats, isNew: true });
						}
					}
				}
			} else if (this.paths.has(path)) {
				// note the deleted file/dir
				const stats = this.paths.get(path);
				this.paths.delete(path);
				this.emit('-', { path, stats });
				if (this._watchers.has(path)) {
					// stop watching it, and report any files/dirs that were in it
					for (const old of this._watchers.keys()) {
						if (old === path || old.startsWith(path + '/')) {
							this._watchers.get(old).close();
							this._watchers.delete(old);
						}
					}
					for (const old of this.paths.keys()) {
						if (old.startsWith(path + '/')) {
							const stats = this.paths.get(old);
							this.paths.delete(old);
							this.emit('-', { path: old, stats });
						}
					}
				}
			}
		}
		this._status = Status.Ready;
	}
}

interface Filter {
	(file: { path: string; stats: fs.Stats }): Promise<boolean>;
}

const enum Status {
	Created,
	Initing,
	Ready,
	Processing,
	Closed,
}
