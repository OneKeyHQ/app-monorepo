// Hyperliquid fee tiers based on 14-day rolling volume
export const HYPERLIQUID_FEE_TIERS = [
  { tier: 0, minVolume: 0, taker: 0.00045, maker: 0.00015, label: '$0' },
  {
    tier: 1,
    minVolume: 5_000_000,
    taker: 0.0004,
    maker: 0.00012,
    label: '>$5M',
  },
  {
    tier: 2,
    minVolume: 25_000_000,
    taker: 0.00035,
    maker: 0.00008,
    label: '>$25M',
  },
  {
    tier: 3,
    minVolume: 100_000_000,
    taker: 0.0003,
    maker: 0.00004,
    label: '>$100M',
  },
  {
    tier: 4,
    minVolume: 500_000_000,
    taker: 0.00028,
    maker: 0,
    label: '>$500M',
  },
  {
    tier: 5,
    minVolume: 2_000_000_000,
    taker: 0.00026,
    maker: 0,
    label: '>$2B',
  },
  {
    tier: 6,
    minVolume: 7_000_000_000,
    taker: 0.00024,
    maker: 0,
    label: '>$7B',
  },
] as const;

// HYPE staking tiers
export const HYPE_STAKING_TIERS = [
  { tier: 'None', minStaked: 0, discount: 0 },
  { tier: 'Wood', minStaked: 10, discount: 0.05 },
  { tier: 'Bronze', minStaked: 100, discount: 0.1 },
  { tier: 'Silver', minStaked: 1_000, discount: 0.15 },
  { tier: 'Gold', minStaked: 10_000, discount: 0.2 },
  { tier: 'Platinum', minStaked: 100_000, discount: 0.3 },
  { tier: 'Diamond', minStaked: 500_000, discount: 0.4 },
] as const;

// Competitor wallet builder fees (sorted ascending by fee)
export const WALLET_BUILDER_FEES = [
  {
    name: 'OneKey',
    builderFee: 0,
    color: '#00B812',
    icon: require('@onekeyhq/kit/assets/perps/wallets/onekey.png'),
  },
  {
    name: 'Dreamcash',
    builderFee: 0.00045,
    color: '#F5A623',
    icon: require('@onekeyhq/kit/assets/perps/wallets/dreamcash.png'),
  },
  {
    name: 'Phantom',
    builderFee: 0.0005,
    color: '#AB9FF2',
    icon: require('@onekeyhq/kit/assets/perps/wallets/phantom.png'),
  },
  {
    name: 'Infinex',
    builderFee: 0.0005,
    color: '#6366F1',
    icon: require('@onekeyhq/kit/assets/perps/wallets/infinex.png'),
  },
  {
    name: 'Liquid',
    builderFee: 0.0005,
    color: '#2DD4BF',
    icon: require('@onekeyhq/kit/assets/perps/wallets/liquid.png'),
  },
  {
    name: 'Rainbow',
    builderFee: 0.0005,
    color: '#FF6B6B',
    icon: require('@onekeyhq/kit/assets/perps/wallets/rainbow.png'),
  },
  {
    name: 'MetaMask',
    builderFee: 0.001,
    color: '#F6851B',
    icon: require('@onekeyhq/kit/assets/perps/wallets/metamask.png'),
  },
] as const;

// Demo user data (hardcoded for now, will be replaced by API data)
export const DEMO_USER_FEE_DATA = {
  feeTier: 3,
  stakingTier: 'Gold',
  builderFee: 0,
  volume14d: 100_000_000,
  hypeStaked: 10_000,
} as const;

export function formatFeePercent(fee: number): string {
  return `${(fee * 100).toFixed(3)}%`;
}
