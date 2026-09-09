import {
  getTradeFillClosePnlBN,
  getTradeFillDisplayInfo,
} from './tradeFillDisplay';

describe('getTradeFillDisplayInfo', () => {
  // Real Hyperliquid spot-buy fill (OK-57923): fee charged in the base token,
  // 7-decimal price, float-tailed size. Hyperliquid renders it as
  // 0.0000006 / 18,333,333.3 MAX / 11.00 USDC / 12,319.983333 MAX.
  const maxSpotBuy = {
    coin: 'MAX/USDC',
    px: '0.0000006',
    sz: '18333333.3000000007',
    fee: '12319.983333',
    feeToken: 'MAX',
  };

  it('renders the MAX spot buy like Hyperliquid', () => {
    const info = getTradeFillDisplayInfo(maxSpotBuy);
    expect(info.priceFormatted).toBe('0.0000006');
    expect(info.sizeFormatted).toBe('18,333,333.3');
    expect(info.tradeValueFormatted).toBe('$11.00');
    expect(info.feeFormatted).toBe('12,319.9833 MAX');
  });

  it('does not net a base-token fee into the USDC closedPnl', () => {
    expect(
      getTradeFillClosePnlBN({
        closedPnl: '-0.01',
        fee: maxSpotBuy.fee,
        feeToken: maxSpotBuy.feeToken,
      }).toFixed(),
    ).toBe('-0.01');
  });

  it('keeps the USD fee and fee netting for perp fills', () => {
    const info = getTradeFillDisplayInfo({
      coin: 'ETH',
      px: '1808.1',
      sz: '0.0061',
      fee: '0.01',
      feeToken: 'USDC',
    });
    expect(info.priceFormatted).toBe('1,808.1');
    expect(info.feeFormatted).toBe('$0.01');
    expect(
      getTradeFillClosePnlBN({
        closedPnl: '0.08',
        fee: '0.01',
        feeToken: 'USDC',
      }).toFixed(),
    ).toBe('0.07');
  });
});
