# YouTube Music Audio-Only Extension

A lightweight Chromium extension that halts video stream decoding on YouTube Music to minimize CPU and GPU overhead and maintain cool hardware temperatures.

## Language

**Decode Suppression**:
Halting video decoding at the browser media engine or network layer to eliminate CPU and GPU decoding cycles.
_Avoid_: Video hiding, CSS blocking

**Audio-Only Mode**:
A playback state where only audio data is fetched, decoded, and rendered.
_Avoid_: Background playback, muted video

**Video-Only Track**:
A media item on YouTube Music that exists exclusively as a video upload without a dedicated audio-only asset.
_Avoid_: Music video, uploaded song
