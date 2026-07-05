// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Only the two classic hook rules — not reactHooks.configs.flat.recommended,
    // which in v6+ pulls in the newer React-Compiler-oriented rules (react-hooks/refs,
    // react-hooks/set-state-in-effect, etc.). Those flag several intentional patterns
    // already in this codebase (e.g. the "latest ref" trick in use-lazy-handler.ts),
    // which this repo isn't written against and doesn't use React Compiler.
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },
  {
    ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/.turbo/**'],
  },
);
