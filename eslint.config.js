import js from '@eslint/js'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig(
  globalIgnores(['**/node_modules/', '**/dist/', '**/coverage/', 'test-results/', 'playwright-report/', 'e2e/.data/']),
  {
    files: ['frontend/**/*.{ts,tsx}', 'e2e/**/*.ts', 'scripts/**/*.mjs', 'eslint.config.js'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: {
      complexity: ['error', { max: 15 }],
    },
  },
  {
    files: ['frontend/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, jsxA11y.flatConfigs.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['e2e/**/*.ts', 'scripts/**/*.mjs', 'frontend/vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
)
