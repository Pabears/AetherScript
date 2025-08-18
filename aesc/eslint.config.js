import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ["dist/", "node_modules/","**/*.test.*"]
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_|',
          varsIgnorePattern: '^_|',
          caughtErrorsIgnorePattern: '^_|',
        },
      ],
    },
  },
  eslintConfigPrettier
);
