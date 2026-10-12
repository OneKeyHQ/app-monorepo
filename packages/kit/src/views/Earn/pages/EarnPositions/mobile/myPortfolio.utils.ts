import BigNumber from 'bignumber.js';

import type { IProtocolValueState } from '@onekeyhq/kit/src/components/DeFi/protocolValueUtils';
import { buildLocalTxStatusSyncId } from '@onekeyhq/kit/src/views/Staking/utils/utils';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { IEarnPortfolioPosition } from '@onekeyhq/shared/types/earn/portfolioPositions';
import type {
  IEarnActionIcon,
  IEarnPortfolioAirdropAsset,
  IEarnPortfolioAsset,
  IEarnRewardsPortfolioGroup,
  IEarnRewardsPortfolioItem,
} from '@onekeyhq/shared/types/staking';

import type {
  IEarnClaimableReward,
  IEarnClaimableRewardGroup,
  IEarnClaimableRewardRow,
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

/** Header "Rewards": the ledger's claimable + pending, plus the positions' claimable rewards. */
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

/** The investment detail's claimable-principal row behind a card claim, as a normal asset the button understands. */
function toInvestmentRowAction({
  position,
  button,
}: {
  position: IEarnPortfolioPosition;
  button: IEarnActionIcon;
}): IEarnPositionClaim {
  const { earn } = position;
  const { investment } = earn;
  const asset = position.assets[0];
  const row = [
    ...(investment.rewardAssets ?? []),
    ...(investment.assetsStatus ?? []),
  ].find((entry) => entry.kind === 'claimablePrincipal' && entry.button);
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
    return toInvestmentRowAction({ position, button: claim });
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

/** One group on Rewards › Claimable: a protocol on one network, its position rewards and its ledger rewards together. */
export type IClaimableRewardsGroup = {
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
  positionRows: IEarnClaimableRewardRow[];
  ledgerItems: {
    group: IEarnRewardsPortfolioGroup;
    item: IEarnRewardsPortfolioItem;
  }[];
};

/**
 * Rewards › Claimable (figma 30490-21537): one group per protocol per
 * network, the positions' rewards first and the ledger's campaign rewards
 * after them, highest total first. The ledger names its groups by provider
 * and network, the same key the protocol rows use.
 */
export function mergeClaimableRewardGroups({
  positionGroups,
  ledgerGroups,
}: {
  positionGroups: IEarnClaimableRewardGroup[];
  ledgerGroups: IEarnRewardsPortfolioGroup[];
}): IClaimableRewardsGroup[] {
  const byKey = new Map<string, IClaimableRewardsGroup>();
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
}: {
  group: IEarnRewardsPortfolioGroup;
  item: IEarnRewardsPortfolioItem;
  networkName: string;
  networkLogoURI: string;
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
