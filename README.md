# Cheap Watch: If it works, why use something else?

[![npm version](https://img.shields.io/npm/v/cheap-watch.svg?style=flat-square)](https://www.npmjs.com/package/cheap-watch)

**Cheap Watch** is a small, simple, dependency-free, cross-platform file system watcher for Node.js 8+.

It began life as part of [Defiler](https://github.com/Conduitry/defiler) and was then prettied up and extracted into its own library.

## Constructor

### `new CheapWatch({ dir, filter, watch = true, debounce = 10 })`

- `dir` - The directory whose contents to watch. It's recommended, though not required, for this to be an absolute path, say one returned by `path.resolve`.
- `filter({ path, stats })` - _(optional)_ A function to decide whether a given file or directory should be watched. It's passed an object containing the file or directory's relative `path` and its `stats`. It should return `true` or `false` (or a `Promise` resolving to one of those). Returning `false` for a directory means that none of its contents will be watched. You can use `stats.isFile()` and `stats.isDirectory()` to determine whether this is a file or a directory.
- `watch` - _(optional)_ Whether to actually watch the directory for changes. Defaults to `true`. If `false`, you can retrieve all of the files within a given directory along with their `Stats` but changes will not actually be watched.
- `debounce` - _(optional)_ Length of timeout in milliseconds to use to debounce incoming events from `fs.watch`. Defaults to 10. Multiple events are often emitted for a single change, and events can also be emitted before `fs.stat` reports the changes. Cheap Watch will wait until `debounce` milliseconds have passed since the last `fs.watch` event for a file before reporting it. The default of 10ms Works On My Machine.

## Methods

### `cheapWatch.init()`

Initialize the watcher, traverse the directory to find the initial files, and set up watchers to look for changes.

This returns a `Promise` that resolves to an array of `{ path, stats }` object, one per file. `path` is a relative path from the `CheapWatch`'s `dir`, and `stats` is the `Stats` object for the file.

### `cheapWatch.close()`

Close all `FSWatcher` instances, and stop watching for file changes.

## Events

`CheapWatch` is a subclass of `EventEmitter`, and emits two events to report a new or update file or to report a deleted file.

### `+` `{ path, stats }`

A `+` event is emitted with an object containing a `path` string and a `stats` object whenever a watched file is created or updated.

### `-` `{ path }`

A `-` event is emitted with an object containing a `path` string whenever a watched file is deleted.

## Usage

```javascript
import CheapWatch from 'cheap-watch';

const watch = new CheapWatch({ dir, /* ... */ });

const initialFiles = await watch.init();

watch.on('+', ({ path, stats }) => /* ... */ );
watch.on('-', ({ path }) => /* ... */);
```

## License

Copyright (c) 2018 Conduitry

- [MIT](LICENSE)
