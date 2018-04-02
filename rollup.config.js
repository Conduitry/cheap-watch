export default {
	input: './CheapWatch.js',
	external: name => /^[-a-z]+$/.test(name),
	output: [
		{
			file: './dist/CheapWatch.cjs.js',
			format: 'cjs',
			sourcemap: true,
			interop: false,
		},
	],
};
