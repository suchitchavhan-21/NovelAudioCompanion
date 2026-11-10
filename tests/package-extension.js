// Novel Audio Companion - Cross-Platform Extension Packager
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('📦 Packaging Novel Audio Companion for Store Distribution...\n');

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const version = manifest.version || '2.0.0';
const distDir = path.join(__dirname, '..', 'dist');
const zipFileName = `NovelAudioCompanion-v${version}.zip`;
const zipFilePath = path.join(distDir, zipFileName);

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Remove old zip if present
if (fs.existsSync(zipFilePath)) {
  fs.unlinkSync(zipFilePath);
}

// Files and folders required for Chrome & Edge extensions
const filesToBundle = [
  'manifest.json',
  'background.js',
  'content.js',
  'content.css',
  'README.md',
  'LICENSE',
  'icons',
  'popup',
  'options'
].filter(f => fs.existsSync(f));

console.log('Bundling assets:');
filesToBundle.forEach(f => console.log(`  + ${f}`));

try {
  const fileListStr = filesToBundle.map(f => `"${f}"`).join(' ');
  // Use bsdtar/tar on Windows/macOS/Linux which is built-in and lightning fast
  try {
    execSync(`tar -a -c -f "${zipFilePath}" ${fileListStr}`, { stdio: 'inherit' });
  } catch (_) {
    // Fallback to zip utility if tar -a is not available
    execSync(`zip -r -q "${zipFilePath}" ${fileListStr}`, { stdio: 'inherit' });
  }

  const stat = fs.statSync(zipFilePath);
  console.log(`\n✔ Package created successfully!`);
  console.log(`  File: ${zipFilePath}`);
  console.log(`  Size: ${(stat.size / 1024).toFixed(2)} KB`);
} catch (err) {
  console.error('\n❌ Packaging failed:', err.message);
  process.exit(1);
}
