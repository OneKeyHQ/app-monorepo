import BigNumber from 'bignumber.js';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EDeFiAssetType,
  type IDeFiAsset,
  type IDeFiProtocol,
  type IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import { getCategoryConfig } from './defiCategoryConfig';

type IPositionLabel = { title: string; titleId?: ETranslations };
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

export type IProtocolPositionItem = {
  positionKey: string;
  groupId: string;
  category: string;
  categoryLabel: string;
  categoryLabelId?: ETranslations;
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
      key: `${position.groupId}-${sectionKey}`,
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
      positionKey: position.groupId,
      groupId: position.groupId,
      category: position.category,
      categoryLabel: categoryLabel.title,
      categoryLabelId: categoryLabel.titleId,
      categoryConfig: getCategoryConfig(position.category),
      poolName: position.poolName,
      poolFullName: position.poolFullName,
      value: position.value,
      sections,
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
      categoryLabel: position.categoryLabelId
        ? translate(position.categoryLabelId)
        : position.categoryLabel,
      sections: position.sections.map((section) => ({
        ...section,
        title: section.titleId ? translate(section.titleId) : section.title,
      })),
    }),
  );
}

// ─── Category-grouped layout (desktop protocol list) ──────────────────────
// Lending stays per-position because supplied/borrowed/rewards each get their
// own row-section header; everything else collapses by category and merges
// rows that share `poolName` so users see one logical position even when the
// backend reports it as multiple groupIds.

const LENDING_NORMALIZED_CATEGORY = 'lending';
const DEPOSIT_NORMALIZED_CATEGORY = 'deposit';
const LP_NORMALIZED_CATEGORIES: ReadonlySet<string> = new Set([
  'liquidity',
  'liquidity_pool',
]);

export type IUnifiedPositionDisplayKind = 'text' | 'icon-text' | 'lp-stack';

export type IProtocolUnifiedPositionDisplay =
  | { kind: 'text'; text: string }
  | { kind: 'icon-text'; text: string; iconUrl?: string }
  | {
      kind: 'lp-stack';
      tokens: { symbol: string; logoUrl?: string }[];
      text: string;
    };

export type IProtocolUnifiedRow = {
  rowKey: string;
  positionDisplay: IProtocolUnifiedPositionDisplay;
  // Upstream net value for the logical row. `position.value` already accounts
  // for debts, so table rendering must not recompute value from visible assets.
  netValue: string;
  // Drives the Supplied/Balance/USD columns. Equals the supplied bucket when
  // the position has supplied assets; for rewards-only positions (e.g. a
  // protocol whose category=='rewards' has no supplied bucket at all) this
  // falls back to the rewards bucket so the row isn't empty.
  primaryAssets: IDeFiAsset[];
  // Non-lending debt assets still explain net exposure, especially for
  // leveraged farming. They render in a dedicated Borrowed column instead of
  // being folded into Balance.
  borrowedAssets: IDeFiAsset[];
  // Only populated when the position has BOTH supplied and rewards. The
  // dedicated Rewards column is hidden across the whole table when no row
  // contributes to it.
  rewardsExtraAssets: IDeFiAsset[];
};

export type IProtocolCategoryGroup =
  | {
      kind: 'lending';
      groupKey: string;
      category: string;
      categoryLabel: string;
      categoryLabelId?: ETranslations;
      positions: IProtocolPositionItem[];
    }
  | {
      kind: 'unified';
      groupKey: string;
      category: string;
      categoryLabel: string;
      categoryLabelId?: ETranslations;
      displayKind: IUnifiedPositionDisplayKind;
      rows: IProtocolUnifiedRow[];
    };

export type ILocalizedProtocolCategoryGroup =
  | {
      kind: 'lending';
      groupKey: string;
      category: string;
      categoryLabel: string;
      positions: ILocalizedProtocolPositionItem[];
    }
  | {
      kind: 'unified';
      groupKey: string;
      category: string;
      categoryLabel: string;
      displayKind: IUnifiedPositionDisplayKind;
      rows: IProtocolUnifiedRow[];
    };

function getUnifiedDisplayKind(
  normalizedCategory: string,
): IUnifiedPositionDisplayKind {
  if (LP_NORMALIZED_CATEGORIES.has(normalizedCategory)) {
    return 'lp-stack';
  }
  if (normalizedCategory === DEPOSIT_NORMALIZED_CATEGORY) {
    return 'icon-text';
  }
  return 'text';
}

function buildUnifiedRowsFromPositions(
  displayKind: IUnifiedPositionDisplayKind,
  positions: IProtocolPositionItem[],
): IProtocolUnifiedRow[] {
  // Bucket by trimmed poolName; positions without a poolName collapse only
  // with themselves so the merge is conservative when the upstream label is
  // missing.
  type Bucket = {
    poolName?: string;
    suppliedAssets: IDeFiAsset[];
    borrowedAssets: IDeFiAsset[];
    rewardsAssets: IDeFiAsset[];
    netValue: BigNumber;
    firstGroupId: string;
  };
  const orderedKeys: string[] = [];
  const buckets = new Map<string, Bucket>();

  for (const position of positions) {
    const trimmedPoolName = position.poolName?.trim();
    const bucketKey = trimmedPoolName
      ? `name:${trimmedPoolName}`
      : `id:${position.groupId}`;
    let bucket = buckets.get(bucketKey);
    if (!bucket) {
      bucket = {
        poolName: position.poolName,
        suppliedAssets: [],
        borrowedAssets: [],
        rewardsAssets: [],
        netValue: new BigNumber(0),
        firstGroupId: position.groupId,
      };
      buckets.set(bucketKey, bucket);
      orderedKeys.push(bucketKey);
    }
    bucket.netValue = bucket.netValue.plus(position.value);
    for (const section of position.sections) {
      if (section.assetType === 'supplied' || section.assetType === 'other') {
        // 'other' is rare and folds into supplied so it still surfaces in
        // the table; without this it would silently disappear.
        bucket.suppliedAssets.push(...section.assets);
      } else if (section.assetType === 'rewards') {
        bucket.rewardsAssets.push(...section.assets);
      } else if (section.assetType === 'borrowed') {
        bucket.borrowedAssets.push(...section.assets);
      }
    }
  }

  return orderedKeys.map((key) => {
    const bucket = buckets.get(key);
    if (!bucket) {
      throw new OneKeyLocalError('protocol category bucket missing');
    }
    const hasSupplied = bucket.suppliedAssets.length > 0;
    const hasRewards = bucket.rewardsAssets.length > 0;
    const primaryAssets = hasSupplied
      ? bucket.suppliedAssets
      : bucket.rewardsAssets;
    const rewardsExtraAssets =
      hasSupplied && hasRewards ? bucket.rewardsAssets : [];

    // Name precedence by displayKind: LP prefers the token-symbol join
    // ("ETH + USDC") because the LP pair *is* the position identity;
    // everything else prefers the upstream pool name and falls back to the
    // same join when poolName is absent. The fallback prevents empty
    // strings from rendering as a blank Position cell, and gives the user
    // an asset-derived label that pairs with the avatar group on the left.
    const positionLabelAssets =
      primaryAssets.length > 0 ? primaryAssets : bucket.borrowedAssets;
    const symbolJoin = positionLabelAssets.map((a) => a.symbol).join(' + ');
    let positionDisplay: IProtocolUnifiedPositionDisplay;
    if (displayKind === 'lp-stack') {
      const tokens = bucket.suppliedAssets.map((asset) => ({
        symbol: asset.symbol,
        logoUrl: asset.meta?.logoUrl,
      }));
      const lpText = symbolJoin || bucket.poolName || '';
      positionDisplay = { kind: 'lp-stack', tokens, text: lpText };
    } else if (displayKind === 'icon-text') {
      const iconUrl =
        bucket.suppliedAssets[0]?.meta?.logoUrl ??
        bucket.rewardsAssets[0]?.meta?.logoUrl;
      positionDisplay = {
        kind: 'icon-text',
        text: bucket.poolName || symbolJoin,
        iconUrl,
      };
    } else {
      positionDisplay = {
        kind: 'text',
        text: bucket.poolName || symbolJoin,
      };
    }

    return {
      rowKey: bucket.poolName ? `name:${bucket.poolName}` : `id:${key}`,
      positionDisplay,
      netValue: bucket.netValue.toFixed(),
      primaryAssets,
      borrowedAssets: bucket.borrowedAssets,
      rewardsExtraAssets,
    };
  });
}

function buildProtocolCategoryGroups(
  protocol: IDeFiProtocol,
): IProtocolCategoryGroup[] {
  const items = buildProtocolPositionItems(protocol);
  const orderedCategoryKeys: string[] = [];
  const positionsByCategory = new Map<string, IProtocolPositionItem[]>();
  for (const item of items) {
    const normalized = normalizeDeFiCategory(item.category) || 'other';
    let bucket = positionsByCategory.get(normalized);
    if (!bucket) {
      bucket = [];
      positionsByCategory.set(normalized, bucket);
      orderedCategoryKeys.push(normalized);
    }
    bucket.push(item);
  }

  return orderedCategoryKeys.map((normalized) => {
    const bucketItems = positionsByCategory.get(normalized);
    if (!bucketItems || bucketItems.length === 0) {
      throw new OneKeyLocalError('protocol category bucket missing');
    }
    const sample = bucketItems[0];
    if (normalized === LENDING_NORMALIZED_CATEGORY) {
      return {
        kind: 'lending',
        groupKey: normalized,
        category: sample.category,
        categoryLabel: sample.categoryLabel,
        categoryLabelId: sample.categoryLabelId,
        positions: bucketItems,
      };
    }
    const displayKind = getUnifiedDisplayKind(normalized);
    return {
      kind: 'unified',
      groupKey: normalized,
      category: sample.category,
      categoryLabel: sample.categoryLabel,
      categoryLabelId: sample.categoryLabelId,
      displayKind,
      rows: buildUnifiedRowsFromPositions(displayKind, bucketItems),
    };
  });
}

function buildLocalizedProtocolCategoryGroups({
  protocol,
  translate,
}: {
  protocol: IDeFiProtocol;
  translate: ITranslatePositionLabel;
}): ILocalizedProtocolCategoryGroup[] {
  return buildProtocolCategoryGroups(protocol).map((group) => {
    const translatedLabel = group.categoryLabelId
      ? translate(group.categoryLabelId)
      : group.categoryLabel;
    if (group.kind === 'lending') {
      return {
        kind: 'lending',
        groupKey: group.groupKey,
        category: group.category,
        categoryLabel: translatedLabel,
        positions: group.positions.map((position) => ({
          ...position,
          categoryLabel: position.categoryLabelId
            ? translate(position.categoryLabelId)
            : position.categoryLabel,
          sections: position.sections.map((section) => ({
            ...section,
            title: section.titleId ? translate(section.titleId) : section.title,
          })),
        })),
      };
    }
    return {
      kind: 'unified',
      groupKey: group.groupKey,
      category: group.category,
      categoryLabel: translatedLabel,
      displayKind: group.displayKind,
      rows: group.rows,
    };
  });
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

// Every image URL a fully-expanded DeFi list will render: protocol logos
// (header + chip strip), and every supplied / debt / reward token icon
// inside the position tables. Deduplicated — many positions share the
// same asset (USDC, ETH, etc.). Used to warm the image cache up front so
// the Tokens inside Accordion.Content / sliced-in protocol cards hit an
// already-resolved cache entry the moment they mount, instead of flashing
// a skeleton on first paint.
function collectDeFiImageUrls({
  protocols,
  protocolMap,
}: {
  protocols: IDeFiProtocol[] | undefined | null;
  protocolMap: Record<string, IProtocolSummary> | undefined | null;
}): string[] {
  const urls = new Set<string>();
  if (protocolMap) {
    for (const summary of Object.values(protocolMap)) {
      if (summary?.protocolLogo) urls.add(summary.protocolLogo);
    }
  }
  if (protocols) {
    for (const protocol of protocols) {
      for (const position of protocol.positions) {
        for (const asset of position.assets) {
          if (asset.meta?.logoUrl) urls.add(asset.meta.logoUrl);
        }
        for (const debt of position.debts) {
          if (debt.meta?.logoUrl) urls.add(debt.meta.logoUrl);
        }
        for (const reward of position.rewards) {
          if (reward.meta?.logoUrl) urls.add(reward.meta.logoUrl);
        }
      }
    }
  }
  return Array.from(urls);
}

export {
  buildLocalizedProtocolCategoryGroups,
  buildLocalizedProtocolPositionItems,
  buildProtocolCategoryGroups,
  buildProtocolDisplayInfo,
  buildProtocolPositionItems,
  collectDeFiImageUrls,
  getPositionModuleLabel,
};
