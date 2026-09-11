(function () {
  'use strict';

  // Check user toggle preference stored in localStorage
  try {
    if (window.localStorage.getItem('ytm_audio_only_enabled') === 'false') {
      document.documentElement.removeAttribute('data-ytm-audio-only');
      return;
    }
  } catch (e) {}

  // Set attribute on <html> to immediately engage declarative CSS hiding
  document.documentElement.setAttribute('data-ytm-audio-only', 'true');

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
  } catch (e) {}

  // 2. Synthetic MockSourceBuffer for video streams
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
    }

    // Report buffer as perpetually full far ahead of currentTime to prevent stalls
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

  // 3. Hook MediaSource.prototype.addSourceBuffer to divert video streams
  if (typeof MediaSource !== 'undefined' && MediaSource.prototype) {
    const origAddSourceBuffer = MediaSource.prototype.addSourceBuffer;
    MediaSource.prototype.addSourceBuffer = function (type, ...rest) {
      if (typeof type === 'string' && type.startsWith('video/')) {
        return new MockSourceBuffer(this, type);
      }
      return origAddSourceBuffer.call(this, type, ...rest);
    };
  }

  // 4. Polymer AV-Switcher Automation (force Song / Audio Mode on YTM)
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

    syncAlbumArt();
  }

  // 5. Album Art Presentation & Thumbnail Fallback Sync
  function syncAlbumArt() {
    const mainImg = document.querySelector('#song-image img#img, #song-image #thumbnail img');
    const playerBarImg = document.querySelector('ytmusic-player-bar .thumbnail-image-wrapper img, ytmusic-player-bar img');
    if (mainImg && playerBarImg && playerBarImg.src) {
      if (!mainImg.src || mainImg.src === '' || mainImg.src.includes('data:image')) {
        mainImg.src = playerBarImg.src;
      }
    }
  }

  // Observe DOM additions and navigation transitions
  const observer = new MutationObserver(enforceAudioMode);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('yt-navigate-finish', enforceAudioMode);
  document.addEventListener('state-navigateend', enforceAudioMode);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enforceAudioMode);
  } else {
    enforceAudioMode();
  }
})();
