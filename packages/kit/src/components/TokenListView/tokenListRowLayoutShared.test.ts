import { getTokenListFooterLayout as getWebFooterLayout } from './tokenListRowLayout';
import { getTokenListFooterLayout as getNativeFooterLayout } from './tokenListRowLayout.native';
import {
  TOKEN_LIST_CONTENT_PADDING_HORIZONTAL,
  getTokenListFooterLeading,
  getTokenListSlotInsetCompensation,
  getTokenRowIconSize,
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

// The token rows are laid out in raw units (12 padding, the icon, a 12 gap),
// and size tokens shrink on narrow Android screens, so the footer rows under
// the list must use raw numbers too (OK-67211).
describe('token list footer rows', () => {
  it('gives the leading icon the token icon box and the row gap', () => {
    for (const gtMd of [false, true]) {
      expect(getTokenListFooterLeading(gtMd)).toMatchObject({
        boxSize: getTokenRowIconSize(gtMd),
        gap: 12,
      });
    }
    expect(getTokenListFooterLeading(false).iconSize).toBe('$6');
    expect(getTokenListFooterLeading(true).iconSize).toBe('$5');
  });

  it('pads native footer rows like the rows, in raw units', () => {
    expect(getNativeFooterLayout({ tableLayout: false })).toEqual({
      mx: TOKEN_LIST_CONTENT_PADDING_HORIZONTAL,
      itemProps: { mx: 0, px: 12 },
    });
    expect(getNativeFooterLayout({ tableLayout: true })).toEqual({
      mx: undefined,
      itemProps: { mx: 0, px: 12 },
    });
    expect(
      getNativeFooterLayout({ tableLayout: true, plainMode: true }),
    ).toEqual({ mx: undefined, itemProps: undefined });
  });

  it('pads web footer rows like the rows', () => {
    expect(getWebFooterLayout({})).toEqual({
      mx: 0,
      itemProps: { mx: 0, px: 12 },
    });
  });
});
