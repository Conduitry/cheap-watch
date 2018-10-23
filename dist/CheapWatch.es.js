import * as EventEmitter from 'events';
import { readdir, stat, watch } from 'fs';
import { promisify } from 'util';

const readdir$1 = promisify(readdir);
const stat$1 = promisify(stat);
class CheapWatch extends EventEmitter {
    constructor(data) {
        super();
        this.watch = true;
        this.debounce = 10;
        this.paths = new Map();
        this._watchers = new Map();
        this._timeouts = new Map();
        this._queue = [];
        this._status = 0;
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
    async init() {
        if (this._status !== 0) {
            throw new Error('cannot call init() twice');
        }
        this._status = 1;
        await this._recurse(this.dir);
        this._status = 2;
    }
    close() {
        if (this._status === 0 || this._status === 1) {
            throw new Error('cannot call close() before init() finishes');
        }
        if (this._status === 4) {
            throw new Error('cannot call close() twice');
        }
        this._status = 4;
        for (const watcher of this._watchers.values()) {
            watcher.close();
        }
    }
    async _recurse(full) {
        const path = full.slice(this.dir.length + 1);
        const stats = await stat$1(full);
        if (path) {
            if (this.filter && !(await this.filter({ path, stats }))) {
                return;
            }
            this.paths.set(path, stats);
        }
        if (stats.isDirectory()) {
            if (this.watch) {
                this._watchers.set(path, watch(full, this._handle.bind(this, full)).on('error', () => { }));
            }
            await Promise.all((await readdir$1(full)).map(sub => this._recurse(full + '/' + sub)));
        }
    }
    _handle(dir, event, file) {
        this._debounce(dir);
        this._debounce(dir + '/' + file);
    }
    _debounce(path) {
        if (this._timeouts.has(path)) {
            clearTimeout(this._timeouts.get(path));
        }
        this._timeouts.set(path, setTimeout(() => {
            this._timeouts.delete(path);
            this._enqueue(path);
        }, this.debounce));
    }
    async _enqueue(full) {
        this._queue.push(full);
        if (this._status !== 2) {
            return;
        }
        this._status = 3;
        while (this._queue.length) {
            const full = this._queue.shift();
            const path = full.slice(this.dir.length + 1);
            const stats = await stat$1(full).catch(() => { });
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
                    await this._recurse(full);
                    for (const [newPath, stats] of this.paths.entries()) {
                        if (newPath.startsWith(path + '/')) {
                            this.emit('+', { path: newPath, stats, isNew: true });
                        }
                    }
                }
            }
            else if (this.paths.has(path)) {
                const stats = this.paths.get(path);
                this.paths.delete(path);
                this.emit('-', { path, stats });
                if (this._watchers.has(path)) {
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
        this._status = 2;
    }
}

export default CheapWatch;
//# sourceMappingURL=CheapWatch.es.js.map
