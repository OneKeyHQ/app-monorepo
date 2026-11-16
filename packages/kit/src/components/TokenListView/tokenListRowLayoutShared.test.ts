import {
  TOKEN_LIST_CONTENT_PADDING_HORIZONTAL,
  getTokenListSlotInsetCompensation,
  getTokenTableColumnWeights,
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

describe('getTokenTableColumnWeights', () => {
  it('reserves a spacer column in front of the swap button', () => {
    expect(getTokenTableColumnWeights(true)).toEqual({
      asset: 2,
      balance: 3,
      price: 3,
      swapSpacer: 2,
    });
  });

  it('keeps three equal columns without a swap button', () => {
    expect(getTokenTableColumnWeights(false)).toEqual({
      asset: 1,
      balance: 1,
      price: 1,
    });
  });
});
