import { getDesktopNavigationState } from './desktopNavigationState';

describe('getDesktopNavigationState', () => {
  it('keeps same-document navigation out of the WebView loading source', () => {
    expect(getDesktopNavigationState(true)).toEqual({
      isInPlace: true,
      loading: false,
    });
  });

  it('treats cross-document navigation as a loading navigation', () => {
    expect(getDesktopNavigationState(false)).toEqual({
      isInPlace: false,
      loading: true,
    });
    expect(getDesktopNavigationState(undefined)).toEqual({
      isInPlace: false,
      loading: true,
    });
  });
});
