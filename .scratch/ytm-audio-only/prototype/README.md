# YouTube Music Audio-Only Prototype

Throwaway prototype to verify video decode suppression and uninterrupted audio playback on YouTube Music (`music.youtube.com`).

## How to Test in Brave / Chrome

1. Open `brave://extensions` (or `chrome://extensions`).
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the folder:
   `/home/sw/1DEV/gemin/.scratch/ytm-audio-only/prototype`
4. Open [music.youtube.com](https://music.youtube.com) and play any track or music video.

## Verification Checklist

- **Telemetry HUD**: Observe the green overlay in the top-right corner.
  - `Decoded Frames`: Stays strictly at `0`.
  - `Dropped Frames`: Stays at `0`.
  - `Audio State`: Shows `Playing (<seconds>s)`.
- **Console Logs**: Open DevTools (`F12` -> Console) and look for:
  - `[YTM-Audio-Only Prototype] Filtered adaptiveFormats: kept N audio formats (dropped M video formats)`
  - `[YTM-Audio-Only Prototype] Cleared progressive muxed formats`
- **Media Internals**: Open `chrome://media-internals` in a separate tab:
  - Find the player session.
  - Verify `video_decoder`: None or not instantiated.
  - Verify `audio_decoder`: Active (e.g. FFmpegAudioDecoder or Opus/AAC decoder).
- **Physical Verification**: Notice absence of GPU video engine load and cooler laptop temperatures during playback.
