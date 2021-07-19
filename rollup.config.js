import typescript2 from 'rollup-plugin-typescript2';

export default {
	input: './src/CheapWatch',
	external: name => /^[a-z]/.test(name),
	plugins: [typescript2()],
	output: [
		{
			file: './dist/CheapWatch.cjs',
			format: 'cjs',
			sourcemap: true,
			interop: false,
		},
		{ file: './dist/CheapWatch.mjs', format: 'es', sourcemap: true },
	],
};
