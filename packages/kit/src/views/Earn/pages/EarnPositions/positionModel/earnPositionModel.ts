import BigNumber from 'bignumber.js';

import {
  type IProtocolValueState,
  getProtocolPositionSectionsValueState,
  getProtocolValueState,
} from '@onekeyhq/kit/src/components/DeFi/protocolValueUtils';
import {
  type ILocalizedProtocolPositionItem,
  type ILocalizedProtocolPositionSection,
  type IProtocolPositionSectionAssetType,
  buildLocalizedProtocolPositionItems,
  getProtocolPositionDisplayName,
} from '@onekeyhq/kit/src/utils/defiPositionUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type {
  IDeFiPosition,
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';
import type { IEarnClaimActionIcon } from '@onekeyhq/shared/types/staking';

import type {
  IEarnPortfolioPositionsResponse,
  IEarnPositionCategory,
  IEarnPositionExtension,
  IEarnPositionManageTarget,
  IEarnPositionState,
} from './earnPositionModel.types';

/**
 * Reference view model for the phone "My portfolio" DeFi Assets tab.
 *
 * Everything that decides what a position is comes from the wallet DeFi
 * Portfolio code, unchanged: defiUtils.transformDeFiData groups positions into
 * one protocol per network and keys each position by groupId, and
 * buildLocalizedProtocolPositionItems builds its sections, value and health
 * factor. This file only adds what the Earn design adds on top: the badge
 * copy, the section label of claimable / unstaking positions, the unlock time
 * row, the Manage / Claim action and the card order inside a protocol.
 */

type ITranslate = (id: ETranslations) => string;

/**
 * Copy without a Lokalise key yet (both are on the OK-61377 list). The
 * reference renders the English text; the page must use the keys once they
 * exist.
 */
export const EARN_POSITION_PENDING_COPY = {
  unstaking: 'Unstaking',
  estUnlockTime: 'Est. unlock time',
} as const;

export type IEarnPositionSectionKind =
  | 'deposited'
  | 'supplied'
  | 'borrowed'
  | 'rewards'
  | 'claimable'
  | 'unstaking'
  | 'other';

export type IEarnPositionSectionView = {
  key: string;
  kind: IEarnPositionSectionKind;
  /** the wallet bucket the rows came from; drives the value sign */
  assetType: IProtocolPositionSectionAssetType;
  title: string;
  assets: ILocalizedProtocolPositionSection['assets'];
};

export type IEarnPositionMeta =
  | { kind: 'healthFactor'; healthFactor: number }
  | { kind: 'unlockAt'; unlockAt: number };

export type IEarnPositionAction =
  | { kind: 'manage'; target: IEarnPositionManageTarget }
  | { kind: 'claim'; claim: IEarnClaimActionIcon };

export type IEarnPositionView = {
  /** the position's groupId */
  key: string;
  state: IEarnPositionState;
  badgeLabel: string;
  name?: string;
  /** assets + rewards - debts, the wallet position value */
  value: IProtocolValueState;
  meta?: IEarnPositionMeta;
  sections: IEarnPositionSectionView[];
  action?: IEarnPositionAction;
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

const SECTION_TITLE_IDS: Record<
  Exclude<IEarnPositionSectionKind, 'unstaking'>,
  ETranslations
> = {
  deposited: ETranslations.earn_deposited,
  supplied: ETranslations.wallet_defi_asset_type_supplied,
  borrowed: ETranslations.wallet_defi_asset_type_borrowed,
  rewards: ETranslations.wallet_defi_position_module_rewards,
  claimable: ETranslations.earn_claimable,
  other: ETranslations.global_others,
};

// Figma 30292-17104: the card that needs a tap comes before the one the user
// can only wait for; several unstaking requests read earliest unlock first.
const STATE_ORDER: Record<IEarnPositionState, number> = {
  active: 0,
  claimable: 1,
  unstaking: 2,
};

function isEarnCategory(category: string): category is IEarnPositionCategory {
  return category in BADGE_LABEL_IDS;
}

function hasEarnExtension(
  source: IDeFiPosition,
): source is IDeFiPosition & { earn: IEarnPositionExtension } {
  return 'earn' in source;
}

// Every entry of one groupId carries the same `earn` block.
function readEarnExtension(
  sourcePositions: IDeFiPosition[] | undefined,
): IEarnPositionExtension | undefined {
  return sourcePositions?.find(hasEarnExtension)?.earn;
}

function resolveSectionKind({
  assetType,
  state,
  category,
}: {
  assetType: IProtocolPositionSectionAssetType;
  state: IEarnPositionState;
  category: string;
}): IEarnPositionSectionKind {
  switch (assetType) {
    case 'supplied':
      if (state === 'claimable') return 'claimable';
      if (state === 'unstaking') return 'unstaking';
      return category === 'lending' ? 'supplied' : 'deposited';
    case 'borrowed':
      return 'borrowed';
    case 'rewards':
      return 'rewards';
    default:
      return 'other';
  }
}

function buildPositionView({
  item,
  translate,
}: {
  item: ILocalizedProtocolPositionItem;
  translate: ITranslate;
}): IEarnPositionView {
  const earn = readEarnExtension(item.sourcePositions);
  const state = earn?.state ?? 'active';

  const sections = item.sections.map<IEarnPositionSectionView>((section) => {
    const kind = resolveSectionKind({
      assetType: section.assetType,
      state,
      category: item.category,
    });
    return {
      key: section.key,
      kind,
      assetType: section.assetType,
      title:
        kind === 'unstaking'
          ? EARN_POSITION_PENDING_COPY.unstaking
          : translate(SECTION_TITLE_IDS[kind]),
      assets: section.assets,
    };
  });

  let meta: IEarnPositionMeta | undefined;
  if (typeof item.healthFactor === 'number') {
    meta = { kind: 'healthFactor', healthFactor: item.healthFactor };
  } else if (state === 'unstaking' && earn?.unlockAt) {
    meta = { kind: 'unlockAt', unlockAt: earn.unlockAt };
  }

  let action: IEarnPositionAction | undefined;
  if (state === 'claimable' && earn?.claim) {
    action = { kind: 'claim', claim: earn.claim };
  } else if (state === 'active' && earn?.manage) {
    action = { kind: 'manage', target: earn.manage };
  }

  return {
    key: item.positionKey,
    state,
    badgeLabel: isEarnCategory(item.category)
      ? translate(BADGE_LABEL_IDS[item.category])
      : item.categoryLabel,
    name: getProtocolPositionDisplayName(item),
    value: getProtocolPositionSectionsValueState(sections),
    meta,
    sections,
    action,
  };
}

function compareInsideProtocol(a: IEarnPositionView, b: IEarnPositionView) {
  const byState = STATE_ORDER[a.state] - STATE_ORDER[b.state];
  if (byState !== 0) {
    return byState;
  }
  if (a.state === 'unstaking') {
    const unlockA = a.meta?.kind === 'unlockAt' ? a.meta.unlockAt : Infinity;
    const unlockB = b.meta?.kind === 'unlockAt' ? b.meta.unlockAt : Infinity;
    return unlockA - unlockB;
  }
  // Same state: keep the wallet order (value, highest first).
  return 0;
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
  const positions = buildLocalizedProtocolPositionItems({ protocol, translate })
    .map((item) => buildPositionView({ item, translate }))
    .toSorted(compareInsideProtocol);
  return {
    key: defiUtils.buildProtocolMapKey({
      protocol: protocol.protocol,
      networkId: protocol.networkId,
    }),
    protocol: protocol.protocol,
    networkId: protocol.networkId,
    name: summary?.protocolName || protocol.protocol,
    logoURI: summary?.protocolLogo || undefined,
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
 * the principal. Claimable principal is a position, not a reward, and never
 * shows up here.
 */
export function buildEarnClaimableRewardsView(
  protocols: IEarnProtocolView[],
): IEarnProtocolView[] {
  return protocols
    .map((protocol) => {
      const positions = protocol.positions.flatMap<IEarnPositionView>(
        (position) => {
          const sections = position.sections.filter(
            (section) => section.kind === 'rewards',
          );
          if (sections.length === 0) {
            return [];
          }
          return [
            {
              ...position,
              meta: undefined,
              sections,
              value: getProtocolPositionSectionsValueState(sections),
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
