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
} from '@onekeyhq/kit/src/utils/defiPositionUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type {
  IDeFiAsset,
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';
import type {
  IEarnPortfolioPosition,
  IEarnPortfolioPositionsResponse,
  IEarnPositionCategory,
  IEarnPositionManageTarget,
  IEarnPositionRewardAsset,
  IEarnPositionRewardClaim,
} from '@onekeyhq/shared/types/earn/portfolioPositions';
import type { IEarnActionIcon } from '@onekeyhq/shared/types/staking';

/**
 * View model of the phone "My portfolio" DeFi Assets tab (OK-61377).
 *
 * The server sends one position per state of a holding (the staked
 * principal with its rewards, the principal out of its cooldown, one
 * position per withdrawal in progress), the way the wallet DeFi portfolio
 * keys positions. Product (10-12): one holding is one card. So the states
 * of one holding — same protocol, network, provider, symbol and vault — are
 * folded into one card here, as its sections (deposited, claimable,
 * unstaking, borrowed, rewards), and the card's actions come from all of
 * them: Manage (Unstake where leaving is the only move) while something
 * still sits in the vault, Claim for the principal out of its cooldown and
 * for every reward the server attached a claim to (one claim goes straight
 * to the confirm page, several open a sheet with one Claim each), and
 * Cancel on a withdrawal the provider lets be called back. The wallet DeFi
 * Portfolio code still does the grouping and the valuation:
 * defiUtils.transformDeFiData groups positions into one protocol per
 * network, buildLocalizedProtocolPositionItems gives the health factor.
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
  /** ms; unstaking rows whose provider knows when the funds free up */
  unlockAt?: number;
  /** unstaking rows the provider lets be called back: the server position carrying the Cancel */
  cancelSource?: IEarnPortfolioPosition;
  /** reward rows: the claim the card runs, when the server attached one */
  claim?: IEarnPositionRewardClaim;
};

/** A reward the card can collect: the reward row with the claim the server attached. */
export type IEarnClaimableReward = IEarnPositionRewardAsset & {
  claim: IEarnPositionRewardClaim;
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

/** Manage, or Unstake where leaving is the only move, into the detail page. */
export type IEarnPositionAction = {
  kind: 'manage' | 'unstake';
  target: IEarnPositionManageTarget;
};

export type IEarnPositionView = {
  /** the holding's main server position's groupId */
  key: string;
  badgeLabel: string;
  name?: string;
  /** assets + rewards - debts, the wallet position value */
  value: IProtocolValueState;
  meta?: IEarnPositionMeta;
  sections: IEarnPositionSectionView[];
  /** the way into the detail page; the card shows it while something still sits in the vault */
  action?: IEarnPositionAction;
  /** principal out of its cooldown: the server positions carrying `earn.claim`, collected on the card */
  principalClaims: IEarnPortfolioPosition[];
  /**
   * The rewards the card's Claim collects: every reward row whose claim the
   * server sent enabled (figma 30490-21882: Claim shows only for those).
   */
  claimableRewards: IEarnClaimableReward[];
  /** withdrawals in progress the provider lets be called back */
  cancels: IEarnPortfolioPosition[];
  /** what the holding holds, for the card's buttons and PnL line */
  hasDeposit: boolean;
  hasClaimable: boolean;
  hasUnstaking: boolean;
  hasRewards: boolean;
  /** the holding's main server position: the staked one, else the one with rewards, else the first */
  source: IEarnPortfolioPosition;
  /** every server position folded into the card */
  sources: IEarnPortfolioPosition[];
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

/**
 * The holding a server position belongs to: the protocol it is filed under
 * and the detail page it manages (network, provider, symbol, vault). Every
 * state of one holding — staked, claimable, each withdrawal in progress —
 * shares it, so the wallet grouping folds them into one card. Bitway's U
 * and USDT run on one contract and stay apart by symbol; the USDe cooling
 * down at Ethena is filed under Ethena and managed through Pendle, apart
 * from Pendle's own markets by symbol and vault.
 */
export function holdingKeyOf(position: IEarnPortfolioPosition): string {
  const { manage } = position.earn;
  return [
    position.protocol,
    manage.networkId,
    manage.provider,
    manage.symbol,
    manage.vault ?? '',
  ].join('|');
}

function hasDepositAsset(position: IEarnPortfolioPosition): boolean {
  return position.assets.some(
    (asset) => asset.category !== 'claimable' && asset.category !== 'unstaking',
  );
}

/** A claim button the server sent disabled (a reward under its claim floor) is no Claim on the card. */
function isClaimEnabled(button: IEarnActionIcon): boolean {
  return !('disabled' in button && button.disabled);
}

/**
 * Lista's Check row: a zero reward whose button is the signature that
 * reveals the amount. The Rewards list offers it on the row, the way the
 * detail page does; the card, which has no row buttons, leaves it out, and
 * the card's Claim never runs it.
 */
function isCheckRow(reward: IEarnPositionRewardAsset): boolean {
  return reward.claim?.button.type === 'listaCheck';
}

function hasEnabledClaim(
  reward: IEarnPositionRewardAsset,
): reward is IEarnClaimableReward {
  return (
    reward.claim !== undefined &&
    !isCheckRow(reward) &&
    isClaimEnabled(reward.claim.button)
  );
}

/**
 * The card's sections, from every state of the holding: the staked
 * principal (Supplied on a loan), the principal out of its cooldown, each
 * withdrawal in progress dated when the provider knows (soonest first, with
 * its Cancel where the provider lets it be called back), the debts, and the
 * rewards (figma 30292-17826).
 */
function buildSections({
  sources,
  category,
  translate,
}: {
  sources: IEarnPortfolioPosition[];
  category: IEarnPositionCategory;
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
    category === 'lending' ? 'supplied' : 'deposited';
  sources.forEach((source) => {
    source.assets.forEach((asset) => {
      switch (asset.category) {
        case 'claimable':
          push('claimable', asset);
          break;
        case 'unstaking':
          push('unstaking', {
            ...asset,
            unlockAt: source.earn.unstaking?.unlockAt,
            ...(source.earn.cancel ? { cancelSource: source } : {}),
          });
          break;
        default:
          push(principalKind, asset);
      }
    });
    source.debts.forEach((asset) => push('borrowed', asset));
    source.rewards.forEach((asset) => {
      if (!isCheckRow(asset)) {
        push('rewards', asset);
      }
    });
  });
  const unstaking = byKind.get('unstaking');
  if (unstaking) {
    // Soonest unlock first; rows without a date (Bitway) after the dated ones.
    byKind.set(
      'unstaking',
      unstaking.toSorted(
        (a, b) =>
          (a.unlockAt ?? Number.MAX_SAFE_INTEGER) -
          (b.unlockAt ?? Number.MAX_SAFE_INTEGER),
      ),
    );
  }
  return SECTION_ORDER.filter((kind) => byKind.has(kind)).map((kind) => ({
    key: kind,
    kind,
    assetType: SECTION_ASSET_TYPES[kind],
    title: translate(SECTION_TITLE_IDS[kind]),
    assets: byKind.get(kind) ?? [],
  }));
}

/**
 * The holding's main server position: the staked one carries the name, the
 * detail page, the PnL and the rewards; without one, the position with
 * rewards (principal withdrawn, yield left), else the first.
 */
function primaryOf(sources: IEarnPortfolioPosition[]): IEarnPortfolioPosition {
  return (
    sources.find(hasDepositAsset) ??
    sources.find((source) => source.rewards.length > 0) ??
    sources[0]
  );
}

/** The server positions of each holding, in the server's order, keyed by holdingKeyOf. */
type ISourcesByHolding = Map<string, IEarnPortfolioPosition[]>;

function buildPositionView({
  item,
  sourcesByHolding,
  translate,
}: {
  item: ILocalizedProtocolPositionItem;
  sourcesByHolding: ISourcesByHolding;
  translate: ITranslate;
}): IEarnPositionView | undefined {
  // The wallet grouping keyed the item by the holding; the server positions
  // behind it, untouched, come from the same key.
  const sources = sourcesByHolding.get(item.groupId) ?? [];
  if (sources.length === 0) {
    return undefined;
  }
  const source = primaryOf(sources);
  const category = isEarnCategory(source.category)
    ? source.category
    : undefined;
  const sections = buildSections({
    sources,
    category: category ?? 'yield',
    translate,
  });
  const has = (kind: IEarnPositionSectionKind) =>
    sections.some((section) => section.kind === kind);
  const hasDeposit = has('deposited') || has('supplied');
  const hasClaimable = has('claimable');
  const hasUnstaking = has('unstaking');
  const hasRewards = has('rewards');
  // A holding that is nothing but withdrawals in progress reads Locked, a
  // state; otherwise the Earn category. One color for every badge.
  let badgeLabel: string;
  if (hasUnstaking && !hasDeposit && !hasClaimable && !hasRewards) {
    badgeLabel = translate(ETranslations.wallet_defi_position_module_locked);
  } else if (category) {
    badgeLabel = translate(BADGE_LABEL_IDS[category]);
  } else {
    badgeLabel = item.categoryLabel;
  }
  return {
    key: source.groupId,
    badgeLabel,
    name: source.name || undefined,
    value: getProtocolPositionSectionsValueState(sections),
    meta:
      typeof item.healthFactor === 'number'
        ? { kind: 'healthFactor', healthFactor: item.healthFactor }
        : undefined,
    sections,
    action: {
      kind: source.earn.action === 'unstake' ? 'unstake' : 'manage',
      target: source.earn.manage,
    },
    principalClaims: sources.filter((entry) => entry.earn.claim),
    claimableRewards: source.rewards.filter(hasEnabledClaim),
    cancels: sources.filter((entry) => entry.earn.cancel),
    hasDeposit,
    hasClaimable,
    hasUnstaking,
    hasRewards,
    source,
    sources,
  };
}

function buildProtocolView({
  protocol,
  summary,
  sourcesByHolding,
  translate,
}: {
  protocol: IDeFiProtocol;
  summary: IProtocolSummary | undefined;
  sourcesByHolding: ISourcesByHolding;
  translate: ITranslate;
}): IEarnProtocolView {
  // Wallet order inside a protocol: value, highest first.
  const positions = buildLocalizedProtocolPositionItems({ protocol, translate })
    .map((item) => buildPositionView({ item, sourcesByHolding, translate }))
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

/**
 * Header "DeFi Assets": what the user holds, debts subtracted and rewards
 * left out (figma 30490-21882: the cards and protocol rows include their
 * rewards, the header figure does not — $58.28 = $68.90 − $10.62).
 */
export function sumEarnDefiAssets(protocols: IEarnProtocolView[]): number {
  return getProtocolPositionSectionsValueState(
    protocols
      .flatMap((protocol) => protocol.positions)
      .flatMap((position) => position.sections)
      .filter((section) => section.kind !== 'rewards'),
  ).value;
}

/** DeFi Assets tab: protocol rows (one per protocol per network) and the header total. */
export function buildEarnPortfolioView({
  response,
  translate,
}: {
  response: IEarnPortfolioPositionsResponse;
  translate: ITranslate;
}): { protocols: IEarnProtocolView[]; totalValue: number } {
  // One holding is one card: the server's per-state positions take the
  // holding as their groupId, and the wallet grouping folds them together.
  const sourcesByHolding: ISourcesByHolding = new Map();
  const positions = Object.fromEntries(
    Object.entries(response.positions).map(([networkId, list]) => [
      networkId,
      list.map((position) => {
        const groupId = holdingKeyOf(position);
        const sources = sourcesByHolding.get(groupId);
        if (sources) {
          sources.push(position);
        } else {
          sourcesByHolding.set(groupId, [position]);
        }
        return { ...position, groupId };
      }),
    ]),
  );
  const { protocols, protocolMap } = defiUtils.transformDeFiData({
    positions,
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
        sourcesByHolding,
        translate,
      }),
    )
    .filter((view) => view.positions.length > 0)
    .toSorted(byValueDesc);
  return { protocols: views, totalValue: sumEarnDefiAssets(views) };
}

/** One reward on Rewards › Claimable: the row, and the card it came from. */
export type IEarnClaimableRewardRow = {
  /** `${position key}:${index}` */
  key: string;
  position: IEarnPositionView;
  asset: IEarnPositionRewardAsset;
};

export type IEarnClaimableRewardGroup = {
  /** the protocol row key, `${networkId}-${protocol}` */
  key: string;
  protocol: string;
  networkId: string;
  name: string;
  logoURI?: string;
  /** sum of its rows */
  value: IProtocolValueState;
  rows: IEarnClaimableRewardRow[];
};

/**
 * Rewards tab, Claimable stage (the protocol part; ledger rewards come from
 * their own endpoint): one row per reward of the positions, under one group
 * per protocol per network (figma 30490-21537), each row claimed in place
 * with the claim the server attached to it. Claimable principal is part of
 * the position on DeFi Assets and never shows up here. Product rule: the
 * header Rewards figure equals what this list adds up to, so a reward the
 * server has not priced stays on the DeFi Assets card and out of this list.
 * Lista's Check row is the one zero row listed: its button is the way to
 * the amount.
 */
export function buildEarnClaimableRewardGroups(
  protocols: IEarnProtocolView[],
): IEarnClaimableRewardGroup[] {
  return protocols
    .map((protocol) => {
      // From the server rewards of the holding's main position, not the
      // card's sections: the card leaves Lista's Check row out, this list
      // is where its button lives.
      const rows = protocol.positions.flatMap((position) =>
        position.source.rewards
          // No zero rows either: a reward the server lists but has not
          // amounted yet is nothing to claim, unless its button is the point.
          .filter(
            (asset) =>
              isCheckRow(asset) ||
              (!isProtocolAssetValueUnavailable(asset) &&
                new BigNumber(asset.amount).gt(0)),
          )
          .map((asset, index) => ({
            key: `${position.key}:${index}`,
            position,
            asset,
          })),
      );
      return {
        key: protocol.key,
        protocol: protocol.protocol,
        networkId: protocol.networkId,
        name: protocol.name,
        logoURI: protocol.logoURI,
        value: getProtocolPositionSectionsValueState([
          { assetType: 'rewards', assets: rows.map((row) => row.asset) },
        ]),
        rows,
      };
    })
    .filter((group) => group.rows.length > 0)
    .toSorted((a, b) => b.value.value - a.value.value);
}

/**
 * Header "Rewards", protocol part: what the Claimable stage lists from the
 * positions, so the figure never carries a reward the list does not show.
 */
export function sumEarnClaimableRewards(
  protocols: IEarnProtocolView[],
): number {
  return buildEarnClaimableRewardGroups(protocols)
    .reduce((sum, group) => sum.plus(group.value.value), new BigNumber(0))
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
