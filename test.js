/* eslint no-console: 0 */

const CheapWatch = require('.');

const assert = require('assert');
const child_process = require('child_process');
const fs = require('fs');
const util = require('util');

const exec = util.promisify(child_process.exec);
const mkdir = util.promisify(fs.mkdir);
const unlink = util.promisify(fs.unlink);
const writeFile = util.promisify(fs.writeFile);

const rmdir =
	process.platform === 'win32'
		? path =>
				exec(`rmdir /s /q ${path.replace(/\//g, '\\')} 2> nul`).catch(() => {})
		: path => exec('rm -rf ' + path);

const sleep = (ms = 100) => new Promise(res => setTimeout(res, ms));

(async () => {
	process.chdir(__dirname);
	await rmdir('test');
	await mkdir('test');
	process.chdir('test');

	console.log('running tests ...');

	const watcher = new CheapWatch({ dir: process.cwd() });
	const events = new Set();
	for (const event of ['+', '-']) {
		watcher.on(event, ({ path, stats }) => {
			events.add(event + (stats.isFile() ? 'f ' : 'd ') + path);
		});
	}

	await writeFile('foo', '');
	await mkdir('bar');
	await writeFile('bar/baz', '');
	await watcher.init();
	assert(watcher.files.get('foo').isFile());
	assert(watcher.files.get('bar').isDirectory());
	assert(watcher.files.get('bar/baz').isFile());

	await writeFile('foo', 'foo');
	await sleep();
	assert(events.has('+f foo'));
	events.clear();

	await writeFile('bar/qux', 'qux');
	await sleep();
	assert(events.has('+f bar/qux'));
	assert(events.has('+d bar'));
	events.clear();

	await rmdir('bar');
	await sleep();
	assert(events.has('-d bar'));
	assert(events.has('-f bar/baz'));
	assert(events.has('-f bar/qux'));
	events.clear();

	await unlink('foo');
	await sleep();
	assert(events.has('-f foo'));
	events.clear();

	await Promise.all([writeFile('foo', ''), writeFile('bar', '')]);
	await sleep();
	assert(events.has('+f foo'));
	assert(events.has('+f bar'));
	events.clear();

	watcher.close();

	await writeFile('foo', '');
	await sleep();
	assert(events.size === 0);

	console.log('tests successful!');

	process.chdir(__dirname);
	await rmdir('test');
})().catch(({ stack }) => {
	console.error(stack);
	process.exit(1);
});
