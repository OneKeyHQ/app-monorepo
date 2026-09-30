import { createIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import messages from '@onekeyhq/shared/src/locale/json/en_US.json';
import type { IFill } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  canShareTradeFill,
  filterTradeHistory,
  getTradeFillClosePnlBN,
  getTradeFillDisplayInfo,
  getTradeFillExtraRows,
  getTradeHistoryMarketOptions,
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

describe('canShareTradeFill', () => {
  it('preserves sharing eligibility when moving the action into details', () => {
    expect(canShareTradeFill({ coin: 'BTC', closedPnl: '0.13' })).toBe(true);
    expect(canShareTradeFill({ coin: 'BTC', closedPnl: '-0.13' })).toBe(true);
    expect(canShareTradeFill({ coin: 'BTC', closedPnl: '0' })).toBe(false);
    expect(canShareTradeFill({ coin: '@107', closedPnl: '0.13' })).toBe(false);
    expect(canShareTradeFill({ coin: 'HYPE/USDC', closedPnl: '0.13' })).toBe(
      false,
    );
    expect(
      canShareTradeFill({
        coin: 'BTC',
        closedPnl: '-0.13',
        liquidation: {
          method: 'market',
          markPx: '83000',
          liquidatedUser: '0x0000000000000000000000000000000000000000',
        },
      }),
    ).toBe(false);
  });
});

describe('getTradeFillExtraRows', () => {
  const testMessages: Record<string, string> = messages;
  const intl = createIntl({ locale: 'en-US', messages: testMessages });
  const fill: IFill = {
    coin: 'BTC',
    px: '83257',
    sz: '0.00014',
    side: 'B',
    time: 1_790_730_000_000,
    startPosition: '-0.00014',
    dir: 'Close Short',
    closedPnl: '-0.01',
    hash: '0x1234',
    oid: 0,
    tid: 0,
    crossed: false,
    fee: '0.01',
    feeToken: 'USDC',
    twapId: null,
  };
  it('shows execution data without hiding zero IDs or losing signed position and PnL', () => {
    const rows = getTradeFillExtraRows({ fill, assetSymbol: 'BTC', intl });
    expect(rows).toEqual(
      expect.arrayContaining([
        {
          label: ETranslations.perp_trades_history_direction,
          value: 'Close Short',
        },
        {
          label: ETranslations.perp_trade_details_liquidity_role__title,
          value: 'Maker',
        },
        {
          label: ETranslations.perp_trade_details_start_position__title,
          value: '-0.00014 BTC',
        },

        {
          label: ETranslations.Limit_order_history_order_id,
          value: '0',
          copyValue: '0',
        },
        {
          label: ETranslations.swap_history_detail_transaction_hash,
          value: fill.hash,
          copyValue: fill.hash,
        },
      ]),
    );
    expect(rows).toHaveLength(6);
  });
  it.each(['0', '0.0', '0.00000000', '-0.0'])(
    'shows zero position without decimal places: %s',
    (startPosition) => {
      const rows = getTradeFillExtraRows({
        fill: { ...fill, startPosition },
        assetSymbol: 'BTC',
        intl,
      });
      expect(
        rows.find(
          ({ label }) =>
            label === ETranslations.perp_trade_details_start_position__title,
        )?.value,
      ).toBe('0 BTC');
    },
  );
  it.each(['0.00000001', '-0.00000001', '0.00014'])(
    'preserves the full start position precision: %s',
    (startPosition) => {
      const rows = getTradeFillExtraRows({
        fill: { ...fill, startPosition },
        assetSymbol: 'BTC',
        intl,
      });
      expect(
        rows.find(
          ({ label }) =>
            label === ETranslations.perp_trade_details_start_position__title,
        )?.value,
      ).toBe(`${startPosition} BTC`);
    },
  );
  it.each<[string, IFill['side'], string]>([
    ['Open Long', 'B', 'Long'],
    ['Close Long', 'A', 'Close Long'],
    ['Open Short', 'A', 'Short'],
    ['Close Short', 'B', 'Close Short'],
  ])('uses the history direction for %s', (dir, side, expected) => {
    const rows = getTradeFillExtraRows({
      fill: { ...fill, dir, side },
      assetSymbol: 'BTC',
      intl,
    });
    expect(
      rows.find(
        ({ label }) => label === ETranslations.perp_trades_history_direction,
      )?.value,
    ).toBe(expected);
  });
  it.each(['market', 'backstop'] as const)(
    'omits internal IDs and liquidation metadata even when supplied for %s liquidation',
    (method) => {
      const rows = getTradeFillExtraRows({
        fill: {
          ...fill,
          side: 'A',
          dir: 'Close Long',
          crossed: true,
          builderFee: '0',
          twapId: 0,
          cloid: '0xabcd',
          liquidation: {
            method,
            markPx: '83257.1',
            liquidatedUser: '0x5678',
          },
        },
        assetSymbol: 'BTC',
        intl,
      });
      expect(rows).toEqual(
        expect.arrayContaining([
          {
            label: ETranslations.perp_trades_history_direction,
            value: 'Close Long',
          },
          {
            label: ETranslations.perp_trade_details_liquidity_role__title,
            value: 'Taker',
          },
          { label: ETranslations.perps_fee_tiers_builder_fee, value: '0 USDC' },
        ]),
      );
      expect(rows).toHaveLength(7);
      expect(rows.map((row) => row.label)).not.toContain(
        ETranslations.perp_twap_id__title,
      );
      expect(rows.map(({ label }) => label)).not.toContain(
        ETranslations.perp_account_history_liquidation,
      );
      expect(rows.map(({ label }) => label)).not.toContain(
        ETranslations.perp_position_mark_price,
      );
    },
  );
});

describe('trade history filters', () => {
  const baseFill: IFill = {
    coin: 'BTC',
    px: '83257',
    sz: '0.00014',
    side: 'B',
    time: 0,
    startPosition: '-0.00014',
    dir: 'Close Short',
    closedPnl: '0',
    hash: '0x1234',
    oid: 0,
    tid: 0,
    crossed: false,
    fee: '0',
    feeToken: 'USDC',
    twapId: null,
  };
  const fills: IFill[] = [
    baseFill,
    { ...baseFill, side: 'A', dir: 'Close Long' },
    { ...baseFill, coin: '@107', dir: 'Buy' },
    { ...baseFill, coin: 'HYPE/USDC', side: 'A', dir: 'Sell' },
    { ...baseFill, coin: 'xyz:AAPL' },
  ];

  it('combines type, execution side and market without losing closing trades', () => {
    expect(filterTradeHistory(fills, { type: 'all', side: 'all' })).toEqual(
      fills,
    );
    expect(
      filterTradeHistory(fills, { type: 'perp', side: 'long', market: 'BTC' }),
    ).toEqual([fills[0]]);
    expect(filterTradeHistory(fills, { type: 'perp', side: 'short' })).toEqual([
      fills[1],
    ]);
    expect(filterTradeHistory(fills, { type: 'spot', side: 'all' })).toEqual([
      fills[2],
      fills[3],
    ]);
    expect(
      filterTradeHistory(
        fills,
        { type: 'all', side: 'long', market: 'active' },
        'xyz:AAPL',
      ),
    ).toEqual([fills[4]]);
    expect(
      filterTradeHistory(fills, { type: 'all', side: 'all', market: 'active' }),
    ).toEqual([]);
    expect(
      filterTradeHistory(fills, { type: 'spot', side: 'all', market: 'BTC' }),
    ).toEqual([]);
  });

  it('groups spot quotes by base asset while keeping the active market exact', () => {
    const records = ['@1', '@2', 'ETH', 'SOL/USDC'].map((coin) => ({
      ...baseFill,
      coin,
    }));
    const names = { '@1': 'ETH/USDC', '@2': 'ETH/USDH' };
    expect(getTradeHistoryMarketOptions(records, names, 'Spot')).toEqual([
      { coin: 'ETH', label: 'ETH' },
      { coin: 'spot:ETH', label: 'ETH (Spot)' },
      { coin: 'spot:SOL', label: 'SOL' },
    ]);
    expect(
      filterTradeHistory(
        records,
        { type: 'spot', side: 'all', market: 'spot:ETH' },
        undefined,
        names,
      ),
    ).toEqual(records.slice(0, 2));
    expect(
      filterTradeHistory(
        records,
        { type: 'all', side: 'all', market: 'active' },
        '@2',
        names,
      ),
    ).toEqual([records[1]]);
  });

  it('only offers indexed spot markets once metadata provides a stable asset name', () => {
    const records = [{ ...baseFill, coin: '@107' }];
    expect(getTradeHistoryMarketOptions(records, {}, 'Spot')).toEqual([]);
    const names = { '@107': 'PURR/USDC' };
    const [market] = getTradeHistoryMarketOptions(records, names, 'Spot');
    expect(market).toEqual({ coin: 'spot:PURR', label: 'PURR' });
    expect(
      filterTradeHistory(
        records,
        { type: 'spot', side: 'all', market: market.coin },
        undefined,
        names,
      ),
    ).toEqual(records);
  });

  it('deduplicates market IDs and resolves spot pair and HIP-3 labels', () => {
    const options = getTradeHistoryMarketOptions(
      fills,
      {
        '@107': 'PURR/USDC',
      },
      'Spot',
    );
    expect(options).toHaveLength(4);
    expect(options).toEqual(
      expect.arrayContaining([
        { coin: 'BTC', label: 'BTC' },
        { coin: 'spot:PURR', label: 'PURR' },
        { coin: 'spot:HYPE', label: 'HYPE' },
        { coin: 'xyz:AAPL', label: 'AAPL (xyz)' },
      ]),
    );
  });
});
