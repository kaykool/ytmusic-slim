(function () {
  'use strict';

  // Synchronize chrome.storage.local with page localStorage and DOM attribute
  function applyState(enabled) {
    try {
      window.localStorage.setItem('ytm_audio_only_enabled', enabled ? 'true' : 'false');
    } catch (e) {}

    if (enabled) {
      document.documentElement.setAttribute('data-ytm-audio-only', 'true');
    } else {
      document.documentElement.removeAttribute('data-ytm-audio-only');
    }
  }

  // Read initial configuration
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get({ audioOnlyEnabled: true }, function (res) {
      const isEnabled = res.audioOnlyEnabled !== false;
      applyState(isEnabled);
    });

    // Listen for storage changes from toolbar popup
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === 'local' && 'audioOnlyEnabled' in changes) {
        const isEnabled = changes.audioOnlyEnabled.newValue !== false;
        applyState(isEnabled);
      }
    });
  }
})();
