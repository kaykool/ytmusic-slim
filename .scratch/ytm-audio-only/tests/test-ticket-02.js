const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

console.log('--- Testing Ticket 02: Video Canvas Suppression & Static Album Art Presentation ---');

// 1. Validate styles.css exists and contains required selectors
const cssPath = path.resolve(__dirname, '../../../extension/styles.css');
assert(fs.existsSync(cssPath), 'styles.css must exist');
const cssContent = fs.readFileSync(cssPath, 'utf8');

assert(cssContent.includes('#song-video'), 'CSS must target #song-video');
assert(cssContent.includes('.html5-main-video'), 'CSS must target .html5-main-video');
assert(cssContent.includes('display: none !important'), 'CSS must hide video elements');
assert(cssContent.includes('#song-image'), 'CSS must target #song-image');
assert(cssContent.includes('object-fit: contain !important'), 'CSS must contain album art');
assert(cssContent.includes('#000'), 'CSS must specify #000 background');
console.log('✓ styles.css selectors and rules verified');

// 2. Validate manifest.json includes styles.css
const manifestPath = path.resolve(__dirname, '../../../extension/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const cssScript = manifest.content_scripts.find(cs => Array.isArray(cs.css) && cs.css.includes('styles.css'));
assert(cssScript, 'manifest.json must register styles.css in content_scripts');
assert.strictEqual(cssScript.run_at, 'document_start', 'styles.css run_at must be document_start');
console.log('✓ manifest.json declarative CSS registration verified');

// 3. Test thumbnail fallback sync and Trusted Types compliance
const injectPath = path.resolve(__dirname, '../../../extension/inject.js');
const injectCode = fs.readFileSync(injectPath, 'utf8');

assert(!injectCode.includes('innerHTML'), 'inject.js must not contain innerHTML');
assert(!injectCode.includes('outerHTML'), 'inject.js must not contain outerHTML');
assert(!injectCode.includes('document.write'), 'inject.js must not contain document.write');
console.log('✓ Trusted Types CSP compliance verified');

// Test thumbnail sync logic in DOM simulation
const fakeMainImg = { src: '' };
const fakePlayerBarImg = { src: 'https://lh3.googleusercontent.com/test-album-art=w544-h544-l90-rj' };

const mockDocument = {
  documentElement: {
    setAttribute: (k, v) => { mockDocument.documentElement[k] = v; },
    removeAttribute: (k) => { delete mockDocument.documentElement[k]; }
  },
  querySelector: (sel) => {
    if (sel.includes('#song-image img')) return fakeMainImg;
    if (sel.includes('ytmusic-player-bar')) return fakePlayerBarImg;
    return null;
  },
  querySelectorAll: () => [],
  addEventListener: () => {},
  readyState: 'complete'
};

const sandbox = {
  window: { localStorage: { getItem: () => 'true' } },
  document: mockDocument,
  MediaSource: { prototype: { addSourceBuffer: () => {} } },
  EventTarget: class {},
  Event: class { constructor(t) { this.type = t; } },
  MutationObserver: class { observe() {} },
  queueMicrotask: process.nextTick,
  console: console,
  Object: Object
};

vm.createContext(sandbox);
vm.runInContext(injectCode, sandbox);

// Verify data-ytm-audio-only is set on documentElement
assert.strictEqual(mockDocument.documentElement['data-ytm-audio-only'], 'true', 'data-ytm-audio-only attribute must be set on documentElement');

// Verify thumbnail sync copied URL
assert.strictEqual(fakeMainImg.src, fakePlayerBarImg.src, 'syncAlbumArt must populate main cover art from player bar thumbnail');
console.log('✓ Thumbnail fallback synchronization verified');
console.log('All Ticket 02 tests passed successfully.');
