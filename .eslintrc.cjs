module.exports = {
  root: true,
  env: { es2021: true, node: true, jest: true, browser: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaFeatures: { jsx: true }, ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  settings: { react: { version: 'detect' } },
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_|^React$' }],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-require-imports': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off',
    'no-useless-catch': 'warn',
    'no-empty': ['warn', { allowEmptyCatch: true }],
    'no-useless-escape': 'warn',
    'prefer-const': 'warn',
    'no-var': 'warn',
  },
  overrides: [
    {
      files: ['**/__tests__/**', '**/*.test.*', '**/*.spec.*', 'jest.*.*', 'firestore.rules.test.js'],
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-require-imports': 'off',
        'no-undef': 'off',
      },
    },
    {
      files: ['src/services/**/*.ts'],
      rules: {
        '@typescript-eslint/no-unused-vars': ['warn', { args: 'none' }],
      },
    },
    {
      files: ['src/screens/**/*.tsx'],
      rules: {
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      },
    },
    {
      files: ['src/utils/**/*.ts'],
      rules: {
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      },
    },
  ],
  ignorePatterns: [
    'dist/',
    'build/',
    'node_modules/',
    'coverage/',
    'e2e/',
    '**/*.config.*',
    '**/*.d.ts',
    'firestore.rules.test.js',
  ],
};
