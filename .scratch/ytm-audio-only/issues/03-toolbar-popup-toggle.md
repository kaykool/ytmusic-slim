# 03: Toolbar Popup Toggle & Storage Synchronization

**What to build:**
A dark-mode toolbar popup interface allowing users to toggle Audio-Only mode ON or OFF, with persistent state in `chrome.storage.local` and automatic tab reload.

**Blocked by:** 01: Core Decode Suppression & Manifest V3 Scaffolding

**Status:** ready-for-agent

- [ ] Clicking the extension icon opens a styled popup toggle switch.
- [ ] State defaults to `true` (Audio-Only ON) on initial install and persists in `chrome.storage.local`.
- [ ] Toggling the switch updates storage and cleanly reloads active `music.youtube.com` tabs.
- [ ] When toggled OFF, normal video playback and standard YouTube Music UI are restored.
- [ ] When toggled back ON, decode suppression and album art presentation reactivate immediately.
