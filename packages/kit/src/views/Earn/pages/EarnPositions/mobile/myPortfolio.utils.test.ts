import { buildLocalTxStatusSyncId } from '@onekeyhq/kit/src/views/Staking/utils/utils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IEarnPortfolioPosition } from '@onekeyhq/shared/types/earn/portfolioPositions';
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
  mergeClaimableRewardGroups,
  positionPendingTag,
  sumRewardsHeaderFiat,
  toLedgerClaimAsset,
  toPositionCancel,
  toPositionClaim,
  toPositionRewardClaim,
} from './myPortfolio.utils';

import type {
  IEarnClaimableReward,
  IEarnClaimableRewardGroup,
} from './earnPositionModel';

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
const everstake = POSITIONS.find(
  (position) => position.groupId === 'everstake:evm--1:eth',
);
const morphoLoan = POSITIONS.find(
  (position) => position.groupId === 'morpho:evm--1:market:weth-usdc',
);
if (!lido || !lidoClaimable || !cooldown || !everstake || !morphoLoan) {
  throw new OneKeyLocalError(
    'fixture changed: Lido, Ethena cooldown, Everstake or Morpho loan missing',
  );
}

function claimableReward(
  position: IEarnPortfolioPosition,
  index = 0,
): IEarnClaimableReward {
  const reward = position.rewards[index];
  if (!reward.claim) {
    throw new OneKeyLocalError('fixture changed: reward without a claim');
  }
  return { ...reward, claim: reward.claim };
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

describe('toPositionRewardClaim', () => {
  it('runs a yield row claim as a normal asset keyed on the position, the row as the reward', () => {
    const claim = toPositionRewardClaim(everstake, claimableReward(everstake));
    expect(claim).toMatchObject({
      asset: {
        token: { info: { symbol: 'ETH' } },
        metadata: {
          protocol: {
            providerDetail: { code: 'everstake', name: 'Everstake' },
          },
          network: { networkId: 'evm--1' },
        },
      },
      reward: { title: { text: '0.001 ETH' }, button: CLAIM_BUTTON },
      rewardSymbol: 'ETH',
    });
    expect(claim.asset).not.toHaveProperty('airdropAssets');
  });

  it('runs a campaign row claim as an airdrop row that names the position as its claim source', () => {
    const claim = toPositionRewardClaim(
      morphoLoan,
      claimableReward(morphoLoan, 1),
    );
    expect(claim).toMatchObject({
      asset: {
        token: { info: { symbol: 'KAT' } },
        airdropAssets: [
          {
            title: { text: '3 KAT' },
            button: CLAIM_BUTTON,
            claimType: 'normal',
          },
        ],
        metadata: {
          protocol: {
            vault: 'market:weth-usdc',
            claimSymbol: 'WETH',
            providerDetail: { code: 'morpho', name: 'Morpho' },
          },
          network: { networkId: 'evm--1' },
        },
      },
      reward: { title: { text: '3 KAT' }, button: CLAIM_BUTTON },
      rewardSymbol: 'KAT',
    });
  });

  it('matches the pending claim on the token the button pays out when it names one', () => {
    const reward = claimableReward(morphoLoan);
    const claim = toPositionRewardClaim(morphoLoan, {
      ...reward,
      claim: {
        ...reward.claim,
        button: {
          ...CLAIM_BUTTON,
          data: {
            balance: '1.2',
            token: {
              price: '1.2',
              info: { symbol: 'MORPHO-V2' } as never,
            },
          },
        },
      },
    });
    expect(claim.rewardSymbol).toBe('MORPHO-V2');
  });
});

describe('mergeClaimableRewardGroups', () => {
  const positionGroup: IEarnClaimableRewardGroup = {
    key: 'evm--1-morpho',
    protocol: 'morpho',
    networkId: 'evm--1',
    name: 'Morpho',
    logoURI: 'm.png',
    value: { value: 1.5, hasAvailableValue: true, hasUnavailableValue: false },
    rows: [],
  };
  const ledgerGroup = (
    overrides: Partial<IEarnRewardsPortfolioGroup>,
  ): IEarnRewardsPortfolioGroup => ({
    provider: 'morpho',
    providerName: 'Morpho',
    providerLogoURI: 'l.png',
    networkId: 'evm--1',
    total: { fiatValue: '2' },
    items: [
      { token: { info: { symbol: 'MORPHO' } } } as IEarnRewardsPortfolioItem,
    ],
    ...overrides,
  });

  it("puts a protocol's position rewards and ledger rewards in one group, highest first", () => {
    const groups = mergeClaimableRewardGroups({
      positionGroups: [positionGroup],
      ledgerGroups: [
        ledgerGroup({}),
        ledgerGroup({
          provider: 'native',
          providerName: 'OneKey',
          total: { fiatValue: '9' },
        }),
      ],
    });
    expect(
      groups.map((group) => [group.key, group.name, group.value.value]),
    ).toEqual([
      ['evm--1|native', 'OneKey', 9],
      ['evm--1|morpho', 'Morpho', 3.5],
    ]);
    const [, morpho] = groups;
    // the protocol row's name and logo win; the ledger rows follow the positions'
    expect(morpho.logoURI).toBe('m.png');
    expect(morpho.ledgerItems).toHaveLength(1);
    expect(morpho.value).toEqual({
      value: 3.5,
      hasAvailableValue: true,
      hasUnavailableValue: false,
    });
  });

  it('shows a ledger group nothing priced by its token amount', () => {
    const [group] = mergeClaimableRewardGroups({
      positionGroups: [],
      ledgerGroups: [
        ledgerGroup({
          total: { fiatValue: '0', amount: '12', symbol: 'MORPHO' },
        }),
      ],
    });
    expect(group.amountOnly).toEqual({ amount: '12', symbol: 'MORPHO' });
    expect(group.value).toEqual({
      value: 0,
      hasAvailableValue: false,
      hasUnavailableValue: true,
    });
    expect(
      mergeClaimableRewardGroups({ positionGroups: [], ledgerGroups: [] }),
    ).toEqual([]);
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
