import typescript from '@rollup/plugin-typescript';

export default {
	input: './src/CheapWatch.ts',
	external: name => /^[a-z]/.test(name),
	plugins: [typescript()],
	output: [
		{
			file: './dist/CheapWatch.cjs',
			format: 'cjs',
			sourcemap: true,
			interop: false,
			exports: 'auto'
		},
		{ file: './dist/CheapWatch.mjs', format: 'es', sourcemap: true },
	],
};
