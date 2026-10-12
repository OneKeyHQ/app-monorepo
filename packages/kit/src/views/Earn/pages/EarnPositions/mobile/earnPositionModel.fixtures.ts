import BigNumber from 'bignumber.js';

import type { IDeFiAsset, IProtocolSummary } from '@onekeyhq/shared/types/defi';
import type {
  IEarnPortfolioPosition,
  IEarnPortfolioPositionsResponse,
  IEarnPositionAssetCategory,
  IEarnPositionCategory,
  IEarnPositionExtension,
  IEarnPositionRewardAsset,
  IEarnPositionRewardClaim,
} from '@onekeyhq/shared/types/earn/portfolioPositions';
import { EClaimType, EStakingActionType } from '@onekeyhq/shared/types/staking';
import type {
  IEarnCancelWithdrawalActionIcon,
  IEarnListaCheckActionIcon,
} from '@onekeyhq/shared/types/staking';

/**
 * Mock response in the positions contract: the cases the page has to get
 * right — a staking position with principal out of its cooldown and two
 * withdrawals in progress (Lido), dated Pendle markets, the USDe cooled
 * down at Ethena that Pendle's sUSDe path reports, Morpho vaults on two
 * chains with a loan, Everstake with yield, USDe held at Ethena, Stakefish
 * on Solana, Lista on BNB Chain before its Check. Rewards carry the claim
 * the server attaches to a row the user collects by hand: Morpho's campaign
 * rows through the airdrop flow, Everstake's yield through the detail
 * row, a Stakefish reward under its claim floor with the claim disabled,
 * and Lista's zero Check row carrying the signature button. Owners are
 * placeholders.
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
  ethena: 'https://uni.onekey-asset.com/static/logo/ethena.png',
};

export const CLAIM_BUTTON = {
  type: EClaimType.ClaimOrder,
  text: { text: 'Claim' },
  disabled: false,
};

export const CANCEL_BUTTON: IEarnCancelWithdrawalActionIcon = {
  type: EStakingActionType.CancelWithdrawal,
  text: { text: 'Cancel' },
  disabled: false,
};

export const CHECK_BUTTON: IEarnListaCheckActionIcon = {
  type: 'listaCheck',
  disabled: false,
  text: { text: 'Check' },
};

/** Lista's Check row before the signature: no amount yet, the button reveals it. */
export function checkClaim(): IEarnPositionRewardClaim {
  return {
    button: CHECK_BUTTON,
    claimSource: 'airdrop',
    row: { title: { text: '0 LISTA' }, button: CHECK_BUTTON },
  };
}

/** A campaign row claimed through the airdrop flow, as Morpho and Lista send it. */
export function airdropClaim(
  title: string,
  disabled = false,
): IEarnPositionRewardClaim {
  const button = { ...CLAIM_BUTTON, disabled };
  return {
    button,
    claimSource: 'airdrop',
    row: { title: { text: title }, button, claimType: 'normal' },
  };
}

/** A yield row claimed through the detail row's own button. */
export function investmentClaim(
  title: string,
  amount: string,
  disabled = false,
): IEarnPositionRewardClaim {
  const button = { ...CLAIM_BUTTON, disabled };
  return {
    button,
    claimSource: 'investment',
    row: { kind: 'reward', amount, title: { text: title }, button },
  };
}

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
  rewards?: IEarnPositionRewardAsset[];
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
      action: 'manage',
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
const bnb = { networkId: 'evm--56', chain: 'evm' };
const solana = { networkId: 'sol--101', chain: 'sol' };

export const LIDO_UNLOCK_AT = Date.parse('2026-10-02T08:00:00Z');
export const LIDO_LATER_UNLOCK_AT = Date.parse('2026-10-05T08:00:00Z');
export const NATIVE_UNLOCK_AT = Date.parse('2026-10-12T08:00:00Z');
export const NATIVE_USDT_VAULT = '0xc31daeeb822790e9ca730e7e34a9ef497fffc959';
export const SUSDE_VAULT = '0x9d39a5de30e57443bff2a8307a4256c8797a3497';

const LIDO = {
  ...ethereum,
  protocol: 'lido',
  protocolName: 'Lido',
  category: 'staked' as const,
  name: 'Lido staked ETH',
};

const ETHEREUM_POSITIONS: IEarnPortfolioPosition[] = [
  // Lido: the deposit is one card; the withdrawal ready to collect is a
  // claimable card of its own; each withdrawal still in progress is a locked
  // card of its own.
  position({
    ...LIDO,
    groupId: 'lido:evm--1:steth',
    assets: [token({ symbol: 'ETH', amount: '4', price: 3150 })],
  }),
  position({
    ...LIDO,
    groupId: 'lido:evm--1:steth:claimable',
    assets: [
      token({
        symbol: 'ETH',
        amount: '0.5',
        price: 3150,
        category: 'claimable',
      }),
    ],
    earn: { action: 'claim', claim: CLAIM_BUTTON, claimSource: 'investment' },
  }),
  position({
    ...LIDO,
    groupId: 'lido:evm--1:steth:unstaking:0',
    assets: [
      token({
        symbol: 'ETH',
        amount: '0.25',
        price: 3150,
        category: 'unstaking',
      }),
    ],
    earn: { unstaking: { unlockAt: LIDO_UNLOCK_AT } },
  }),
  position({
    ...LIDO,
    groupId: 'lido:evm--1:steth:unstaking:1',
    assets: [
      token({
        symbol: 'ETH',
        amount: '0.3',
        price: 3150,
        category: 'unstaking',
      }),
    ],
    earn: { unstaking: { unlockAt: LIDO_LATER_UNLOCK_AT } },
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
      // a cost basis: +$0.02 on $1.09 of cost
      pnl: {
        amount: '0.0205',
        symbol: 'USD3',
        fiatValue: '0.02',
        percent: '1.84',
      },
    },
  }),
  // The USDe cooled down at Ethena after a Pendle sUSDe redeem: filed under
  // Ethena, read through Pendle; with no detail page to go to, the card's
  // Claim runs the redeem.
  position({
    ...ethereum,
    protocol: 'ethena',
    protocolName: 'Ethena',
    category: 'staked',
    groupId: `ethena:evm--1:${SUSDE_VAULT}:cooldown`,
    name: 'USDe',
    assets: [
      token({
        symbol: 'USDe',
        amount: '0.04588',
        price: 0.9993,
        category: 'claimable',
      }),
    ],
    earn: {
      manage: {
        networkId: 'evm--1',
        provider: 'pendle',
        symbol: 'USDe',
        vault: SUSDE_VAULT,
      },
      symbol: 'USDe',
      vault: SUSDE_VAULT,
      action: 'claim',
      claim: CLAIM_BUTTON,
      claimSource: 'airdrop',
      airdropRows: [{ title: { text: '0.04588 USDe' }, button: CLAIM_BUTTON }],
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
      {
        ...token({
          symbol: 'MORPHO',
          amount: '0.0213',
          price: 1.2,
          category: 'reward',
        }),
        claim: airdropClaim('0.0213 MORPHO'),
      },
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
      {
        ...token({
          symbol: 'MORPHO',
          amount: '1.2',
          price: 1.2,
          category: 'reward',
        }),
        claim: airdropClaim('1.2 MORPHO'),
      },
      // a second token on the same market (Morpho on Katana pays MORPHO and
      // KAT): the card's Claim opens the sheet
      {
        ...token({
          symbol: 'KAT',
          amount: '3',
          price: 0.05,
          category: 'reward',
        }),
        claim: airdropClaim('3 KAT'),
      },
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
    assets: [token({ symbol: 'ETH', amount: '0.1', price: 3150 })],
    rewards: [
      {
        ...token({
          symbol: 'ETH',
          amount: '0.001',
          price: 3150,
          category: 'reward',
        }),
        claim: investmentClaim('0.001 ETH', '0.001'),
      },
    ],
  }),
  position({
    ...ethereum,
    protocol: 'everstake',
    protocolName: 'Everstake',
    category: 'staked',
    groupId: 'everstake:evm--1:eth:claimable',
    name: 'Everstake ETH',
    assets: [
      token({
        symbol: 'ETH',
        amount: '0.05',
        price: 3150,
        category: 'claimable',
      }),
    ],
    earn: { action: 'claim', claim: CLAIM_BUTTON, claimSource: 'investment' },
  }),
  // Ethena: USDe held at Ethena, Manage like every other card (the detail
  // page's own button), the listing category as its badge.
  position({
    ...ethereum,
    protocol: 'ethena',
    protocolName: 'Ethena',
    category: 'yield',
    groupId: 'ethena:evm--1:USDe',
    name: 'Ethena USDe',
    assets: [token({ symbol: 'USDe', amount: '12', price: 0.9993 })],
  }),
  // Native: the queued withdrawal can still be called back; the server
  // sends the Cancel, the detail page runs it (the card shows the date).
  position({
    ...ethereum,
    protocol: 'native',
    protocolName: 'Native',
    category: 'yield',
    groupId: `native:evm--1:${NATIVE_USDT_VAULT}`,
    name: 'Native USDT',
    assets: [token({ symbol: 'USDT', amount: '2', price: 0.9992 })],
    earn: { symbol: 'USDT', vault: NATIVE_USDT_VAULT },
  }),
  position({
    ...ethereum,
    protocol: 'native',
    protocolName: 'Native',
    category: 'yield',
    groupId: `native:evm--1:${NATIVE_USDT_VAULT}:unstaking:0`,
    name: 'Native USDT',
    assets: [
      token({
        symbol: 'USDT',
        amount: '0.112',
        price: 0.9992,
        category: 'unstaking',
      }),
    ],
    earn: {
      symbol: 'USDT',
      vault: NATIVE_USDT_VAULT,
      action: 'cancel',
      cancel: CANCEL_BUTTON,
      unstaking: { unlockAt: NATIVE_UNLOCK_AT },
      investment: {
        totalFiatValue: '2.11',
        earnings24hFiatValue: '0',
        assetsStatus: [
          {
            kind: 'unstaking',
            amount: '0.112',
            unlockAt: NATIVE_UNLOCK_AT,
            title: { text: '0.112 USDT' },
            description: { text: 'Withdrawing' },
            button: CANCEL_BUTTON,
          },
        ],
      },
    },
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

export const LISTA_VAULT = '0xd093bd337814b0d4741bc0bf076549a6eb8cfdf7';

const BNB_POSITIONS: IEarnPortfolioPosition[] = [
  // Lista before its Check: the LISTA reward is a zero row whose button is
  // the signature that reveals the amount.
  position({
    ...bnb,
    protocol: 'lista',
    protocolName: 'Lista',
    category: 'yield',
    groupId: `lista:evm--56:USDT:${LISTA_VAULT}`,
    name: 'Pangolins USDT',
    assets: [token({ symbol: 'USDT', amount: '0.9', price: 1 })],
    rewards: [
      {
        ...token({
          symbol: 'LISTA',
          amount: '0',
          price: 0.2,
          category: 'reward',
        }),
        claim: checkClaim(),
      },
    ],
    earn: { symbol: 'USDT', vault: LISTA_VAULT },
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
    assets: [token({ symbol: 'SOL', amount: '0.008119', price: 110 })],
    // yield under the claim floor: the claim travels disabled
    rewards: [
      {
        ...token({
          symbol: 'SOL',
          amount: '0.0001',
          price: 110,
          category: 'reward',
        }),
        claim: investmentClaim('0.0001 SOL', '0.0001', true),
      },
    ],
  }),
  position({
    ...solana,
    protocol: 'stakefish',
    protocolName: 'Stakefish',
    category: 'staked',
    groupId: 'stakefish:sol--101:SOL:claimable',
    name: 'Stakefish SOL',
    assets: [
      token({
        symbol: 'SOL',
        amount: '0.008045',
        price: 110,
        category: 'claimable',
      }),
    ],
    earn: { action: 'claim', claim: CLAIM_BUTTON, claimSource: 'investment' },
  }),
];

const ALL_POSITIONS = [
  ...ETHEREUM_POSITIONS,
  ...BASE_POSITIONS,
  ...BNB_POSITIONS,
  ...SOLANA_POSITIONS,
];

export const EARN_PORTFOLIO_POSITIONS_FIXTURE: IEarnPortfolioPositionsResponse =
  {
    positions: {
      'evm--1': ETHEREUM_POSITIONS,
      'evm--8453': BASE_POSITIONS,
      'evm--56': BNB_POSITIONS,
      'sol--101': SOLANA_POSITIONS,
    },
    errors: [],
    protocolSummaries: [
      summary(ALL_POSITIONS, 'lido', 'evm--1'),
      summary(ALL_POSITIONS, 'pendle', 'evm--1'),
      summary(ALL_POSITIONS, 'morpho', 'evm--1'),
      summary(ALL_POSITIONS, 'everstake', 'evm--1'),
      summary(ALL_POSITIONS, 'ethena', 'evm--1'),
      summary(ALL_POSITIONS, 'native', 'evm--1'),
      summary(ALL_POSITIONS, 'morpho', 'evm--8453'),
      summary(ALL_POSITIONS, 'pendle', 'evm--8453'),
      summary(ALL_POSITIONS, 'lista', 'evm--56'),
      summary(ALL_POSITIONS, 'stakefish', 'sol--101'),
    ],
  };
