#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createHash } = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf-8'));
const version = manifest.version;
const zipName = `lingflow-ai-v${version}.zip`;
const outDir = path.join(ROOT, 'releases');

const INCLUDE = [
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

const EXCLUDE = [
    'tests/',
    'scripts/',
    'node_modules/',
    '*.test.js',
    '*.spec.js',
    'playwright.config.js',
    'webpack.config.js',
    'tailwind.config.js',
    'postcss.config.js',
    'eslint.config.mjs',
    'vitest.config.js',
    '.gitignore',
    '.nvmrc',
    'package.json',
    'package-lock.json',
    'PLAN-AKTUALIZACJI-V2.md',
    'ROADMAP.md',
    'CHANGELOG.md',
    'README.md',
    '.DS_Store',
    'docs/',
    'store/',
    'popup/input.css',
    'lib/piper/*',
    'assets/store/*',
];

if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

const excludeArgs = EXCLUDE.map(e => `--exclude='${e}'`).join(' ');
const includeArgs = INCLUDE.join(' ');

const zipPath = path.join(outDir, zipName);

if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
}

console.log(`\n📦 Packaging LingFlow AI v${version}\n`);

try {
    execSync(
        `cd "${ROOT}" && zip -r "${zipPath}" ${includeArgs} ${excludeArgs} -x '*.DS_Store'`,
        { stdio: 'inherit' }
    );
} catch (e) {
    console.error('❌ zip command failed');
    process.exit(1);
}

const zipBuffer = fs.readFileSync(zipPath);
const sha256 = createHash('sha256').update(zipBuffer).digest('hex');
const sizeMB = (zipBuffer.length / 1024 / 1024).toFixed(2);

const checksumFile = path.join(outDir, `${zipName}.sha256`);
fs.writeFileSync(checksumFile, `${sha256}  ${zipName}\n`);

console.log(`\n✅ Package created: ${zipPath}`);
console.log(`   Size: ${sizeMB} MB`);
console.log(`   SHA-256: ${sha256}`);
console.log(`   Checksum: ${checksumFile}\n`);

try {
    execSync(`node "${path.join(__dirname, 'validate-zip.js')}" "${zipPath}"`, { stdio: 'inherit' });
} catch {
    process.exit(1);
}
