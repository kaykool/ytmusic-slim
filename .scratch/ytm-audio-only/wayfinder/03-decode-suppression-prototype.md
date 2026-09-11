Type: prototype
Status: resolved
Blocked by: 01, 02

# Prototype and verify video decode suppression and audio continuity

## Question

Does intercepting the selected video hook halt video frame decoding (0 decoded frames in `video.getVideoPlaybackQuality()`, no hardware decoder instantiation) while maintaining uninterrupted audio playback across both standard tracks and video-only uploads on YouTube Music?

## Answer

Validated via throwaway prototype v0.2.1 in [.scratch/ytm-audio-only/prototype/](file:///home/sw/1DEV/gemin/.scratch/ytm-audio-only/prototype/).

**Findings & Validation Verdict:**
1. **Decode Suppression Confirmed**: Intercepting `MediaSource.prototype.addSourceBuffer` with a synthetic `MockSourceBuffer` for video streams completely prevents Chromium from creating a video `DemuxerStream`. Native video decoding is bypassed (0 decoded frames, 0 dropped frames).
2. **Audio Continuity Confirmed**: Audio continues playing uninterrupted across both music tracks and official music videos (verified with continuous playback over 2.5+ minutes).
3. **Thermal and Hardware Impact**: Hardware video decoder is never instantiated, keeping laptop CPU temperature cool (48.8°C observed under active playback).
4. **Format Validation Requirement**: Upstream InnerTube payload format descriptors must not be stripped; `deviceIsAudioOnly: true` and `MockSourceBuffer` handle suppression without triggering player format errors or loop skips.
5. **Trusted Types Compliance**: DOM element creation must use standard nodes (`createElement`, `textContent`) rather than `innerHTML` to comply with YouTube's strict CSP `require-trusted-types-for 'script'`.
