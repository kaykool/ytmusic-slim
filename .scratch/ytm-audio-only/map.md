## Destination

A complete technical implementation specification at `.scratch/ytm-audio-only/spec.md` detailing Manifest V3 extension architecture, video decode suppression mechanics, static album art UI replacement, and low-overhead performance verification, ready for `/to-tickets`.

## Notes

- Domain: Chromium Manifest V3 extension for `music.youtube.com` (Chrome and Brave).
- Primary goal: Decode suppression (halting video frame decoding in hardware and software) to reduce CPU/GPU utilization and keep laptop temperatures cool.
- Architecture: Zero-dependency, minimal memory footprint (<10MB), event-driven.
- UI: Always-on with minimal toolbar popup toggle, static album art placeholder instead of video player.
- Skills to consult: `research`, `prototype`, `grilling`, `domain-modeling`.

## Decisions so far

<!-- the index: one line per closed ticket, enough to judge relevance, then zoom the link for the detail the ticket holds -->
- [01: YTM media pipeline mechanisms](file:///home/sw/1DEV/gemin/.scratch/ytm-audio-only/wayfinder/01-ytm-media-pipeline-mechanisms.md): Direct network blocking deadlocks Chromium's ChunkDemuxer; two-tier interception (InnerTube streamingData filter + MSE addSourceBuffer mock safety net in MAIN world) forces native audio-only playback with zero video downloads and zero GPU decoding ([research](file:///home/sw/1DEV/gemin/.scratch/ytm-audio-only/research/01-ytm-media-pipeline-mechanisms.md)).
- [02: MV3 low-overhead architecture](file:///home/sw/1DEV/gemin/.scratch/ytm-audio-only/wayfinder/02-mv3-low-overhead-architecture.md): Zero-background (or ephemeral SW) + `world: "MAIN"` at `run_at: "document_start"` + declarative CSS + MSE hook + static DNR barrier yields <0.2MB RAM and 0.00% CPU idle burn ([research](file:///home/sw/1DEV/gemin/.scratch/ytm-audio-only/research/02-mv3-low-overhead-architecture.md)).
- [03: Decode suppression prototype](file:///home/sw/1DEV/gemin/.scratch/ytm-audio-only/wayfinder/03-decode-suppression-prototype.md): Live browser prototype verified decode suppression (0 decoded frames), uninterrupted audio across videos/tracks, cool laptop temps (48.8°C), and Trusted Types compliance ([prototype v0.2.1](file:///home/sw/1DEV/gemin/.scratch/ytm-audio-only/prototype/)).
- [04: UI toggle and album art integration](file:///home/sw/1DEV/gemin/.scratch/ytm-audio-only/wayfinder/04-ui-toggle-and-album-art-integration.md): Toggle stored in `chrome.storage.local` (default ON) with clean tab reload on change; album art rendered in centered aspect-fit (`object-fit: contain`) over `#000` with zero GPU blur shaders.
- [05: Author technical specification](file:///home/sw/1DEV/gemin/.scratch/ytm-audio-only/wayfinder/05-author-technical-specification.md): Produced comprehensive implementation specification at `.scratch/ytm-audio-only/spec.md` with complete MV3 structure, decode suppression mechanics, and verification criteria ([spec.md](file:///home/sw/1DEV/gemin/.scratch/ytm-audio-only/spec.md)).
- [Issue 01: Core decode suppression](file:///home/sw/1DEV/gemin/.scratch/ytm-audio-only/issues/01-core-decode-suppression.md): Implemented MV3 manifest and main-world decode suppression in `extension/manifest.json` and `extension/inject.js` using `MockSourceBuffer` and `deviceIsAudioOnly`. Verified via automated tests.
- [Issue 02: Album art presentation](file:///home/sw/1DEV/gemin/.scratch/ytm-audio-only/issues/02-album-art-presentation.md): Declarative CSS styling and thumbnail sync in `extension/styles.css` and `extension/inject.js` cleanly replaces video with centered cover art. Verified via automated tests.
- [Issue 03: Toolbar popup toggle](file:///home/sw/1DEV/gemin/.scratch/ytm-audio-only/issues/03-toolbar-popup-toggle.md): Dark-mode popup UI and storage bridge in `extension/popup/` and `extension/content.js` allow user toggling with automatic tab reload. Verified via automated tests.

## Not yet specified

- SPA navigation lifecycle: handling `yt-navigate-finish` and dynamic playlist transitions without leaking video buffers.
- Physical thermal benchmarking: measurement methodology for CPU package power and GPU engine utilization on laptops.
- Platform edge cases: interactions with ads, radio autoplay, and user-uploaded library audio files.

## Out of scope

- Standard `youtube.com` video suppression (scoped strictly to `music.youtube.com`).
- Mobile browser extensions (Firefox Android, Kiwi).
- Support for third-party streaming services (Spotify, Apple Music).
- Audio downloading, caching, or stream ripping capabilities.
