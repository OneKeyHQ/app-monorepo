import BigNumber from 'bignumber.js';

import type { IDeFiAsset, IProtocolSummary } from '@onekeyhq/shared/types/defi';
import type {
  IEarnPortfolioPosition,
  IEarnPortfolioPositionsResponse,
  IEarnPositionAssetCategory,
  IEarnPositionCategory,
  IEarnPositionExtension,
} from '@onekeyhq/shared/types/earn/portfolioPositions';

/**
 * Mock response in the positions contract: the cases the page has to get
 * right — a staking position with withdrawn and unstaking principal (Lido),
 * dated Pendle markets, Morpho vaults on two chains with a loan, Everstake
 * with yield, Stakefish on Solana. Owners are placeholders.
 */

const FETCHED_AT = '2026-09-28T03:40:00.000Z';
const EVM_OWNER = '0x0000000000000000000000000000000000000001';
const SOL_OWNER = '11111111111111111111111111111112';

const PROTOCOL_LOGO: Record<string, string> = {
  lido: 'https://uni.onekey-asset.com/static/logo/Lido.png',
  pendle: 'https://uni.onekey-asset.com/static/logo/pendle.png',
  morpho: 'https://uni.onekey-asset.com/static/logo/morpho.png',
  everstake: 'https://uni.onekey-asset.com/static/logo/everstake.png',
  stakefish: 'https://uni.onekey-asset.com/static/logo/stakefish.png',
};

export function token({
  symbol,
  amount,
  price,
  category = 'deposit',
}: {
  symbol: string;
  amount: string;
  price: number;
  category?: IEarnPositionAssetCategory;
}): IDeFiAsset {
  return {
    symbol,
    address: '',
    amount,
    price,
    value: new BigNumber(amount).times(price).toNumber(),
    category,
    meta: {
      decimals: 18,
      logoUrl: `https://logo/${symbol}.png`,
      isVerified: true,
    },
  };
}

const sumValues = (assets: IDeFiAsset[]) =>
  assets.reduce((sum, asset) => sum.plus(asset.value), new BigNumber(0));

export function position({
  networkId,
  chain,
  protocol,
  protocolName,
  category,
  groupId,
  name,
  assets = [],
  debts = [],
  rewards = [],
  healthFactor = null,
  earn = {},
}: {
  networkId: string;
  chain: string;
  protocol: string;
  protocolName: string;
  category: IEarnPositionCategory;
  groupId: string;
  name: string;
  assets?: IDeFiAsset[];
  debts?: IDeFiAsset[];
  rewards?: IDeFiAsset[];
  healthFactor?: number | null;
  /** the server fills every field; a fixture names what the case is about */
  earn?: Partial<IEarnPositionExtension>;
}): IEarnPortfolioPosition {
  const symbol = earn.symbol ?? assets[0]?.symbol ?? '';
  return {
    networkId,
    owner: networkId.startsWith('sol') ? SOL_OWNER : EVM_OWNER,
    protocol,
    protocolName,
    chain,
    category,
    assets,
    debts,
    rewards,
    metrics: { healthFactor },
    source: {
      provider: 'onekey-earn',
      fetchedAt: FETCHED_AT,
      ttl: 60,
      cached: false,
    },
    groupId,
    name,
    earn: {
      manage: { networkId, provider: protocol, symbol },
      symbol,
      network: { networkId, name: networkId, logoURI: '' },
      investment: {
        totalFiatValue: sumValues(assets).toFixed(),
        earnings24hFiatValue: '0',
      },
      ...earn,
    },
  };
}

function summary(
  positions: IEarnPortfolioPosition[],
  protocol: string,
  networkId: string,
): IProtocolSummary {
  const own = positions.filter(
    (item) => item.protocol === protocol && item.networkId === networkId,
  );
  const totalValue = sumValues(own.flatMap((item) => item.assets));
  const totalDebt = sumValues(own.flatMap((item) => item.debts));
  const totalReward = sumValues(own.flatMap((item) => item.rewards));
  return {
    protocol,
    protocolName: own[0]?.protocolName ?? protocol,
    totalValue: totalValue.toNumber(),
    totalDebt: totalDebt.toNumber(),
    totalReward: totalReward.toNumber(),
    netWorth: totalValue.plus(totalReward).minus(totalDebt).toNumber(),
    networkIds: [networkId],
    positionCount: own.length,
    positionIndices: [],
    protocolLogo: PROTOCOL_LOGO[protocol] ?? '',
    protocolUrl: '',
  };
}

const ethereum = { networkId: 'evm--1', chain: 'evm' };
const base = { networkId: 'evm--8453', chain: 'evm' };
const solana = { networkId: 'sol--101', chain: 'sol' };

export const LIDO_UNLOCK_AT = Date.parse('2026-10-02T08:00:00Z');
export const LIDO_LATER_UNLOCK_AT = Date.parse('2026-10-05T08:00:00Z');

const ETHEREUM_POSITIONS: IEarnPortfolioPosition[] = [
  // Lido: one position; the deposit, a withdrawal ready to claim and two
  // still unstaking are its assets (product: one holding, one card).
  position({
    ...ethereum,
    protocol: 'lido',
    protocolName: 'Lido',
    category: 'staked',
    groupId: 'lido:evm--1:steth',
    name: 'Lido staked ETH',
    assets: [
      token({ symbol: 'ETH', amount: '4', price: 3150 }),
      token({
        symbol: 'ETH',
        amount: '0.5',
        price: 3150,
        category: 'claimable',
      }),
      token({
        symbol: 'ETH',
        amount: '0.25',
        price: 3150,
        category: 'unstaking',
      }),
      token({
        symbol: 'ETH',
        amount: '0.3',
        price: 3150,
        category: 'unstaking',
      }),
    ],
    earn: {
      investment: {
        totalFiatValue: '15907.5',
        earnings24hFiatValue: '1.2',
        assetsStatus: [
          {
            title: { text: '4 ETH' },
            description: { text: 'Active' },
            kind: 'active',
            amount: '4',
          },
          {
            title: { text: '0.25 ETH' },
            description: { text: 'Withdrawal requested' },
            kind: 'unstaking',
            amount: '0.25',
            unlockAt: LIDO_UNLOCK_AT,
          },
          {
            title: { text: '0.3 ETH' },
            description: { text: 'Withdrawal requested' },
            kind: 'unstaking',
            amount: '0.3',
            unlockAt: LIDO_LATER_UNLOCK_AT,
          },
        ],
      },
    },
  }),
  position({
    ...ethereum,
    protocol: 'pendle',
    protocolName: 'Pendle',
    category: 'yield',
    groupId: 'pendle:evm--1:0xusdg',
    name: 'PT-USDG-28MAY2026',
    assets: [token({ symbol: 'PT-USDG', amount: '120', price: 0.98 })],
    earn: {
      symbol: 'USDG',
      vault: '0xusdg',
      maturityAt: Date.parse('2026-05-28T00:00:00Z'),
    },
  }),
  position({
    ...ethereum,
    protocol: 'pendle',
    protocolName: 'Pendle',
    category: 'yield',
    groupId: 'pendle:evm--1:0xusd3',
    name: 'PT-USD3-17DEC2026',
    assets: [token({ symbol: 'PT-USD3', amount: '1.1405', price: 0.9733 })],
    earn: {
      symbol: 'USD3',
      vault: '0xusd3',
      maturityAt: Date.parse('2026-12-17T00:00:00Z'),
    },
  }),
  position({
    ...ethereum,
    protocol: 'morpho',
    protocolName: 'Morpho',
    category: 'yield',
    groupId: 'morpho:evm--1:0xa71d08a159258553a5ac190d60fa919425ff02ea',
    name: 'Steakhouse USDC',
    assets: [token({ symbol: 'USDC', amount: '50', price: 1 })],
    rewards: [
      token({
        symbol: 'MORPHO',
        amount: '0.0213',
        price: 1.2,
        category: 'reward',
      }),
    ],
    earn: {
      symbol: 'USDC',
      vault: '0xa71d08a159258553a5ac190d60fa919425ff02ea',
    },
  }),
  position({
    ...ethereum,
    protocol: 'morpho',
    protocolName: 'Morpho',
    category: 'lending',
    groupId: 'morpho:evm--1:market:weth-usdc',
    name: 'WETH / USDC',
    assets: [token({ symbol: 'WETH', amount: '0.02', price: 3150 })],
    debts: [token({ symbol: 'USDC', amount: '20.01', price: 1 })],
    rewards: [
      token({
        symbol: 'MORPHO',
        amount: '1.2',
        price: 1.2,
        category: 'reward',
      }),
    ],
    healthFactor: 1.62,
    earn: { symbol: 'WETH', vault: 'market:weth-usdc' },
  }),
  position({
    ...ethereum,
    protocol: 'everstake',
    protocolName: 'Everstake',
    category: 'staked',
    groupId: 'everstake:evm--1:eth',
    name: 'Everstake ETH',
    assets: [
      token({ symbol: 'ETH', amount: '0.1', price: 3150 }),
      token({
        symbol: 'ETH',
        amount: '0.05',
        price: 3150,
        category: 'claimable',
      }),
    ],
    rewards: [
      token({
        symbol: 'ETH',
        amount: '0.001',
        price: 3150,
        category: 'reward',
      }),
    ],
  }),
];

const BASE_POSITIONS: IEarnPortfolioPosition[] = [
  position({
    ...base,
    protocol: 'morpho',
    protocolName: 'Morpho',
    category: 'yield',
    groupId: 'morpho:evm--8453:0xbase',
    name: 'Moonwell USDC',
    assets: [token({ symbol: 'USDC', amount: '10', price: 1 })],
    earn: { symbol: 'USDC', vault: '0xbase' },
  }),
  position({
    ...base,
    protocol: 'pendle',
    protocolName: 'Pendle',
    category: 'yield',
    groupId: 'pendle:evm--8453:0xusdat',
    name: 'PT-USDat-14JAN2027',
    assets: [token({ symbol: 'PT-USDat', amount: '8', price: 0.95 })],
    earn: {
      symbol: 'USDat',
      vault: '0xusdat',
      maturityAt: Date.parse('2027-01-14T00:00:00Z'),
    },
  }),
];

const SOLANA_POSITIONS: IEarnPortfolioPosition[] = [
  position({
    ...solana,
    protocol: 'stakefish',
    protocolName: 'Stakefish',
    category: 'staked',
    groupId: 'stakefish:sol--101:SOL',
    name: 'Stakefish SOL',
    assets: [
      token({ symbol: 'SOL', amount: '0.008119', price: 110 }),
      token({
        symbol: 'SOL',
        amount: '0.008045',
        price: 110,
        category: 'claimable',
      }),
    ],
  }),
];

const ALL_POSITIONS = [
  ...ETHEREUM_POSITIONS,
  ...BASE_POSITIONS,
  ...SOLANA_POSITIONS,
];

export const EARN_PORTFOLIO_POSITIONS_FIXTURE: IEarnPortfolioPositionsResponse =
  {
    positions: {
      'evm--1': ETHEREUM_POSITIONS,
      'evm--8453': BASE_POSITIONS,
      'sol--101': SOLANA_POSITIONS,
    },
    errors: [],
    protocolSummaries: [
      summary(ALL_POSITIONS, 'lido', 'evm--1'),
      summary(ALL_POSITIONS, 'pendle', 'evm--1'),
      summary(ALL_POSITIONS, 'morpho', 'evm--1'),
      summary(ALL_POSITIONS, 'everstake', 'evm--1'),
      summary(ALL_POSITIONS, 'morpho', 'evm--8453'),
      summary(ALL_POSITIONS, 'pendle', 'evm--8453'),
      summary(ALL_POSITIONS, 'stakefish', 'sol--101'),
    ],
  };
