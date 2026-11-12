import { shouldReserveWindowControlsInset } from './sidebar';

const base = {
  isDesktopWin: true,
  isDesktopLinux: false,
  isOnboardingScreen: false,
  isModelScreen: false,
  isInsideInsetSurface: false,
};

describe('shouldReserveWindowControlsInset', () => {
  it('reserves the inset for a plain Windows page header', () => {
    expect(shouldReserveWindowControlsInset(base)).toBe(true);
  });

  it('reserves the inset on Linux as well', () => {
    expect(
      shouldReserveWindowControlsInset({
        ...base,
        isDesktopWin: false,
        isDesktopLinux: true,
      }),
    ).toBe(true);
  });

  it('skips the inset outside desktop (macOS, web, extension, native)', () => {
    expect(
      shouldReserveWindowControlsInset({
        ...base,
        isDesktopWin: false,
        isDesktopLinux: false,
      }),
    ).toBe(false);
  });

  it('skips the inset for onboarding screens', () => {
    expect(
      shouldReserveWindowControlsInset({ ...base, isOnboardingScreen: true }),
    ).toBe(false);
  });

  it('skips the inset for modal screens', () => {
    expect(
      shouldReserveWindowControlsInset({ ...base, isModelScreen: true }),
    ).toBe(false);
  });

  // Pages pushed inside the Settings modal sheet (Address Book, Add Custom
  // Network, ...) are rendered by a nested navigator that reports a plain page
  // type, so the surrounding surface reaches the header through the page type.
  it('skips the inset for pages inside a modal or full-screen surface', () => {
    expect(
      shouldReserveWindowControlsInset({
        ...base,
        isInsideInsetSurface: true,
      }),
    ).toBe(false);
  });
});
