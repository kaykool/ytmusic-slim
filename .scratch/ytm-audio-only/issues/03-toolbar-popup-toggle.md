# 03: Toolbar Popup Toggle & Storage Synchronization

**What to build:**
A dark-mode toolbar popup interface allowing users to toggle Audio-Only mode ON or OFF, with persistent state in `chrome.storage.local` and automatic tab reload.

**Blocked by:** 01: Core Decode Suppression & Manifest V3 Scaffolding

**Status:** resolved

- [x] Clicking the extension icon opens a styled popup toggle switch.
- [x] State defaults to `true` (Audio-Only ON) on initial install and persists in `chrome.storage.local`.
- [x] Toggling the switch updates storage and cleanly reloads active `music.youtube.com` tabs.
- [x] When toggled OFF, normal video playback and standard YouTube Music UI are restored.
- [x] When toggled back ON, decode suppression and album art presentation reactivate immediately.

## Answer

Implemented dark-mode minimalist popup interface and storage synchronization in `extension/popup/` and `extension/content.js`:
- `popup.html`, `popup.css`, and `popup.js` provide a toggle switch with live status badge and state persisted in `chrome.storage.local`.
- Switching the toggle reloads active `music.youtube.com` tabs to reset the media pipeline.
- `content.js` bridges `chrome.storage.local` to `localStorage` and dynamic `data-ytm-audio-only` DOM attributes in the page.
- Adheres to Trusted Types CSP (0 HTML injection sinks).
- Verified with automated test suite in `.scratch/ytm-audio-only/tests/test-ticket-03.js`.

