import { getTradingViewNativeDefaultInitialRightOffset } from './config';

describe('TradingViewNative configuration', () => {
  it('selects the initial right offset from the chart width', () => {
    expect(getTradingViewNativeDefaultInitialRightOffset(767)).toEqual({
      type: 'pointCount',
      value: 2,
    });
    expect(getTradingViewNativeDefaultInitialRightOffset(768)).toEqual({
      type: 'chartWidthPercentage',
      value: 5,
    });
  });
});
