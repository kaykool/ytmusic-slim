# 01: Core Decode Suppression & Manifest V3 Scaffolding

**What to build:**
A loadable Chromium Manifest V3 extension that halts video stream decoding and plays audio uninterrupted across all YouTube Music songs and videos, maintaining 0 decoded video frames with zero persistent background memory.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Extension loads unpacked in Chromium/Brave without manifest errors or warnings.
- [ ] Injected script runs at `document_start` in `world: "MAIN"` on `music.youtube.com`.
- [ ] Intercepts `MediaSource.prototype.addSourceBuffer` for `video/*` and diverts to `MockSourceBuffer`.
- [ ] Retains InnerTube `streamingData` formats so tracks never fail format validation or loop skip.
- [ ] `video.getVideoPlaybackQuality().totalVideoFrames` stays strictly at `0` during active playback.
- [ ] Audio plays continuously across both standard audio tracks and official music videos.
