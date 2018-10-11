let transform;

if (process.env.ROLLUP_WATCH === 'true') {
	const { transpileModule } = require('typescript');
	const tsconfig = require('./tsconfig.json');
	transform = (code, id) => {
		if (id.endsWith('.ts')) {
			const { outputText, sourceMapText } = transpileModule(code, tsconfig);
			return { code: outputText, map: JSON.parse(sourceMapText) };
		}
	};
} else {
	const { readFile, unlink } = require('fs');
	const { promisify } = require('util');
	transform = async (code, id) => {
		if (id.endsWith('.ts')) {
			id = id.slice(0, -2) + 'js';
			const [js, map] = await Promise.all(
				[id, id + '.map'].map(async path => {
					const data = await promisify(readFile)(path);
					unlink(path, () => null);
					return data.toString();
				}),
			);
			return { code: js, map: JSON.parse(map) };
		}
	};
}

export default {
	input: './src/CheapWatch',
	external: name => /^[a-z]/.test(name),
	plugins: {
		resolveId(importee, importer) {
			if (/\/[^.]+$/.test(importee)) {
				return this.resolveId(importee + '.ts', importer);
			}
		},
		transform,
	},
	output: [
		{
			file: './dist/CheapWatch.cjs.js',
			format: 'cjs',
			sourcemap: true,
			interop: false,
		},
		{ file: './dist/CheapWatch.es.js', format: 'es', sourcemap: true },
	],
};
