import type { ColorTokens } from '@onekeyhq/components';

const CATEGORY_CONFIG: Record<string, { bg: ColorTokens; text: ColorTokens }> =
  {
    yield: { bg: '$green9', text: '$whiteA12' },
    liquidity: { bg: '$cyan9', text: '$whiteA12' },
    lending: { bg: '$green9', text: '$whiteA12' },
    supplied: { bg: '$green9', text: '$whiteA12' },
    deposit: { bg: '$green9', text: '$whiteA12' },
    borrowed: { bg: '$orange9', text: '$whiteA12' },
    locked: { bg: '$amber9', text: '$whiteA12' },
    rewards: { bg: '$teal9', text: '$whiteA12' },
    staking: { bg: '$purple9', text: '$whiteA12' },
    farming: { bg: '$pink9', text: '$whiteA12' },
  };

const DEFAULT_CATEGORY_CONFIG = {
  bg: '$neutral9',
  text: '$whiteA12',
} as const;

function getCategoryConfig(category: string) {
  return CATEGORY_CONFIG[category.toLowerCase()] ?? DEFAULT_CATEGORY_CONFIG;
}

export { CATEGORY_CONFIG, DEFAULT_CATEGORY_CONFIG, getCategoryConfig };
