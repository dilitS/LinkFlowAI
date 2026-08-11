#!/usr/bin/env node
/**
 * Validate a release ZIP: required paths, manifest integrity, no dev artifacts.
 * Usage: node scripts/validate-zip.js [path-to.zip]
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf-8'));
const version = manifest.version;
const defaultZip = path.join(ROOT, 'releases', `lingflow-ai-v${version}.zip`);
const zipPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultZip;

const REQUIRED_PREFIXES = [
    'manifest.json',
    'popup/',
    'sidepanel/',
    'background/',
    'content/',
    'lib/',
    'dist/',
    '_locales/',
    'assets/',
    'LICENSE',
    'PRIVACY.md',
];

const FORBIDDEN_PREFIXES = [
    'tests/',
    'scripts/',
    'node_modules/',
    'PLAN-AKTUALIZACJI-V2.md',
    'package.json',
    'package-lock.json',
    '.git/',
];

let errors = 0;

function fail(msg) {
    console.error(`  ✗ ${msg}`);
    errors++;
}

function pass(msg) {
    console.log(`  ✓ ${msg}`);
}

if (!fs.existsSync(zipPath)) {
    console.error(`\n❌ ZIP not found: ${zipPath}\n`);
    process.exit(1);
}

console.log(`\n🔍 Validating ZIP: ${path.basename(zipPath)}\n`);

let listing;
try {
    listing = execSync(`unzip -l "${zipPath}"`, { encoding: 'utf-8' });
} catch {
    fail('Could not read ZIP archive');
    process.exit(1);
}

const entries = listing
    .split('\n')
    .slice(3)
    .map(line => line.trim().split(/\s+/).pop())
    .filter(name => name && !name.endsWith('/') && name !== 'Name' && name !== '----');

pass(`${entries.length} files in archive`);

for (const prefix of REQUIRED_PREFIXES) {
    const found = entries.some(e => e === prefix || e.startsWith(prefix));
    if (found) pass(`contains ${prefix}`);
    else fail(`missing required path: ${prefix}`);
}

for (const prefix of FORBIDDEN_PREFIXES) {
    const leaked = entries.filter(e => e.startsWith(prefix) || e === prefix.replace(/\/$/, ''));
    if (leaked.length) fail(`forbidden content: ${leaked.slice(0, 3).join(', ')}${leaked.length > 3 ? '…' : ''}`);
}

const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'lingflow-zip-'));
try {
    execSync(`unzip -q "${zipPath}" -d "${tmpDir}"`, { stdio: 'pipe' });

    const unpackedManifest = JSON.parse(
        fs.readFileSync(path.join(tmpDir, 'manifest.json'), 'utf-8')
    );

    if (unpackedManifest.version !== manifest.version) {
        fail(`manifest version mismatch: zip=${unpackedManifest.version} repo=${manifest.version}`);
    } else {
        pass(`manifest version ${unpackedManifest.version}`);
    }

    function checkRef(relPath, label) {
        const full = path.join(tmpDir, relPath);
        if (fs.existsSync(full)) pass(`${label}: ${relPath}`);
        else fail(`${label} missing in ZIP: ${relPath}`);
    }

    for (const [size, iconPath] of Object.entries(unpackedManifest.icons || {})) {
        checkRef(iconPath, `icon ${size}`);
    }
    if (unpackedManifest.background?.service_worker) {
        checkRef(unpackedManifest.background.service_worker, 'service_worker');
    }
    if (unpackedManifest.action?.default_popup) {
        checkRef(unpackedManifest.action.default_popup, 'popup');
    }
    if (unpackedManifest.side_panel?.default_path) {
        checkRef(unpackedManifest.side_panel.default_path, 'side_panel');
    }
    for (const cs of unpackedManifest.content_scripts || []) {
        for (const jsFile of cs.js || []) checkRef(jsFile, 'content_script JS');
        for (const cssFile of cs.css || []) checkRef(cssFile, 'content_script CSS');
    }
} finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log(`\n${'─'.repeat(40)}`);
if (errors) {
    console.error(`\n❌ ZIP validation FAILED with ${errors} error(s)\n`);
    process.exit(1);
}
console.log(`\n✅ ZIP validation PASSED\n`);
