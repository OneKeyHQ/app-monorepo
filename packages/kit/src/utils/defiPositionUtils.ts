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
type IProtocolPositionSectionKey = 'supplied' | 'borrowed' | 'rewards';
type IProtocolPositionSourceAsset =
  IDeFiProtocol['positions'][number]['assets'][number];
type ICategoryConfig = ReturnType<typeof getCategoryConfig>;
type ITranslatePositionLabel = (id: ETranslations) => string;

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
  IProtocolPositionSectionKey,
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
};

const SUPPLIED_SECTION_SOURCE_CATEGORIES = new Set([
  'asset',
  'supplied',
  'supply',
  'deposit',
  'investment',
  'staked',
  'staking',
  'locked',
  'yield',
  'liquidity',
  'liquidity_pool',
  'farming',
  'leveraged_farming',
  'lending',
  'vesting',
  'nft_staked',
]);

const BORROWED_SECTION_SOURCE_CATEGORIES = new Set([
  'debt',
  'loan',
  'borrow',
  'borrowed',
]);

const REWARD_SECTION_SOURCE_CATEGORIES = new Set(['reward', 'rewards']);

export type IProtocolPositionSection = {
  key: string;
  title: string;
  titleId?: ETranslations;
  assets: IDeFiAsset[];
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
};

export type ILocalizedProtocolPositionSection = Omit<
  IProtocolPositionSection,
  'title'
> & {
  title: string;
};

export type ILocalizedProtocolPositionItem = Omit<
  IProtocolPositionItem,
  'sections'
> & {
  sections: ILocalizedProtocolPositionSection[];
};

export type IDeFiProtocolDisplayInfo = {
  protocolName: string;
  protocolLogo?: string;
  protocolUrl?: string;
  netWorth: string | number;
};

function getPositionModuleLabel(category: string) {
  return (
    POSITION_MODULE_LABELS[category.toLowerCase()] ?? {
      title: category,
    }
  );
}

function getProtocolPositionSectionKey(
  asset: IProtocolPositionSourceAsset,
): IProtocolPositionSectionKey {
  const normalizedCategory = asset.category.toLowerCase();

  if (asset.type === EDeFiAssetType.REWARD) {
    return 'rewards';
  }
  if (asset.type === EDeFiAssetType.DEBT) {
    return 'borrowed';
  }

  if (REWARD_SECTION_SOURCE_CATEGORIES.has(normalizedCategory)) {
    return 'rewards';
  }
  if (BORROWED_SECTION_SOURCE_CATEGORIES.has(normalizedCategory)) {
    return 'borrowed';
  }
  if (SUPPLIED_SECTION_SOURCE_CATEGORIES.has(normalizedCategory)) {
    return 'supplied';
  }

  return 'supplied';
}

function buildPositionSections(position: IDeFiProtocol['positions'][number]) {
  const groupedAssets: Record<IProtocolPositionSectionKey, IDeFiAsset[]> = {
    supplied: [],
    borrowed: [],
    rewards: [],
  };

  [...position.assets, ...position.debts, ...position.rewards].forEach(
    (asset) => {
      groupedAssets[getProtocolPositionSectionKey(asset)].push(asset);
    },
  );

  return (
    Object.entries(POSITION_SECTION_LABELS) as Array<
      [IProtocolPositionSectionKey, IPositionLabel]
    >
  )
    .map(([sectionKey, label]) => ({
      key: `${position.groupId}-${position.category}-${sectionKey}`,
      title: label.title,
      titleId: label.titleId,
      assets: groupedAssets[sectionKey].toSorted((a, b) => b.value - a.value),
    }))
    .filter((section) => section.assets.length > 0);
}

function buildProtocolPositionItems(protocol: IDeFiProtocol) {
  return protocol.positions.map<IProtocolPositionItem>((position) => {
    const categoryLabel = getPositionModuleLabel(position.category);

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
      sections: buildPositionSections(position),
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
