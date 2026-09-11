const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

console.log('--- Testing Ticket 03: Toolbar Popup Toggle & Storage Synchronization ---');

// 1. Validate files exist
const extDir = path.resolve(__dirname, '../../../extension');
assert(fs.existsSync(path.join(extDir, 'popup/popup.html')), 'popup.html must exist');
assert(fs.existsSync(path.join(extDir, 'popup/popup.css')), 'popup.css must exist');
assert(fs.existsSync(path.join(extDir, 'popup/popup.js')), 'popup.js must exist');
assert(fs.existsSync(path.join(extDir, 'content.js')), 'content.js must exist');

// 2. Validate manifest.json registrations
const manifest = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'));
assert(manifest.action && manifest.action.default_popup === 'popup/popup.html', 'manifest must declare default_popup');
assert(manifest.permissions.includes('storage'), 'manifest must include storage permission');
const contentScript = manifest.content_scripts.find(cs => Array.isArray(cs.js) && cs.js.includes('content.js'));
assert(contentScript, 'manifest must declare content.js in content_scripts');
console.log('✓ Manifest popup and content script registrations verified');

// 3. Verify Trusted Types compliance
const popupJs = fs.readFileSync(path.join(extDir, 'popup/popup.js'), 'utf8');
const contentJs = fs.readFileSync(path.join(extDir, 'content.js'), 'utf8');

assert(!popupJs.includes('innerHTML') && !popupJs.includes('outerHTML') && !popupJs.includes('document.write'), 'popup.js must not contain HTML sinks');
assert(!contentJs.includes('innerHTML') && !contentJs.includes('outerHTML') && !contentJs.includes('document.write'), 'content.js must not contain HTML sinks');
console.log('✓ Trusted Types compliance verified for popup and content scripts');

// 4. Test popup.js toggle behavior
let storageData = {};
let reloadedTabs = [];

const mockStorage = {
  local: {
    get: (defaults, cb) => {
      cb({ audioOnlyEnabled: storageData.audioOnlyEnabled !== undefined ? storageData.audioOnlyEnabled : defaults.audioOnlyEnabled });
    },
    set: (data, cb) => {
      Object.assign(storageData, data);
      if (cb) cb();
    }
  },
  onChanged: {
    addListener: () => {}
  }
};

const mockTabs = {
  query: (queryInfo, cb) => {
    cb([{ id: 101, url: 'https://music.youtube.com/watch?v=123' }]);
  },
  reload: (tabId) => {
    reloadedTabs.push(tabId);
  }
};

const fakeCheckbox = {
  checked: true,
  listeners: {},
  addEventListener(name, fn) { this.listeners[name] = fn; }
};
const fakeStatus = { textContent: '' };
const fakeBadge = { textContent: '', style: {} };

const mockDocument = {
  getElementById: (id) => {
    if (id === 'toggle-checkbox') return fakeCheckbox;
    if (id === 'status-text') return fakeStatus;
    if (id === 'thermal-badge') return fakeBadge;
    return null;
  }
};

const popupSandbox = {
  document: mockDocument,
  chrome: { storage: mockStorage, tabs: mockTabs },
  console: console
};

vm.createContext(popupSandbox);
vm.runInContext(popupJs, popupSandbox);

// Verify initial state
assert.strictEqual(fakeCheckbox.checked, true, 'Checkbox should default to true');
assert.strictEqual(fakeStatus.textContent, 'Audio Only: ON', 'Status should be Audio Only: ON');
assert.strictEqual(fakeBadge.textContent, 'Cool Mode', 'Badge should be Cool Mode');

// Simulate toggle change to OFF
fakeCheckbox.checked = false;
fakeCheckbox.listeners['change']();

assert.strictEqual(fakeStatus.textContent, 'Audio Only: OFF', 'Status should be Audio Only: OFF');
assert.strictEqual(fakeBadge.textContent, 'Standard', 'Badge should be Standard');
assert.strictEqual(storageData.audioOnlyEnabled, false, 'Storage should be updated to false');
assert.deepStrictEqual(reloadedTabs, [101], 'Tab 101 should be reloaded upon toggling');
console.log('✓ Popup toggle state changes and tab reload verified');

// 5. Test content.js storage bridge behavior
let docAttrs = {};
let localStore = {};
let storageChangeListeners = [];

const contentMockDocument = {
  documentElement: {
    setAttribute: (k, v) => { docAttrs[k] = v; },
    removeAttribute: (k) => { delete docAttrs[k]; }
  }
};

const contentMockStorage = {
  local: {
    get: (defaults, cb) => {
      cb({ audioOnlyEnabled: storageData.audioOnlyEnabled !== undefined ? storageData.audioOnlyEnabled : defaults.audioOnlyEnabled });
    }
  },
  onChanged: {
    addListener: (fn) => { storageChangeListeners.push(fn); }
  }
};

const contentSandbox = {
  window: {
    localStorage: {
      setItem: (k, v) => { localStore[k] = String(v); },
      getItem: (k) => localStore[k] || null
    }
  },
  document: contentMockDocument,
  chrome: { storage: contentMockStorage },
  console: console
};

vm.createContext(contentSandbox);
vm.runInContext(contentJs, contentSandbox);

// Since storageData.audioOnlyEnabled was set to false above:
assert.strictEqual(localStore['ytm_audio_only_enabled'], 'false', 'localStorage should reflect false');
assert.strictEqual(docAttrs['data-ytm-audio-only'], undefined, 'data-ytm-audio-only attribute should be removed');

// Fire storage change listener turning it back ON
storageChangeListeners.forEach(fn => fn({ audioOnlyEnabled: { newValue: true } }, 'local'));
assert.strictEqual(localStore['ytm_audio_only_enabled'], 'true', 'localStorage should reflect true after storage change');
assert.strictEqual(docAttrs['data-ytm-audio-only'], 'true', 'data-ytm-audio-only attribute should be set after storage change');

console.log('✓ content.js storage bridge and dynamic attribute sync verified');
console.log('All Ticket 03 tests passed successfully.');
