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

function getEvents(watcher) {
	const events = new Set();
	for (const event of ['+', '-']) {
		watcher.on(event, ({ path, stats }) => {
			events.add(event + (stats.isFile() ? 'f ' : 'd ') + path);
		});
	}
	return events;
}

(async () => {
	process.chdir(__dirname);
	await rmdir('test');
	await mkdir('test');
	process.chdir('test');

	console.log('running tests ...');

	const watcher = new CheapWatch({ dir: process.cwd() });
	const events = getEvents(watcher);

	await writeFile('foo', '');
	await mkdir('bar');
	await writeFile('bar/baz', '');
	await watcher.init();
	assert.equal(watcher.files.size, 3);
	assert.ok(watcher.files.get('foo').isFile());
	assert.ok(watcher.files.get('bar').isDirectory());
	assert.ok(watcher.files.get('bar/baz').isFile());

	await writeFile('foo', 'foo');
	await sleep();
	assert.ok(events.has('+f foo'));
	events.clear();

	await writeFile('bar/qux', 'qux');
	await sleep();
	assert.ok(events.has('+f bar/qux'));
	assert.ok(events.has('+d bar'));
	events.clear();

	await rmdir('bar');
	await sleep();
	assert.ok(events.has('-d bar'));
	assert.ok(events.has('-f bar/baz'));
	assert.ok(events.has('-f bar/qux'));
	events.clear();

	await unlink('foo');
	await sleep();
	assert.ok(events.has('-f foo'));
	events.clear();

	await Promise.all([writeFile('foo', ''), writeFile('bar', '')]);
	await sleep();
	assert.ok(events.has('+f foo'));
	assert.ok(events.has('+f bar'));
	events.clear();

	watcher.close();

	await writeFile('foo', '');
	await sleep();
	assert.equal(events.size, 0);

	const watcher2 = new CheapWatch({
		dir: process.cwd(),
		filter: ({ path, stats }) =>
			(stats.isFile() && !path.includes('skip-file')) ||
			(stats.isDirectory() && !path.includes('skip-directory')),
	});
	const events2 = getEvents(watcher2);

	await watcher2.init();

	await writeFile('skip-file', '');
	await sleep();
	assert.equal(events2.size, 0);

	await writeFile('foo', '');
	await sleep();
	assert.ok(events2.has('+f foo'));
	events2.clear();

	await mkdir('skip-directory');
	await sleep();
	assert.equal(events2.size, 0);

	await writeFile('skip-directory/foo', '');
	await sleep();
	assert.equal(events2.size, 0);

	watcher2.close();

	console.log('tests successful!');

	process.chdir(__dirname);
	await rmdir('test');
})().catch(({ stack }) => {
	console.error(stack);
	process.exit(1);
});
