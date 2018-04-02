# v0.2.0

- Report directory stats and events
- Expose latest stats for all files and directories as `watch.files`
- Expose pre-deletion stats for deleted files and directories as part of `-` event
- `watch.init()` simply returns a `Promise` resolving to `undefined` now that `watch.files` is available

# v0.1.0

- Initial release
