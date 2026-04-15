import type { ColorTokens } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const CATEGORY_CONFIG: Record<
  string,
  {
    bg: ColorTokens;
    text: ColorTokens;
    label: string;
    labelId?: ETranslations;
  }
> = {
  yield: {
    bg: '$green9',
    text: '$whiteA12',
    label: 'Yield',
    labelId: ETranslations.wallet_defi_position_module_yield,
  },
  liquidity: {
    bg: '$cyan9',
    text: '$whiteA12',
    label: 'Liquidity Pool',
    labelId: ETranslations.wallet_defi_position_module_liquidity_pool,
  },
  lending: {
    bg: '$green9',
    text: '$whiteA12',
    label: 'Lending',
    labelId: ETranslations.wallet_defi_position_module_lending,
  },
  supplied: {
    bg: '$green9',
    text: '$whiteA12',
    label: 'Supplied',
    labelId: ETranslations.wallet_defi_asset_type_supplied,
  },
  deposit: {
    bg: '$green9',
    text: '$whiteA12',
    label: 'Deposit',
    labelId: ETranslations.wallet_defi_position_module_deposit,
  },
  borrowed: {
    bg: '$orange9',
    text: '$whiteA12',
    label: 'Borrowed',
    labelId: ETranslations.wallet_defi_asset_type_borrowed,
  },
  locked: {
    bg: '$amber9',
    text: '$whiteA12',
    label: 'Locked',
    labelId: ETranslations.wallet_defi_position_module_locked,
  },
  rewards: {
    bg: '$teal9',
    text: '$whiteA12',
    label: 'Rewards',
    labelId: ETranslations.wallet_defi_position_module_rewards,
  },
  staking: {
    bg: '$purple9',
    text: '$whiteA12',
    label: 'Staking',
    labelId: ETranslations.wallet_defi_position_module_staked,
  },
  farming: {
    bg: '$pink9',
    text: '$whiteA12',
    label: 'Farming',
    labelId: ETranslations.wallet_defi_position_module_farming,
  },
};

const DEFAULT_CATEGORY_CONFIG = {
  bg: '$neutral9',
  text: '$whiteA12',
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

function getCategoryLabel(category: string) {
  return getCategoryConfig(category).label;
}

function getCategoryLabelTranslationId(category: string) {
  return getCategoryConfig(category).labelId;
}

export {
  CATEGORY_CONFIG,
  DEFAULT_CATEGORY_CONFIG,
  formatCategoryLabel,
  getCategoryConfig,
  getCategoryLabel,
  getCategoryLabelTranslationId,
};
