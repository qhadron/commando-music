module.exports = {
	parser: 'babel-eslint',
	parserOptions: {
		emcaVersion: 8
	},
	env: {
		es6: true,
		node: true
	},
	plugins: ['prettier'],
	extends: ['eslint:recommended', 'prettier'],
	rules: {
		'prettier/prettier': 'warn',
		'linebreak-style': ['error', 'unix'],
		quotes: [
			'error',
			'single',
			{
				avoidEscape: true,
				allowTemplateLiterals: true
			}
		],
		'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
		semi: ['error', 'always']
	}
};
