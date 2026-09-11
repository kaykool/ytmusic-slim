# ytmusic-slim

A lightweight, zero-bloat Chrome and Brave extension for YouTube Music (`music.youtube.com`).

It halts video streaming and decoding to keep your laptop cool, save battery, and free up CPU/GPU resources while keeping audio playback completely uninterrupted.

## What it does

- **0 Decoded Video Frames**: Intercepts the media pipeline to divert video chunks away from the video decoder. Chromium never instantiates hardware or software video decoders.
- **Continuous Audio**: Works on official music videos, live performances, and standard tracks without premature skipping or format errors.
- **Clean Album Art**: Replaces the video canvas with clean, centered album cover art over a pure black background.
- **Zero Heavy Styling**: Strips ambient glow, canvas repaints, heavy blur filters (`backdrop-filter`), and drop shadows to eliminate GPU compositor load.
- **Zero Telemetry**: No remote analytics, no tracking, no external CDNs, no background service worker (0 MB idle RAM).
- **Zero Configuration**: Always-on by default with zero popups, buttons, or background processes.

## How to Install

1. Clone or download this repository:
   ```bash
   git clone https://github.com/kaykool/ytmusic-slim.git
   ```
2. Open your browser and go to `chrome://extensions` (or `brave://extensions`).
3. Enable **Developer mode** using the switch in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the `extension/` directory from this repository.
6. Open [music.youtube.com](https://music.youtube.com) and start playing music.

## How to Verify

Open DevTools (`F12`), switch to the **Console** tab, and run:

```javascript
document.querySelector('video').getVideoPlaybackQuality().totalVideoFrames
```

The output will stay at `0` throughout playback.

## License

MIT
