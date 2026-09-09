import {
  buildHyperliquidModifyOrder,
  buildHyperliquidModifyRequest,
} from './orderAmend';

const baseParams = {
  oid: 123,
  assetId: 0,
  isBuy: true,
  sz: '0.25',
  price: '100000',
  reduceOnly: false,
} as const;

describe('buildHyperliquidModifyOrder', () => {
  test.each(['Gtc', 'Alo'] as const)('preserves %s limit TIF', (tif) => {
    expect(
      buildHyperliquidModifyOrder({
        ...baseParams,
        orderType: { limit: { tif } },
      }).t,
    ).toEqual({ limit: { tif } });
  });

  it('preserves trigger semantics and zero position TP/SL size', () => {
    expect(
      buildHyperliquidModifyOrder({
        ...baseParams,
        sz: '0',
        reduceOnly: true,
        orderType: {
          trigger: {
            isMarket: true,
            triggerPx: '95000',
            tpsl: 'sl',
          },
        },
        allowZeroSize: true,
      }),
    ).toMatchObject({
      s: '0',
      r: true,
      t: {
        trigger: {
          isMarket: true,
          triggerPx: '95000',
          tpsl: 'sl',
        },
      },
    });
  });

  it('writes a non-null cloid and omits null', () => {
    expect(
      buildHyperliquidModifyOrder({
        ...baseParams,
        orderType: { limit: { tif: 'Gtc' } },
        cloid: '0x0123456789abcdef0123456789abcdef',
      }),
    ).toMatchObject({ c: '0x0123456789abcdef0123456789abcdef' });
    expect(
      buildHyperliquidModifyOrder({
        ...baseParams,
        orderType: { limit: { tif: 'Gtc' } },
        cloid: null,
      }),
    ).not.toHaveProperty('c');
  });
});

describe('buildHyperliquidModifyRequest', () => {
  const order = buildHyperliquidModifyOrder({
    ...baseParams,
    orderType: { limit: { tif: 'Gtc' } },
  });

  it('omits always_place for ordinary amendments', () => {
    expect(
      buildHyperliquidModifyRequest({
        oid: baseParams.oid,
        order,
      }),
    ).toEqual({
      oid: baseParams.oid,
      order,
    });
  });

  it('sets always_place only when explicitly requested', () => {
    expect(
      buildHyperliquidModifyRequest({
        oid: baseParams.oid,
        order,
        alwaysPlace: true,
      }),
    ).toEqual({
      oid: baseParams.oid,
      order,
      a: true,
    });
  });
});
