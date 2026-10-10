import type { IEarnAvailableAssetV2 } from '@onekeyhq/shared/types/earn';
import type { IEarnPortfolioPositionsResponse } from '@onekeyhq/shared/types/earn/portfolioPositions';

import {
  buildPositionsRequests,
  mergePortfolioPositionsResponses,
} from './earnPortfolioPositions.utils';
import { EARN_PORTFOLIO_POSITIONS_FIXTURE } from './earnPositionModel.fixtures';

const asset = (
  networkId: string,
  provider: string,
  extra: Partial<IEarnAvailableAssetV2> = {},
): IEarnAvailableAssetV2 => ({
  type: 'normal',
  networkId,
  provider,
  symbol: 'X',
  ...extra,
});

describe('buildPositionsRequests', () => {
  it('makes one request per account, network and provider, never per vault', () => {
    const requests = buildPositionsRequests({
      accountId: 'acc',
      assets: [
        asset('evm--1', 'lido', { symbol: 'ETH' }),
        asset('evm--1', 'morpho', { vault: '0xa' }),
        asset('evm--1', 'morpho', { vault: '0xb' }),
        asset('evm--8453', 'morpho', { vault: '0xc' }),
        asset('sol--101', 'stakefish', { symbol: 'SOL' }),
      ],
      accounts: [
        { networkId: 'evm--1', accountAddress: '0x1' },
        { networkId: 'evm--8453', accountAddress: '0x1' },
      ],
    });
    expect(
      requests.map((request) => [request.networkId, request.provider]),
    ).toEqual([
      ['evm--1', 'lido'],
      ['evm--1', 'morpho'],
      ['evm--8453', 'morpho'],
    ]);
    expect(requests[0]).toEqual({
      key: 'evm--1_lido_0x1_',
      accountId: 'acc',
      accountAddress: '0x1',
      networkId: 'evm--1',
      provider: 'lido',
    });
  });

  it('skips airdrop entries and carries the public key when the account has one', () => {
    const requests = buildPositionsRequests({
      accountId: 'acc',
      assets: [
        asset('btc--0', 'babylon', { symbol: 'BTC' }),
        asset('evm--1', 'native', { type: 'airdrop' }),
      ],
      accounts: [
        { networkId: 'btc--0', accountAddress: 'bc1', publicKey: 'pub' },
        { networkId: 'evm--1', accountAddress: '0x1' },
      ],
    });
    expect(requests).toEqual([
      {
        key: 'btc--0_babylon_bc1_pub',
        accountId: 'acc',
        accountAddress: 'bc1',
        networkId: 'btc--0',
        provider: 'babylon',
        publicKey: 'pub',
      },
    ]);
  });
});

describe('mergePortfolioPositionsResponses', () => {
  it('concatenates positions per network, summaries and errors', () => {
    const [eth, ...rest] = EARN_PORTFOLIO_POSITIONS_FIXTURE.positions['evm--1'];
    const a: IEarnPortfolioPositionsResponse = {
      positions: { 'evm--1': [eth] },
      protocolSummaries: [
        EARN_PORTFOLIO_POSITIONS_FIXTURE.protocolSummaries[0],
      ],
      errors: [],
    };
    const b: IEarnPortfolioPositionsResponse = {
      positions: { 'evm--1': rest, 'evm--8453': [] },
      protocolSummaries: [
        EARN_PORTFOLIO_POSITIONS_FIXTURE.protocolSummaries[1],
      ],
      errors: [{ vault: '0xv', symbol: 'USDC', errorCode: 'INTERNAL_ERROR' }],
    };
    const merged = mergePortfolioPositionsResponses([a, b]);
    expect(merged.positions['evm--1']).toEqual(
      EARN_PORTFOLIO_POSITIONS_FIXTURE.positions['evm--1'],
    );
    expect(merged.positions['evm--8453']).toEqual([]);
    expect(merged.protocolSummaries).toHaveLength(2);
    expect(merged.errors).toHaveLength(1);
  });
});
