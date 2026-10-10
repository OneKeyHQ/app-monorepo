import { buildLocalTxStatusSyncId } from '@onekeyhq/kit/src/views/Staking/utils/utils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EClaimType } from '@onekeyhq/shared/types/staking';
import type {
  IEarnRewardsPortfolioGroup,
  IEarnRewardsPortfolioItem,
} from '@onekeyhq/shared/types/staking';

import {
  CANCEL_BUTTON,
  CLAIM_BUTTON,
  EARN_PORTFOLIO_POSITIONS_FIXTURE,
  NATIVE_USDT_VAULT,
  SUSDE_VAULT,
} from './earnPositionModel.fixtures';
import {
  buildClaimSourceCandidates,
  buildNetworkInfoMap,
  hasPositionDetailPage,
  positionPendingTag,
  sumRewardsHeaderFiat,
  toLedgerClaimAsset,
  toPositionCancel,
  toPositionClaim,
} from './myPortfolio.utils';

const POSITIONS = Object.values(
  EARN_PORTFOLIO_POSITIONS_FIXTURE.positions,
).flat();
const lido = POSITIONS.find(
  (position) => position.groupId === 'lido:evm--1:steth',
);
const lidoClaimable = POSITIONS.find(
  (position) => position.groupId === 'lido:evm--1:steth:claimable',
);
const cooldown = POSITIONS.find(
  (position) => position.groupId === `ethena:evm--1:${SUSDE_VAULT}:cooldown`,
);
if (!lido || !lidoClaimable || !cooldown) {
  throw new OneKeyLocalError(
    'fixture changed: Lido or Ethena cooldown position missing',
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
  it('only the Pendle USDe row without buttons has no page, wherever it is filed', () => {
    expect(hasPositionDetailPage(lido)).toBe(true);
    expect(hasPositionDetailPage(lidoClaimable)).toBe(true);
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

describe('toPositionClaim', () => {
  it('runs the detail row claim as a normal asset keyed on the protocol symbol and vault', () => {
    const claim = toPositionClaim({
      ...lidoClaimable,
      earn: {
        ...lidoClaimable.earn,
        vault: '0xsteth',
        investment: {
          ...lidoClaimable.earn.investment,
          rewardAssets: [
            {
              kind: 'claimablePrincipal',
              title: { text: '0.5 ETH' },
              description: { text: '($1575)' },
              button: CLAIM_BUTTON,
            },
          ],
        },
      },
    });
    expect(claim).toMatchObject({
      asset: {
        token: { info: { symbol: 'ETH' } },
        metadata: {
          protocol: {
            vault: '0xsteth',
            providerDetail: { code: 'lido', name: 'Lido' },
          },
          network: { networkId: 'evm--1' },
        },
      },
      reward: { title: { text: '0.5 ETH' }, button: CLAIM_BUTTON },
      rewardSymbol: 'ETH',
    });
    expect(claim?.asset).not.toHaveProperty('airdropAssets');
    expect(claim?.reward).not.toHaveProperty('claimType');
  });

  it('runs the Ethena cooldown claim as a Pendle airdrop row, whatever protocol the card is filed under', () => {
    const claim = toPositionClaim(cooldown);
    expect(cooldown.protocol).toBe('ethena');
    expect(claim).toMatchObject({
      asset: {
        token: { info: { symbol: 'USDe' } },
        airdropAssets: [{ claimType: 'airdrop', button: CLAIM_BUTTON }],
        metadata: {
          protocol: {
            vault: SUSDE_VAULT,
            providerDetail: { code: 'pendle', name: 'Ethena' },
          },
          network: { networkId: 'evm--1' },
        },
      },
      reward: { claimType: 'airdrop', button: CLAIM_BUTTON },
      rewardSymbol: 'USDe',
    });
  });

  it('yields nothing for a position without a claim of its own', () => {
    expect(toPositionClaim(lido)).toBeUndefined();
  });
});

describe('toPositionCancel', () => {
  it('runs the withdrawal row cancel as a normal asset, keyed on the vault', () => {
    const locked = POSITIONS.find(
      (position) =>
        position.groupId === `native:evm--1:${NATIVE_USDT_VAULT}:unstaking:0`,
    );
    if (!locked) {
      throw new OneKeyLocalError('fixture changed: Native locked missing');
    }
    expect(toPositionCancel(locked)).toMatchObject({
      asset: {
        token: { info: { symbol: 'USDT' } },
        metadata: {
          protocol: {
            vault: NATIVE_USDT_VAULT,
            providerDetail: { code: 'native', name: 'Native' },
          },
          network: { networkId: 'evm--1' },
        },
      },
      reward: { title: { text: '0.112 USDT' }, button: CANCEL_BUTTON },
      rewardSymbol: 'USDT',
    });
    expect(toPositionCancel(lido)).toBeUndefined();
  });
});

describe('buildClaimSourceCandidates / buildNetworkInfoMap', () => {
  it('lists every held position as a claim source, by the provider that reads it', () => {
    expect(buildClaimSourceCandidates([lido, cooldown])).toEqual([
      {
        networkId: 'evm--1',
        providerName: 'lido',
        symbol: 'ETH',
        vault: undefined,
      },
      {
        networkId: 'evm--1',
        providerName: 'pendle',
        symbol: 'USDe',
        vault: SUSDE_VAULT,
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
