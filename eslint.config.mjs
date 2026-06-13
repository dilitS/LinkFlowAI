import js from '@eslint/js';
import globals from 'globals';

export default [
    {
        ignores: ['dist/**', 'node_modules/**', '_locales/**', 'assets/**', 'popup/output.css']
    },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.serviceworker,
                ...globals.webextensions,
                chrome: 'readonly',
                // Chrome Built-in AI platform globals
                Translator: 'readonly',
                LanguageDetector: 'readonly',
                LanguageModel: 'readonly',
                Writer: 'readonly',
                Rewriter: 'readonly',
                Proofreader: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
            'no-empty': ['error', { allowEmptyCatch: true }],
            'no-constant-condition': ['error', { checkLoops: false }],
            'no-console': 'off',
            // Deferred to a dedicated lint-cleanup pass (Sprint 6.2 sets the
            // tooling up; rewriting historical throw/assignment patterns across
            // untouched modules is out of scope here).
            'no-useless-assignment': 'off',
            'preserve-caught-error': 'off'
        }
    },
    {
        files: ['tests/**/*.js', 'vitest.config.js', 'eslint.config.mjs', 'webpack.config.js', 'tailwind.config.js'],
        languageOptions: {
            globals: { ...globals.node }
        }
    }
];
