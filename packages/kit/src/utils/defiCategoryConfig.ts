import type { ColorTokens } from '@onekeyhq/components';

const CATEGORY_CONFIG: Record<
  string,
  { bg: ColorTokens; text: ColorTokens; emoji: string }
> = {
  yield: { bg: '$blue4', text: '$blue12', emoji: '📈' },
  liquidity: { bg: '$cyan4', text: '$cyan12', emoji: '💧' },
  lending: { bg: '$green4', text: '$green12', emoji: '🏦' },
  supplied: { bg: '$lime4', text: '$lime12', emoji: '📥' },
  deposit: { bg: '$jade4', text: '$jade12', emoji: '🏧' },
  borrowed: { bg: '$orange4', text: '$orange12', emoji: '📤' },
  locked: { bg: '$amber4', text: '$amber12', emoji: '🔒' },
  rewards: { bg: '$teal4', text: '$teal12', emoji: '🎁' },
  staking: { bg: '$purple4', text: '$purple12', emoji: '⛏️' },
  farming: { bg: '$pink4', text: '$pink12', emoji: '🌾' },
};

const DEFAULT_CATEGORY_CONFIG = {
  bg: '$neutral4',
  text: '$neutral12',
  emoji: '📊',
} as const;

function getCategoryConfig(category: string) {
  return CATEGORY_CONFIG[category.toLowerCase()] ?? DEFAULT_CATEGORY_CONFIG;
}

export { CATEGORY_CONFIG, DEFAULT_CATEGORY_CONFIG, getCategoryConfig };
