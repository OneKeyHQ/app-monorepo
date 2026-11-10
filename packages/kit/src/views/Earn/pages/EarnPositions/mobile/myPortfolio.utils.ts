import BigNumber from 'bignumber.js';

import type { IProtocolValueState } from '@onekeyhq/kit/src/components/DeFi/protocolValueUtils';
import { buildBorrowMarketKey } from '@onekeyhq/kit/src/views/Borrow/borrowMarketKey';
import { isUnsupportedAaveNativeReserve } from '@onekeyhq/kit/src/views/Borrow/components/borrowRepayPosition.utils';
import { getCollateralCellState } from '@onekeyhq/kit/src/views/Borrow/components/collateralControls.utils';
import type { ICollateralCellState } from '@onekeyhq/kit/src/views/Borrow/components/collateralControls.utils';
import { normalizeEModeLabel } from '@onekeyhq/kit/src/views/Borrow/pages/BorrowEModeSwitch/emodeUtils';
import { buildLocalTxStatusSyncId } from '@onekeyhq/kit/src/views/Staking/utils/utils';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { IEarnPortfolioPosition } from '@onekeyhq/shared/types/earn/portfolioPositions';
import type {
  IBorrowEModeStatus,
  IEarnActionIcon,
  IEarnPortfolioAirdropAsset,
  IEarnPortfolioAsset,
  IEarnRewardsPortfolioGroup,
  IEarnRewardsPortfolioItem,
} from '@onekeyhq/shared/types/staking';

import { EARN_LENDING_MARKET_SOURCE } from './earnLendingPositions';

import type {
  IEarnLendingMarketRef,
  IEarnLendingReserveRef,
  IEarnLendingSuppliedReserve,
} from './earnLendingPositions';
import type {
  IEarnClaimableReward,
  IEarnPositionRewardGroup,
  IEarnPositionRewardRow,
  IEarnPositionSectionAsset,
  IEarnPositionSectionKind,
  IEarnPositionView,
  IEarnProtocolView,
} from './earnPositionModel';
import type { IPortfolioClaimSourceCandidate } from '../../../utils/portfolioClaimUtils';

/**
 * Pure helpers behind the phone "My portfolio" page (OK-61377).
 *
 * The page draws from two sources:
 *   - POST /earn/v1/portfolio/positions: one position per holding, the wallet
 *     DeFi Portfolio contract (see earnPositionModel.ts for the view);
 *   - POST /earn/v1/rewards/portfolio: ledger rewards (airdrops, rebates) in
 *     three stages for the Rewards tab.
 * The helpers here name positions for the pending-tx badge and adapt ledger
 * rows and card claims into the claim button the wide layout already runs.
 * Every identity reads `earn.manage`: a position filed under the protocol
 * holding its funds (the USDe cooling down at Ethena) still claims, tags its
 * txs and opens its page through the provider that reads it (Pendle).
 */

/** Header "Rewards": the ledger's claimable + pending, plus the positions' claimable and pending rewards. */
export function sumRewardsHeaderFiat({
  ledgerRewardsFiatValue,
  positionRewardsValue,
}: {
  ledgerRewardsFiatValue: string | undefined;
  positionRewardsValue: number;
}): string {
  return new BigNumber(ledgerRewardsFiatValue || '0')
    .plus(positionRewardsValue)
    .toFixed();
}

/**
 * The pending-tx tag of a position's vault: the same id the detail page and
 * the claim button stamp on a stake / withdraw / claim, so one in-flight tx
 * puts a badge on its provider row.
 */
export function positionPendingTag(position: IEarnPortfolioPosition): string {
  return buildLocalTxStatusSyncId({
    providerName: position.earn.manage.provider,
    tokenSymbol: position.earn.symbol,
    protocolVault: position.earn.vault,
  });
}

/**
 * Whether a card holds a loan or a position read from its lending market.
 * On web such a card has no page of its own to open since the market's
 * page was retired (demo 11-10): the card carries the market's controls
 * and figures itself, so its header line doesn't open anything there. The
 * phone app keeps the detail page
 */
export function isLoanPositionCard(position: IEarnPositionView): boolean {
  return position.sources.some(
    (source) =>
      source.category === 'lending' &&
      (source.debts.length > 0 ||
        source.source.provider === EARN_LENDING_MARKET_SOURCE),
  );
}

/**
 * Same guard as the wide layout: the Pendle USDe unstake row has no detail
 * page to go to, so Manage and row taps do nothing for it.
 */
export function hasPositionDetailPage(
  position: IEarnPortfolioPosition,
): boolean {
  const { earn } = position;
  return !(
    earnUtils.isPendleProvider({ providerName: earn.manage.provider }) &&
    earn.symbol === 'USDe' &&
    (earn.investment.buttons?.length ?? 0) === 0
  );
}

const EMPTY_TEXT = { text: '' };

/** A detail row with the button the card presses, the shape the claim button takes for a normal asset. */
type IEarnPositionClaimRow = Omit<
  IEarnPortfolioAsset['assetsStatus'][number],
  'button'
> & { button: IEarnActionIcon };

/** What a card's own button runs on: the asset carrying the claim identity, and the row carrying the button. */
export type IEarnPositionClaim =
  | {
      asset: IEarnPortfolioAirdropAsset;
      reward: IEarnPortfolioAirdropAsset['airdropAssets'][number];
      rewardSymbol: string;
    }
  | {
      asset: IEarnPortfolioAsset;
      reward: IEarnPositionClaimRow;
      rewardSymbol: string;
    };

/** The asset the claim button reads its protocol, network and token off, keyed on `earn.manage`. */
function positionClaimMetadata(position: IEarnPortfolioPosition) {
  const { earn } = position;
  return {
    protocol: {
      ...(earn.vault ? { vault: earn.vault } : {}),
      ...(earn.vaultName ? { vaultName: earn.vaultName } : {}),
      providerDetail: {
        code: earn.manage.provider,
        name: position.protocolName,
        logoURI: earn.providerLogoURI ?? '',
      },
    },
    network: earn.network,
  };
}

/** The position as the normal asset the claim button reads its protocol, network and token off. */
function toInvestmentAsset(
  position: IEarnPortfolioPosition,
): IEarnPortfolioAsset {
  const { earn } = position;
  const { investment } = earn;
  const asset = position.assets[0];
  return {
    token: {
      info: { symbol: earn.symbol, logoURI: asset?.meta.logoUrl ?? '' },
    },
    deposit: investment.deposit ?? {
      title: EMPTY_TEXT,
      description: EMPTY_TEXT,
    },
    earnings24h: investment.earnings24h ?? { title: EMPTY_TEXT },
    ...(investment.totalReward ? { totalReward: investment.totalReward } : {}),
    rewardAssets: [],
    assetsStatus: [],
    buttons: [],
    metadata: positionClaimMetadata(position),
  };
}

/** The investment detail's own row behind a card row's button, as a normal asset the button understands. */
function toInvestmentRowAction({
  position,
  button,
  kind,
}: {
  position: IEarnPortfolioPosition;
  button: IEarnActionIcon;
  kind: 'claimablePrincipal' | 'unstaking';
}): IEarnPositionClaim {
  const { earn } = position;
  const { investment } = earn;
  const asset = position.assets[0];
  const row = [
    ...(investment.rewardAssets ?? []),
    ...(investment.assetsStatus ?? []),
  ].find((entry) => entry.kind === kind && entry.button);
  return {
    asset: toInvestmentAsset(position),
    reward: {
      ...row,
      title: row?.title ?? EMPTY_TEXT,
      description: row?.description ?? EMPTY_TEXT,
      button,
    },
    rewardSymbol: asset?.symbol ?? earn.symbol,
  };
}

/** The symbol a claim button pays out, when it names one; the pending claim's spinner is matched on it (OK-62924). */
function claimButtonSymbol(button: IEarnActionIcon): string | undefined {
  if (!('data' in button) || !button.data || !('token' in button.data)) {
    return undefined;
  }
  return button.data.token?.info?.symbol;
}

/**
 * A reward claimed from the card or the Rewards list, through the button the
 * wide layout runs on that very row: the detail row's claim travels as a
 * normal asset, the airdrop read's as an airdrop row keyed on the position
 * (`claimSymbol`), so a reward split across two cards (Morpho pays per
 * account and token) resolves to the card it was pressed on.
 */
export function toPositionRewardClaim(
  position: IEarnPortfolioPosition,
  reward: IEarnClaimableReward,
): IEarnPositionClaim {
  const { earn } = position;
  const { button, row, claimSource } = reward.claim;
  const rewardSymbol = claimButtonSymbol(button) ?? reward.symbol;
  if (claimSource !== 'airdrop') {
    return {
      asset: toInvestmentAsset(position),
      reward: {
        ...row,
        description: row.description ?? EMPTY_TEXT,
        button,
      },
      rewardSymbol,
    };
  }
  const metadata = positionClaimMetadata(position);
  // The airdrop row type requires a tooltip the position row does not
  // carry; the claim button never reads it, so the entry is built without one.
  const airdropRow = {
    ...row,
    button,
  } as IEarnPortfolioAirdropAsset['airdropAssets'][number];
  return {
    asset: {
      token: {
        info: {
          symbol: reward.symbol,
          logoURI: reward.meta?.logoUrl ?? '',
          ...(reward.address ? { address: reward.address } : {}),
        },
      },
      airdropAssets: [airdropRow],
      metadata: {
        ...metadata,
        protocol: { ...metadata.protocol, claimSymbol: earn.symbol },
      },
    },
    reward: airdropRow,
    rewardSymbol,
  };
}

/**
 * A redeemable position claims through the button the wide layout already
 * runs on its rows: this rebuilds the asset that button reads its protocol,
 * network and token off, keyed on `earn.manage` and `earn.symbol` /
 * `earn.vault`. The investment detail's claim travels as a normal asset
 * row; the airdrop read's (the USDe cooled down at Ethena, reached through
 * Pendle) as an airdrop row, which Pendle resolves from symbol and vault.
 * Product (10-12) redeems on the detail page; the card runs this only for
 * a holding that has no page to go to.
 */
export function toPositionClaim(
  position: IEarnPortfolioPosition,
): IEarnPositionClaim | undefined {
  const { earn } = position;
  const { claim } = earn;
  if (!claim) {
    return undefined;
  }
  if (earn.claimSource !== 'airdrop') {
    return toInvestmentRowAction({
      position,
      button: claim,
      kind: 'claimablePrincipal',
    });
  }
  const asset = position.assets[0];
  const rewardSymbol = asset?.symbol ?? earn.symbol;
  const metadata = positionClaimMetadata(position);
  const row =
    earn.airdropRows?.find((entry) => entry.button) ?? earn.airdropRows?.[0];
  // The airdrop row type requires a tooltip the position row does not
  // carry; the claim button never reads it, so the entry is built without one.
  const airdropRow = {
    title: row?.title ?? EMPTY_TEXT,
    description: row?.description ?? EMPTY_TEXT,
    button: claim,
    claimType: 'airdrop',
  } as IEarnPortfolioAirdropAsset['airdropAssets'][number];
  return {
    asset: {
      token: {
        info: {
          symbol: earn.symbol,
          logoURI: asset?.meta.logoUrl ?? '',
          ...(asset?.address ? { address: asset.address } : {}),
        },
      },
      airdropAssets: [airdropRow],
      metadata,
    },
    reward: airdropRow,
    rewardSymbol,
  };
}

/**
 * A withdrawal in progress the provider lets be called back (Native): the
 * Pending withdrawal row runs the cancel the wide layout runs on that row,
 * through the same button.
 */
export function toPositionCancel(
  position: IEarnPortfolioPosition,
): IEarnPositionClaim | undefined {
  const { cancel } = position.earn;
  if (!cancel) {
    return undefined;
  }
  return toInvestmentRowAction({ position, button: cancel, kind: 'unstaking' });
}

/**
 * Whether a lending row's Withdraw or Repay is off, as the market page has
 * it: the server's flag on the row's button, or Aave's own coin on a network
 * whose market has no gateway for it
 */
export function isLendingRowActionDisabled(
  lending: IEarnLendingReserveRef,
): boolean {
  const { market } = lending.market;
  const button =
    lending.side === 'supplied'
      ? lending.reserve.withdrawButton
      : lending.reserve.repayButton;
  return (
    button?.disabled === true ||
    isUnsupportedAaveNativeReserve({
      networkId: market.networkId,
      providerName: market.provider,
      reserveAddress: lending.reserve.reserveAddress,
    })
  );
}

/**
 * What a row of the shared holding sections offers (product 10-14, the way
 * the detail page's Portfolio row does): Redeem on the deposit, the server's
 * claim (or Lista's Check) on a reward, a Pending badge on a reward the user
 * cannot claim yet, Cancel on a withdrawal the provider lets be called back
 * (Native), and the claim on the principal out of its cooldown. A lending
 * market's rows read from the market itself (web, demo 11-03) open the
 * market page's own windows: Withdraw on a supply and Repay on a loan, each
 * off where the market page has it off; the windows show what the health
 * factor becomes. A claim or cancel acts on its whole server position, so
 * only the position's first row in the section carries it.
 */
export type IEarnHoldingRowAction =
  | { kind: 'redeem' }
  | { kind: 'button'; claim: IEarnPositionClaim }
  | { kind: 'lending'; lending: IEarnLendingReserveRef; disabled: boolean }
  | { kind: 'pending' };

export function holdingRowActionOf({
  kind,
  asset,
  redeemable,
}: {
  kind: IEarnPositionSectionKind;
  asset: IEarnPositionSectionAsset;
  /** whether the deposit rows offer Redeem here: the card does, the detail page keeps it in its footer */
  redeemable: boolean;
}): IEarnHoldingRowAction | undefined {
  const { origin, lending } = asset;
  switch (kind) {
    // A lending supply's row too: the market's Withdraw where the row was
    // read from its market, else its own way out where its page offers one
    // (the supply page's Withdraw)
    case 'deposited':
    case 'supplied':
      if (lending?.side === 'supplied') {
        return {
          kind: 'lending',
          lending,
          disabled: isLendingRowActionDisabled(lending),
        };
      }
      return redeemable ? { kind: 'redeem' } : undefined;
    case 'borrowed':
      return lending?.side === 'borrowed'
        ? {
            kind: 'lending',
            lending,
            disabled: isLendingRowActionDisabled(lending),
          }
        : undefined;
    case 'rewards': {
      if (asset.status === 'pending') {
        return { kind: 'pending' };
      }
      return asset.claim
        ? {
            kind: 'button',
            claim: toPositionRewardClaim(origin, {
              ...asset,
              claim: asset.claim,
            }),
          }
        : undefined;
    }
    case 'pendingWithdrawal': {
      const cancel = asset.isOriginLead ? toPositionCancel(origin) : undefined;
      return cancel ? { kind: 'button', claim: cancel } : undefined;
    }
    case 'claimable': {
      const claim = asset.isOriginLead ? toPositionClaim(origin) : undefined;
      return claim ? { kind: 'button', claim } : undefined;
    }
    default:
      return undefined;
  }
}

/**
 * The market a lending card's rows were read from, for the card's own
 * controls (E-Mode); none for a card the API sent
 */
export function lendingMarketOf(
  position: IEarnPositionView,
): IEarnLendingMarketRef | undefined {
  for (const section of position.sections) {
    const row = section.assets.find((asset) => asset.lending);
    if (row?.lending) {
      return row.lending.market;
    }
  }
  return undefined;
}

/**
 * The card (a protocol on a network) holding a lending market's position,
 * found by the market its rows were read from: where a Your loans card
 * takes the page (the key buildBorrowMarketKey writes)
 */
export function findLendingMarketCardKey(
  protocols: IEarnProtocolView[],
  marketKey: string,
): string | undefined {
  return protocols.find((protocol) =>
    protocol.positions.some((position) => {
      const market = lendingMarketOf(position);
      return market ? buildBorrowMarketKey(market.market) === marketKey : false;
    }),
  )?.key;
}

/**
 * The collateral control hung under a supplied row read from its market,
 * as the market page's own rows have it: where the market says whether the
 * supply counts as collateral (Aave; Kamino doesn't say), the switch, or the
 * mark that the market never takes this asset as collateral
 */
export function lendingCollateralOf(asset: IEarnPositionSectionAsset):
  | {
      state: Exclude<ICollateralCellState, 'hidden'>;
      reserve: IEarnLendingSuppliedReserve;
      market: IEarnLendingMarketRef;
    }
  | undefined {
  const { lending } = asset;
  if (lending?.side !== 'supplied') {
    return undefined;
  }
  const state = getCollateralCellState(lending.reserve);
  return state === 'hidden'
    ? undefined
    : { state, reserve: lending.reserve, market: lending.market };
}

/**
 * The account's E-Mode in a market as the market page's E-Mode bar names it
 * (BorrowEModeMetric): the category on, else Off. Nothing where the market
 * has no categories, where the bar hides too
 */
export function lendingEModeLabelOf(
  eModeStatus: IBorrowEModeStatus | null | undefined,
  offLabel: string,
): string | undefined {
  if (!eModeStatus?.categories?.length) {
    return undefined;
  }
  const current = eModeStatus.categories.find(
    (category) => category.eModeId === eModeStatus.eModeId,
  );
  return eModeStatus.eModeId !== 0 && current
    ? normalizeEModeLabel(current.label)
    : offLabel;
}

/**
 * Whether the card's deposit row offers its way out, mirroring the detail
 * page's footer (product 10-15: every row the user can act on carries its
 * action): a holding with principal and a page to go to. Redeem, or Sell
 * early for a Pendle PT before its market matures. Ethena's USDe is managed
 * rather than redeemed, and a loan does not unfold here.
 */
export function canRedeemFromCard(position: IEarnPositionView): boolean {
  const { source } = position;
  const { manage } = source.earn;
  return (
    position.sections.some((section) => section.kind === 'deposited') &&
    hasPositionDetailPage(source) &&
    (earnUtils.isPendleProvider({ providerName: manage.provider }) ||
      manage.symbol.toUpperCase() !== 'USDE')
  );
}

/**
 * Whether a dated position (a Pendle market) has passed its maturity: the
 * server's flag, or its date against the clock, whichever says so first (a
 * cached position flagged before its date passed matures on the clock).
 * Undefined for a position without either, so a caller can fall through to
 * another source.
 */
export function positionMatured(
  position: IEarnPortfolioPosition,
): boolean | undefined {
  const { earn } = position;
  if (earn.matured) {
    return true;
  }
  if (earn.maturityAt !== undefined) {
    return earn.maturityAt <= Date.now();
  }
  return earn.matured;
}

/**
 * Whether a server-formatted amount ("+0.216 USDT", "< 0.0001 U") reads as
 * more than nothing, for the gain's green. A loss, a zero or a text that
 * isn't an amount reads as no gain.
 */
export function isPositiveAmountText(text: string): boolean {
  const match = /^([+-]?)\s*<?\s*([+-]?)\s*([\d,]*\.?\d+)/.exec(text.trim());
  if (!match || match[1] === '-' || match[2] === '-') {
    return false;
  }
  return new BigNumber(match[3].replace(/,/g, '')).gt(0);
}

/**
 * A Pendle PT before its market matures is sold rather than redeemed: the
 * detail page's footer reads Sell early until maturity, and so does the row.
 */
export function sellsEarly(position: IEarnPortfolioPosition): boolean {
  const { earn } = position;
  if (!earnUtils.isPendleProvider({ providerName: earn.manage.provider })) {
    return false;
  }
  return !(positionMatured(position) ?? false);
}

/**
 * Candidates for resolving which protocol a ledger claim belongs to: every
 * vault the wallet holds a position in, the list the claim button matches a
 * ledger row against.
 */
export function buildClaimSourceCandidates(
  positions: IEarnPortfolioPosition[],
): IPortfolioClaimSourceCandidate[] {
  return positions.map((position) => ({
    networkId: position.networkId,
    providerName: position.earn.manage.provider,
    symbol: position.earn.symbol,
    vault: position.earn.vault,
  }));
}

/** Network name and logo per network, as the positions name them; for ledger rows. */
export function buildNetworkInfoMap(
  positions: IEarnPortfolioPosition[],
): Map<string, { name: string; logoURI: string }> {
  const map = new Map<string, { name: string; logoURI: string }>();
  positions.forEach((position) => {
    const { network } = position.earn;
    if (!map.has(network.networkId)) {
      map.set(network.networkId, {
        name: network.name,
        logoURI: network.logoURI,
      });
    }
  });
  return map;
}

/** One group on Rewards › Claimable or Pending: a protocol on one network, its position rewards and its ledger rewards together. */
export type IRewardsStageGroup = {
  /** `${networkId}|${provider}` */
  key: string;
  provider: string;
  networkId: string;
  name: string;
  logoURI?: string;
  /** fiat of every row; unavailable when nothing priced the group */
  value: IProtocolValueState;
  /** the group's token amount, for a ledger group nothing priced whose rows are one token */
  amountOnly?: { amount: string; symbol: string };
  positionRows: IEarnPositionRewardRow[];
  ledgerItems: {
    group: IEarnRewardsPortfolioGroup;
    item: IEarnRewardsPortfolioItem;
  }[];
};

/**
 * Rewards › Claimable and Pending (figma 30490-21537): one group per
 * protocol per network, the positions' rewards first and the ledger's
 * rewards after them, highest total first. The ledger names its groups by
 * provider and network, the same key the protocol rows use.
 */
export function mergeRewardGroups({
  positionGroups,
  ledgerGroups,
}: {
  positionGroups: IEarnPositionRewardGroup[];
  ledgerGroups: IEarnRewardsPortfolioGroup[];
}): IRewardsStageGroup[] {
  const byKey = new Map<string, IRewardsStageGroup>();
  positionGroups.forEach((group) => {
    const key = `${group.networkId}|${group.protocol}`;
    byKey.set(key, {
      key,
      provider: group.protocol,
      networkId: group.networkId,
      name: group.name,
      logoURI: group.logoURI,
      value: { ...group.value },
      positionRows: group.rows,
      ledgerItems: [],
    });
  });
  ledgerGroups.forEach((group) => {
    const key = `${group.networkId}|${group.provider}`;
    const fiat = new BigNumber(group.total.fiatValue || '0');
    const hasFiat = fiat.gt(0);
    const ledgerItems = group.items.map((item) => ({ group, item }));
    const existing = byKey.get(key);
    if (existing) {
      existing.ledgerItems.push(...ledgerItems);
      existing.value = {
        value: new BigNumber(existing.value.value).plus(fiat).toNumber(),
        hasAvailableValue: existing.value.hasAvailableValue || hasFiat,
        hasUnavailableValue: existing.value.hasUnavailableValue || !hasFiat,
      };
      return;
    }
    byKey.set(key, {
      key,
      provider: group.provider,
      networkId: group.networkId,
      name: group.providerName,
      logoURI: group.providerLogoURI,
      value: {
        value: fiat.toNumber(),
        hasAvailableValue: hasFiat,
        hasUnavailableValue: !hasFiat,
      },
      ...(!hasFiat && group.total.amount && group.total.symbol
        ? {
            amountOnly: {
              amount: group.total.amount,
              symbol: group.total.symbol,
            },
          }
        : {}),
      positionRows: [],
      ledgerItems,
    });
  });
  return Array.from(byKey.values()).toSorted(
    (a, b) => b.value.value - a.value.value,
  );
}

/**
 * Adapts a ledger reward row into the airdrop-asset shape the existing claim
 * button (WrappedActionButton + usePortfolioAction) already knows how to
 * claim, so the ledger path reuses the same identity resolution, pending-tx
 * spinner and refresh as the wide layout's airdrop rows.
 */
export function toLedgerClaimAsset({
  group,
  item,
  networkName,
  networkLogoURI,
  claimSymbol,
}: {
  group: IEarnRewardsPortfolioGroup;
  item: IEarnRewardsPortfolioItem;
  networkName: string;
  networkLogoURI: string;
  /**
   * The token of the Earn product the reward's vault belongs to, where the
   * product list names one: the claim the home's reward pills and DeFi
   * Assets make for the same reward (demo 10-29). Without it the claim is
   * matched to the account's positions
   */
  claimSymbol?: string;
}): IEarnPortfolioAirdropAsset | undefined {
  const button = item.buttons?.[0];
  if (!button) {
    return undefined;
  }
  // The airdrop row type requires a tooltip the ledger row does not carry;
  // the claim button never reads it, so the entry is built without one.
  const airdropRow = {
    title: item.title,
    description: item.description,
    button,
    claimType: 'airdrop',
  } as IEarnPortfolioAirdropAsset['airdropAssets'][number];
  return {
    token: {
      info: {
        symbol: item.token.info.symbol,
        logoURI: item.token.info.logoURI,
        address: item.token.info.address,
      },
    },
    airdropAssets: [airdropRow],
    metadata: {
      protocol: {
        vault: item.vault,
        ...(claimSymbol
          ? { claimSymbol, claimSymbolStatus: 'matched' as const }
          : {}),
        providerDetail: {
          code: group.provider,
          name: group.providerName,
          logoURI: group.providerLogoURI ?? '',
        },
      },
      network: {
        networkId: group.networkId,
        name: networkName,
        logoURI: networkLogoURI,
      },
    },
  };
}
