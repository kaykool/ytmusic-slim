# YouTube Music Media Pipeline & Video Decode Suppression Research

## Executive Summary

YouTube Music on desktop browsers exclusively utilizes **Media Source Extensions (MSE)** over an HTML5 `<video>` element, receiving decoupled, server-demuxed audio and video elementary streams from Google Video CDN endpoints (`videoplayback`). 

Direct network-level blocking of video requests (e.g. via Manifest V3 `declarativeNetRequest`) **fatally breaks playback**. It violates Chromium's demuxer initialization barrier (`ChunkDemuxer::pending_source_init_ids_`) and triggers renderer underflow (`RendererImpl::WaitingForEnoughData()`), resulting in immediate audio stalls and fatal player errors (`PB_ERR_NETWORK`).

The most reliable, zero-overhead suppression architecture employs a **two-tier interception strategy in the page `MAIN` world**:
1. **Primary Hook (Upstream Preemption)**: Intercept the InnerTube player response (`window.ytInitialPlayerResponse` and `fetch`/`XHR` calls to `/youtubei/v1/player`) to filter `streamingData.adaptiveFormats` down to audio-only streams (`mimeType.startsWith('audio/')`) and wipe `streamingData.formats`. YouTube Music's `WEB_REMIX` player natively adapts to audio-only streams, preventing video `SourceBuffer` creation and eliminating 100% of video chunk network requests.
2. **Secondary Hook (MSE Safety Net)**: Monkey-patch `MediaSource.prototype.addSourceBuffer`. If a video MIME type is requested (e.g. for forced video tracks or fallback paths), return a synthetic `MockSourceBuffer` while passing audio through to native MSE. Because native Chromium never registers a video `DemuxerStream`, `RendererImpl` initializes in audio-only mode (`video_renderer_ = nullptr`), completely bypassing video underflow checks and preventing pipeline stalls, while eliminating GPU/VPU hardware decoding.

---

## 1. YouTube Music Media Delivery Architecture

### 1.1 MSE vs. Single-File HTMLMediaElement
Desktop YouTube Music (`music.youtube.com`) streams media via **Media Source Extensions (MSE)** rather than pointing the `<video>` element's `src` to a static progressive container URL.
- The player instantiates a JavaScript `MediaSource` object.
- A virtual blob URI is created via `URL.createObjectURL(mediaSource)` and assigned to the `<video>` element:
  ```javascript
  // Native YouTube Music player initialization pattern
  const mediaSource = new MediaSource();
  videoElement.src = URL.createObjectURL(mediaSource);
  ```
- Playback synchronization, segment fetching, adaptive bitrate (ABR) switching, and buffer eviction are managed entirely by YouTube's JavaScript player application running on top of Polymer / Lit elements (`<ytmusic-player id="player">`).

### 1.2 InnerTube API & Stream Negotiation
Before streaming begins, the web application requests media stream metadata and authorization tokens from YouTube's internal API (InnerTube):
- **Endpoint**: `POST https://music.youtube.com/youtubei/v1/player?key={INNERTUBE_API_KEY}`
- **Client Context**: `WEB_REMIX` (Client Version e.g. `1.2024xxxx.xx.xx`).
- **Response Structure**:
  - `videoDetails`: Metadata including `videoId`, `title`, `author`, and `musicVideoType`.
    - `MUSIC_VIDEO_TYPE_ATV` (Audio Track Video): Official studio recording delivered with static album cover or simple visualizer.
    - `MUSIC_VIDEO_TYPE_OMV` (Official Music Video): Official music video containing high-definition narrative video.
    - `MUSIC_VIDEO_TYPE_UGC` (User Generated Content): Community upload or live capture.
  - `streamingData`: Contains stream definitions split into two arrays:
    1. `formats`: Legacy progressive muxed streams (both audio and video in a single MP4 container).
    2. `adaptiveFormats`: Disaggregated elementary streams designed for DASH and MSE chunked delivery.

### 1.3 `videoplayback` URL Anatomy & Format Separation
In DASH/MSE streaming, audio and video are segregated at source. The client requests independent chunk segments using discrete HTTP GET requests to Google Video nodes (`*.googlevideo.com/videoplayback`).

A typical `videoplayback` request URL contains key query parameters:

| Parameter | Purpose | Example Value |
|:---|:---|:---|
| `itag` | Numeric identifier specifying container, codec, resolution/bitrate | `itag=140` (Audio), `itag=247` (Video) |
| `mime` | MIME type with container format | `mime=audio%2Fmp4`, `mime=video%2Fwebm` |
| `range` | Byte range requested for chunk streaming | `range=0-131071` (Init segment), `range=131072-524287` |
| `rn` / `sq` | Request number / sequence chunk counter | `rn=1`, `sq=12` |
| `clen` | Total content length in bytes for this specific elementary stream | `clen=34567890` |
| `gir` | Group of Pictures (GOP) index boundary marker | `gir=yes` |
| `dur` | Segment duration in seconds | `dur=5.000` |
| `lmt` | Last modified timestamp of media asset | `lmt=1698765432` |
| `expire`, `ei`, `ip`, `id` | Security, session token, client IP binding, and stream ID | Cryptographic tokens |

### 1.4 YouTube Streaming itag Taxonomy

#### Adaptive Audio Streams (`adaptiveFormats`)
| itag | Container | Codec | Target Bitrate | Sample Rate | Typical Use in YTM |
|:---:|:---:|:---:|:---:|:---:|:---|
| **140** | MP4 (`audio/mp4`) | AAC-LC (`mp4a.40.2`) | ~128 kbps | 44.1 kHz | Default standard quality audio |
| **141** | MP4 (`audio/mp4`) | AAC-LC (`mp4a.40.2`) | ~256 kbps | 44.1 kHz | High quality audio (Premium tier) |
| **249** | WebM (`audio/webm`) | Opus (`opus`) | ~50 kbps | 48.0 kHz | Low bitrate fallback |
| **250** | WebM (`audio/webm`) | Opus (`opus`) | ~70 kbps | 48.0 kHz | Medium bitrate fallback |
| **251** | WebM (`audio/webm`) | Opus (`opus`) | ~160 kbps | 48.0 kHz | High quality Opus stream |

#### Adaptive Video Streams (`adaptiveFormats`)
| itag | Container | Codec | Resolution | Framerate | Notes |
|:---:|:---:|:---:|:---:|:---:|:---|
| **160** | MP4 (`video/mp4`) | H.264 (`avc1.4d400c`) | 144p | 30 fps | Minimum video resolution |
| **133** | MP4 (`video/mp4`) | H.264 (`avc1.4d4015`) | 240p | 30 fps | Low resolution |
| **134** | MP4 (`video/mp4`) | H.264 (`avc1.4d401e`) | 360p | 30 fps | Standard definition |
| **135** | MP4 (`video/mp4`) | H.264 (`avc1.4d401f`) | 480p | 30 fps | Standard definition |
| **136** | MP4 (`video/mp4`) | H.264 (`avc1.4d401f`) | 720p | 30 fps | High definition |
| **137** | MP4 (`video/mp4`) | H.264 (`avc1.640028`) | 1080p | 30 fps | Full high definition |
| **278** | WebM (`video/webm`) | VP9 (`vp9` / `vp09`) | 144p | 30 fps | WebM minimal resolution |
| **242–248** | WebM (`video/webm`) | VP9 (`vp9` / `vp09`) | 240p–1080p | 30 fps | Default Chromium video formats |
| **394–399** | MP4 (`video/mp4`) | AV1 (`av01`) | 144p–1080p | 30 fps | Next-gen AV1 video formats |

#### Legacy Progressive Muxed Streams (`formats`)
| itag | Container | Video Codec | Resolution | Audio Codec | Audio Bitrate |
|:---:|:---:|:---:|:---:|:---:|:---:|
| **18** | MP4 | H.264 Baseline | 360p | AAC-LC | ~96 kbps |
| **22** | MP4 | H.264 High | 720p | AAC-LC | ~192 kbps |

---

## 2. Chromium Media Pipeline & Synchronization Mechanics

Understanding how Chromium demuxes, decodes, and renders media reveals why crude suppression methods fail and why targeted stream removal succeeds.

### 2.1 Media Engine Architecture
In Chromium, an HTML `<video>` element with an attached `MediaSource` delegates execution to Blink's `WebMediaPlayerImpl`:
1. `WebMediaPlayerImpl` (`third_party/blink/renderer/platform/media/web_media_player_impl.cc`) instantiates a `media::ChunkDemuxer` (`media/filters/chunk_demuxer.cc`) to serve as the `MediaResource`.
2. When JavaScript calls `mediaSource.addSourceBuffer(mimeType)`, Blink maps this to `ChunkDemuxer::AddId()`.
3. `ChunkDemuxer` instantiates a stream parser (e.g. `StreamParserFactory::Create`) based on container and codecs, creating corresponding `DemuxerStream` instances (`DemuxerStream::AUDIO` and `DemuxerStream::VIDEO`).

### 2.2 The Demuxer Initialization Barrier (`pending_source_init_ids_`)
In `media/filters/chunk_demuxer.cc`:
- When a `SourceBuffer` is registered via `AddId()`, its ID is added to a tracking set:
  ```cpp
  // ChunkDemuxer tracks all registered source buffers awaiting init
  pending_source_init_ids_.insert(source_id);
  ```
- When chunks are appended, the parser processes the **initialization segment** (`ftyp`+`moov` in MP4, `EBML`+`Segment Header`+`Tracks` in WebM). Once parsed, `ChunkDemuxer::OnSourceInitDone` is invoked:
  ```cpp
  // media/filters/chunk_demuxer.cc
  void ChunkDemuxer::OnSourceInitDone(
      const std::string& source_id,
      const StreamParser::InitParameters& params) {
    ...
    // Wait until all streams have initialized.
    pending_source_init_ids_.erase(source_id);
    if (!pending_source_init_ids_.empty())
      return;

    ChangeState_Locked(INITIALIZED);
    RunInitCB_Locked(PIPELINE_OK);
  }
  ```
> [!CRITICAL]
> **The Initialization Barrier**: If JavaScript creates both an audio `SourceBuffer` and a video `SourceBuffer`, `pending_source_init_ids_` contains both IDs. `ChunkDemuxer` will **refuse to complete demuxer initialization** until initialization segments are parsed on **both** buffers. If video chunk requests are blocked or dropped at the network layer, `pending_source_init_ids_` never clears, `init_cb_` is never fired, `HTMLMediaElement.readyState` remains `HAVE_NOTHING` (0), and audio playback **never starts**.

### 2.3 Underflow Synchronization & Playback Pausing
Once initialized, `media::RendererImpl` (`media/renderers/renderer_impl.cc`) manages playback:
- Chromium's master clock is driven by audio hardware via `AudioRendererImpl` (`TimeSource` / `AudioClock`).
- `VideoRendererImpl` synchronizes video frames against the audio clock.
- In `RendererImpl::WaitingForEnoughData()`:
  ```cpp
  // media/renderers/renderer_impl.cc
  bool RendererImpl::WaitingForEnoughData() const {
    DCHECK(task_runner_->RunsTasksInCurrentSequence());
    if (state_ != STATE_PLAYING)
      return false;
    if (audio_renderer_ && audio_buffering_state_ != BUFFERING_HAVE_ENOUGH)
      return true;
    if (video_renderer_ && video_buffering_state_ != BUFFERING_HAVE_ENOUGH)
      return true;
    return false;
  }
  ```
- When `WaitingForEnoughData()` returns `true`:
  ```cpp
  // Renderer underflowed.
  if (!was_waiting_for_enough_data && WaitingForEnoughData()) {
    PausePlayback();
    client_->OnBufferingStateChange(BUFFERING_HAVE_NOTHING, reason);
    return;
  }
  ```
> [!IMPORTANT]
> **Video Starvation Stalls Audio**: If a video `SourceBuffer` exists, `video_renderer_` is active. If video chunk delivery halts, `video_buffering_state_` collapses to `BUFFERING_HAVE_NOTHING`. `WaitingForEnoughData()` evaluates to `true`, immediately calling `PausePlayback()`. Chromium pauses the audio output device, freezing the track.

### 2.4 The Native Audio-Only Pipeline Path
In `RendererImpl::InitializeVideoRenderer()` (`media/renderers/renderer_impl.cc`):
```cpp
void RendererImpl::InitializeVideoRenderer() {
  DemuxerStream* video_stream =
      media_resource_->GetFirstStream(DemuxerStream::VIDEO);

  if (!video_stream) {
    video_renderer_.reset();

    if (!audio_renderer_) {
      FinishInitialization(PIPELINE_ERROR_COULD_NOT_RENDER);
      return;
    }

    task_runner_->PostTask(
        FROM_HERE, base::BindOnce(&RendererImpl::OnVideoRendererInitializeDone,
                                  weak_this_, PIPELINE_OK));
    return;
  }
  ...
}
```
When `ChunkDemuxer` contains **only an audio stream** (because no video `SourceBuffer` was ever attached):
1. `video_stream` is `nullptr`.
2. `video_renderer_.reset()` ensures `video_renderer_` is null.
3. Initialization finishes cleanly with `PIPELINE_OK`.
4. In `RendererImpl::WaitingForEnoughData()`, the clause `if (video_renderer_ && ...)` is completely skipped.
5. The pipeline operates as a pure audio presentation:
   - Zero video decoder allocation (no VPU/GPU hardware decoders or software threads).
   - Zero video frame allocations in shared memory.
   - Zero compositor work or draw calls for video frames.
   - Complete immunity to video underflow stalls.

---

## 3. Evaluation of Candidate Hook Points

| Hook Point | Technique | Network Savings | Decode Savings | Stalling Risk | Player Error Risk | Verdict |
|:---|:---|:---:|:---:|:---:|:---:|:---|
| **1. DNR Network Rule** | Block `videoplayback` with `mime=video` | 100% | 100% | **Fatal (100%)** | **Fatal (100%)** | **Unviable** |
| **2. MediaTrack API** | `video.videoTracks[0].selected = false` | 0% | 0% | None | None | **Ineffective** |
| **3. Codec Spoofing** | `MediaSource.isTypeSupported` = `false` for video | 0% | 0% | Low | High (Error/Fallback) | **Unviable** |
| **4. Throwing `addSourceBuffer`** | Throw `NotSupportedError` on video MIME | 100% | 100% | High | High (Uncaught Exception) | **Unreliable** |
| **5. Mock `addSourceBuffer`** | Return synthetic `SourceBuffer` for video | 0–100% | 100% | **Zero** | **Zero** | **Reliable (Safety Net)** |
| **6. Intercept `streamingData`** | Filter `adaptiveFormats` to audio-only | **100%** | **100%** | **Zero** | **Zero** | **Optimal (Primary)** |

### 3.1 Hook Point 1: DeclarativeNetRequest (DNR) Rules on Video Requests
- **Mechanics**: Register an MV3 declarative rule matching `*://*.googlevideo.com/videoplayback*` with condition `urlFilter` matching video itags or `mime=video/*`, action: `{ type: "block" }`.
- **Primary Failure Modes**:
  1. *Player Crash*: Chromium returns `net::ERR_BLOCKED_BY_CLIENT` to the player's fetch loop. The YouTube player retries with exponential backoff before firing an unrecoverable `PB_ERR_NETWORK` error and halting.
  2. *Demuxer Barrier Deadlock*: As demonstrated in Section 2.2, `ChunkDemuxer` awaits the video initialization segment in `pending_source_init_ids_`. Because the request is blocked, initialization never completes. The media element never leaves `HAVE_NOTHING`, and audio never starts.
  3. *Underflow Pause*: If only subsequent chunks are blocked, `video_buffering_state_` underflows to `BUFFERING_HAVE_NOTHING`, causing `RendererImpl::PausePlayback()` to freeze audio.
- **Conclusion**: Unusable as a standalone mechanism.

### 3.2 Hook Point 2: HTMLMediaElement Track Disabling (`videoTracks`)
- **Mechanics**: Enumerate `videoElement.videoTracks` and set `selected = false`.
- **Primary Failure Modes**:
  1. *Platform Availability*: The W3C `AudioTrackList` and `VideoTrackList` APIs remain disabled by default or behind experimental flags in standard Chromium desktop releases.
  2. *Zero Pipeline Relief*: Disabling a video track in the DOM does not affect `ChunkDemuxer` or the JavaScript fetcher. The YouTube player continues downloading video chunks over the network and pushing them into `SourceBuffer.appendBuffer()`, leaving CPU, GPU, and memory consumption unchanged.
- **Conclusion**: Ineffective for bandwidth and decode suppression.

### 3.3 Hook Point 3: Spoofing `MediaSource.isTypeSupported`
- **Mechanics**: Intercept `window.MediaSource.isTypeSupported` to return `false` whenever a video MIME type (`video/mp4`, `video/webm`) is queried.
- **Primary Failure Modes**:
  1. YouTube's player uses `isTypeSupported` to construct its supported format ladder. If all MSE video formats return `false`, the player does not convert into an audio-only MSE mode.
  2. Instead, the player attempts fallback to progressive muxed formats from `streamingData.formats` (itags 18 and 22). These muxed formats still contain video tracks and force hardware decoding.
  3. If progressive video is also blocked via `HTMLMediaElement.canPlayType`, the player triggers a fatal error banner: *"Your browser does not currently recognize any of the video formats available."*
- **Conclusion**: Fails to trigger an audio-only playback state.

### 3.4 Hook Point 4: Intercepting `MediaSource.prototype.addSourceBuffer`
- **Mechanics**: Monkey-patch `MediaSource.prototype.addSourceBuffer` in the page `MAIN` world:
  ```javascript
  const nativeAddSourceBuffer = MediaSource.prototype.addSourceBuffer;
  MediaSource.prototype.addSourceBuffer = function(mimeType) {
    if (mimeType.startsWith('video/')) {
      return new MockSourceBuffer(this, mimeType);
    }
    return nativeAddSourceBuffer.call(this, mimeType);
  };
  ```
- **Throwing `NotSupportedError` vs Mocking**:
  - Throwing an exception (`DOMException`) breaks the player because YouTube's player does not wrap `addSourceBuffer` in a fallback `try...catch` block.
  - **Returning a Mock `SourceBuffer`**:
    - The synthetic `MockSourceBuffer` implements the W3C `SourceBuffer` interface: `appendBuffer`, `abort`, `remove`, `addEventListener`, `removeEventListener`, `updating`, and `buffered`.
    - When `appendBuffer(buffer)` is invoked, the mock drops the bytes immediately, schedules a microtask to fire `updatestart`, sets `updating = false`, and dispatches `update` and `updateend`.
    - It reports a simulated `buffered` range spanning far ahead of `video.currentTime` (e.g. `[0, 100000]`).
- **Pipeline Consequence**:
  - Native Chromium only receives `addSourceBuffer` for audio.
  - `ChunkDemuxer` initializes with only `DemuxerStream::AUDIO`.
  - Chromium initializes `AudioRendererImpl` and sets `video_renderer_ = nullptr`.
  - Zero video frames are decoded, eliminating all GPU/VPU decoding overhead.
  - Audio plays with zero stall risk.
- **Network Considerations**: While decode is eliminated, the player's JavaScript fetch loop may still issue chunk requests unless its ABR buffer logic is satisfied by the mock `buffered` ranges, or combined with network preemption.

### 3.5 Hook Point 5: Preemptive Player Response Interception (`adaptiveFormats`)
- **Mechanics**: YouTube Music operates on the `WEB_REMIX` client profile. When a song is loaded (via initial SSR payload or AJAX request to `/youtubei/v1/player`), the client receives `streamingData`.
- By intercepting `window.ytInitialPlayerResponse` and hooking `window.fetch` / `window.XMLHttpRequest` in the page `MAIN` world:
  ```javascript
  function pruneVideoFormats(playerResponse) {
    if (playerResponse?.streamingData?.adaptiveFormats) {
      playerResponse.streamingData.adaptiveFormats = 
        playerResponse.streamingData.adaptiveFormats.filter(f => 
          f.mimeType && f.mimeType.startsWith('audio/')
        );
    }
    if (playerResponse?.streamingData?.formats) {
      playerResponse.streamingData.formats = [];
    }
    return playerResponse;
  }
  ```
- **Consequences in YouTube Music Engine**:
  1. The ABR format selector inspects `adaptiveFormats` and finds only audio streams (e.g. itags 140, 251).
  2. Because YouTube Music natively supports audio-only tracks (ATV tracks and Premium audio mode), the player engine initializes MSE with **only the audio `SourceBuffer`**.
  3. The player **never issues any `videoplayback` requests for video chunks**.
  4. Native Chromium receives only audio data, bypassing `VideoRendererImpl` creation.
  5. 100% bandwidth savings on video chunks, 0% video decode CPU/GPU utilization, and zero player error warnings.

---

## 4. Recommended Architecture for Decode Suppression

To ensure 100% reliability across SPA navigations, music videos (`OMV`), community uploads (`UGC`), and dynamic playlists, implement a **Two-Tier Interception Model** in the `MAIN` execution world:

```mermaid
flowchart TD
    subgraph PageContext["Page Context (MAIN World)"]
        FetchHook["Fetch & XHR Interceptor<br/>(/youtubei/v1/player)"]
        MSEHook["MediaSource.prototype.addSourceBuffer Hook"]
        MockSB["Synthetic MockSourceBuffer"]
    end

    subgraph YTM["YouTube Music Player Engine"]
        InnerTube["InnerTube API Response"]
        ABR["ABR & Format Selector"]
    end

    subgraph ChromiumPipeline["Chromium Media Pipeline"]
        CD["ChunkDemuxer (media/filters/chunk_demuxer.cc)"]
        RI["RendererImpl (media/renderers/renderer_impl.cc)"]
        AR["AudioRendererImpl (Active)"]
        VR["VideoRendererImpl (nullptr)"]
    end

    InnerTube -->|Response Data| FetchHook
    FetchHook -->|Filter: adaptiveFormats = audio-only<br/>formats = []| ABR
    
    ABR -->|1. Standard Audio-Only Path| MSEHook
    MSEHook -->|audio/webm or audio/mp4| CD
    
    ABR -.->|2. Fallback Video Path (if forced)| MSEHook
    MSEHook -.->|video/webm or video/mp4| MockSB
    MockSB -.->|Immediate updateend / Fake buffer| ABR

    CD -->|DemuxerStream::AUDIO only| RI
    RI --> AR
    RI -->|No DemuxerStream::VIDEO| VR
```

### Architectural Breakdown
1. **Tier 1 (Upstream Preemption)**:
   - Injected script runs at `document_start` in the `MAIN` world.
   - Intercepts `window.ytInitialPlayerResponse` and overrides `window.fetch` / `window.XMLHttpRequest`.
   - Modifies responses matching `/youtubei/v1/player`: keeps only audio entries in `adaptiveFormats` and empties `formats`.
   - Eliminates video chunk fetching at the source.
2. **Tier 2 (MSE Safety Net)**:
   - Monkey-patches `MediaSource.prototype.addSourceBuffer`.
   - If the player attempts to register a video MIME type under any edge case, the call is diverted to a synthetic `MockSourceBuffer`.
   - Ensures native `ChunkDemuxer` receives only audio streams, setting `video_renderer_ = nullptr` in Chromium's `RendererImpl`.
   - Prevents demuxer initialization deadlocks and underflow pauses.
3. **UI Replacement (Album Art Placeholder)**:
   - Observes `<ytmusic-player id="player">` and hides the native video canvas (`#song-video`).
   - Displays a static album art container using high-resolution thumbnails already present in track metadata (`videoDetails.thumbnail.thumbnails`).

---

## 5. Primary Source Citations & References

1. **Chromium Demuxer Initialization & Stream Registration**:
   - Source: `media/filters/chunk_demuxer.cc`
   - Key symbols: `ChunkDemuxer::AddId`, `ChunkDemuxer::OnSourceInitDone`, `pending_source_init_ids_`, `RunInitCB_Locked`.
   - Upstream URL: [https://chromium.googlesource.com/chromium/src/+/refs/heads/main/media/filters/chunk_demuxer.cc](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/media/filters/chunk_demuxer.cc)
2. **Chromium Audio/Video Synchronization & Buffering State**:
   - Source: `media/renderers/renderer_impl.cc`
   - Key symbols: `RendererImpl::InitializeVideoRenderer`, `RendererImpl::WaitingForEnoughData`, `RendererImpl::OnBufferingStateChange`, `RendererImpl::PausePlayback`.
   - Upstream URL: [https://chromium.googlesource.com/chromium/src/+/refs/heads/main/media/renderers/renderer_impl.cc](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/media/renderers/renderer_impl.cc)
3. **Chromium Web Media Player Blink Integration**:
   - Source: `third_party/blink/renderer/platform/media/web_media_player_impl.cc`
   - Key symbols: `WebMediaPlayerImpl::HaveSufficientData`, `WebMediaPlayerImpl::OnBufferingStateChange`.
   - Upstream URL: [https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/platform/media/web_media_player_impl.cc](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/platform/media/web_media_player_impl.cc)
4. **W3C Media Source Extensions™ (MSE)**:
   - W3C Recommendation 17 November 2016.
   - Key sections: §2.2 `MediaSource` object, §2.4 `SourceBuffer` object, §3.5.7 Initialization Segment Received.
   - Specification URL: [https://www.w3.org/TR/media-source/](https://www.w3.org/TR/media-source/)
5. **W3C HTML5 Media Playback Specification**:
   - W3C Recommendation / WHATWG HTML Living Standard.
   - Key sections: §4.8.12 Media elements, `readyState` definitions (`HAVE_NOTHING` through `HAVE_ENOUGH_DATA`), audio/video synchronization algorithms.
   - Specification URL: [https://html.spec.whatwg.org/multipage/media.html](https://html.spec.whatwg.org/multipage/media.html)
6. **YouTube Music InnerTube API Client Architecture**:
   - Client definition: `WEB_REMIX`, endpoint: `/youtubei/v1/player`.
   - Metadata classification: `videoDetails.musicVideoType` (`MUSIC_VIDEO_TYPE_ATV`, `MUSIC_VIDEO_TYPE_OMV`, `MUSIC_VIDEO_TYPE_UGC`).
   - Format definitions: `streamingData.adaptiveFormats` vs `streamingData.formats`.
