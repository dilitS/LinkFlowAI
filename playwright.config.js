const { defineConfig } = require('@playwright/test');
const path = require('path');

const extensionPath = path.resolve(__dirname);

module.exports = defineConfig({
    testDir: './tests/e2e',
    timeout: 30_000,
    retries: 0,
    use: {
        headless: false,
        launchOptions: {
            args: [
                `--disable-extensions-except=${extensionPath}`,
                `--load-extension=${extensionPath}`,
                '--no-first-run',
                '--disable-gpu',
            ],
        },
    },
    projects: [
        {
            name: 'chromium',
            use: { channel: 'chromium' },
        },
    ],
});
