export default [
  {
    ignores: ['.next/**', 'dist/**', 'node_modules/**', 'collector/out/**', 'src/**'],
  },
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        document: 'readonly',
        crypto: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'off',
    },
  },
]
