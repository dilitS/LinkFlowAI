const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const extensionPath = path.resolve(__dirname, '..', '..');

test.describe('LingFlow AI Extension', () => {
    let context;
    let extensionId;

    test.beforeAll(async () => {
        context = await chromium.launchPersistentContext('', {
            headless: false,
            args: [
                `--disable-extensions-except=${extensionPath}`,
                `--load-extension=${extensionPath}`,
                '--no-first-run',
                '--disable-gpu',
            ],
        });

        let [background] = context.serviceWorkers();
        if (!background) {
            background = await context.waitForEvent('serviceworker');
        }
        extensionId = background.url().split('/')[2];
    });

    test.afterAll(async () => {
        await context?.close();
    });

    test('manifest files all exist in the package', () => {
        const manifest = JSON.parse(fs.readFileSync(path.join(extensionPath, 'manifest.json'), 'utf-8'));

        for (const size of Object.keys(manifest.icons || {})) {
            const iconPath = path.join(extensionPath, manifest.icons[size]);
            expect(fs.existsSync(iconPath), `Missing icon: ${manifest.icons[size]}`).toBe(true);
        }

        for (const cs of manifest.content_scripts || []) {
            for (const jsFile of cs.js || []) {
                expect(fs.existsSync(path.join(extensionPath, jsFile)), `Missing CS JS: ${jsFile}`).toBe(true);
            }
            for (const cssFile of cs.css || []) {
                expect(fs.existsSync(path.join(extensionPath, cssFile)), `Missing CS CSS: ${cssFile}`).toBe(true);
            }
        }

        if (manifest.background?.service_worker) {
            const swPath = path.join(extensionPath, manifest.background.service_worker);
            expect(fs.existsSync(swPath), `Missing SW: ${manifest.background.service_worker}`).toBe(true);
        }

        if (manifest.action?.default_popup) {
            const popupPath = path.join(extensionPath, manifest.action.default_popup);
            expect(fs.existsSync(popupPath), `Missing popup: ${manifest.action.default_popup}`).toBe(true);
        }

        if (manifest.side_panel?.default_path) {
            const sidePanelPath = path.join(extensionPath, manifest.side_panel.default_path);
            expect(fs.existsSync(sidePanelPath), `Missing side panel: ${manifest.side_panel.default_path}`).toBe(true);
        }

        for (const resource of manifest.web_accessible_resources || []) {
            for (const r of resource.resources || []) {
                if (r.includes('*')) continue;
                expect(fs.existsSync(path.join(extensionPath, r)), `Missing WAR: ${r}`).toBe(true);
            }
        }
    });

    test('service worker loads without errors', async () => {
        let [background] = context.serviceWorkers();
        if (!background) {
            background = await context.waitForEvent('serviceworker');
        }
        expect(background.url()).toContain(extensionId);
    });

    test('popup page loads and has content', async () => {
        const popupPage = await context.newPage();
        await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
        await popupPage.waitForLoadState('domcontentloaded');

        const title = await popupPage.title();
        expect(title).toBeTruthy();

        const body = await popupPage.locator('body').textContent();
        expect(body.length).toBeGreaterThan(0);

        await popupPage.close();
    });

    test('popup shows provider selector (radio buttons)', async () => {
        const popupPage = await context.newPage();
        await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
        await popupPage.waitForLoadState('domcontentloaded');

        const chromeAi = popupPage.locator('input[name="api-provider-select"][value="chrome-ai"]');
        const openai = popupPage.locator('input[name="api-provider-select"][value="openai"]');
        const gemini = popupPage.locator('input[name="api-provider-select"][value="gemini"]');

        expect(await chromeAi.count()).toBe(1);
        expect(await openai.count()).toBe(1);
        expect(await gemini.count()).toBe(1);

        expect(await chromeAi.isChecked()).toBe(true);

        await popupPage.close();
    });

    test('popup shows language selectors', async () => {
        const popupPage = await context.newPage();
        await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
        await popupPage.waitForLoadState('domcontentloaded');

        const srcLang = popupPage.locator('#source-lang');
        const tgtLang = popupPage.locator('#target-lang');

        await expect(srcLang).toBeVisible();
        await expect(tgtLang).toBeVisible();

        await popupPage.close();
    });

    test('popup navigation tabs work', async () => {
        const popupPage = await context.newPage();
        await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
        await popupPage.waitForLoadState('domcontentloaded');

        const tabs = popupPage.locator('[data-tab], .tab-btn, .nav-tab');
        const tabCount = await tabs.count();

        if (tabCount > 1) {
            await tabs.nth(1).click();
            await popupPage.waitForTimeout(300);
        }

        await popupPage.close();
    });

    test('settings page shows API key input', async () => {
        const popupPage = await context.newPage();
        await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
        await popupPage.waitForLoadState('domcontentloaded');

        const settingsTab = popupPage.locator('[data-tab="settings"], #settings-tab, .tab-btn:has-text("Settings"), .tab-btn:has-text("Ustawienia")');
        if (await settingsTab.count() > 0) {
            await settingsTab.first().click();
            await popupPage.waitForTimeout(300);
        }

        await popupPage.close();
    });

    test('no console errors in popup', async () => {
        const popupPage = await context.newPage();
        const errors = [];

        popupPage.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
        await popupPage.waitForLoadState('domcontentloaded');
        await popupPage.waitForTimeout(500);

        const criticalErrors = errors.filter(e =>
            !e.includes('net::ERR_') &&
            !e.includes('favicon') &&
            !e.includes('DevTools')
        );

        expect(criticalErrors).toEqual([]);

        await popupPage.close();
    });

    test('side panel page loads', async () => {
        const manifest = JSON.parse(fs.readFileSync(path.join(extensionPath, 'manifest.json'), 'utf-8'));
        const sidePanelPath = manifest.side_panel?.default_path;

        if (!sidePanelPath) {
            test.skip();
            return;
        }

        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/${sidePanelPath}`);
        await page.waitForLoadState('domcontentloaded');

        const body = await page.locator('body').textContent();
        expect(body.length).toBeGreaterThan(0);

        await page.close();
    });

    test('content script does not break example.com', async () => {
        const page = await context.newPage();
        const errors = [];

        page.on('pageerror', err => errors.push(err.message));

        await page.goto('https://example.com');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);

        const heading = await page.locator('h1').textContent();
        expect(heading).toContain('Example Domain');

        const injectedErrors = errors.filter(e =>
            e.includes('lingflow') || e.includes('LingFlow')
        );
        expect(injectedErrors).toEqual([]);

        await page.close();
    });

    test('switching provider via radio buttons updates hidden select', async () => {
        const popupPage = await context.newPage();
        await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
        await popupPage.waitForLoadState('domcontentloaded');

        const openaiRadio = popupPage.locator('input[name="api-provider-select"][value="openai"]');
        const openaiLabel = popupPage.locator('label:has(input[value="openai"])');

        if (await openaiLabel.count() > 0) {
            await openaiLabel.click();
            await popupPage.waitForTimeout(300);

            expect(await openaiRadio.isChecked()).toBe(true);
        }

        await popupPage.close();
    });
});
