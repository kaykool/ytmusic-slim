Type: research
Status: resolved
Blocked by: none

# Investigate YouTube Music media streaming pipeline and video suppression hook points

## Question

How does YouTube Music stream and demux video versus audio (MediaSource Extensions MSE vs HTMLMediaElement, `videoplayback` request URLs, itags, adaptive stream formats), and what reliable hook points exist (e.g. `declarativeNetRequest` rules on video mime types, intercepting `MediaSource.prototype.addSourceBuffer`, or removing video tracks) to completely prevent video chunk fetching and decoding without triggering player errors or stalling audio playback?

## Answer

Full research findings and primary source citations documented in [.scratch/ytm-audio-only/research/01-ytm-media-pipeline-mechanisms.md](file:///home/sw/1DEV/gemin/.scratch/ytm-audio-only/research/01-ytm-media-pipeline-mechanisms.md).

**Key Architectural Findings:**
1. **Streaming Model**: YouTube Music (`WEB_REMIX` client) streams decoupled audio and video elementary streams via Media Source Extensions (MSE) over Google Video CDN `videoplayback` endpoints. Discrete itags separate audio (140, 141, 249-251) from video (133-137, 242-248, 394-399).
2. **Network Blocking Failure**: Direct blocking of video requests (e.g. via `declarativeNetRequest`) causes player retry loops, network error overlays (`PB_ERR_NETWORK`), demuxer initialization deadlock (`ChunkDemuxer::pending_source_init_ids_`), and renderer underflow stalls (`RendererImpl::WaitingForEnoughData()`).
3. **Primary Hook (Upstream InnerTube Interception)**: In the page `MAIN` world at `document_start`, intercepting `window.ytInitialPlayerResponse` and `fetch`/`XHR` calls to `/youtubei/v1/player` to filter `streamingData.adaptiveFormats` down to `audio/*` makes the YTM player adapt natively to audio-only streaming. Zero video chunks are requested or downloaded.
4. **Secondary Hook (MSE Safety Net)**: Monkey-patching `MediaSource.prototype.addSourceBuffer` to divert any video MIME requests to a synthetic `MockSourceBuffer` ensures Chromium never registers a video `DemuxerStream`. `RendererImpl` initializes in audio-only mode (`video_renderer_ = nullptr`), completely bypassing video underflow checks and preventing GPU/VPU hardware decoding.
