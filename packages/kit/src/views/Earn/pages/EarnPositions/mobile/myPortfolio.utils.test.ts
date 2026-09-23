import BigNumber from 'bignumber.js';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IEarnPortfolioInvestment,
  IEarnRewardsPortfolioGroup,
  IEarnRewardsPortfolioItem,
} from '@onekeyhq/shared/types/staking';

import {
  LEDGER_AIRDROP_PROVIDERS,
  buildClaimSourceCandidates,
  categoryLabelId,
  countInvestmentsByNetwork,
  depositedFiatValue,
  filterInvestmentsByNetworks,
  groupInvestmentsByProvider,
  isLedgerAirdropProvider,
  resolveDefiAssetsFiatValue,
  selectProtocolClaimableInvestments,
  sizedRewardRows,
  splitPositionRows,
  sumRewardsHeaderFiat,
  toLedgerClaimAsset,
} from './myPortfolio.utils';

function investment(
  overrides: Partial<IEarnPortfolioInvestment> & {
    provider?: string;
    networkId?: string;
    vault?: string;
    symbol?: string;
  } = {},
): IEarnPortfolioInvestment {
  const {
    provider = 'morpho',
    networkId = 'evm--1',
    vault = '0xvault',
    symbol = 'USDC',
    ...rest
  } = overrides;
  return {
    totalFiatValue: '10',
    earnings24hFiatValue: '0',
    protocol: {
      networkId,
      provider,
      symbol,
      vault,
      vaultName: `${provider} ${symbol}`,
      providerDetail: { code: provider, name: provider, logoURI: '' },
    },
    network: { networkId, name: networkId, logoURI: '' },
    assets: [],
    airdropAssets: [],
    ...rest,
  } as IEarnPortfolioInvestment;
}

const asset = (extra: Record<string, unknown> = {}) =>
  ({
    token: { info: { symbol: 'USDC', logoURI: '' } },
    deposit: { title: { text: '1 USDC' } },
    metadata: {
      protocol: {
        vault: '0xvault',
        providerDetail: { code: 'morpho', name: 'Morpho', logoURI: '' },
      },
      network: { networkId: 'evm--1', name: 'Ethereum', logoURI: '' },
    },
    ...extra,
  }) as IEarnPortfolioInvestment['assets'][number];

const airdropAsset = (rows = 1) =>
  ({
    token: { info: { symbol: 'MORPHO', logoURI: '' } },
    airdropAssets: Array.from({ length: rows }, () => ({
      title: { text: '1 MORPHO' },
      button: {
        type: 'claimAirdrop',
        text: { text: 'Claim' },
        disabled: false,
      },
    })),
    metadata: {
      protocol: {
        providerDetail: { code: 'morpho', name: 'Morpho', logoURI: '' },
      },
      network: { networkId: 'evm--1', name: 'Ethereum', logoURI: '' },
    },
  }) as unknown as IEarnPortfolioInvestment['airdropAssets'][number];

describe('categoryLabelId', () => {
  it('maps the server categories onto the design labels', () => {
    expect(categoryLabelId('simpleEarn')).toBe(ETranslations.earn_yield);
    expect(categoryLabelId('fixedRate')).toBe(ETranslations.earn_yield);
    expect(categoryLabelId('staking')).toBe(
      ETranslations.earn_category_staked__title,
    );
    expect(categoryLabelId('lending')).toBe(ETranslations.earn_loans);
    expect(categoryLabelId(undefined)).toBeUndefined();
  });
});

describe('isLedgerAirdropProvider', () => {
  it('names exactly the providers whose airdrop-detail is the ledger', () => {
    expect(LEDGER_AIRDROP_PROVIDERS).toEqual(['native', 'spark']);
    expect(isLedgerAirdropProvider('Spark')).toBe(true);
    expect(isLedgerAirdropProvider('morpho')).toBe(false);
  });
});

describe('groupInvestmentsByProvider', () => {
  it('collapses vaults under their provider, sums fiat, sorts richest first', () => {
    const groups = groupInvestmentsByProvider([
      investment({ provider: 'morpho', vault: 'a', totalFiatValue: '1' }),
      investment({ provider: 'spark', totalFiatValue: '5' }),
      investment({
        provider: 'morpho',
        vault: 'b',
        networkId: 'evm--8453',
        totalFiatValue: '2',
      }),
    ]);
    expect(
      groups.map((g) => [
        g.providerCode,
        g.totalFiatValue,
        g.investments.length,
      ]),
    ).toEqual([
      ['spark', '5', 1],
      ['morpho', '3', 2],
    ]);
  });
});

describe('network filter helpers', () => {
  const list = [
    investment({ networkId: 'evm--1' }),
    investment({ networkId: 'evm--1', vault: 'b' }),
    investment({ networkId: 'evm--8453' }),
  ];
  it('counts vaults per network', () => {
    expect(countInvestmentsByNetwork(list)).toEqual({
      'evm--1': 2,
      'evm--8453': 1,
    });
  });
  it('an empty selection means every network', () => {
    expect(filterInvestmentsByNetworks(list, [])).toHaveLength(3);
    expect(filterInvestmentsByNetworks(list, ['evm--8453'])).toHaveLength(1);
  });
  it('goes by the assets: a multi-chain investment counts and matches on every network it holds', () => {
    const stakefish = investment({
      provider: 'stakefish',
      networkId: 'sol--101',
      assets: [
        asset({ metadata: { network: { networkId: 'sol--101' } } }),
        asset({ metadata: { network: { networkId: 'cosmos--cosmoshub-4' } } }),
      ],
    });
    expect(countInvestmentsByNetwork([stakefish])).toEqual({
      'sol--101': 1,
      'cosmos--cosmoshub-4': 1,
    });
    expect(
      filterInvestmentsByNetworks([stakefish], ['cosmos--cosmoshub-4']),
    ).toEqual([stakefish]);
    expect(filterInvestmentsByNetworks([stakefish], ['evm--1'])).toEqual([]);
  });
});

describe('splitPositionRows / depositedFiatValue', () => {
  const classified = investment({
    totalFiatValue: '100',
    assets: [
      asset({
        rewardAssets: [
          {
            title: { text: '1' },
            kind: 'claimablePrincipal',
            amount: '1',
            fiatValue: '30',
          },
          { title: { text: '2' }, kind: 'reward', amount: '2', fiatValue: '5' },
          { title: { text: '3' } },
        ],
        assetsStatus: [
          {
            title: { text: 'a' },
            description: { text: '' },
            kind: 'active',
            amount: '9',
            fiatValue: '50',
          },
          {
            title: { text: 'u' },
            description: { text: '' },
            kind: 'unstaking',
            amount: '4',
            fiatValue: '20',
            unlockAt: 1,
          },
        ],
      }),
    ],
  });

  it('sorts rows by kind and keeps unclassified rows under rewards', () => {
    const { principal, unstaking, rewards } = splitPositionRows(classified);
    expect(principal.map((r) => r.row.fiatValue)).toEqual(['30']);
    expect(unstaking.map((r) => r.row.fiatValue)).toEqual(['20']);
    expect(rewards.map((r) => r.row.title.text)).toEqual(['2', '3']);
    expect(sizedRewardRows(classified).map((r) => r.row.fiatValue)).toEqual([
      '5',
    ]);
  });

  it('the Deposited card is the total minus what the other two cards show, never below 0', () => {
    expect(depositedFiatValue(classified)).toBe('50');
    expect(
      depositedFiatValue(
        investment({ totalFiatValue: '10', assets: [asset()] }),
      ),
    ).toBe('10');
    expect(
      depositedFiatValue(
        investment({
          totalFiatValue: '1',
          assets: [
            asset({
              rewardAssets: [
                {
                  title: { text: '' },
                  kind: 'claimablePrincipal',
                  fiatValue: '5',
                },
              ],
            }),
          ],
        }),
      ),
    ).toBe('0');
  });
});

describe('selectProtocolClaimableInvestments', () => {
  it('keeps sized yield rows and on-chain airdrops of non-ledger providers; unsized and principal rows stay on the DeFi Assets card', () => {
    const withSizedRewards = investment({
      assets: [
        asset({
          rewardAssets: [
            {
              title: { text: '0.1 USDC' },
              kind: 'reward',
              amount: '0.1',
              fiatValue: '0.1',
            },
          ],
        }),
      ],
    });
    const withRewards = investment({
      assets: [asset({ rewardAssets: [{ title: { text: '0.1 USDC' } }] })],
    });
    const withPrincipal = investment({
      assets: [
        asset({
          rewardAssets: [
            {
              title: { text: '1 ETH' },
              kind: 'claimablePrincipal',
              amount: '1',
              fiatValue: '2',
            },
          ],
        }),
      ],
    });
    const morphoAirdrop = investment({
      provider: 'morpho',
      airdropAssets: [airdropAsset()],
    });
    const sparkAirdrop = investment({
      provider: 'spark',
      airdropAssets: [airdropAsset()],
    });
    const plain = investment({ assets: [asset()] });
    expect(
      selectProtocolClaimableInvestments([
        withSizedRewards,
        withRewards,
        withPrincipal,
        morphoAirdrop,
        sparkAirdrop,
        plain,
      ]),
    ).toEqual([withSizedRewards, morphoAirdrop]);
  });
});

describe('resolveDefiAssetsFiatValue', () => {
  it('sums the listed rows while the hook total is still 0', () => {
    expect(
      resolveDefiAssetsFiatValue({
        hookTotal: new BigNumber(0),
        investments: [
          investment({ totalFiatValue: '2.25' }),
          investment({ totalFiatValue: '0.41', vault: 'b' }),
        ],
      }),
    ).toBe('2.66');
  });
  it('trusts the hook total once it has one, and shows 0 with nothing listed', () => {
    expect(
      resolveDefiAssetsFiatValue({
        hookTotal: new BigNumber('19.95'),
        investments: [investment({ totalFiatValue: '2.25' })],
      }),
    ).toBe('19.95');
    expect(
      resolveDefiAssetsFiatValue({
        hookTotal: new BigNumber(0),
        investments: [],
      }),
    ).toBe('0');
  });
});

describe('sumRewardsHeaderFiat', () => {
  it("adds each position's sized yield on top of the ledger and airdrop figures", () => {
    expect(
      sumRewardsHeaderFiat({
        ledgerRewardsFiatValue: '1',
        investments: [
          investment({ provider: 'stakefish', rewardsFiatValue: '0.5' }),
          investment({
            provider: 'native',
            rewardsFiatValue: '0.25',
            airdropFiatValue: '9',
          }),
        ],
      }),
    ).toBe('1.75');
  });
  it('adds the ledger total and the non-ledger airdrop fiat the page holds', () => {
    expect(
      sumRewardsHeaderFiat({
        ledgerRewardsFiatValue: '12.5',
        investments: [
          investment({ provider: 'morpho', airdropFiatValue: '2' }),
          // ledger-backed: already inside the server total
          investment({ provider: 'spark', airdropFiatValue: '99' }),
          investment({ provider: 'lido' }),
        ],
      }),
    ).toBe('14.5');
  });
  it('is 0 with nothing loaded', () => {
    expect(
      sumRewardsHeaderFiat({
        ledgerRewardsFiatValue: undefined,
        investments: [],
      }),
    ).toBe('0');
  });
});

describe('buildClaimSourceCandidates', () => {
  it('lists every held vault as a claim source', () => {
    expect(
      buildClaimSourceCandidates([investment({ assets: [asset()] })]),
    ).toEqual([
      {
        networkId: 'evm--1',
        providerName: 'morpho',
        symbol: 'USDC',
        vault: '0xvault',
      },
    ]);
  });
});

describe('toLedgerClaimAsset', () => {
  const group = {
    provider: 'spark',
    providerName: 'Spark',
    providerLogoURI: 'https://x/spark.png',
    networkId: 'evm--1',
    total: { fiatValue: '1' },
    items: [],
  } as IEarnRewardsPortfolioGroup;
  const item = {
    stage: 'claimable',
    vault: '0xvault',
    title: { text: '12.5 USDT' },
    description: { text: '' },
    fiatValue: '12.5',
    formattedValue: '12.5',
    token: {
      info: { symbol: 'USDT', logoURI: '', address: '0xusdt' },
      price: '1',
    },
    buttons: [
      {
        type: 'claimAirdrop',
        text: { text: 'Claim' },
        disabled: false,
        data: { balance: '12.5' },
      },
    ],
  } as unknown as IEarnRewardsPortfolioItem;

  it('wraps a ledger row into the airdrop-asset shape the claim button understands', () => {
    const result = toLedgerClaimAsset({
      group,
      item,
      networkName: 'Ethereum',
      networkLogoURI: '',
    });
    expect(result).toMatchObject({
      token: { info: { symbol: 'USDT', address: '0xusdt' } },
      airdropAssets: [
        { claimType: 'airdrop', button: { type: 'claimAirdrop' } },
      ],
      metadata: {
        protocol: {
          vault: '0xvault',
          providerDetail: { code: 'spark', name: 'Spark' },
        },
        network: { networkId: 'evm--1', name: 'Ethereum' },
      },
    });
  });

  it('yields nothing for a row without a button', () => {
    expect(
      toLedgerClaimAsset({
        group,
        item: { ...item, buttons: undefined },
        networkName: 'Ethereum',
        networkLogoURI: '',
      }),
    ).toBeUndefined();
  });
});
