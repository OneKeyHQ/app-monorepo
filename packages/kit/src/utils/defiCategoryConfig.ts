import type { ColorTokens } from '@onekeyhq/components';

const DEFAULT_CATEGORY_CONFIG = {
  bg: '$green9',
  text: '$whiteA12',
} as const;

const CATEGORY_CONFIG: Record<string, { bg: ColorTokens; text: ColorTokens }> =
  {
    yield: DEFAULT_CATEGORY_CONFIG,
    investment: DEFAULT_CATEGORY_CONFIG,
    liquidity: DEFAULT_CATEGORY_CONFIG,
    liquidity_pool: DEFAULT_CATEGORY_CONFIG,
    lending: DEFAULT_CATEGORY_CONFIG,
    supplied: DEFAULT_CATEGORY_CONFIG,
    deposit: DEFAULT_CATEGORY_CONFIG,
    borrowed: DEFAULT_CATEGORY_CONFIG,
    locked: DEFAULT_CATEGORY_CONFIG,
    vesting: DEFAULT_CATEGORY_CONFIG,
    rewards: DEFAULT_CATEGORY_CONFIG,
    staking: DEFAULT_CATEGORY_CONFIG,
    staked: DEFAULT_CATEGORY_CONFIG,
    nft_staked: DEFAULT_CATEGORY_CONFIG,
    farming: DEFAULT_CATEGORY_CONFIG,
    leveraged_farming: DEFAULT_CATEGORY_CONFIG,
  };

function getCategoryConfig(category: string) {
  const normalizedCategory = category
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  return CATEGORY_CONFIG[normalizedCategory] ?? DEFAULT_CATEGORY_CONFIG;
}

export { CATEGORY_CONFIG, DEFAULT_CATEGORY_CONFIG, getCategoryConfig };
