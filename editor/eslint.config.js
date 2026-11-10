import js from '@eslint/js'
import globals from 'globals'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import reactRefreshPlugin from 'eslint-plugin-react-refresh'
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['dist', 'schema/dcat-us'],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-refresh': reactRefreshPlugin,
      'jsx-a11y': jsxA11yPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...jsxA11yPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/no-danger': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXIdentifier[name="dangerouslySetInnerHTML"]',
          message: 'dangerouslySetInnerHTML is banned per SI-15 control',
        },
      ],
    },
    settings: {
      react: {
        version: 'detect',
        runtime: 'automatic',
      },
    },
  },
  {
    // The catalog model must run in a worker: no React, no DOM (#20). DOM types are kept out by
    // src/catalog/tsconfig.json (lib WebWorker), run by `npm run typecheck`.
    files: ['src/catalog/**/*.ts'],
    ignores: ['src/catalog/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ regex: '^(?!\\./(?!.*\\.\\.)|\\.\\./schema$)', message: 'src/catalog may import only itself and ../schema.' }] },
      ],
    },
  },
)
