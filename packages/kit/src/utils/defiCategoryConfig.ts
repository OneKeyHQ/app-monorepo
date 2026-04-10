import type { ColorTokens } from '@onekeyhq/components';

const CATEGORY_CONFIG: Record<
  string,
  { bg: ColorTokens; text: ColorTokens; label: string }
> = {
  yield: { bg: '$lime4', text: '$lime12', label: 'Yield' },
  liquidity: { bg: '$green4', text: '$green12', label: 'Liquidity Pool' },
  lending: { bg: '$green4', text: '$green12', label: 'Lending' },
  supplied: { bg: '$lime4', text: '$lime12', label: 'Supplied' },
  deposit: { bg: '$jade4', text: '$jade12', label: 'Deposit' },
  borrowed: { bg: '$orange4', text: '$orange12', label: 'Borrowed' },
  locked: { bg: '$amber4', text: '$amber12', label: 'Locked' },
  rewards: { bg: '$teal4', text: '$teal12', label: 'Rewards' },
  staking: { bg: '$purple4', text: '$purple12', label: 'Staking' },
  farming: { bg: '$pink4', text: '$pink12', label: 'Farming' },
};

const DEFAULT_CATEGORY_CONFIG = {
  bg: '$neutral4',
  text: '$neutral12',
  label: '',
} as const;

function formatCategoryLabel(category: string) {
  return category
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getCategoryConfig(category: string) {
  const categoryConfig = CATEGORY_CONFIG[category.toLowerCase()];

  if (categoryConfig) {
    return categoryConfig;
  }

  return {
    ...DEFAULT_CATEGORY_CONFIG,
    label: formatCategoryLabel(category),
  };
}

export { CATEGORY_CONFIG, DEFAULT_CATEGORY_CONFIG, getCategoryConfig };
