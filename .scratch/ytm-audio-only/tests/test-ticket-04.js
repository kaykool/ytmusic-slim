const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing Ticket 04: Packaging, Icon Assets & Regression Suite ---');

const extDir = path.resolve(__dirname, '../../../extension');

// 1. Verify all required files exist
const requiredFiles = [
  'manifest.json',
  'inject.js',
  'content.js',
  'styles.css',
  'popup/popup.html',
  'popup/popup.css',
  'popup/popup.js',
  'icons/icon-16.png',
  'icons/icon-48.png',
  'icons/icon-128.png'
];

requiredFiles.forEach(file => {
  const filePath = path.join(extDir, file);
  assert(fs.existsSync(filePath), `Required extension file ${file} must exist`);
  const stat = fs.statSync(filePath);
  assert(stat.size > 0, `File ${file} must not be empty`);
});
console.log(`✓ All ${requiredFiles.length} distribution files present and non-empty`);

// 2. Validate manifest.json schema and referenced paths
const manifest = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'));
assert.strictEqual(manifest.manifest_version, 3, 'manifest_version must be 3');
assert.strictEqual(manifest.icons['16'], 'icons/icon-16.png');
assert.strictEqual(manifest.icons['48'], 'icons/icon-48.png');
assert.strictEqual(manifest.icons['128'], 'icons/icon-128.png');
assert.strictEqual(manifest.action.default_icon['16'], 'icons/icon-16.png');
assert.strictEqual(manifest.action.default_icon['48'], 'icons/icon-48.png');
assert.strictEqual(manifest.action.default_icon['128'], 'icons/icon-128.png');
console.log('✓ Manifest schema and icon paths validated');

// 3. Validate PNG magic bytes and dimensions
const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
[16, 48, 128].forEach(size => {
  const buf = fs.readFileSync(path.join(extDir, `icons/icon-${size}.png`));
  assert(buf.subarray(0, 8).equals(pngMagic), `icon-${size}.png must have valid PNG magic bytes`);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  assert.strictEqual(width, size, `icon-${size}.png width must be ${size}`);
  assert.strictEqual(height, size, `icon-${size}.png height must be ${size}`);
});
console.log('✓ PNG icon headers, dimensions, and signatures verified');

// 4. Static Trusted Types CSP audit
const jsFiles = ['inject.js', 'content.js', 'popup/popup.js'];
jsFiles.forEach(file => {
  const content = fs.readFileSync(path.join(extDir, file), 'utf8');
  assert(!content.includes('innerHTML'), `${file} must not contain innerHTML`);
  assert(!content.includes('outerHTML'), `${file} must not contain outerHTML`);
  assert(!content.includes('document.write'), `${file} must not contain document.write`);
});
console.log('✓ Trusted Types static audit passed for all scripts');

// 5. Calculate total package size
let totalBytes = 0;
requiredFiles.forEach(file => {
  totalBytes += fs.statSync(path.join(extDir, file)).size;
});
console.log(`✓ Total unzipped extension footprint: ${(totalBytes / 1024).toFixed(2)} KB (Target: < 2000 KB)`);
assert(totalBytes < 100 * 1024, 'Extension package must be under 100 KB');

console.log('All Ticket 04 packaging tests passed successfully.');
