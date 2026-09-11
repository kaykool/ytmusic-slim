(function () {
  'use strict';

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
        start(i) {
          return 0;
        },
        end(i) {
          return 100000;
        }
      };
    }

    _dispatch(name, handler) {
      const evt = new Event(name);
      if (typeof handler === 'function') {
        try { handler.call(this, evt); } catch (e) {}
      }
      this.dispatchEvent(evt);
    }

    appendBuffer(buf) {
      this.updating = true;
      this._dispatch('updatestart', this.onupdatestart);

      queueMicrotask(() => {
        this.updating = false;
        this._dispatch('update', this.onupdate);
        this._dispatch('updateend', this.onupdateend);
      });
    }

    abort() {
      const wasUpdating = this.updating;
      this.updating = false;
      if (wasUpdating) {
        queueMicrotask(() => {
          this._dispatch('abort', this.onabort);
          this._dispatch('updateend', this.onupdateend);
        });
      }
    }

    remove(start, end) {
      this.updating = true;
      this._dispatch('updatestart', this.onupdatestart);
      queueMicrotask(() => {
        this.updating = false;
        this._dispatch('update', this.onupdate);
        this._dispatch('updateend', this.onupdateend);
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

  // 4. Album Art Presentation & Thumbnail Fallback Sync
  function syncAlbumArt() {
    const mainImg = document.querySelector('#song-image img#img, #song-image #thumbnail img');
    const playerBarImg = document.querySelector('ytmusic-player-bar .thumbnail-image-wrapper img, ytmusic-player-bar img');
    if (mainImg && playerBarImg && playerBarImg.src) {
      if (!mainImg.src || mainImg.src === '' || mainImg.src.includes('data:image')) {
        mainImg.src = playerBarImg.src;
      }
    }
  }

  // Hook navigation transitions safely without mutating Polymer internals
  document.addEventListener('yt-navigate-finish', syncAlbumArt);
  document.addEventListener('yt-page-data-updated', syncAlbumArt);
  document.addEventListener('state-navigateend', syncAlbumArt);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncAlbumArt);
  } else {
    syncAlbumArt();
  }
})();
