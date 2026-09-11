(function () {
  'use strict';

  const toggle = document.getElementById('toggle-checkbox');
  const statusText = document.getElementById('status-text');
  const thermalBadge = document.getElementById('thermal-badge');

  function renderState(enabled) {
    if (toggle) toggle.checked = enabled;
    if (statusText) statusText.textContent = enabled ? 'Audio Only: ON' : 'Audio Only: OFF';
    if (thermalBadge) {
      thermalBadge.textContent = enabled ? 'Cool Mode' : 'Standard';
      thermalBadge.style.color = enabled ? '#00e676' : '#888888';
      thermalBadge.style.background = enabled ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 255, 255, 0.08)';
    }
  }

  // Load persistent state from chrome.storage.local (defaults to true)
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get({ audioOnlyEnabled: true }, function (res) {
      const isEnabled = res.audioOnlyEnabled !== false;
      renderState(isEnabled);
    });
  }

  // Handle user toggling switch
  if (toggle) {
    toggle.addEventListener('change', function () {
      const newState = toggle.checked;
      renderState(newState);

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ audioOnlyEnabled: newState }, function () {
          // Cleanly reload YouTube Music tabs to reset MediaSource pipeline
          if (chrome.tabs && chrome.tabs.query) {
            chrome.tabs.query({ url: '*://music.youtube.com/*' }, function (tabs) {
              if (tabs && tabs.length > 0) {
                tabs.forEach(function (tab) {
                  if (tab.id) {
                    chrome.tabs.reload(tab.id);
                  }
                });
              }
            });
          }
        });
      }
    });
  }
})();
