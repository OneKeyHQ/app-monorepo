import {
  TOKEN_LIST_CONTENT_PADDING_HORIZONTAL,
  getTokenListSlotInsetCompensation,
} from './tokenListRowLayoutShared';

describe('getTokenListSlotInsetCompensation', () => {
  it('leaves web slot content alone because it is sized for the inset', () => {
    expect(
      getTokenListSlotInsetCompensation({
        isNative: false,
        isNativeAndroid: false,
        hasSidecarLayout: false,
      }),
    ).toBeUndefined();
  });

  it('pulls the inset back out on iOS with and without the sidecar', () => {
    for (const hasSidecarLayout of [false, true]) {
      expect(
        getTokenListSlotInsetCompensation({
          isNative: true,
          isNativeAndroid: false,
          hasSidecarLayout,
        }),
      ).toBe(-TOKEN_LIST_CONTENT_PADDING_HORIZONTAL);
    }
  });

  it('pulls the inset back out on Android without the sidecar', () => {
    expect(
      getTokenListSlotInsetCompensation({
        isNative: true,
        isNativeAndroid: true,
        hasSidecarLayout: false,
      }),
    ).toBe(-TOKEN_LIST_CONTENT_PADDING_HORIZONTAL);
  });

  it('skips the Android sidecar layout whose engine already drops the inset', () => {
    expect(
      getTokenListSlotInsetCompensation({
        isNative: true,
        isNativeAndroid: true,
        hasSidecarLayout: true,
      }),
    ).toBeUndefined();
  });
});
