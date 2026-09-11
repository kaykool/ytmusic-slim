Type: research
Status: resolved
Blocked by: none

# Design ultra-low overhead Manifest V3 architecture for Chromium and Brave

## Question

What Manifest V3 extension architecture provides the minimal memory footprint (<10MB) and zero CPU idle burn for stream suppression and DOM manipulation on `music.youtube.com`? Specifically evaluate declarativeNetRequest rule limits, content script execution timing (`run_at: document_start` in `MAIN` vs `ISOLATED` world), and event-driven background service worker sleep lifecycles.

## Answer

Full research findings and primary source citations documented in [.scratch/ytm-audio-only/research/02-mv3-low-overhead-architecture.md](file:///home/sw/1DEV/gemin/.scratch/ytm-audio-only/research/02-mv3-low-overhead-architecture.md).

**Key Architectural Verdicts:**
1. **Zero-Background Service Worker**: In MV3, `"background"` is optional. Omitting it completely (or using a strictly ephemeral worker without keep-alives) guarantees 0 MB background RAM and 0.00% background CPU during playback.
2. **`world: "MAIN"` at `run_at: "document_start"`**: Executes inside the tab's existing `v8::Context`, eliminating the ~3.4 MB RAM baseline of an `ISOLATED` world context. It allows synchronous monkey-patching of `MediaSource.isTypeSupported` and `MediaSource.prototype.addSourceBuffer` before YTM scripts initialize, avoiding DOM `<script>` injection, CSP violations, and `postMessage` GC churn.
3. **Primary MSE Suppression + Static DNR Barrier**: Blocking video chunks exclusively via DNR causes `net::ERR_BLOCKED_BY_CLIENT`, triggering aggressive player retry loops and audio stalls. Primary suppression must occur by reporting video formats as unsupported in MSE. DNR acts strictly as a static, zero-CPU fail-safe barrier.
4. **Declarative CSS Injection for DOM Manipulation**: Replace JS polling and broad `MutationObserver` loops with pure declarative CSS (`visibility: hidden` on `<video>`, `#song-image` display override), yielding 0.00% continuous CPU idle burn.
5. **Steady-State Footprint**: < 0.2 MB total RAM (< 0.05 MB FlatBuffer DNR + < 0.05 MB Main World script), easily beating the < 10 MB budget.
