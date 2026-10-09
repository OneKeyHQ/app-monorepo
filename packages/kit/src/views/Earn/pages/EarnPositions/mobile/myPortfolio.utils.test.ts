import { buildLocalTxStatusSyncId } from '@onekeyhq/kit/src/views/Staking/utils/utils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EClaimType } from '@onekeyhq/shared/types/staking';
import type {
  IEarnRewardsPortfolioGroup,
  IEarnRewardsPortfolioItem,
} from '@onekeyhq/shared/types/staking';

import {
  CLAIM_BUTTON,
  EARN_PORTFOLIO_POSITIONS_FIXTURE,
  SUSDE_VAULT,
} from './earnPositionModel.fixtures';
import {
  buildClaimSourceCandidates,
  buildNetworkInfoMap,
  hasPositionDetailPage,
  positionPendingTag,
  sumRewardsHeaderFiat,
  toLedgerClaimAsset,
  toPositionAirdropClaimAsset,
} from './myPortfolio.utils';

const POSITIONS = Object.values(
  EARN_PORTFOLIO_POSITIONS_FIXTURE.positions,
).flat();
const lido = POSITIONS.find(
  (position) => position.groupId === 'lido:evm--1:steth',
);
const cooldown = POSITIONS.find(
  (position) => position.groupId === `pendle:evm--1:${SUSDE_VAULT}:cooldown`,
);
if (!lido || !cooldown) {
  throw new OneKeyLocalError(
    'fixture changed: Lido or Pendle cooldown position missing',
  );
}

describe('sumRewardsHeaderFiat', () => {
  it('adds the positions claimable rewards on top of the ledger total', () => {
    expect(
      sumRewardsHeaderFiat({
        ledgerRewardsFiatValue: '12.5',
        positionRewardsValue: 1.44,
      }),
    ).toBe('13.94');
  });

  it('is 0 with nothing loaded', () => {
    expect(
      sumRewardsHeaderFiat({
        ledgerRewardsFiatValue: undefined,
        positionRewardsValue: 0,
      }),
    ).toBe('0');
  });
});

describe('positionPendingTag', () => {
  it('tags a position with the id the detail page stamps on its txs', () => {
    expect(positionPendingTag(lido)).toBe(
      buildLocalTxStatusSyncId({
        providerName: 'lido',
        tokenSymbol: 'ETH',
        protocolVault: undefined,
      }),
    );
  });
});

describe('hasPositionDetailPage', () => {
  it('only the Pendle USDe row without buttons has no page', () => {
    expect(hasPositionDetailPage(lido)).toBe(true);
    expect(hasPositionDetailPage(cooldown)).toBe(false);
    expect(
      hasPositionDetailPage({
        ...cooldown,
        earn: {
          ...cooldown.earn,
          investment: {
            ...cooldown.earn.investment,
            buttons: [
              { type: 'manage', text: { text: 'Manage' }, disabled: false },
            ],
          },
        },
      }),
    ).toBe(true);
  });
});

describe('toPositionAirdropClaimAsset', () => {
  it('rebuilds the airdrop asset the claim flow keys on: symbol, vault, provider, network', () => {
    const asset = toPositionAirdropClaimAsset(cooldown);
    expect(asset).toMatchObject({
      token: { info: { symbol: 'USDe' } },
      airdropAssets: [{ claimType: 'airdrop', button: CLAIM_BUTTON }],
      metadata: {
        protocol: {
          vault: SUSDE_VAULT,
          providerDetail: { code: 'pendle', name: 'Pendle' },
        },
        network: { networkId: 'evm--1' },
      },
    });
  });

  it('yields nothing for a position whose claim runs on the detail page', () => {
    expect(toPositionAirdropClaimAsset(lido)).toBeUndefined();
    expect(
      toPositionAirdropClaimAsset({
        ...cooldown,
        earn: { ...cooldown.earn, claimSource: undefined },
      }),
    ).toBeUndefined();
  });
});

describe('buildClaimSourceCandidates / buildNetworkInfoMap', () => {
  it('lists every held position as a claim source, by protocol symbol', () => {
    expect(buildClaimSourceCandidates([lido])).toEqual([
      {
        networkId: 'evm--1',
        providerName: 'lido',
        symbol: 'ETH',
        vault: undefined,
      },
    ]);
  });

  it('names each network once, as the positions name it', () => {
    const map = buildNetworkInfoMap(POSITIONS);
    expect(map.get('evm--1')?.name).toBe(lido.earn.network.name);
    expect(map.size).toBe(
      new Set(POSITIONS.map((position) => position.networkId)).size,
    );
  });
});

describe('toLedgerClaimAsset', () => {
  const group: IEarnRewardsPortfolioGroup = {
    provider: 'native',
    providerName: 'OneKey',
    providerLogoURI: 'p.png',
    networkId: 'evm--1',
    total: { fiatValue: '3' },
    items: [],
  };
  const item = {
    title: { text: '1 USDC' },
    description: { text: '$1' },
    token: { info: { symbol: 'USDC', logoURI: 'u.png', address: '0xusdc' } },
    buttons: [
      { type: EClaimType.ClaimOrder, text: { text: 'Claim' }, disabled: false },
    ],
    stage: 'claimable',
    vault: '0xvault',
  } as unknown as IEarnRewardsPortfolioItem;

  it('wraps a ledger row into the airdrop-asset shape the claim button understands', () => {
    const asset = toLedgerClaimAsset({
      group,
      item,
      networkName: 'Ethereum',
      networkLogoURI: 'e.png',
    });
    expect(asset).toMatchObject({
      token: { info: { symbol: 'USDC', address: '0xusdc' } },
      airdropAssets: [{ claimType: 'airdrop', button: item.buttons?.[0] }],
      metadata: {
        protocol: { vault: '0xvault', providerDetail: { code: 'native' } },
        network: { networkId: 'evm--1', name: 'Ethereum', logoURI: 'e.png' },
      },
    });
  });

  it('yields nothing for a row without a button', () => {
    expect(
      toLedgerClaimAsset({
        group,
        item: { ...item, buttons: [] },
        networkName: '',
        networkLogoURI: '',
      }),
    ).toBeUndefined();
  });
});
