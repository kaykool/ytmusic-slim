// PROTOTYPE - throwaway code to verify decode suppression on YouTube Music
(function () {
  'use strict';

  console.log('[YTM-Audio-Only Prototype] Initializing v0.2.1 decode suppression hooks...');

  let divertedVideoBufferCount = 0;

  // 1. Enforce deviceIsAudioOnly on YouTube player prototypes and ytcfg
  try {
    Object.defineProperty(Object.prototype, 'deviceIsAudioOnly', {
      get() {
        return true;
      },
      set(nv) {
        return true;
      },
      enumerable: false,
      configurable: true
    });
  } catch (e) {
    console.warn('[YTM-Audio-Only Prototype] deviceIsAudioOnly defineProperty failed:', e);
  }

  // 2. Polymer AV-Switcher Automation (force Song / Audio Mode on YTM)
  function enforceAudioMode() {
    const playerPages = document.querySelectorAll('ytmusic-player-page');
    for (const page of playerPages) {
      if (page.videoMode) page.videoMode = false;
      page.removeAttribute('video-mode');
    }

    const avToggles = document.querySelectorAll('ytmusic-av-toggle');
    for (const toggle of avToggles) {
      if (toggle.mustPlayAudioOnly === false) toggle.mustPlayAudioOnly = true;
      if (toggle.selectedItemHasVideo === true) toggle.selectedItemHasVideo = false;
      if (toggle.playbackMode && toggle.playbackMode !== 'ATV_PREFERRED') {
        toggle.playbackMode = 'ATV_PREFERRED';
      }
      if (typeof toggle.onSongAvToggleTap === 'function') {
        try {
          toggle.onSongAvToggleTap();
        } catch (e) {}
      }
    }
  }

  // 3. Robust Synthetic MockSourceBuffer for video streams
  class MockSourceBuffer extends EventTarget {
    constructor(mediaSource, type) {
      super();
      this.mediaSource = mediaSource;
      this.type = type;
      this.updating = false;
      this.mode = 'segments';
      this.timestampOffset = 0;
      this.appendWindowStart = 0;
      this.appendWindowEnd = Infinity;
      this.trackDefaults = null;
      this.onupdatestart = null;
      this.onupdate = null;
      this.onupdateend = null;
      this.onerror = null;
      this.onabort = null;
      divertedVideoBufferCount++;
    }

    // Report buffer as perpetually full far ahead of currentTime to prevent player stall & stop chunk requests
    get buffered() {
      return {
        length: 1,
        start: () => 0,
        end: () => 100000
      };
    }

    appendBuffer(buf) {
      this.updating = true;
      const dispatch = (name, handler) => {
        const evt = new Event(name);
        if (typeof handler === 'function') {
          try { handler.call(this, evt); } catch (e) {}
        }
        this.dispatchEvent(evt);
      };

      dispatch('updatestart', this.onupdatestart);

      queueMicrotask(() => {
        this.updating = false;
        dispatch('update', this.onupdate);
        dispatch('updateend', this.onupdateend);
      });
    }

    abort() {
      this.updating = false;
    }

    remove(start, end) {
      this.updating = true;
      queueMicrotask(() => {
        this.updating = false;
        const evt = new Event('update');
        if (this.onupdate) this.onupdate(evt);
        this.dispatchEvent(evt);
        const endEvt = new Event('updateend');
        if (this.onupdateend) this.onupdateend(endEvt);
        this.dispatchEvent(endEvt);
      });
    }

    changeType(type) {
      this.type = type;
    }
  }

  // 4. Hook MediaSource.prototype.addSourceBuffer
  const origAddSourceBuffer = MediaSource.prototype.addSourceBuffer;
  MediaSource.prototype.addSourceBuffer = function (type, ...rest) {
    if (typeof type === 'string' && type.startsWith('video/')) {
      console.log(`[YTM-Audio-Only Prototype] Diverted video SourceBuffer (${type}) to MockSourceBuffer`);
      return new MockSourceBuffer(this, type);
    }
    return origAddSourceBuffer.call(this, type, ...rest);
  };

  // 5. Observe DOM mutations and navigation for dynamic SPA transitions
  const observer = new MutationObserver(enforceAudioMode);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('yt-navigate-finish', enforceAudioMode);
  document.addEventListener('state-navigateend', enforceAudioMode);

  // 6. Telemetry HUD (Surfacing State)
  function injectHUD() {
    const existing = document.getElementById('ytm-audio-only-hud');
    if (existing) existing.remove();

    const hud = document.createElement('div');
    hud.id = 'ytm-audio-only-hud';
    hud.style.cssText = `
      position: fixed;
      top: 12px;
      right: 12px;
      z-index: 999999;
      background: rgba(18, 18, 18, 0.92);
      color: #00ff88;
      font-family: monospace;
      font-size: 11px;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #00ff88;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      pointer-events: none;
      line-height: 1.5;
    `;

    const title = document.createElement('strong');
    title.textContent = '[YTM Audio-Only v0.2.1]';
    hud.appendChild(title);
    hud.appendChild(document.createElement('br'));

    hud.appendChild(document.createTextNode('Decoded Frames: '));
    const spanDecoded = document.createElement('span');
    spanDecoded.id = 'ytm-hud-decoded';
    spanDecoded.textContent = '0';
    hud.appendChild(spanDecoded);
    hud.appendChild(document.createElement('br'));

    hud.appendChild(document.createTextNode('Dropped Frames: '));
    const spanDropped = document.createElement('span');
    spanDropped.id = 'ytm-hud-dropped';
    spanDropped.textContent = '0';
    hud.appendChild(spanDropped);
    hud.appendChild(document.createElement('br'));

    hud.appendChild(document.createTextNode('Video Buffers Diverted: '));
    const spanDiverted = document.createElement('span');
    spanDiverted.id = 'ytm-hud-diverted';
    spanDiverted.textContent = '0';
    hud.appendChild(spanDiverted);
    hud.appendChild(document.createElement('br'));

    hud.appendChild(document.createTextNode('Audio State: '));
    const spanAudio = document.createElement('span');
    spanAudio.id = 'ytm-hud-audio';
    spanAudio.textContent = 'Idle';
    hud.appendChild(spanAudio);

    document.documentElement.appendChild(hud);

    function syncAlbumArt() {
      const songImage = document.querySelector('#song-image');
      const songVideo = document.querySelector('#song-video');
      if (songVideo) songVideo.style.setProperty('display', 'none', 'important');
      if (songImage) {
        songImage.style.setProperty('display', 'flex', 'important');
        songImage.style.setProperty('visibility', 'visible', 'important');
        songImage.style.setProperty('opacity', '1', 'important');
      }

      const mainImg = document.querySelector('#song-image img#img, #song-image #thumbnail img');
      const playerBarImg = document.querySelector('ytmusic-player-bar .thumbnail-image-wrapper img, ytmusic-player-bar img');
      if (mainImg && playerBarImg && playerBarImg.src) {
        if (!mainImg.src || mainImg.src === '' || mainImg.src.includes('data:image')) {
          mainImg.src = playerBarImg.src;
        }
      }
    }

    setInterval(() => {
      syncAlbumArt();

      const media = document.querySelector('video, audio, .html5-main-video');
      const decodedSpan = document.getElementById('ytm-hud-decoded');
      const droppedSpan = document.getElementById('ytm-hud-dropped');
      const divertedSpan = document.getElementById('ytm-hud-diverted');
      const audioSpan = document.getElementById('ytm-hud-audio');

      if (divertedSpan) divertedSpan.textContent = String(divertedVideoBufferCount);

      if (!media) {
        if (audioSpan) audioSpan.textContent = 'Awaiting media element...';
        return;
      }

      if (typeof media.getVideoPlaybackQuality === 'function') {
        const q = media.getVideoPlaybackQuality();
        if (decodedSpan) decodedSpan.textContent = String(q.totalVideoFrames);
        if (droppedSpan) droppedSpan.textContent = String(q.droppedVideoFrames);
      } else {
        if (decodedSpan) decodedSpan.textContent = '0 (Native audio)';
        if (droppedSpan) droppedSpan.textContent = '0';
      }

      const isPlaying = !media.paused && !media.ended && media.readyState > 1;
      const tag = media.tagName.toLowerCase();
      if (audioSpan) {
        audioSpan.textContent = isPlaying
          ? `Playing (${Math.floor(media.currentTime)}s) [${tag}]`
          : media.paused
          ? `Paused [${tag}]`
          : `Buffering (readyState=${media.readyState}) [${tag}]`;
      }
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectHUD);
  } else {
    injectHUD();
  }

  console.log('[YTM-Audio-Only Prototype] Hooks active.');
})();
