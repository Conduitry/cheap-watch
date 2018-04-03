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

const sleep = ms => new Promise(res => setTimeout(res, ms));

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
	await sleep(50);
	assert(events.has('+f foo'));
	events.clear();

	await writeFile('bar/qux', 'qux');
	await sleep(50);
	assert(events.has('+f bar/qux'));
	assert(events.has('+d bar'));
	events.clear();

	await rmdir('bar');
	await sleep(50);
	assert(events.has('-d bar'));
	assert(events.has('-f bar/baz'));
	assert(events.has('-f bar/qux'));
	events.clear();

	watcher.close();

	console.log('tests successful!');

	process.chdir(__dirname);
	await rmdir('test');
})().catch(({ stack }) => {
	console.error(stack);
	process.exit(1);
});
