import { shouldRenderMobileOpenOrdersNativeTree } from './mobileOpenOrdersVisibility';

describe('shouldRenderMobileOpenOrdersNativeTree', () => {
  it('removes the hidden iOS and Android mobile view tree', () => {
    expect(
      shouldRenderMobileOpenOrdersNativeTree({
        isNative: true,
        isMobile: true,
        isPanelActive: false,
      }),
    ).toBe(false);
  });

  it('renders the active native mobile view tree', () => {
    expect(
      shouldRenderMobileOpenOrdersNativeTree({
        isNative: true,
        isMobile: true,
        isPanelActive: true,
      }),
    ).toBe(true);
  });

  it('preserves the hidden web mobile view tree', () => {
    expect(
      shouldRenderMobileOpenOrdersNativeTree({
        isNative: false,
        isMobile: true,
        isPanelActive: false,
      }),
    ).toBe(true);
  });

  it('preserves existing call sites without panel visibility state', () => {
    expect(
      shouldRenderMobileOpenOrdersNativeTree({
        isNative: true,
        isMobile: true,
      }),
    ).toBe(true);
  });
});
