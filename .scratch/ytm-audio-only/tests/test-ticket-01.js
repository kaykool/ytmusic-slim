const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

console.log('--- Testing Ticket 01: Core Decode Suppression & Manifest V3 Scaffolding ---');

// 1. Validate manifest.json
const manifestPath = path.resolve(__dirname, '../../../extension/manifest.json');
assert(fs.existsSync(manifestPath), 'manifest.json must exist');
const manifestContent = fs.readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(manifestContent);

assert.strictEqual(manifest.manifest_version, 3, 'manifest_version must be 3');
assert(manifest.name, 'manifest must have a name');
assert(manifest.version, 'manifest must have a version');
assert(Array.isArray(manifest.content_scripts), 'manifest must have content_scripts');

const mainScript = manifest.content_scripts.find(cs => cs.world === 'MAIN');
assert(mainScript, 'must have content_script with world: MAIN');
assert.strictEqual(mainScript.run_at, 'document_start', 'run_at must be document_start');
assert(mainScript.js.includes('inject.js'), 'content script js must include inject.js');
console.log('✓ manifest.json validation passed');

// 2. Validate inject.js syntax and lack of Trusted Types violations
const injectPath = path.resolve(__dirname, '../../../extension/inject.js');
assert(fs.existsSync(injectPath), 'inject.js must exist');
const injectCode = fs.readFileSync(injectPath, 'utf8');

// Check no innerHTML / outerHTML / document.write
assert(!injectCode.includes('innerHTML'), 'inject.js must not contain innerHTML');
assert(!injectCode.includes('outerHTML'), 'inject.js must not contain outerHTML');
assert(!injectCode.includes('document.write'), 'inject.js must not contain document.write');
console.log('✓ Trusted Types CSP check passed (no forbidden HTML assignment sinks)');

// 3. Test execution and MockSourceBuffer behavior in simulated browser environment
const mockMediaSource = {
  prototype: {
    addSourceBuffer(type) {
      return { native: true, type };
    }
  }
};

const mockLocalStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); }
};

const mockDocument = {
  querySelectorAll: () => [],
  addEventListener: () => {},
  documentElement: {},
  readyState: 'complete'
};

const mockWindow = {
  localStorage: mockLocalStorage
};

const sandbox = {
  window: mockWindow,
  document: mockDocument,
  MediaSource: mockMediaSource,
  EventTarget: class {
    constructor() { this._listeners = {}; }
    addEventListener(name, fn) { (this._listeners[name] = this._listeners[name] || []).push(fn); }
    dispatchEvent(evt) { (this._listeners[evt.type] || []).forEach(fn => fn(evt)); }
  },
  Event: class { constructor(type) { this.type = type; } },
  MutationObserver: class {
    observe() {}
    disconnect() {}
  },
  queueMicrotask: process.nextTick,
  console: console,
  Object: Object
};

vm.createContext(sandbox);
vm.runInContext(injectCode, sandbox);

// Verify deviceIsAudioOnly property
const dummyObj = {};
assert.strictEqual(dummyObj.deviceIsAudioOnly, true, 'deviceIsAudioOnly must evaluate to true on any Object');

// Verify MediaSource interception
const fakeMs = {};
const videoBuffer = sandbox.MediaSource.prototype.addSourceBuffer.call(fakeMs, 'video/webm; codecs="vp9"');
assert(videoBuffer, 'video SourceBuffer must be created');
assert.strictEqual(videoBuffer.native, undefined, 'video buffer must NOT be native');
assert.strictEqual(typeof videoBuffer.appendBuffer, 'function', 'MockSourceBuffer must implement appendBuffer');

// Verify buffered range returns [0, 100000]
const buffered = videoBuffer.buffered;
assert.strictEqual(buffered.length, 1, 'buffered.length must be 1');
assert.strictEqual(buffered.start(0), 0, 'buffered start must be 0');
assert.strictEqual(buffered.end(0), 100000, 'buffered end must be 100000');

// Verify audio buffer remains native
const audioBuffer = sandbox.MediaSource.prototype.addSourceBuffer.call(fakeMs, 'audio/webm; codecs="opus"');
assert.strictEqual(audioBuffer.native, true, 'audio buffer must remain native');
assert.strictEqual(audioBuffer.type, 'audio/webm; codecs="opus"');

console.log('✓ MediaSource prototype hook and MockSourceBuffer verified');
console.log('All Ticket 01 tests passed successfully.');
