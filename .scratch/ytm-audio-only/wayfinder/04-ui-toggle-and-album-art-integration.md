Type: grilling
Status: resolved
Blocked by: 03

# Design UI toggle integration and static album art presentation

## Question

How should the extension inject and style the static album art in place of the video element, and how does the popup toggle synchronize state with active tabs across dynamic SPA navigation?

## Answer

Settled in grilling exchange with user:

1. **Toggle Mode Switching**: When the toolbar popup toggle is changed, trigger `location.reload()` on active `music.youtube.com` tabs to cleanly reset the MediaSource pipeline and avoid mid-stream desync or buffer leaks.
2. **Album Art Presentation**: Render cover art in centered aspect-fit (`object-fit: contain`) over a clean black background (`#000`), avoiding heavy GPU backdrop blur shaders.
3. **State Persistence**: Store active state in `chrome.storage.local` under key `audioOnlyEnabled`, defaulting to `true` on initial install.
