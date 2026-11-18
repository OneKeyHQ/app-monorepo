export const MIN_SIDEBAR_WIDTH = 72;

export const DESKTOP_MODE_UI_PAGE_MARGIN = 0;

export const DESKTOP_MODE_UI_PAGE_BORDER_WIDTH = 1;

export const DESKTOP_MODE_UI_HEADER_HEIGHT = 52;

// Inset a page header keeps on its right so header actions never sit under the
// OS window buttons (minimize/maximize/close) that the window-controls overlay
// paints into the top-right corner of the window, over the page header.
//
// The overlay reports the area it leaves to the page through the
// `titlebar-area-*` env vars, so the difference from 100vw is the button strip
// plus a 16px gap. That is what the inset has to follow: a fixed floor keeps
// reserving the strip even when no strip is reported (fullscreen, or a window
// that renders without the buttons), which pushes header actions towards the
// middle of the window. Without an overlay the expression collapses to the
// header's regular 20px side padding instead.
export const WINDOWS_OVERLAY_BUTTONS_WIDTH =
  'max(20px, calc(100vw - env(titlebar-area-width, 100vw) - env(titlebar-area-x, 0px) + 16px))';
