# YouTube Music Audio-Only Resource & Verification Report

**Status:** Implementation verified; empirical side-by-side baseline pending live capture.  
**Extension Version:** 1.0.0  
**Package Size:** 15.85 KB unzipped  

---

## 1. Verified Implementation Facts

The following metrics are verified directly via code analysis and test execution:

| Area | Verification Mechanism | Observed Result |
| :--- | :--- | :--- |
| **Video Decoding** | `MediaSource.prototype.addSourceBuffer` hook | Video `SourceBuffer` diverted to `MockSourceBuffer`. `totalVideoFrames` evaluates to `0`. |
| **Media Pipeline** | Synthetic buffer range `[0, 100000]` | Prevents playback stalls and halts video chunk requests. Audio demuxing continues natively. |
| **Background Memory** | No background service worker declared in `manifest.json` | 0 MB background process RAM. |
| **CSP Compliance** | Static audit of all `.js` and `.html` files | 0 instances of `innerHTML`, `outerHTML`, or `document.write`. |
| **Extension Footprint** | Disk size of all extension distribution files | 15.85 KB total across all 10 assets (target: < 2,000 KB). |
| **Regression Suite** | Automated test harness (`tests/run-all.js`) | 4/4 suites pass (100%). |

---

## 2. Hardware Resource Metrics

### Current System Readings (Idle / Test State)
- **CPU Package Temperature (`k10temp`)**: ~47.0°C to 50.6°C
- **GPU Power (`amdgpu` PPT)**: ~9.6 W
- **GPU Edge Temperature**: ~47.0°C

### Comparative Baseline Status
- A side-by-side run comparing stock YouTube Music video (video decoding enabled) against the extension (audio-only mode) has not been captured in an isolated profiling run.
- Projections (e.g. CPU% drop, fan acoustic state) are theoretical expectations from eliminating video stream decoding, not empirical laboratory logs.
- To record empirical data, run `tools/benchmark.sh` while playing an official music video in standard mode versus audio-only mode.
