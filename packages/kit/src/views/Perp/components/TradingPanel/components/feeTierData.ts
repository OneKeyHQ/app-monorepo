export type IWalletBuilderFeeBenchmark = {
  name: string;
  builderFeeBenchmark: number | null;
  color: string;
  icon: number;
  isMaintained: boolean;
  evidence?: string;
};

// Default sample rates used only when we cannot fetch user-specific fee data.
export const DEFAULT_HL_TAKER_FEE_FOR_COMPARE = 0.000_45;
export const DEFAULT_HL_MAKER_FEE_FOR_COMPARE = 0.000_15;

export const FEE_COMPARE_BENCHMARK_LAST_UPDATED = '2026-03-02';
export const PERP_CONFIG_BUILDER_FEE_RATE_DIVISOR = 100_000;

export const STAKING_DISCOUNT_LABELS = [
  { label: 'None', discount: 0 },
  { label: 'Wood', discount: 0.05 },
  { label: 'Bronze', discount: 0.1 },
  { label: 'Silver', discount: 0.15 },
  { label: 'Gold', discount: 0.2 },
  { label: 'Platinum', discount: 0.3 },
  { label: 'Diamond', discount: 0.4 },
] as const;

// Configurable benchmark data for non-OneKey wallets.
export const WALLET_BUILDER_FEE_BENCHMARKS: IWalletBuilderFeeBenchmark[] = [
  {
    name: 'OneKey',
    builderFeeBenchmark: null,
    color: '#00B812',
    icon: require('@onekeyhq/kit/assets/perps/wallets/onekey.png') as number,
    isMaintained: true,
    evidence: 'Perps config',
  },
  {
    name: 'Phantom',
    builderFeeBenchmark: 0.0005,
    color: '#AB9FF2',
    icon: require('@onekeyhq/kit/assets/perps/wallets/phantom.png') as number,
    isMaintained: true,
    evidence: 'CoinMarketMan Hypertracker builders usage fee',
  },
  {
    name: 'Infinex',
    builderFeeBenchmark: 0.0005,
    color: '#6366F1',
    icon: require('@onekeyhq/kit/assets/perps/wallets/infinex.png') as number,
    isMaintained: true,
    evidence: 'CoinMarketMan Hypertracker builders usage fee',
  },
  {
    name: 'Rainbow',
    builderFeeBenchmark: 0.0005,
    color: '#FF6B6B',
    icon: require('@onekeyhq/kit/assets/perps/wallets/rainbow.png') as number,
    isMaintained: true,
    evidence: 'CoinMarketMan Hypertracker builders usage fee',
  },
  {
    name: 'MetaMask',
    builderFeeBenchmark: 0.001,
    color: '#F6851B',
    icon: require('@onekeyhq/kit/assets/perps/wallets/metamask.png') as number,
    isMaintained: true,
    evidence: 'CoinMarketMan Hypertracker builders usage fee',
  },
];

export function formatFeePercent(fee: number): string {
  return `${(fee * 100).toFixed(3)}%`;
}

export function formatFeePercentOrNA(fee?: number | null): string {
  if (fee === null || fee === undefined || Number.isNaN(fee)) {
    return '—';
  }
  return formatFeePercent(fee);
}

// hyperliquidMaxBuilderFee uses 1/1000% precision (e.g. 13 => 0.013% => 0.00013).
export function normalizePerpsConfigBuilderFeeRate(
  maxBuilderFee?: number | null,
): number {
  if (
    maxBuilderFee === null ||
    maxBuilderFee === undefined ||
    Number.isNaN(maxBuilderFee)
  ) {
    return 0;
  }
  return Math.max(maxBuilderFee, 0) / PERP_CONFIG_BUILDER_FEE_RATE_DIVISOR;
}

export function getStakingTierLabelByDiscount(discount: number): string {
  const resolved = STAKING_DISCOUNT_LABELS.find(
    (tier) => Math.abs(tier.discount - discount) < 0.000_01,
  );
  return resolved?.label ?? `Custom`;
}
