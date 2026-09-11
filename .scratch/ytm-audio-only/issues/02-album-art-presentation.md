# 02: Video Canvas Suppression & Static Album Art Presentation

**What to build:**
Declarative CSS and thumbnail synchronization that cleanly hides the video container and renders high-resolution cover art centered in the player pane with zero GPU rendering overhead.

**Blocked by:** 01: Core Decode Suppression & Manifest V3 Scaffolding

**Status:** ready-for-agent

- [ ] Declarative CSS hides `#song-video`, `#player video`, and `.html5-main-video` completely.
- [ ] `#song-image` displays centered in the player pane with `object-fit: contain` over a black (`#000`) background.
- [ ] If track thumbnail is unpopulated on video tracks, fallback logic copies the thumbnail URL from `ytmusic-player-bar`.
- [ ] No black boxes, visual stutter, or video frame flashes occur during track transitions.
- [ ] All DOM modifications comply with YouTube's Trusted Types CSP (`require-trusted-types-for 'script'`).
