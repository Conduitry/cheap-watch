const CheapWatch = require('.');

const assert = require('assert');
const child_process = require('child_process');
const fs = require('fs');
const util = require('util');

const exec = util.promisify(child_process.exec);
const mkdir = util.promisify(fs.mkdir);
const rename = util.promisify(fs.rename);
const unlink = util.promisify(fs.unlink);
const writeFile = util.promisify(fs.writeFile);

const rmdir =
	process.platform === 'win32'
		? path =>
				exec(`rmdir /s /q ${path.replace(/\//g, '\\')} 2> nul`).catch(() => {})
		: path => exec('rm -rf ' + path);

const sleep = (ms = 500) => new Promise(res => setTimeout(res, ms));

function getEvents(watch) {
	const files = new Set();
	const directories = new Set();
	watch.on('+', ({ path, stats, isNew }) => {
		if (stats.isFile()) {
			const event = `${isNew ? 'added' : 'updated'} ${path}`;
			if (files.has(event)) {
				throw new Error(`Duplicate event: ${event}`);
			}
			files.add(event);
		}
		if (stats.isDirectory()) {
			const event = `${isNew ? 'added' : 'updated'} ${path}`;
			directories.add(event);
		}
	});
	watch.on('-', ({ path, stats }) => {
		if (stats.isFile()) {
			const event = `deleted ${path}`;
			if (files.has(event)) {
				throw new Error(`Duplicate event: ${event}`);
			}
			files.add(event);
		}
		if (stats.isDirectory()) {
			const event = `deleted ${path}`;
			directories.add(event);
		}
	});
	const clear = () => {
		files.clear();
		directories.clear();
	};
	return { files, directories, clear };
}

(async () => {
	process.chdir(__dirname);
	await rmdir('test');
	await mkdir('test');
	process.chdir('test');

	console.log('running tests ...');

	{
		const watch = new CheapWatch({ dir: process.cwd() });
		const { files, directories, clear } = getEvents(watch);

		await writeFile('foo', '');
		await mkdir('bar');
		await writeFile('bar/baz', '');
		await sleep();
		await watch.init();
		assert.equal(watch.paths.size, 3);
		assert.ok(watch.paths.get('foo').isFile());
		assert.ok(watch.paths.get('bar').isDirectory());
		assert.ok(watch.paths.get('bar/baz').isFile());
		assert.equal(files.size, 0);
		assert.equal(directories.size, 0);

		await writeFile('foo', '');
		await sleep();
		assert.equal(files.size, 1);
		assert.ok(files.has('updated foo'));
		clear();

		await writeFile('bar/qux', '');
		await sleep();
		assert.equal(files.size, 1);
		assert.ok(files.has('added bar/qux'));
		assert.ok(directories.has('updated bar'));
		clear();

		await rmdir('bar');
		await sleep();
		assert.ok(directories.has('deleted bar'));
		assert.equal(files.size, 2);
		assert.ok(files.has('deleted bar/baz'));
		assert.ok(files.has('deleted bar/qux'));
		clear();

		await unlink('foo');
		await sleep();
		assert.equal(files.size, 1);
		assert.ok(files.has('deleted foo'));
		clear();

		await Promise.all([writeFile('foo', ''), writeFile('bar', '')]);
		await sleep();
		assert.equal(files.size, 2);
		assert.ok(files.has('added foo'));
		assert.ok(files.has('added bar'));
		clear();

		watch.close();

		await writeFile('foo', '');
		await sleep();
		assert.equal(files.size, 0);
	}

	{
		const watch = new CheapWatch({
			dir: process.cwd(),
			filter: ({ path, stats }) =>
				(stats.isFile() && !path.includes('skip-file')) ||
				(stats.isDirectory() && !path.includes('skip-directory')),
		});
		const { files, directories, clear } = getEvents(watch);

		await watch.init();

		await writeFile('skip-file', '');
		await sleep();
		assert.equal(files.size, 0);

		await writeFile('foo', '');
		await sleep();
		assert.equal(files.size, 1);
		assert.ok(files.has('updated foo'));
		clear();

		await mkdir('skip-directory');
		await sleep();
		assert.equal(directories.size, 0);

		await writeFile('skip-directory/foo', '');
		await sleep();
		assert.equal(files.size, 0);

		await mkdir('included-directory');
		await sleep();
		assert.equal(directories.size, 1);
		assert.ok(directories.has('added included-directory'));
		await writeFile('included-directory/foo', '');
		await sleep();
		clear();

		await rename('included-directory/foo', 'included-directory/foo-2');
		await sleep();
		assert.equal(files.size, 2);
		assert.ok(files.has('deleted included-directory/foo'));
		assert.ok(files.has('added included-directory/foo-2'));
		assert.ok(directories.has('updated included-directory'));
		clear();

		await rename('included-directory', 'included-directory-2');
		await sleep();
		assert.equal(files.size, 2);
		assert.ok(files.has('deleted included-directory/foo-2'));
		assert.ok(files.has('added included-directory-2/foo-2'));
		assert.ok(directories.has('deleted included-directory'));
		assert.ok(directories.has('added included-directory-2'));
		clear();

		watch.close();
	}

	console.log('tests successful!');

	process.chdir(__dirname);
	await rmdir('test');
})().catch(({ stack }) => {
	console.error(stack);
	process.exit(1);
});
