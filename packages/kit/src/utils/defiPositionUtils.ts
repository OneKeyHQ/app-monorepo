import BigNumber from 'bignumber.js';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import defiActionUtils from '@onekeyhq/shared/src/utils/defiActionUtils';
import {
  EDeFiAssetType,
  EDeFiPositionAction,
  type IDeFiProtocol,
  type IDeFiSupportedProtocolAction,
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
  assets: IProtocolPositionSourceAsset[];
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
  // Most-conservative (lowest) health factor across the position's source
  // positions, or null when none report one. Only lending/debt positions carry
  // it; everything else stays null. Drives the Health Factor row.
  healthFactor?: number | null;
  sections: IProtocolPositionSection[];
  sourcePositions?: IDeFiProtocol['positions'][number]['sourcePositions'];
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

// Some upstreams (notably f(x) Protocol) stamp a placeholder like "x" into
// poolName when the position has no real market label. `sanitizePoolName`
// returns undefined for these so the Position cell falls back to the
// symbol-join instead of rendering the literal "x".
const POOL_NAME_PLACEHOLDERS: ReadonlySet<string> = new Set([
  'x',
  '-',
  '--',
  '?',
  'n/a',
  'na',
  'null',
  'undefined',
  'tbd',
]);

function sanitizePoolName(name?: string): string | undefined {
  const trimmed = name?.trim();
  if (!trimmed) return undefined;
  if (POOL_NAME_PLACEHOLDERS.has(trimmed.toLowerCase())) return undefined;
  return trimmed;
}

function getProtocolPositionDisplayName({
  poolName,
  poolFullName,
}: {
  poolName?: string;
  poolFullName?: string;
}): string | undefined {
  return sanitizePoolName(poolName) ?? sanitizePoolName(poolFullName);
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
  const groupedAssets: Record<
    IProtocolPositionSectionAssetType,
    IProtocolPositionSourceAsset[]
  > = {
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

// Lending health factor is account-level, so a position's source positions
// normally all report the same number; we still take the lowest finite value
// defensively (lowest == closest to liquidation == the one worth surfacing).
// Returns null when nothing reports a usable health factor.
function getPositionHealthFactor(
  sourcePositions: IDeFiProtocol['positions'][number]['sourcePositions'],
): number | null {
  let lowest: number | null = null;
  for (const source of sourcePositions ?? []) {
    const value = source.metrics?.healthFactor;
    if (typeof value === 'number' && Number.isFinite(value)) {
      lowest = lowest === null ? value : Math.min(lowest, value);
    }
  }
  return lowest;
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
      healthFactor: getPositionHealthFactor(position.sourcePositions),
      sections,
      sourcePositions: position.sourcePositions,
    };
  });
}

function localizePositionItem(
  position: IProtocolPositionItem,
  translate: ITranslatePositionLabel,
): ILocalizedProtocolPositionItem {
  return {
    ...position,
    categoryLabel: position.categoryLabelId
      ? translate(position.categoryLabelId)
      : position.categoryLabel,
    sections: position.sections.map((section) => ({
      ...section,
      title: section.titleId ? translate(section.titleId) : section.title,
    })),
  };
}

function buildLocalizedProtocolPositionItems({
  protocol,
  translate,
}: {
  protocol: IDeFiProtocol;
  translate: ITranslatePositionLabel;
}) {
  return buildProtocolPositionItems(protocol).map((position) =>
    localizePositionItem(position, translate),
  );
}

// ─── Category-grouped layout (desktop protocol list) ──────────────────────
// Lending stays per-position because supplied/borrowed/rewards each get their
// own row-section header; everything else collapses by category into the
// compact unified table — one row per groupId. Distinct groupIds are never
// merged, even when they share a poolName.

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
  groupId: string;
  category: string;
  sourcePositions?: IDeFiProtocol['positions'][number]['sourcePositions'];
  positionDisplay: IProtocolUnifiedPositionDisplay;
  // Drives the Supplied/Balance/USD columns. Equals the supplied bucket when
  // the position has supplied assets; for rewards-only positions (e.g. a
  // protocol whose category=='rewards' has no supplied bucket at all) this
  // falls back to the rewards bucket so the row isn't empty.
  primaryAssets: IProtocolPositionSourceAsset[];
  // Only populated when the position has BOTH supplied and rewards. The
  // dedicated Rewards column is hidden across the whole table when no row
  // contributes to it.
  rewardsExtraAssets: IProtocolPositionSourceAsset[];
};

// One badge per group, one block per group. A category that mixes clean
// and debt-bearing positions is split into two adjacent groups (each
// with its own badge) by buildProtocolCategoryGroups, so the
// leveraged/CDP block reads as a distinct surface rather than a
// sub-section anchored to the clean rows.
export type IProtocolCategoryGroup =
  | {
      kind: 'sectioned';
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
      kind: 'sectioned';
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
  // Bucket strictly by groupId. Distinct groupIds never merge — even when they
  // share a poolName — so a pool the backend reports as several groupIds renders
  // as several rows. Entries that share a groupId still merge, so a single
  // position is never split across rows. poolName is display-only now.
  type IUnifiedRowBucket = {
    poolName?: string;
    suppliedAssets: IProtocolPositionSourceAsset[];
    rewardsAssets: IProtocolPositionSourceAsset[];
    firstGroupId: string;
    category: string;
    sourcePositions: NonNullable<
      IDeFiProtocol['positions'][number]['sourcePositions']
    >;
  };
  const orderedKeys: string[] = [];
  const buckets = new Map<string, IUnifiedRowBucket>();

  for (const position of positions) {
    // poolName (falling back to poolFullName) is the display label only; the
    // row is keyed by groupId so distinct groupIds stay distinct rows.
    const cleanPoolName = getProtocolPositionDisplayName(position);
    const bucketKey = `id:${position.groupId}`;
    let bucket = buckets.get(bucketKey);
    if (!bucket) {
      bucket = {
        poolName: cleanPoolName,
        suppliedAssets: [],
        rewardsAssets: [],
        firstGroupId: position.groupId,
        category: position.category,
        sourcePositions: [],
      };
      buckets.set(bucketKey, bucket);
      orderedKeys.push(bucketKey);
    }
    bucket.sourcePositions.push(...(position.sourcePositions ?? []));
    for (const section of position.sections) {
      if (section.assetType === 'supplied' || section.assetType === 'other') {
        // 'other' is rare and folds into supplied so it still surfaces in
        // the table; without this it would silently disappear.
        bucket.suppliedAssets.push(...section.assets);
      } else if (section.assetType === 'rewards') {
        bucket.rewardsAssets.push(...section.assets);
      }
      // 'borrowed' is never expected here — buildProtocolCategoryGroups
      // partitions debt-bearing positions out into a sectioned block
      // before this builder runs, because the unified table has no
      // Borrowed column to render them in. If you see a debt slip through
      // anyway, fix the partition; do not silently swallow it here.
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
    const symbolJoin = primaryAssets.map((a) => a.symbol).join(' + ');
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
      rowKey: key,
      groupId: bucket.firstGroupId,
      category: bucket.category,
      sourcePositions: bucket.sourcePositions,
      positionDisplay,
      primaryAssets,
      rewardsExtraAssets,
    };
  });
}

// Suffix on the groupKey of the second group when a non-lending category
// is split into [clean, debt-bearing]. Keeps React from deduping the two
// adjacent groups that share the same normalized category key.
const DEBT_GROUP_KEY_SUFFIX = ':debt';

function positionHasBorrowed(position: IProtocolPositionItem): boolean {
  return position.sections.some(
    (section) => section.assetType === 'borrowed' && section.assets.length > 0,
  );
}

// The inline action for a section sits under the asset it acts on: Withdraw
// with supplied balances, Repay with borrowed debt, Claim with rewards. Shared
// by the desktop sectioned table and the mobile/detail per-asset rows so both
// place the same button against the same asset.
export function getSectionActionPlacement(
  assetType: IProtocolPositionSectionAssetType,
): 'balance' | 'rewards' | 'debt' | undefined {
  if (assetType === 'rewards') return 'rewards';
  if (assetType === 'supplied' || assetType === 'other') return 'balance';
  if (assetType === 'borrowed') return 'debt';
  return undefined;
}

// A position renders as "sectioned" (Supplied/Borrowed/Rewards blocks, each
// asset getting its own action) when it's lending or carries debt; otherwise
// it's a compact "unified" position with a single position-level action.
// Mirrors the split in buildProtocolCategoryGroups so the detail page matches
// the list.
function isSectionedPosition(
  position: ILocalizedProtocolPositionItem,
): boolean {
  const normalized = normalizeDeFiCategory(position.category) || 'other';
  if (normalized === LENDING_NORMALIZED_CATEGORY) {
    return true;
  }
  return position.sections.some(
    (section) => section.assetType === 'borrowed' && section.assets.length > 0,
  );
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

  return orderedCategoryKeys.flatMap<IProtocolCategoryGroup>((normalized) => {
    const bucketItems = positionsByCategory.get(normalized);
    if (!bucketItems || bucketItems.length === 0) {
      throw new OneKeyLocalError('protocol category bucket missing');
    }
    const sample = bucketItems[0];
    const sharedMeta = {
      category: sample.category,
      categoryLabel: sample.categoryLabel,
      categoryLabelId: sample.categoryLabelId,
    };

    if (normalized === LENDING_NORMALIZED_CATEGORY) {
      // Lending is always sectioned and never merges by poolName — every
      // market keeps its own block.
      return [
        {
          kind: 'sectioned',
          groupKey: normalized,
          ...sharedMeta,
          positions: bucketItems,
        },
      ];
    }

    // Non-lending: clean positions stay in the compact unified table;
    // debt-bearing positions split out into an adjacent sectioned group
    // (own badge, own table) so Borrowed renders as a labelled section
    // instead of being dropped on the unified-row floor.
    const cleanItems: IProtocolPositionItem[] = [];
    const debtItems: IProtocolPositionItem[] = [];
    for (const item of bucketItems) {
      if (positionHasBorrowed(item)) {
        debtItems.push(item);
      } else {
        cleanItems.push(item);
      }
    }
    const groups: IProtocolCategoryGroup[] = [];
    const displayKind = getUnifiedDisplayKind(normalized);
    if (cleanItems.length > 0) {
      groups.push({
        kind: 'unified',
        groupKey: normalized,
        ...sharedMeta,
        displayKind,
        rows: buildUnifiedRowsFromPositions(displayKind, cleanItems),
      });
    }
    if (debtItems.length > 0) {
      groups.push({
        kind: 'sectioned',
        groupKey: `${normalized}${DEBT_GROUP_KEY_SUFFIX}`,
        ...sharedMeta,
        positions: debtItems,
      });
    }
    return groups;
  });
}

function buildLocalizedProtocolCategoryGroups({
  protocol,
  translate,
}: {
  protocol: IDeFiProtocol;
  translate: ITranslatePositionLabel;
}): ILocalizedProtocolCategoryGroup[] {
  return buildProtocolCategoryGroups(
    protocol,
  ).map<ILocalizedProtocolCategoryGroup>((group) => {
    const translatedLabel = group.categoryLabelId
      ? translate(group.categoryLabelId)
      : group.categoryLabel;
    if (group.kind === 'sectioned') {
      return {
        kind: 'sectioned',
        groupKey: group.groupKey,
        category: group.category,
        categoryLabel: translatedLabel,
        positions: group.positions.map((position) =>
          localizePositionItem(position, translate),
        ),
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

// Badge label id for a resolved action, in the same wording the detail page
// uses. `Permit` is an internal approval step (omitted → undefined); Claim and
// ClaimWithdrawal collapse to one "Claim". RemoveLiquidity reads "Remove &
// Claim rewards" only when the position holds rewards, otherwise plain "Remove".
function getProtocolActionBadgeLabelId(
  action: EDeFiPositionAction,
  hasRewards: boolean,
): ETranslations | undefined {
  switch (action) {
    case EDeFiPositionAction.Withdraw:
      return ETranslations.global_withdraw;
    case EDeFiPositionAction.Repay:
      return ETranslations.defi_repay;
    case EDeFiPositionAction.Claim:
    case EDeFiPositionAction.ClaimWithdrawal:
      return ETranslations.earn_claim;
    case EDeFiPositionAction.RemoveLiquidity:
      return hasRewards
        ? ETranslations.earn_remove_and_claim_rewards__action
        : ETranslations.dexmarket_details_liquidity_change_remove;
    default:
      return undefined;
  }
}

// Badge display order, deduped by label id. A protocol with both a reward LP
// and a plain LP can surface both Remove variants, hence both are listed.
const DEFI_ACTION_BADGE_LABEL_ORDER: ETranslations[] = [
  ETranslations.global_withdraw,
  ETranslations.defi_repay,
  ETranslations.earn_claim,
  ETranslations.earn_remove_and_claim_rewards__action,
  ETranslations.dexmarket_details_liquidity_change_remove,
];

// Distinct, ordered i18n label ids for the actions a protocol's positions can
// perform (union across positions). Empty when nothing is actionable or the
// supported-actions config hasn't loaded yet.
function getProtocolActionBadgeLabelIds({
  protocol,
  supportedActions,
}: {
  protocol: IDeFiProtocol;
  supportedActions: IDeFiSupportedProtocolAction[];
}): ETranslations[] {
  if (!supportedActions.length) return [];
  const available = new Set<ETranslations>();
  for (const position of protocol.positions) {
    const hasRewards = defiActionUtils.positionHasRewards(position);
    for (const resolved of defiActionUtils.resolveDeFiPositionActions({
      protocol,
      position,
      supportedActions,
    })) {
      const labelId = getProtocolActionBadgeLabelId(
        resolved.action,
        hasRewards,
      );
      if (labelId) available.add(labelId);
    }
  }
  return DEFI_ACTION_BADGE_LABEL_ORDER.filter((labelId) =>
    available.has(labelId),
  );
}

export {
  buildLocalizedProtocolCategoryGroups,
  buildLocalizedProtocolPositionItems,
  buildProtocolCategoryGroups,
  buildProtocolDisplayInfo,
  buildProtocolPositionItems,
  collectDeFiImageUrls,
  getProtocolActionBadgeLabelIds,
  getProtocolPositionDisplayName,
  getPositionModuleLabel,
  isSectionedPosition,
};
