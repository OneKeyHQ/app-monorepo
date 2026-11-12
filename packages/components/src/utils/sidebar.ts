export const MIN_SIDEBAR_WIDTH = 72;

export const DESKTOP_MODE_UI_PAGE_MARGIN = 0;

export const DESKTOP_MODE_UI_PAGE_BORDER_WIDTH = 1;

export const DESKTOP_MODE_UI_HEADER_HEIGHT = 52;

// Width reserved on the right of a page header so header actions never sit
// under the OS minimize/maximize/close buttons, which the window-controls
// overlay paints into the top-right corner of the window on Windows/Linux.
export const WINDOWS_OVERLAY_BUTTONS_WIDTH =
  'max(154px, calc(100vw - env(titlebar-area-width, 100vw) - env(titlebar-area-x, 0px) + 16px))';

// Only headers that actually sit in the window's top-right corner have to keep
// clear of the overlay buttons.
//
// `isInsideInsetSurface` marks a page rendered inside a modal / full-screen
// surface (e.g. the Settings sheet). Such a surface is inset from the window
// chrome, and pages pushed inside it by a nested navigator still report a plain
// page type there, so `isModelScreen` alone leaves those headers reserving space
// for buttons that are not above them.
export function shouldReserveWindowControlsInset({
  isDesktopWin,
  isDesktopLinux,
  isOnboardingScreen,
  isModelScreen,
  isInsideInsetSurface,
}: {
  isDesktopWin: boolean;
  isDesktopLinux: boolean;
  isOnboardingScreen: boolean;
  isModelScreen: boolean;
  isInsideInsetSurface: boolean;
}): boolean {
  return (
    (isDesktopWin || isDesktopLinux) &&
    !isOnboardingScreen &&
    !isModelScreen &&
    !isInsideInsetSurface
  );
}
