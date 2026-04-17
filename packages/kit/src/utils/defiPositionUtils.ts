import BigNumber from 'bignumber.js';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EDeFiAssetType,
  type IDeFiAsset,
  type IDeFiProtocol,
  type IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import { getCategoryConfig } from './defiCategoryConfig';

type IPositionLabel = { title: string; titleId?: ETranslations };
type IProtocolPositionActionKey = 'withdraw' | 'claim';
type IProtocolPositionSourceAsset =
  IDeFiProtocol['positions'][number]['assets'][number];
type ICategoryConfig = ReturnType<typeof getCategoryConfig>;
type ITranslatePositionLabel = (id: ETranslations) => string;

export type IProtocolPositionSectionAssetType =
  | 'supplied'
  | 'borrowed'
  | 'rewards'
  | 'other';

const POSITION_MODULE_FALLBACK_LABEL: IPositionLabel = {
  title: 'Others',
  titleId: ETranslations.global_others,
};

const POSITION_MODULE_LABELS: Record<string, IPositionLabel> = {
  deposit: {
    title: 'Deposit',
    titleId: ETranslations.wallet_defi_position_module_deposit,
  },
  farming: {
    title: 'Farming',
    titleId: ETranslations.wallet_defi_position_module_farming,
  },
  investment: {
    title: 'Investment',
    titleId: ETranslations.wallet_defi_position_module_investment,
  },
  lending: {
    title: 'Lending',
    titleId: ETranslations.wallet_defi_position_module_lending,
  },
  leveraged_farming: {
    title: 'Leveraged farming',
    titleId: ETranslations.wallet_defi_position_module_leveraged_farming,
  },
  liquidity_pool: {
    title: 'Liquidity pool',
    titleId: ETranslations.wallet_defi_position_module_liquidity_pool,
  },
  liquidity: {
    title: 'Liquidity pool',
    titleId: ETranslations.wallet_defi_position_module_liquidity_pool,
  },
  locked: {
    title: 'Locked',
    titleId: ETranslations.wallet_defi_position_module_locked,
  },
  nft_staked: {
    title: 'NFT staking',
    titleId: ETranslations.wallet_defi_position_module_nft_staked,
  },
  rewards: {
    title: 'Rewards',
    titleId: ETranslations.wallet_defi_position_module_rewards,
  },
  staked: {
    title: 'Staking',
    titleId: ETranslations.wallet_defi_position_module_staked,
  },
  staking: {
    title: 'Staking',
    titleId: ETranslations.wallet_defi_position_module_staked,
  },
  supplied: {
    title: 'Supplied',
    titleId: ETranslations.wallet_defi_asset_type_supplied,
  },
  borrowed: {
    title: 'Borrowed',
    titleId: ETranslations.wallet_defi_asset_type_borrowed,
  },
  loan: {
    title: 'Borrowed',
    titleId: ETranslations.wallet_defi_asset_type_borrowed,
  },
  vesting: {
    title: 'Vesting',
    titleId: ETranslations.wallet_defi_position_module_vesting,
  },
  reward: {
    title: 'Rewards',
    titleId: ETranslations.wallet_defi_position_module_rewards,
  },
  yield: {
    title: 'Yield',
    titleId: ETranslations.wallet_defi_position_module_yield,
  },
};

const POSITION_SECTION_LABELS: Record<
  IProtocolPositionSectionAssetType,
  IPositionLabel
> = {
  supplied: {
    title: 'Supplied',
    titleId: ETranslations.wallet_defi_asset_type_supplied,
  },
  borrowed: {
    title: 'Borrowed',
    titleId: ETranslations.wallet_defi_asset_type_borrowed,
  },
  rewards: {
    title: 'Rewards',
    titleId: ETranslations.wallet_defi_position_module_rewards,
  },
  other: {
    title: 'Others',
    titleId: ETranslations.global_others,
  },
};

const POSITION_ACTION_LABELS: Record<
  IProtocolPositionActionKey,
  IPositionLabel
> = {
  withdraw: {
    title: 'Withdraw',
    titleId: ETranslations.global_withdraw,
  },
  claim: {
    title: 'Claim',
    titleId: ETranslations.earn_claim,
  },
};

const DEFI_ASSET_TYPE_ALIAS_MAP: Record<
  string,
  IProtocolPositionSectionAssetType
> = {
  asset: 'supplied',
  supplied: 'supplied',
  supply: 'supplied',
  deposit: 'supplied',
  investment: 'supplied',
  stake: 'supplied',
  staked: 'supplied',
  staking: 'supplied',
  locked: 'supplied',
  yield: 'supplied',
  liquidity: 'supplied',
  liquidity_pool: 'supplied',
  farming: 'supplied',
  leveraged_farming: 'supplied',
  lending: 'supplied',
  vesting: 'supplied',
  nft_staked: 'supplied',
  debt: 'borrowed',
  loan: 'borrowed',
  borrow: 'borrowed',
  borrowed: 'borrowed',
  reward: 'rewards',
  rewards: 'rewards',
  // Reserved compatibility types still fold into current stable UI buckets.
  collateral: 'supplied',
  other: 'other',
};

const POSITION_SECTION_ORDER: IProtocolPositionSectionAssetType[] = [
  'supplied',
  'borrowed',
  'rewards',
  'other',
];

export type IProtocolPositionSection = {
  key: string;
  assetType: IProtocolPositionSectionAssetType;
  title: string;
  titleId?: ETranslations;
  assets: IDeFiAsset[];
};

export type IProtocolPositionAction = {
  key: IProtocolPositionActionKey;
  label: string;
  labelId?: ETranslations;
};

export type IProtocolPositionItem = {
  positionKey: string;
  groupId: string;
  category: string;
  categoryLabel: string;
  categoryTitleId?: ETranslations;
  categoryConfig: ICategoryConfig;
  poolName?: string;
  poolFullName?: string;
  value: string;
  sections: IProtocolPositionSection[];
  action?: IProtocolPositionAction;
};

export type ILocalizedProtocolPositionSection = Omit<
  IProtocolPositionSection,
  'title'
> & {
  title: string;
};

export type ILocalizedProtocolPositionAction = Omit<
  IProtocolPositionAction,
  'label'
> & {
  label: string;
};

export type ILocalizedProtocolPositionItem = Omit<
  IProtocolPositionItem,
  'sections' | 'action'
> & {
  sections: ILocalizedProtocolPositionSection[];
  action?: ILocalizedProtocolPositionAction;
};

export type IDeFiProtocolDisplayInfo = {
  protocolName: string;
  protocolLogo?: string;
  protocolUrl?: string;
  netWorth: string | number;
};

function normalizeDeFiCategory(value?: string) {
  return (
    value
      ?.trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_') ?? ''
  );
}

function getPositionModuleLabel(category: string) {
  return (
    POSITION_MODULE_LABELS[normalizeDeFiCategory(category)] ??
    POSITION_MODULE_FALLBACK_LABEL
  );
}

function getNormalizedDeFiAssetTypeFromCategory(category?: string) {
  const normalizedCategory = normalizeDeFiCategory(category);

  if (!normalizedCategory) {
    return 'other';
  }

  return DEFI_ASSET_TYPE_ALIAS_MAP[normalizedCategory] ?? 'other';
}

function getProtocolPositionSectionKey(
  asset: IProtocolPositionSourceAsset,
): IProtocolPositionSectionAssetType {
  if (asset.type === EDeFiAssetType.REWARD) {
    return 'rewards';
  }
  if (asset.type === EDeFiAssetType.DEBT) {
    return 'borrowed';
  }

  return getNormalizedDeFiAssetTypeFromCategory(asset.category);
}

function buildProtocolPositionAction(
  sections: IProtocolPositionSection[],
): IProtocolPositionAction | undefined {
  const assetTypeSet = new Set(sections.map((section) => section.assetType));

  if (assetTypeSet.has('borrowed')) {
    return undefined;
  }

  if (assetTypeSet.has('supplied')) {
    return {
      key: 'withdraw',
      label: POSITION_ACTION_LABELS.withdraw.title,
      labelId: POSITION_ACTION_LABELS.withdraw.titleId,
    };
  }

  if (assetTypeSet.has('rewards')) {
    return {
      key: 'claim',
      label: POSITION_ACTION_LABELS.claim.title,
      labelId: POSITION_ACTION_LABELS.claim.titleId,
    };
  }

  return undefined;
}

function buildPositionSections(position: IDeFiProtocol['positions'][number]) {
  const groupedAssets: Record<IProtocolPositionSectionAssetType, IDeFiAsset[]> =
    {
      supplied: [],
      borrowed: [],
      rewards: [],
      other: [],
    };

  [...position.assets, ...position.debts, ...position.rewards].forEach(
    (asset) => {
      groupedAssets[getProtocolPositionSectionKey(asset)].push(asset);
    },
  );

  return POSITION_SECTION_ORDER.map((sectionKey) => {
    const label = POSITION_SECTION_LABELS[sectionKey];

    return {
      key: `${position.groupId}-${position.category}-${sectionKey}`,
      assetType: sectionKey,
      title: label.title,
      titleId: label.titleId,
      assets: groupedAssets[sectionKey].toSorted((a, b) => b.value - a.value),
    };
  }).filter((section) => section.assets.length > 0);
}

function buildProtocolPositionItems(protocol: IDeFiProtocol) {
  return protocol.positions.map<IProtocolPositionItem>((position) => {
    const categoryLabel = getPositionModuleLabel(position.category);
    const sections = buildPositionSections(position);

    return {
      positionKey: `${position.groupId}-${position.category}`,
      groupId: position.groupId,
      category: position.category,
      categoryLabel: categoryLabel.title,
      categoryTitleId: categoryLabel.titleId,
      categoryConfig: getCategoryConfig(position.category),
      poolName: position.poolName,
      poolFullName: position.poolFullName,
      value: position.value,
      sections,
      action: buildProtocolPositionAction(sections),
    };
  });
}

function buildLocalizedProtocolPositionItems({
  protocol,
  translate,
}: {
  protocol: IDeFiProtocol;
  translate: ITranslatePositionLabel;
}) {
  return buildProtocolPositionItems(protocol).map(
    (position): ILocalizedProtocolPositionItem => ({
      ...position,
      categoryLabel: position.categoryTitleId
        ? translate(position.categoryTitleId)
        : position.categoryLabel,
      action: position.action
        ? {
            ...position.action,
            label: position.action.labelId
              ? translate(position.action.labelId)
              : position.action.label,
          }
        : undefined,
      sections: position.sections.map((section) => ({
        ...section,
        title: section.titleId ? translate(section.titleId) : section.title,
      })),
    }),
  );
}

function buildProtocolDisplayInfo({
  protocol,
  protocolInfo,
}: {
  protocol: IDeFiProtocol;
  protocolInfo?: IProtocolSummary;
}): IDeFiProtocolDisplayInfo {
  const netWorth =
    protocolInfo?.netWorth ??
    protocol.positions
      .reduce((acc, position) => acc.plus(position.value), new BigNumber(0))
      .toFixed();

  return {
    protocolName: protocolInfo?.protocolName ?? protocol.protocol,
    protocolLogo: protocolInfo?.protocolLogo,
    protocolUrl: protocolInfo?.protocolUrl,
    netWorth,
  };
}

export {
  buildLocalizedProtocolPositionItems,
  buildProtocolDisplayInfo,
  buildProtocolPositionItems,
  getPositionModuleLabel,
};
