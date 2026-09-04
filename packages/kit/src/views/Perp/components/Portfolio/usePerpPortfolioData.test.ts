import type { IFill } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  buildPerpPortfolioFillsStats,
  buildPortfolioChartData,
  sumPerpsNetDeposits,
} from './portfolioStats';

const NOW = 1_700_000_000_000;

function createFill(overrides: Partial<IFill>): IFill {
  return {
    coin: 'BTC',
    px: '100',
    sz: '1',
    side: 'B',
    closedPnl: '0',
    fee: '0',
    time: NOW,
    hash: '0x0',
    oid: 1,
    tid: 1,
    dir: 'Open Long',
    crossed: false,
    liquidation: false,
    startPosition: '0',
    feeToken: 'USDC',
    builderFee: '0',
    ...overrides,
  } as IFill;
}

describe('buildPerpPortfolioFillsStats', () => {
  it('includes spot fills in portfolio activity stats', () => {
    const stats = buildPerpPortfolioFillsStats({
      timePeriod: 'day',
      now: NOW,
      fills: [
        createFill({
          coin: 'BTC',
          px: '50000',
          sz: '0.1',
          closedPnl: '20',
          fee: '1',
          tid: 1,
        }),
        createFill({
          coin: '@142',
          px: '40',
          sz: '2',
          closedPnl: '0',
          fee: '0.2',
          tid: 2,
        }),
        createFill({
          coin: '@142',
          px: '50',
          sz: '1',
          side: 'A',
          closedPnl: '-5',
          fee: '0.3',
          tid: 3,
        }),
        createFill({
          coin: 'ETH',
          px: '3000',
          sz: '1',
          closedPnl: '100',
          fee: '1',
          time: NOW - 2 * 24 * 60 * 60 * 1000,
          tid: 4,
        }),
      ],
    });

    expect(stats.totalTrades).toBe(3);
    expect(stats.mostTraded).toBe('@142');
    expect(stats.winRate).toBe(50);
    expect(stats.avgWin).toBe(20);
    expect(stats.avgLoss).toBe(-5);
    expect(stats.profitFactor).toBe(4);
    expect(stats.realizedPnl).toBe(15);
    expect(stats.spotRealizedPnl).toBe(-5);
    expect(stats.feesPaid).toBe(1.5);
    expect(stats.volumeUsd).toBe(5130);
  });

  it('converts base-token spot fees at the fill price and drops ones without a usable price', () => {
    const stats = buildPerpPortfolioFillsStats({
      timePeriod: 'day',
      now: NOW,
      fills: [
        createFill({ coin: 'BTC', px: '50000', sz: '0.1', fee: '1', tid: 1 }),
        // Real MAX spot buy: fee charged in the base token (OK-57923).
        createFill({
          coin: 'MAX/USDC',
          px: '0.0000006',
          sz: '18333333.3',
          fee: '12319.983333',
          feeToken: 'MAX',
          tid: 2,
        }),
        // No usable price: dropped instead of counted as raw token units.
        createFill({
          coin: 'MAX/USDC',
          px: '0',
          sz: '1',
          fee: '100',
          feeToken: 'MAX',
          tid: 3,
        }),
      ],
    });

    expect(stats.feesPaid).toBeCloseTo(1 + 12_319.983_333 * 0.000_000_6, 10);
  });

  it('filters portfolio activity stats by pnl type', () => {
    const fills = [
      createFill({
        coin: 'BTC',
        px: '50000',
        sz: '0.1',
        closedPnl: '20',
        fee: '1',
        tid: 1,
      }),
      createFill({
        coin: '@142',
        px: '40',
        sz: '2',
        closedPnl: '0',
        fee: '0.2',
        tid: 2,
      }),
      createFill({
        coin: '@142',
        px: '50',
        sz: '1',
        side: 'A',
        closedPnl: '-5',
        fee: '0.3',
        tid: 3,
      }),
    ];

    const perpsStats = buildPerpPortfolioFillsStats({
      timePeriod: 'day',
      pnlType: 'perps',
      now: NOW,
      fills,
    });
    const spotStats = buildPerpPortfolioFillsStats({
      timePeriod: 'day',
      pnlType: 'spot',
      now: NOW,
      fills,
    });

    expect(perpsStats.totalTrades).toBe(1);
    expect(perpsStats.volumeUsd).toBe(5000);
    expect(perpsStats.realizedPnl).toBe(20);
    expect(perpsStats.spotRealizedPnl).toBe(0);
    expect(perpsStats.mostTraded).toBe('BTC');

    expect(spotStats.totalTrades).toBe(2);
    expect(spotStats.volumeUsd).toBe(130);
    expect(spotStats.realizedPnl).toBe(-5);
    expect(spotStats.spotRealizedPnl).toBe(-5);
    expect(spotStats.mostTraded).toBe('@142');
  });
});

describe('buildPortfolioChartData', () => {
  it('uses combined history for account value and derives spot pnl from combined minus perps', () => {
    const portfolioData: Parameters<
      typeof buildPortfolioChartData
    >[0]['portfolioData'] = [
      [
        'day',
        {
          accountValueHistory: [
            [1_700_000_000_000, '12.66'],
            [1_700_000_060_000, '13.66'],
          ],
          pnlHistory: [
            [1_700_000_000_000, '5'],
            [1_700_000_060_000, '8'],
          ],
          vlm: '100',
        },
      ],
      [
        'perpDay',
        {
          accountValueHistory: [
            [1_700_000_000_000, '0'],
            [1_700_000_060_000, '0'],
          ],
          pnlHistory: [
            [1_700_000_000_000, '2'],
            [1_700_000_060_000, '3'],
          ],
          vlm: '50',
        },
      ],
    ];

    const chartData = buildPortfolioChartData({
      timePeriod: 'day',
      portfolioData,
    });

    expect(chartData?.accountValueHistory).toEqual([
      [1_700_000_000, 12.66],
      [1_700_000_060, 13.66],
    ]);
    expect(chartData?.pnlHistory).toEqual([
      [1_700_000_000, 5],
      [1_700_000_060, 8],
    ]);
    expect(chartData?.perpsPnlHistory).toEqual([
      [1_700_000_000, 2],
      [1_700_000_060, 3],
    ]);
    expect(chartData?.nonPerpsPnlHistory).toEqual([
      [1_700_000_000, 3],
      [1_700_000_060, 5],
    ]);
    expect(chartData?.vlm).toBe('100');
  });
});

describe('sumPerpsNetDeposits', () => {
  const SYSTEM = '0x2000000000000000000000000000000000000000';
  const ME = '0x4ef880525383ab4e3d94b7689e3146bf899a296e';

  const ledger = (deltas: Record<string, unknown>[]) =>
    deltas.map((delta, index) => ({
      time: NOW + index,
      hash: `0x${index}`,
      delta,
    })) as unknown as Parameters<typeof sumPerpsNetDeposits>[0];

  it('counts bridge deposits and legacy withdrawals', () => {
    expect(
      sumPerpsNetDeposits(
        ledger([
          { type: 'deposit', usdc: '100' },
          { type: 'withdraw', usdc: '30', fee: '1.0' },
        ]),
      ),
    ).toBe(70);
  });

  // A CCTP withdrawal is a `send` to the system address, not a `withdraw`.
  it('counts a CCTP withdrawal as an outflow', () => {
    expect(
      sumPerpsNetDeposits(
        ledger([
          { type: 'deposit', usdc: '100' },
          {
            type: 'send',
            user: ME,
            destination: SYSTEM,
            sourceDex: 'spot',
            destinationDex: 'spot',
            token: 'USDC',
            amount: '40',
          },
        ]),
      ),
    ).toBe(60);
  });

  // Unified accounts withdraw from spot, so filtering on source would hide
  // every withdrawal the app itself makes.
  it('counts a withdrawal whichever balance it is sourced from', () => {
    const fromSpot = sumPerpsNetDeposits(
      ledger([
        {
          type: 'send',
          user: ME,
          destination: SYSTEM,
          sourceDex: 'spot',
          destinationDex: 'spot',
          token: 'USDC',
          amount: '10',
        },
      ]),
    );
    const fromPerp = sumPerpsNetDeposits(
      ledger([
        {
          type: 'send',
          user: ME,
          destination: SYSTEM,
          sourceDex: '',
          destinationDex: 'spot',
          token: 'USDC',
          amount: '10',
        },
      ]),
    );
    expect(fromSpot).toBe(-10);
    expect(fromPerp).toBe(-10);
  });

  // HyperEVM credits come back as a `spotTransfer` sent by the system address.
  it('nets a Core/HyperEVM round trip to zero', () => {
    expect(
      sumPerpsNetDeposits(
        ledger([
          {
            type: 'send',
            user: ME,
            destination: SYSTEM,
            sourceDex: 'spot',
            destinationDex: 'spot',
            token: 'USDC',
            amount: '25',
          },
          {
            type: 'spotTransfer',
            user: SYSTEM,
            destination: ME,
            token: 'USDC',
            amount: '25',
            usdcValue: '25',
          },
        ]),
      ),
    ).toBe(0);
  });

  // Neither a deposit nor a withdrawal, and counting it double-subtracted
  // spot-sourced withdrawals.
  it('ignores transfers between the account own balances', () => {
    expect(
      sumPerpsNetDeposits(
        ledger([
          { type: 'deposit', usdc: '100' },
          { type: 'accountClassTransfer', usdc: '100', toPerp: false },
          {
            type: 'send',
            user: ME,
            destination: ME,
            sourceDex: '',
            destinationDex: 'spot',
            token: 'USDC',
            amount: '100',
          },
          {
            type: 'send',
            user: ME,
            destination: SYSTEM,
            sourceDex: 'spot',
            destinationDex: 'spot',
            token: 'USDC',
            amount: '100',
          },
        ]),
      ),
    ).toBe(0);
  });

  it('ignores tokens other than USDC', () => {
    expect(
      sumPerpsNetDeposits(
        ledger([
          {
            type: 'send',
            user: ME,
            destination: SYSTEM,
            sourceDex: 'spot',
            destinationDex: 'spot',
            token: 'HYPE',
            amount: '5',
          },
        ]),
      ),
    ).toBe(0);
  });

  it('returns null before the ledger loads', () => {
    expect(sumPerpsNetDeposits(undefined)).toBeNull();
  });
});
