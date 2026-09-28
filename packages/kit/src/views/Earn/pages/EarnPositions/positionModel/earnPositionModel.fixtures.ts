import BigNumber from 'bignumber.js';

import type { IDeFiAsset, IProtocolSummary } from '@onekeyhq/shared/types/defi';
import { EClaimType } from '@onekeyhq/shared/types/staking';

import type {
  IEarnPortfolioPosition,
  IEarnPortfolioPositionsResponse,
  IEarnPositionCategory,
  IEarnPositionExtension,
} from './earnPositionModel.types';

/**
 * Mock response in the reference contract, built from the positions the test
 * wallet held on 2026-09-28 (Pendle markets, Morpho vaults on two chains,
 * Everstake / Stakefish withdrawals) plus the Lido and Loans cases of the
 * design. Owners are placeholders.
 */

const FETCHED_AT = '2026-09-28T03:40:00.000Z';
const EVM_OWNER = '0x0000000000000000000000000000000000000001';
const SOL_OWNER = '11111111111111111111111111111112';

const LOGO = {
  ETH: 'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address--1751363512633.png',
  USDC: 'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48-1749190981666.png',
  USDC_BASE:
    'https://uni.onekey-asset.com/server-service-indexer/evm--8453/tokens/address-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913-1720669295958.png',
  USDT: 'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xdac17f958d2ee523a2206206994597c13d831ec7-1722246302921.png',
  WETH: 'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2-1720667871986.png',
  MORPHO:
    'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0x58d97b57bb95320f9a05dc918aef65434969c2b2-1732155300090.png',
  POL: 'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0x455e53cbb86018ac2b8092fdcd39d8444affc3f6.png',
  SOL: 'https://uni.onekey-asset.com/server-service-indexer/sol--101/tokens/address--1758104080638.png',
  USD3: 'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0x056b269eb1f75477a8666ae8c7fe01b64dd55ecc-1773210188780.png',
  USDG: 'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xe343167631d89b6ffc58b88d6b7fb0228795491d-1757752756133.png',
  USDat:
    'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0x23238f20b894f29041f48d88ee91131c395aaa71-1775714413775.png',
} as const;

const PROTOCOL_LOGO = {
  lido: 'https://uni.onekey-asset.com/static/logo/Lido.png',
  pendle: 'https://uni.onekey-asset.com/static/logo/pendle.png',
  morpho: 'https://uni.onekey-asset.com/static/logo/morpho.png',
  everstake: 'https://uni.onekey-asset.com/static/logo/everstake.png',
  stakefish: 'https://uni.onekey-asset.com/static/logo/stakefish.png',
} as const;

const CLAIM_BUTTON = {
  type: EClaimType.ClaimOrder,
  text: { text: 'Claim' },
  disabled: false,
};

function token({
  symbol,
  amount,
  price,
  logoUrl,
  category = 'deposit',
}: {
  symbol: string;
  amount: string;
  price: number;
  logoUrl: string;
  category?: string;
}): IDeFiAsset {
  return {
    symbol,
    address: '',
    amount,
    price,
    value: new BigNumber(amount).times(price).toNumber(),
    category,
    meta: { decimals: 18, logoUrl, isVerified: true },
  };
}

function position({
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
  earn,
}: {
  networkId: string;
  chain: string;
  protocol: keyof typeof PROTOCOL_LOGO;
  protocolName: string;
  category: IEarnPositionCategory;
  groupId: string;
  name: string;
  assets?: IDeFiAsset[];
  debts?: IDeFiAsset[];
  rewards?: IDeFiAsset[];
  healthFactor?: number | null;
  earn: IEarnPositionExtension;
}): IEarnPortfolioPosition {
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
    earn,
  };
}

const sumValues = (assets: IDeFiAsset[]) =>
  assets.reduce((sum, asset) => sum.plus(asset.value), new BigNumber(0));

function summary(
  positions: IEarnPortfolioPosition[],
  protocol: keyof typeof PROTOCOL_LOGO,
): IProtocolSummary {
  const own = positions.filter((item) => item.protocol === protocol);
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
    networkIds: [own[0]?.networkId ?? ''],
    positionCount: own.length,
    positionIndices: [],
    protocolLogo: PROTOCOL_LOGO[protocol],
    protocolUrl: '',
  };
}

const ethereum = { networkId: 'evm--1', chain: 'eth' };
const base = { networkId: 'evm--8453', chain: 'base' };
const solana = { networkId: 'sol--101', chain: 'sol' };

const ETHEREUM_POSITIONS: IEarnPortfolioPosition[] = [
  // Lido: one deposit, one withdrawal ready to claim, two still unstaking.
  // Each is its own position (figma 30292-17104).
  position({
    ...ethereum,
    protocol: 'lido',
    protocolName: 'Lido',
    category: 'staked',
    groupId: 'lido:evm--1:steth',
    name: 'Lido staked ETH',
    assets: [
      token({ symbol: 'ETH', amount: '4', price: 3150, logoUrl: LOGO.ETH }),
    ],
    earn: {
      state: 'active',
      manage: { networkId: 'evm--1', provider: 'lido', symbol: 'ETH' },
    },
  }),
  position({
    ...ethereum,
    protocol: 'lido',
    protocolName: 'Lido',
    category: 'staked',
    groupId: 'lido:evm--1:withdrawal:81234',
    name: 'Lido staked ETH',
    assets: [
      token({ symbol: 'ETH', amount: '0.5', price: 3150, logoUrl: LOGO.ETH }),
    ],
    earn: { state: 'claimable', claim: CLAIM_BUTTON },
  }),
  position({
    ...ethereum,
    protocol: 'lido',
    protocolName: 'Lido',
    category: 'staked',
    groupId: 'lido:evm--1:withdrawal:81251',
    name: 'Lido staked ETH',
    assets: [
      token({ symbol: 'ETH', amount: '0.25', price: 3150, logoUrl: LOGO.ETH }),
    ],
    earn: { state: 'unstaking', unlockAt: Date.parse('2026-10-05T08:00:00Z') },
  }),
  position({
    ...ethereum,
    protocol: 'lido',
    protocolName: 'Lido',
    category: 'staked',
    groupId: 'lido:evm--1:withdrawal:81240',
    name: 'Lido staked ETH',
    assets: [
      token({ symbol: 'ETH', amount: '1', price: 3150, logoUrl: LOGO.ETH }),
    ],
    earn: { state: 'unstaking', unlockAt: Date.parse('2026-10-02T08:00:00Z') },
  }),

  // Pendle: one position per PT market. The maturity belongs to the market,
  // so it is part of that position's name, never shared by the protocol row.
  position({
    ...ethereum,
    protocol: 'pendle',
    protocolName: 'Pendle',
    category: 'yield',
    groupId: 'pendle:evm--1:0x4a5067c3ff1abb7449244025b0e37feaf77d8e3e',
    name: 'PT-USD3-17DEC2026',
    assets: [
      token({
        symbol: 'PT-USD3',
        amount: '1.1405',
        price: 0.9733,
        logoUrl: LOGO.USD3,
      }),
    ],
    earn: {
      state: 'active',
      maturityAt: Date.parse('2026-12-17T00:00:00Z'),
      manage: {
        networkId: 'evm--1',
        provider: 'pendle',
        symbol: 'USD3',
        vault: '0x4a5067c3ff1abb7449244025b0e37feaf77d8e3e',
      },
    },
  }),
  position({
    ...ethereum,
    protocol: 'pendle',
    protocolName: 'Pendle',
    category: 'yield',
    groupId: 'pendle:evm--1:0xc5b32dba5f29f8395fb9591e1a15f23a75214f33',
    name: 'PT-USDG-28MAY2026',
    assets: [
      token({
        symbol: 'PT-USDG',
        amount: '1.52',
        price: 1,
        logoUrl: LOGO.USDG,
      }),
    ],
    earn: {
      state: 'active',
      maturityAt: Date.parse('2026-05-28T00:00:00Z'),
      manage: {
        networkId: 'evm--1',
        provider: 'pendle',
        symbol: 'USDG',
        vault: '0xc5b32dba5f29f8395fb9591e1a15f23a75214f33',
      },
    },
  }),
  position({
    ...ethereum,
    protocol: 'pendle',
    protocolName: 'Pendle',
    category: 'yield',
    groupId: 'pendle:evm--1:0x4ccf6deb3d1895373f604b418ff55d8adae8b846',
    name: 'PT-USDat-14JAN2027',
    assets: [
      token({
        symbol: 'PT-USDat',
        amount: '0.1745',
        price: 0.9742,
        logoUrl: LOGO.USDat,
      }),
    ],
    earn: {
      state: 'active',
      maturityAt: Date.parse('2027-01-14T00:00:00Z'),
      manage: {
        networkId: 'evm--1',
        provider: 'pendle',
        symbol: 'USDat',
        vault: '0x4ccf6deb3d1895373f604b418ff55d8adae8b846',
      },
    },
  }),

  // Morpho on Ethereum: two vaults and one borrow market, three positions.
  position({
    ...ethereum,
    protocol: 'morpho',
    protocolName: 'Morpho',
    category: 'yield',
    groupId: 'morpho:evm--1:0xa71d08a159258553a5ac190d60fa919425ff02ea',
    name: 'Hakutora USDT',
    assets: [
      token({
        symbol: 'USDT',
        amount: '0.4021',
        price: 1,
        logoUrl: LOGO.USDT,
      }),
    ],
    rewards: [
      token({
        symbol: 'MORPHO',
        amount: '0.0213',
        price: 1.2,
        logoUrl: LOGO.MORPHO,
        category: 'reward',
      }),
    ],
    earn: {
      state: 'active',
      manage: {
        networkId: 'evm--1',
        provider: 'morpho',
        symbol: 'USDT',
        vault: '0xa71d08a159258553a5ac190d60fa919425ff02ea',
      },
    },
  }),
  position({
    ...ethereum,
    protocol: 'morpho',
    protocolName: 'Morpho',
    category: 'yield',
    groupId: 'morpho:evm--1:0x974c8fbf4fd795f66b85b73ebc988a51f1a040a9',
    name: 'Hakutora USDC',
    assets: [
      token({
        symbol: 'USDC',
        amount: '0.007549',
        price: 1,
        logoUrl: LOGO.USDC,
      }),
    ],
    earn: {
      state: 'active',
      manage: {
        networkId: 'evm--1',
        provider: 'morpho',
        symbol: 'USDC',
        vault: '0x974c8fbf4fd795f66b85b73ebc988a51f1a040a9',
      },
    },
  }),
  position({
    ...ethereum,
    protocol: 'morpho',
    protocolName: 'Morpho',
    category: 'lending',
    groupId: 'morpho:evm--1:market:weth-usdc',
    name: 'WETH / USDC',
    assets: [
      token({
        symbol: 'WETH',
        amount: '0.02',
        price: 3150,
        logoUrl: LOGO.WETH,
      }),
    ],
    debts: [
      token({
        symbol: 'USDC',
        amount: '20.01',
        price: 1,
        logoUrl: LOGO.USDC,
        category: 'borrow',
      }),
    ],
    rewards: [
      token({
        symbol: 'MORPHO',
        amount: '1.2',
        price: 1.2,
        logoUrl: LOGO.MORPHO,
        category: 'reward',
      }),
    ],
    healthFactor: 1.62,
    earn: {
      state: 'active',
      manage: {
        networkId: 'evm--1',
        provider: 'morpho',
        symbol: 'USDC',
        vault: 'weth-usdc',
      },
    },
  }),

  // Everstake POL: the staked position and the withdrawn POL ready to claim
  // (today a `claimOrder` row inside the deposit, rendered as a reward).
  position({
    ...ethereum,
    protocol: 'everstake',
    protocolName: 'Everstake',
    category: 'staked',
    groupId: 'everstake:evm--1:pol',
    name: 'Everstake staked POL',
    assets: [
      token({
        symbol: 'POL',
        amount: '1.1842',
        price: 0.1149,
        logoUrl: LOGO.POL,
      }),
    ],
    rewards: [
      token({
        symbol: 'POL',
        amount: '0.0008532',
        price: 0.1149,
        logoUrl: LOGO.POL,
        category: 'reward',
      }),
    ],
    earn: {
      state: 'active',
      manage: { networkId: 'evm--1', provider: 'everstake', symbol: 'POL' },
    },
  }),
  position({
    ...ethereum,
    protocol: 'everstake',
    protocolName: 'Everstake',
    category: 'staked',
    groupId: 'everstake:evm--1:pol:unbond:12',
    name: 'Everstake staked POL',
    assets: [
      token({ symbol: 'POL', amount: '1', price: 0.1149, logoUrl: LOGO.POL }),
    ],
    earn: { state: 'claimable', claim: CLAIM_BUTTON },
  }),
];

const BASE_POSITIONS: IEarnPortfolioPosition[] = [
  position({
    ...base,
    protocol: 'morpho',
    protocolName: 'Morpho',
    category: 'yield',
    groupId: 'morpho:evm--8453:0x1401d1271c47648ac70cbcdfa3776d4a87ce006b',
    name: 'Pangolins USDC',
    assets: [
      token({
        symbol: 'USDC',
        amount: '0.8552',
        price: 1,
        logoUrl: LOGO.USDC_BASE,
      }),
    ],
    earn: {
      state: 'active',
      manage: {
        networkId: 'evm--8453',
        provider: 'morpho',
        symbol: 'USDC',
        vault: '0x1401d1271c47648ac70cbcdfa3776d4a87ce006b',
      },
    },
  }),
  position({
    ...base,
    protocol: 'morpho',
    protocolName: 'Morpho',
    category: 'yield',
    groupId: 'morpho:evm--8453:0xefa40c84f1f2335a8599dd7686a28d2b6263b6ef',
    name: 'Gauntlet USDC Prime',
    assets: [
      token({
        symbol: 'USDC',
        amount: '0.4635',
        price: 1,
        logoUrl: LOGO.USDC_BASE,
      }),
    ],
    earn: {
      state: 'active',
      manage: {
        networkId: 'evm--8453',
        provider: 'morpho',
        symbol: 'USDC',
        vault: '0xefa40c84f1f2335a8599dd7686a28d2b6263b6ef',
      },
    },
  }),
  position({
    ...base,
    protocol: 'pendle',
    protocolName: 'Pendle',
    category: 'yield',
    groupId: 'pendle:evm--8453:0xb0eb82ba25ffa51641d8613d270ad79183171fac',
    name: 'PT-sKAITO-30JUL2026',
    assets: [
      token({
        symbol: 'PT-sKAITO',
        amount: '1.3',
        price: 0.7769,
        logoUrl:
          'https://uni.onekey-asset.com/server-service-indexer/evm--8453/tokens/address-0x548d3b444da39686d1a6f1544781d154e7cd1ef7-1773210283051.png',
      }),
    ],
    earn: {
      state: 'active',
      maturityAt: Date.parse('2026-07-30T00:00:00Z'),
      manage: {
        networkId: 'evm--8453',
        provider: 'pendle',
        symbol: 'sKAITO',
        vault: '0xb0eb82ba25ffa51641d8613d270ad79183171fac',
      },
    },
  }),
];

const SOLANA_POSITIONS: IEarnPortfolioPosition[] = [
  position({
    ...solana,
    protocol: 'stakefish',
    protocolName: 'Stakefish',
    category: 'staked',
    groupId: 'stakefish:sol--101:sol',
    name: 'Stakefish staked SOL',
    assets: [
      token({
        symbol: 'SOL',
        amount: '0.008108',
        price: 119.6,
        logoUrl: LOGO.SOL,
      }),
    ],
    earn: {
      state: 'active',
      manage: { networkId: 'sol--101', provider: 'stakefish', symbol: 'SOL' },
    },
  }),
  position({
    ...solana,
    protocol: 'stakefish',
    protocolName: 'Stakefish',
    category: 'staked',
    groupId: 'stakefish:sol--101:sol:withdrawal:3',
    name: 'Stakefish staked SOL',
    assets: [
      token({
        symbol: 'SOL',
        amount: '0.008045',
        price: 119.6,
        logoUrl: LOGO.SOL,
      }),
    ],
    earn: { state: 'claimable', claim: CLAIM_BUTTON },
  }),
];

// Same provider, other network: its own protocol row, like the wallet.
const ETHEREUM_STAKEFISH: IEarnPortfolioPosition[] = [
  position({
    ...ethereum,
    protocol: 'stakefish',
    protocolName: 'Stakefish',
    category: 'staked',
    groupId: 'stakefish:evm--1:pol',
    name: 'Stakefish staked POL',
    assets: [
      token({
        symbol: 'POL',
        amount: '0.7017',
        price: 0.1149,
        logoUrl: LOGO.POL,
      }),
    ],
    earn: {
      state: 'active',
      manage: { networkId: 'evm--1', provider: 'stakefish', symbol: 'POL' },
    },
  }),
];

const ethereumPositions = [...ETHEREUM_POSITIONS, ...ETHEREUM_STAKEFISH];

export const EARN_PORTFOLIO_POSITIONS_FIXTURE: IEarnPortfolioPositionsResponse =
  {
    positions: {
      'evm--1': ethereumPositions,
      'evm--8453': BASE_POSITIONS,
      'sol--101': SOLANA_POSITIONS,
    },
    protocolSummaries: [
      summary(ethereumPositions, 'lido'),
      summary(ethereumPositions, 'pendle'),
      summary(ethereumPositions, 'morpho'),
      summary(ethereumPositions, 'everstake'),
      summary(ethereumPositions, 'stakefish'),
      summary(BASE_POSITIONS, 'morpho'),
      summary(BASE_POSITIONS, 'pendle'),
      summary(SOLANA_POSITIONS, 'stakefish'),
    ],
  };
