import type { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IEarnAvailableAssetV2 } from '@onekeyhq/shared/types/earn';
import type { IEarnPortfolioPositionsResponse } from '@onekeyhq/shared/types/earn/portfolioPositions';

import {
  buildPositionsRequests,
  holdingPositionsOf,
  mergePortfolioPositionsResponses,
  positionsScopeKey,
} from './earnPortfolioPositions.utils';
import { buildHoldingView } from './earnPositionModel';
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

describe('detail page holding', () => {
  const translate = (id: ETranslations) => id as string;

  it('keys a scope the way the page caches it', () => {
    expect(
      positionsScopeKey({
        networkId: 'evm--1',
        provider: 'lido',
        accountAddress: '0xme',
      }),
    ).toBe('evm--1_lido_0xme_');
  });

  it("picks every state of the page's holding, and folds them into the card the page shows", () => {
    const sources = holdingPositionsOf([EARN_PORTFOLIO_POSITIONS_FIXTURE], {
      networkId: 'evm--1',
      provider: 'LIDO',
      symbol: 'eth',
    });
    expect(sources.map((source) => source.groupId)).toEqual([
      'lido:evm--1:steth',
      'lido:evm--1:steth:claimable',
      'lido:evm--1:steth:unstaking:0',
      'lido:evm--1:steth:unstaking:1',
    ]);
    const view = buildHoldingView({ sources, provider: 'lido', translate });
    expect(view?.key).toBe('lido:evm--1:steth');
    expect(view?.sections.map((section) => section.kind)).toEqual([
      'deposited',
      'pendingWithdrawal',
      'redeemable',
    ]);
  });

  it('matches the vault without case, and keeps a holding filed under another protocol (the USDe cooling down at Ethena)', () => {
    const cooldown = Object.values(EARN_PORTFOLIO_POSITIONS_FIXTURE.positions)
      .flat()
      .find((position) => position.groupId.endsWith(':cooldown'));
    const sources = holdingPositionsOf([EARN_PORTFOLIO_POSITIONS_FIXTURE], {
      networkId: 'evm--1',
      provider: 'pendle',
      symbol: 'USDe',
      vault: cooldown?.earn.manage.vault?.toUpperCase(),
    });
    expect(sources.map((source) => source.groupId)).toEqual([
      cooldown?.groupId,
    ]);
    const view = buildHoldingView({ sources, provider: 'pendle', translate });
    expect(view?.source.protocol).toBe('ethena');
  });

  it('yields no card for a holding the wallet does not have', () => {
    expect(
      holdingPositionsOf([EARN_PORTFOLIO_POSITIONS_FIXTURE], {
        networkId: 'evm--1',
        provider: 'lido',
        symbol: 'ETH',
        vault: '0xother',
      }),
    ).toEqual([]);
    expect(
      buildHoldingView({ sources: [], provider: 'lido', translate }),
    ).toBeUndefined();
  });
});
