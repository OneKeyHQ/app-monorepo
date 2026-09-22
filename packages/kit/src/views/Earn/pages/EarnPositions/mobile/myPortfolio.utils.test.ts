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
  filterInvestmentsByNetworks,
  groupInvestmentsByProvider,
  isLedgerAirdropProvider,
  selectProtocolClaimableInvestments,
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
      ETranslations.wallet_defi_position_module_staked,
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
});

describe('selectProtocolClaimableInvestments', () => {
  it('keeps positions with reward rows, and on-chain airdrops of non-ledger providers only', () => {
    const withRewards = investment({
      assets: [asset({ rewardAssets: [{ title: { text: '0.1 USDC' } }] })],
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
        withRewards,
        morphoAirdrop,
        sparkAirdrop,
        plain,
      ]),
    ).toEqual([withRewards, morphoAirdrop]);
  });
});

describe('sumRewardsHeaderFiat', () => {
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
