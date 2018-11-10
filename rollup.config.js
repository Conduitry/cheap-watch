import cheapTS from 'rollup-plugin-cheap-ts';

export default {
	input: './src/CheapWatch',
	external: name => /^[a-z]/.test(name),
	plugins: [cheapTS()],
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
