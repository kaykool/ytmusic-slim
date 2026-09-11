# 04: Packaging, Icon Assets & Before-and-After Resource Benchmarking

**What to build:**
Production-ready extension distribution with standard icons (16px, 48px, 128px), automated regression tests, and a reproducible before-and-after resource benchmark measuring CPU, RAM, GPU video decode engine, and laptop temperature.

**Blocked by:** 02: Video Canvas Suppression & Static Album Art Presentation, 03: Toolbar Popup Toggle & Storage Synchronization

**Status:** ready-for-agent

- [ ] Clean directory structure containing all production files and valid PNG icon assets (16px, 48px, 128px).
- [ ] Automated test suite verifies manifest schema, script syntax, and Trusted Types compliance.
- [ ] Before-and-after resource benchmark documented:
  - Baseline (Stock YTM Video): record CPU%, GPU video decode engine %, RAM, and CPU package temp during active video playback.
  - With Extension (Audio-Only Active): record 0% GPU video decode engine, reduced CPU usage, and cool laptop temperature (< 50°C).
- [ ] Verification checklist completed and ready for distribution.
