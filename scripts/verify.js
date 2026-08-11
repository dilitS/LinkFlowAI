#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let errors = 0;

function fail(msg) {
    console.error(`  ✗ ${msg}`);
    errors++;
}

function pass(msg) {
    console.log(`  ✓ ${msg}`);
}

console.log('\n🔍 LingFlow AI — Release Verification\n');

// 1. Validate manifest.json
console.log('▸ Manifest validation');
const manifestPath = path.join(ROOT, 'manifest.json');
let manifest;
try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    pass('manifest.json is valid JSON');
} catch (e) {
    fail(`manifest.json parse error: ${e.message}`);
    process.exit(1);
}

// Chrome accepts 1–4 dot-separated integers, each 0–65535, no leading zeros.
// Prerelease suffixes like "-rc.1" belong in version_name, not version.
const CHROME_VERSION_RE = /^(0|[1-9]\d*)(\.(0|[1-9]\d*)){0,3}$/;

function isValidChromeVersion(value) {
    if (typeof value !== 'string' || !CHROME_VERSION_RE.test(value)) return false;
    return value.split('.').every(part => Number(part) <= 65535);
}

if (!manifest.version) {
    fail('manifest missing "version"');
} else if (!isValidChromeVersion(manifest.version)) {
    fail(
        `manifest "version" is not a valid Chrome version: "${manifest.version}" ` +
        '(1–4 dot-separated integers 0–65535; put prerelease labels in "version_name")'
    );
} else {
    pass(`version: ${manifest.version}${manifest.version_name ? ` (version_name: ${manifest.version_name})` : ''}`);
}

// package.json may carry a semver prerelease tag; its release core must match
// the manifest so the packaged ZIP name and the store version stay in sync.
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
const pkgCore = String(pkg.version || '').split('-')[0];
if (pkgCore !== manifest.version) {
    fail(`package.json version "${pkg.version}" does not match manifest version "${manifest.version}"`);
} else {
    pass(`package.json version ${pkg.version} matches manifest`);
}

if (manifest.version_name && manifest.version_name !== pkg.version) {
    fail(`manifest version_name "${manifest.version_name}" does not match package.json version "${pkg.version}"`);
}

if (!manifest.manifest_version || manifest.manifest_version !== 3)
    fail('manifest_version must be 3');
else pass('manifest_version: 3');

// 2. Check all files referenced by manifest
console.log('\n▸ Manifest file references');

function checkFile(relPath, label) {
    const full = path.join(ROOT, relPath);
    if (fs.existsSync(full)) pass(`${label}: ${relPath}`);
    else fail(`${label} missing: ${relPath}`);
}

for (const [size, iconPath] of Object.entries(manifest.icons || {})) {
    checkFile(iconPath, `icon ${size}`);
}

if (manifest.background?.service_worker) {
    checkFile(manifest.background.service_worker, 'service_worker');
}

if (manifest.action?.default_popup) {
    checkFile(manifest.action.default_popup, 'popup');
}

if (manifest.side_panel?.default_path) {
    checkFile(manifest.side_panel.default_path, 'side_panel');
}

for (const cs of manifest.content_scripts || []) {
    for (const jsFile of cs.js || []) checkFile(jsFile, 'content_script JS');
    for (const cssFile of cs.css || []) checkFile(cssFile, 'content_script CSS');
}

for (const resource of manifest.web_accessible_resources || []) {
    for (const r of resource.resources || []) {
        if (r.includes('*')) continue;
        checkFile(r, 'web_accessible_resource');
    }
}

// 3. Validate all locale files
console.log('\n▸ Locale validation');
const SUPPORTED_UI_LOCALES = ['en', 'pl'];
const localesDir = path.join(ROOT, '_locales');
const enMessages = JSON.parse(fs.readFileSync(path.join(localesDir, 'en', 'messages.json'), 'utf-8'));
const enKeys = Object.keys(enMessages).sort();
const locales = fs.readdirSync(localesDir).filter(d =>
    fs.statSync(path.join(localesDir, d)).isDirectory()
);

pass(`${locales.length} UI locales (v2.0: ${SUPPORTED_UI_LOCALES.join(', ')}), en has ${enKeys.length} keys`);

for (const locale of locales) {
    if (locale === 'en') continue;
    if (!SUPPORTED_UI_LOCALES.includes(locale)) {
        fail(`unexpected locale directory: ${locale} (v2.0 supports: ${SUPPORTED_UI_LOCALES.join(', ')})`);
        continue;
    }
    try {
        const msgs = JSON.parse(fs.readFileSync(path.join(localesDir, locale, 'messages.json'), 'utf-8'));
        const localeKeys = Object.keys(msgs).sort();
        const missing = enKeys.filter(k => !localeKeys.includes(k));
        const extra = localeKeys.filter(k => !enKeys.includes(k));

        if (missing.length) fail(`${locale}: missing keys: ${missing.join(', ')}`);
        if (extra.length) fail(`${locale}: extra keys: ${extra.join(', ')}`);
        if (!missing.length && !extra.length) pass(`${locale}: ${localeKeys.length} keys OK`);
    } catch (e) {
        fail(`${locale}: ${e.message}`);
    }
}

// 4. Check for release placeholders
console.log('\n▸ Placeholder scan');
const placeholderPatterns = [/TODO.*release/i, /FIXME.*release/i, /XXX/];
const scanExtensions = ['.js', '.html', '.json', '.css', '.md'];
const scanDirs = ['popup', 'background', 'content', 'lib'];

let placeholderCount = 0;
function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            scanDir(full);
        } else if (entry.isFile() && scanExtensions.some(ext => entry.name.endsWith(ext))) {
            const content = fs.readFileSync(full, 'utf-8');
            for (const pattern of placeholderPatterns) {
                const match = content.match(pattern);
                if (match) {
                    fail(`Placeholder in ${path.relative(ROOT, full)}: "${match[0]}"`);
                    placeholderCount++;
                }
            }
        }
    }
}
for (const d of scanDirs) scanDir(path.join(ROOT, d));
if (!placeholderCount) pass('No release placeholders found');

// 5. Build output check
console.log('\n▸ Build output');
const distDir = path.join(ROOT, 'dist');
if (fs.existsSync(distDir)) {
    const bundles = [];
    function findBundles(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) findBundles(full);
            else if (entry.name.endsWith('.js')) bundles.push(path.relative(ROOT, full));
        }
    }
    findBundles(distDir);
    if (bundles.length) pass(`${bundles.length} bundles in dist/`);
    else fail('No bundles found in dist/');
} else {
    fail('dist/ directory missing — run npm run build first');
}

// Summary
console.log(`\n${'─'.repeat(40)}`);
if (errors) {
    console.error(`\n❌ Verification FAILED with ${errors} error(s)\n`);
    process.exit(1);
} else {
    console.log(`\n✅ Verification PASSED — all checks OK\n`);
}
