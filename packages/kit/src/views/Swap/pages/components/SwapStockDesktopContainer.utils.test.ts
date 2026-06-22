import { ESwapStockTradeSide } from '../../hooks/swapStockChannelUtils';

import {
  STOCK_CHART_DEFAULT_RANGE,
  STOCK_CHART_RANGE_ITEMS,
  STOCK_DESKTOP_HEADER_SLOT_PROPS,
  getStockDisabledActionButtonProps,
} from './SwapStockDesktopContainer.utils';

describe('SwapStockDesktopContainer utils', () => {
  it('defaults the stock chart range to one week', () => {
    expect(STOCK_CHART_DEFAULT_RANGE).toBe('1W');
  });

  it('keeps one month as a selectable stock chart range', () => {
    expect(
      STOCK_CHART_RANGE_ITEMS.some((item) => item.label === '1M'),
    ).toBeTruthy();
  });

  it('uses the shared desktop header slot spacing for stock layout', () => {
    expect(STOCK_DESKTOP_HEADER_SLOT_PROPS).toEqual({
      width: '100%',
      alignItems: 'center',
      pt: '$8',
      pb: '$4',
    });
  });

  it('keeps disabled buy actions in the buy color family', () => {
    expect(getStockDisabledActionButtonProps(ESwapStockTradeSide.Buy)).toEqual({
      bg: '$bgSuccessStrong',
      color: '$textOnColor',
      disabledStyle: {
        opacity: 0.6,
      },
    });
  });

  it('keeps disabled sell actions in the sell color family', () => {
    expect(getStockDisabledActionButtonProps(ESwapStockTradeSide.Sell)).toEqual(
      {
        bg: '$bgCriticalStrong',
        color: '$textOnColor',
        disabledStyle: {
          opacity: 0.6,
        },
      },
    );
  });
});
