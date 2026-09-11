# YouTube Music Audio-Only Extension Specification

## 1. Executive Summary

A lightweight, zero-dependency Chromium extension (Chrome and Brave) that halts video streaming and decoding on YouTube Music (`music.youtube.com`). By intercepting the media pipeline at the `MediaSource` and player interface layers, the extension eliminates GPU and CPU video decoding overhead, maintaining cool laptop temperatures and low system resource consumption while preserving uninterrupted audio playback and high-resolution album art.

---

## 2. Goals & Performance Targets

- **Thermal & Resource Efficiency**: Eliminate hardware video decoding (0 decoded frames, 0 dropped frames). Keep laptop idle/playback thermals cool.
- **Minimal Footprint**: Total extension RAM footprint under 2 MB; zero background CPU utilization when audio is playing or paused.
- **Unbroken Playback**: Seamless playback across official album tracks (`ATV`), official music videos (`OMV`), and community uploads (`UGC`) without looping or "video format not supported" errors.
- **Trusted Types Compliance**: Zero CSP injection sink violations under YouTube's `require-trusted-types-for 'script'` policy.
- **User Control**: Fast toolbar popup toggle (default ON) with state stored in `chrome.storage.local`.

---

## 3. Architecture & Extension Design

### 3.1 Extension Manifest (Manifest V3)
- `manifest_version`: `3`
- `permissions`: `["storage"]`
- `host_permissions`: `["*://music.youtube.com/*"]`
- `content_scripts`:
  - `matches`: `["*://music.youtube.com/*"]`
  - `run_at`: `"document_start"`
  - `world`: `"MAIN"` for media pipeline hooks (`inject.js`)
  - Declarative stylesheet for zero-CPU DOM layout overrides (`styles.css`)
- `action`: Minimal popup (`popup/popup.html`)

### 3.2 File Structure
```
extension/
├── manifest.json
├── inject.js          # MAIN world script (MediaSource & player hooks)
├── content.js         # ISOLATED world script (bridge to chrome.storage)
├── styles.css         # Declarative CSS overrides
├── popup/
│   ├── popup.html     # Toggle interface
│   ├── popup.css      # Dark-mode minimalist styles
│   └── popup.js       # Storage read/write and tab reload trigger
└── icons/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

---

## 4. Technical Mechanisms

### 4.1 Decode Suppression Pipeline
1. **Payload Preservation**: The InnerTube API player response (`/youtubei/v1/player`) must retain its `streamingData` format descriptors. Stripping video formats from the response causes the YTM client to reject tracks as unplayable and loop skip.
2. **Player Audio-Mode Flagging**: Enforce `deviceIsAudioOnly: true` on `Object.prototype` and sync with `ytcfg` at `document_start`.
3. **Polymer Element Automation**:
   - `ytmusic-player-page`: Clear `video-mode` attribute; set `videoMode = false`.
   - `ytmusic-av-toggle`: Enforce `mustPlayAudioOnly = true`, `selectedItemHasVideo = false`, `playbackMode = 'ATV_PREFERRED'`, and trigger `onSongAvToggleTap()`.
4. **MediaSource Safety Net (`MockSourceBuffer`)**:
   - Monkey-patch `MediaSource.prototype.addSourceBuffer`.
   - When a MIME type starting with `video/` is requested, return a synthetic `MockSourceBuffer`.
   - The mock buffer implements the W3C `SourceBuffer` interface and reports a simulated `buffered` range spanning `[0, 100000]` seconds.
   - `appendBuffer` calls immediately resolve `update` and `updateend` via `queueMicrotask` and discard incoming video chunks.
   - **Chromium Pipeline Effect**: Native Chromium's `ChunkDemuxer` only registers `DemuxerStream::AUDIO`. In `RendererImpl::InitializeVideoRenderer`, `video_renderer_` is set to `nullptr`. No hardware or software video decoder is instantiated.

### 4.2 DOM & Album Art Presentation
1. **Video Suppression**:
   ```css
   ytmusic-player #song-video,
   #song-video,
   #player video,
   video.html5-main-video {
     display: none !important;
   }
   ```
2. **Album Art Centering**:
   ```css
   ytmusic-player #song-image,
   #song-image {
     display: flex !important;
     visibility: visible !important;
     opacity: 1 !important;
     align-items: center !important;
     justify-content: center !important;
     background-color: #000 !important;
   }
   ytmusic-player #song-image #thumbnail img,
   #song-image img#img {
     display: block !important;
     visibility: visible !important;
     opacity: 1 !important;
     max-width: 100% !important;
     max-height: 100% !important;
     object-fit: contain !important;
   }
   ```
3. **Thumbnail Synchronization**: If the central `#song-image` element has an empty source during video track playback, copy the thumbnail URL from the bottom player bar (`ytmusic-player-bar img`).

### 4.3 Extension Toggle & State Synchronization
1. **Default State**: Enabled (`audioOnlyEnabled: true`) on initial install.
2. **State Storage**: `chrome.storage.local`.
3. **Switching Logic**: When the user flips the toggle in the popup, write to `chrome.storage.local` and trigger `chrome.tabs.reload(tab.id)` on the active YouTube Music tab to cleanly reset the MediaSource pipeline.

---

## 5. Security & CSP Rules

- **Trusted Types**: In accordance with YouTube's `require-trusted-types-for 'script'` policy, no code may assign raw strings to `innerHTML`, `outerHTML`, or `document.write`.
- All DOM modifications must use safe methods: `document.createElement`, `document.createTextNode`, `appendChild`, and `textContent`.

---

## 6. Verification & Acceptance Criteria

1. **Decode Elimination**: `video.getVideoPlaybackQuality().totalVideoFrames === 0` throughout track playback. `chrome://media-internals` shows no active `video_decoder`.
2. **Audio Stability**: Uninterrupted playback across album tracks and official music videos with zero premature skips.
3. **Thermal Benchmark**: Verified reduction in CPU/GPU power consumption and stable laptop operating temperatures (< 50°C during extended playback).
4. **Visual Layout**: Video pane displays high-resolution centered album cover art over clean black backdrop.
