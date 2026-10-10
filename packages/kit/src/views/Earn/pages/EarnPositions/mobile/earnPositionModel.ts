import BigNumber from 'bignumber.js';

import {
  type IProtocolValueState,
  getProtocolPositionSectionsValueState,
  getProtocolValueState,
  isProtocolAssetValueUnavailable,
} from '@onekeyhq/kit/src/components/DeFi/protocolValueUtils';
import {
  type ILocalizedProtocolPositionItem,
  type IProtocolPositionSectionAssetType,
  buildLocalizedProtocolPositionItems,
  getProtocolPositionDisplayName,
} from '@onekeyhq/kit/src/utils/defiPositionUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type {
  IDeFiAsset,
  IDeFiPosition,
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';
import type {
  IEarnPortfolioPosition,
  IEarnPortfolioPositionsResponse,
  IEarnPositionCategory,
  IEarnPositionManageTarget,
} from '@onekeyhq/shared/types/earn/portfolioPositions';

/**
 * View model of the phone "My portfolio" DeFi Assets tab (OK-61377).
 *
 * What a position is comes from the server and the wallet DeFi Portfolio
 * code, unchanged: defiUtils.transformDeFiData groups positions into one
 * protocol per network and keys each position by groupId, and
 * buildLocalizedProtocolPositionItems gives its value and health factor.
 * This file adds what the Earn design adds on top: the badge copy, the
 * sections a card shows (deposited, claimable, borrowed, rewards; one
 * unstaking section on a locked card), the locked card's name and the
 * card's single action. Product rules: the staked principal and its rewards
 * are one card with Manage (Unstake where leaving is the only move); each
 * withdrawal in progress is a locked card of its own (Cancel where the
 * provider lets it be called back), and principal out of its cooldown is a
 * claimable card of its own with Claim, as the wallet DeFi portfolio shows
 * them, since the detail page lists what sits in the vault and its rewards,
 * not principal on its way out.
 */

type ITranslate = (id: ETranslations) => string;

export type IEarnPositionSectionKind =
  | 'deposited'
  | 'supplied'
  | 'claimable'
  | 'unstaking'
  | 'borrowed'
  | 'rewards';

export type IEarnPositionSectionAsset = IDeFiAsset & {
  /** ms; locked cards whose provider knows when the funds free up */
  unlockAt?: number;
};

export type IEarnPositionSectionView = {
  key: string;
  kind: IEarnPositionSectionKind;
  /** the wallet bucket the rows belong to; drives the value sign */
  assetType: IProtocolPositionSectionAssetType;
  title: string;
  assets: IEarnPositionSectionAsset[];
};

export type IEarnPositionMeta = { kind: 'healthFactor'; healthFactor: number };

export type IEarnPositionAction =
  | { kind: 'manage' | 'unstake'; target: IEarnPositionManageTarget }
  | { kind: 'claim' }
  | { kind: 'cancel' };

/**
 * active: the staked principal and its rewards; unstaking: a withdrawal in
 * progress, a locked card named after its unlock time; claimable: principal
 * out of its cooldown, collected on the card.
 */
export type IEarnPositionStage = 'active' | 'unstaking' | 'claimable';

export type IEarnPositionView = {
  /** the position's groupId */
  key: string;
  badgeLabel: string;
  name?: string;
  /** assets + rewards - debts, the wallet position value */
  value: IProtocolValueState;
  meta?: IEarnPositionMeta;
  sections: IEarnPositionSectionView[];
  /** the card's single button */
  action?: IEarnPositionAction;
  stage: IEarnPositionStage;
  /** unstaking cards: when the funds free up, if the provider knows */
  locked?: { unlockAt?: number };
  /** the server position behind the card */
  source: IEarnPortfolioPosition;
  /** Claimable stage: the card shows its rewards alone, no PnL line */
  variant?: 'rewards';
};

export type IEarnProtocolView = {
  /** `${networkId}-${protocol}`, the wallet protocol key */
  key: string;
  protocol: string;
  networkId: string;
  name: string;
  logoURI?: string;
  /** sum of its positions */
  value: IProtocolValueState;
  positions: IEarnPositionView[];
};

const BADGE_LABEL_IDS: Record<IEarnPositionCategory, ETranslations> = {
  yield: ETranslations.earn_yield,
  staked: ETranslations.earn_category_staked__title,
  lending: ETranslations.earn_loans,
};

// Unstaking reuses the status the detail page prints on these very rows
// ("Withdrawal requested"); a dedicated "Unstaking" key is still on the
// OK-61377 i18n list.
const SECTION_TITLE_IDS: Record<IEarnPositionSectionKind, ETranslations> = {
  deposited: ETranslations.earn_deposited,
  supplied: ETranslations.wallet_defi_asset_type_supplied,
  claimable: ETranslations.earn_claimable,
  unstaking: ETranslations.earn_withdrawal_requested,
  borrowed: ETranslations.wallet_defi_asset_type_borrowed,
  rewards: ETranslations.wallet_defi_position_module_rewards,
};

const SECTION_ASSET_TYPES: Record<
  IEarnPositionSectionKind,
  IProtocolPositionSectionAssetType
> = {
  deposited: 'supplied',
  supplied: 'supplied',
  claimable: 'supplied',
  unstaking: 'supplied',
  borrowed: 'borrowed',
  rewards: 'rewards',
};

// Figma 30292-17104: principal first, then what is owed on top.
const SECTION_ORDER: IEarnPositionSectionKind[] = [
  'deposited',
  'supplied',
  'claimable',
  'unstaking',
  'borrowed',
  'rewards',
];

function isEarnCategory(category: string): category is IEarnPositionCategory {
  return category in BADGE_LABEL_IDS;
}

function isEarnPosition(
  source: IDeFiPosition,
): source is IEarnPortfolioPosition {
  return 'earn' in source;
}

// Every entry of one groupId carries the same `earn` block.
function readEarnPosition(
  sourcePositions: IDeFiPosition[] | undefined,
): IEarnPortfolioPosition | undefined {
  return sourcePositions?.find(isEarnPosition);
}

/** "Unlock time: 2026-10-12", the locked card's name; plain "Locked" without a date. */
function lockedName({
  unlockAt,
  translate,
}: {
  unlockAt?: number;
  translate: ITranslate;
}): string {
  if (!unlockAt) {
    return translate(ETranslations.wallet_defi_position_module_locked);
  }
  return `${translate(ETranslations.earn_unlock_time)}: ${formatDate(
    new Date(unlockAt),
    { hideTimeForever: true },
  )}`;
}

function buildSections({
  source,
  translate,
}: {
  source: IEarnPortfolioPosition;
  translate: ITranslate;
}): IEarnPositionSectionView[] {
  const byKind = new Map<
    IEarnPositionSectionKind,
    IEarnPositionSectionAsset[]
  >();
  const push = (
    kind: IEarnPositionSectionKind,
    asset: IEarnPositionSectionAsset,
  ) => {
    const list = byKind.get(kind);
    if (list) {
      list.push(asset);
    } else {
      byKind.set(kind, [asset]);
    }
  };
  const principalKind: IEarnPositionSectionKind =
    source.category === 'lending' ? 'supplied' : 'deposited';
  source.assets.forEach((asset) => {
    switch (asset.category) {
      case 'claimable':
        push('claimable', asset);
        break;
      case 'unstaking':
        push('unstaking', {
          ...asset,
          unlockAt: source.earn.unstaking?.unlockAt,
        });
        break;
      default:
        push(principalKind, asset);
    }
  });
  source.debts.forEach((asset) => push('borrowed', asset));
  source.rewards.forEach((asset) => push('rewards', asset));
  return SECTION_ORDER.filter((kind) => byKind.has(kind)).map((kind) => ({
    key: kind,
    kind,
    assetType: SECTION_ASSET_TYPES[kind],
    title: translate(SECTION_TITLE_IDS[kind]),
    assets: byKind.get(kind) ?? [],
  }));
}

// The server attaches `claim` and `cancel` to the positions acted on from
// the card alone: principal to collect, a withdrawal that can be called back.
function resolveAction(source: IEarnPortfolioPosition): IEarnPositionAction {
  const { earn } = source;
  if (earn.claim) {
    return { kind: 'claim' };
  }
  if (earn.cancel) {
    return { kind: 'cancel' };
  }
  return {
    kind: earn.action === 'unstake' ? 'unstake' : 'manage',
    target: earn.manage,
  };
}

function stageOf(source: IEarnPortfolioPosition): IEarnPositionStage {
  if (source.earn.unstaking) {
    return 'unstaking';
  }
  const principalOut =
    source.assets.length > 0 &&
    source.assets.every((asset) => asset.category === 'claimable');
  return principalOut && source.rewards.length === 0 ? 'claimable' : 'active';
}

/** The badge: Locked on a withdrawal in progress, else the Earn category. */
function badgeLabelOf({
  item,
  locked,
  translate,
}: {
  item: ILocalizedProtocolPositionItem;
  locked: boolean;
  translate: ITranslate;
}): string {
  if (locked) {
    return translate(ETranslations.wallet_defi_position_module_locked);
  }
  if (isEarnCategory(item.category)) {
    return translate(BADGE_LABEL_IDS[item.category]);
  }
  return item.categoryLabel;
}

function buildPositionView({
  item,
  translate,
}: {
  item: ILocalizedProtocolPositionItem;
  translate: ITranslate;
}): IEarnPositionView | undefined {
  const source = readEarnPosition(item.sourcePositions);
  if (!source) {
    return undefined;
  }
  const sections = buildSections({ source, translate });
  const stage = stageOf(source);
  const locked = stage === 'unstaking' ? source.earn.unstaking : undefined;
  return {
    key: item.positionKey,
    badgeLabel: badgeLabelOf({ item, locked: Boolean(locked), translate }),
    name: locked
      ? lockedName({ unlockAt: locked.unlockAt, translate })
      : getProtocolPositionDisplayName(item),
    value: getProtocolPositionSectionsValueState(sections),
    meta:
      typeof item.healthFactor === 'number'
        ? { kind: 'healthFactor', healthFactor: item.healthFactor }
        : undefined,
    sections,
    action: resolveAction(source),
    stage,
    locked,
    source,
  };
}

function buildProtocolView({
  protocol,
  summary,
  translate,
}: {
  protocol: IDeFiProtocol;
  summary: IProtocolSummary | undefined;
  translate: ITranslate;
}): IEarnProtocolView {
  // Wallet order inside a protocol: value, highest first.
  const positions = buildLocalizedProtocolPositionItems({ protocol, translate })
    .map((item) => buildPositionView({ item, translate }))
    .filter((view): view is IEarnPositionView => Boolean(view));
  return {
    key: defiUtils.buildProtocolMapKey({
      protocol: protocol.protocol,
      networkId: protocol.networkId,
    }),
    protocol: protocol.protocol,
    networkId: protocol.networkId,
    name:
      summary?.protocolName ||
      positions[0]?.source.protocolName ||
      protocol.protocol,
    logoURI:
      summary?.protocolLogo ||
      positions[0]?.source.earn.providerLogoURI ||
      undefined,
    value: getProtocolValueState(protocol),
    positions,
  };
}

function byValueDesc(a: IEarnProtocolView, b: IEarnProtocolView) {
  return b.value.value - a.value.value;
}

/** DeFi Assets tab: protocol rows (one per protocol per network) and the header total. */
export function buildEarnPortfolioView({
  response,
  translate,
}: {
  response: IEarnPortfolioPositionsResponse;
  translate: ITranslate;
}): { protocols: IEarnProtocolView[]; totalValue: number } {
  const { protocols, protocolMap } = defiUtils.transformDeFiData({
    positions: response.positions,
    protocolSummaries: response.protocolSummaries,
  });
  const views = protocols
    .map((protocol) =>
      buildProtocolView({
        protocol,
        summary:
          protocolMap[
            defiUtils.buildProtocolMapKey({
              protocol: protocol.protocol,
              networkId: protocol.networkId,
            })
          ],
        translate,
      }),
    )
    .filter((view) => view.positions.length > 0)
    .toSorted(byValueDesc);
  const totalValue = views
    .reduce((sum, view) => sum.plus(view.value.value), new BigNumber(0))
    .toNumber();
  return { protocols: views, totalValue };
}

/**
 * Rewards tab, Claimable stage (the protocol part; ledger rewards come from
 * their own endpoint): the same position cards with only their Rewards
 * section, so each card and each protocol row reads the rewards amount, never
 * the principal. Claimable principal is part of the position on DeFi Assets
 * and never shows up here. Product rule: the header Rewards figure equals
 * what this list adds up to, so a reward the server has not priced stays on
 * the DeFi Assets card and out of this list.
 */
export function buildEarnClaimableRewardsView(
  protocols: IEarnProtocolView[],
): IEarnProtocolView[] {
  return protocols
    .map((protocol) => {
      const positions = protocol.positions.flatMap<IEarnPositionView>(
        (position) => {
          // No zero rows either: a reward the server lists but has not
          // amounted yet (Lista before its Check) is nothing to claim.
          const sections = position.sections
            .filter((section) => section.kind === 'rewards')
            .map((section) => ({
              ...section,
              assets: section.assets.filter(
                (asset) =>
                  !isProtocolAssetValueUnavailable(asset) &&
                  new BigNumber(asset.amount).gt(0),
              ),
            }))
            .filter((section) => section.assets.length > 0);
          if (sections.length === 0) {
            return [];
          }
          return [
            {
              ...position,
              meta: undefined,
              sections,
              value: getProtocolPositionSectionsValueState(sections),
              variant: 'rewards' as const,
            },
          ];
        },
      );
      return {
        ...protocol,
        positions,
        value: getProtocolPositionSectionsValueState(
          positions.flatMap((position) => position.sections),
        ),
      };
    })
    .filter((protocol) => protocol.positions.length > 0)
    .toSorted(byValueDesc);
}

/**
 * Header "Rewards", protocol part: what the Claimable stage lists from the
 * positions, so the figure never carries a reward the list does not show.
 */
export function sumEarnClaimableRewards(
  protocols: IEarnProtocolView[],
): number {
  return buildEarnClaimableRewardsView(protocols)
    .reduce((sum, protocol) => sum.plus(protocol.value.value), new BigNumber(0))
    .toNumber();
}

/** Network filter: protocol rows are per network, so the match is exact. */
export function filterEarnProtocolsByNetworks(
  protocols: IEarnProtocolView[],
  networkIds: string[],
): IEarnProtocolView[] {
  if (networkIds.length === 0) {
    return protocols;
  }
  const selected = new Set(networkIds);
  return protocols.filter((protocol) => selected.has(protocol.networkId));
}

/** Network filter options: the networks with positions, and how many each holds. */
export function countEarnPositionsByNetwork(
  protocols: IEarnProtocolView[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  protocols.forEach((protocol) => {
    counts[protocol.networkId] =
      (counts[protocol.networkId] ?? 0) + protocol.positions.length;
  });
  return counts;
}
