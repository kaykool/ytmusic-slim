// Feedback loop to reproduce TrustedHTML innerHTML violation in prototype-hook.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function runTest() {
  const hookCode = fs.readFileSync(
    path.join(__dirname, '../prototype/prototype-hook.js'),
    'utf-8'
  );

  // Setup mock DOM environment enforcing Trusted Types on innerHTML
  const elements = [];
  const fakeElement = {
    id: '',
    style: { cssText: '' },
    appendChild(child) {
      elements.push(child);
      return child;
    },
    remove() {},
    get innerHTML() {
      return this._innerHTML || '';
    },
    set innerHTML(val) {
      // Emulate Chromium Trusted Types enforcement
      if (typeof val === 'string') {
        throw new TypeError(
          "Failed to set the 'innerHTML' property on 'Element': This document requires 'TrustedHTML' assignment."
        );
      }
      this._innerHTML = val;
    }
  };

  const fakeDocument = {
    readyState: 'complete',
    documentElement: {
      appendChild(child) {
        return child;
      }
    },
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        style: { cssText: '' },
        appendChild(child) { return child; },
        remove() {},
        get innerHTML() { return this._innerHTML || ''; },
        set innerHTML(val) {
          if (typeof val === 'string') {
            throw new TypeError(
              "Failed to set the 'innerHTML' property on 'Element': This document requires 'TrustedHTML' assignment."
            );
          }
          this._innerHTML = val;
        }
      };
    },
    createTextNode(text) {
      return {
        textContent: text
      };
    },
    getElementById(id) {
      return null;
    },
    querySelector(sel) {
      return null;
    },
    querySelectorAll(sel) {
      return [];
    },
    addEventListener() {}
  };

  const sandbox = {
    window: {
      fetch: () => {},
      MediaSource: function() {}
    },
    document: fakeDocument,
    console: {
      log: () => {},
      warn: () => {},
      error: () => {}
    },
    EventTarget: class {},
    Event: class {},
    MediaSource: function() {},
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    setInterval: () => {},
    queueMicrotask: (fn) => fn()
  };
  sandbox.MediaSource.prototype = {
    addSourceBuffer: () => {}
  };
  sandbox.window.MediaSource = sandbox.MediaSource;

  const context = vm.createContext(sandbox);
  vm.runInContext(hookCode, context);
}

try {
  runTest();
  console.log('PASS: No TrustedHTML violations detected.');
  process.exit(0);
} catch (err) {
  console.error('FAIL:', err.message);
  process.exit(1);
}
