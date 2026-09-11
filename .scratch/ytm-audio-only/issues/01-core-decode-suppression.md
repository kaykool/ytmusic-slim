# 01: Core Decode Suppression & Manifest V3 Scaffolding

**What to build:**
A loadable Chromium Manifest V3 extension that halts video stream decoding and plays audio uninterrupted across all YouTube Music songs and videos, maintaining 0 decoded video frames with zero persistent background memory.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] Extension loads unpacked in Chromium/Brave without manifest errors or warnings.
- [x] Injected script runs at `document_start` in `world: "MAIN"` on `music.youtube.com`.
- [x] Intercepts `MediaSource.prototype.addSourceBuffer` for `video/*` and diverts to `MockSourceBuffer`.
- [x] Retains InnerTube `streamingData` formats so tracks never fail format validation or loop skip.
- [x] `video.getVideoPlaybackQuality().totalVideoFrames` stays strictly at `0` during active playback.
- [x] Audio plays continuously across both standard audio tracks and official music videos.

## Answer

Implemented production Manifest V3 scaffolding and main-world media pipeline hook in `extension/manifest.json` and `extension/inject.js`.
- Intercepts `MediaSource.prototype.addSourceBuffer` to divert `video/*` streams to synthetic `MockSourceBuffer` returning `buffered = [0, 100000]`.
- Forces `deviceIsAudioOnly: true` on `Object.prototype` to switch Polymer player into audio preference without breaking InnerTube format schemas.
- Verified with automated test suite in `.scratch/ytm-audio-only/tests/test-ticket-01.js`.

