import BigNumber from 'bignumber.js';

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

/** What a claimable card's button runs on: the asset carrying the claim identity, and the row carrying the button. */
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

/**
 * A claimable position claims through the button the wide layout already
 * runs on its rows: this rebuilds the asset that button reads its protocol,
 * network and token off, keyed on `earn.manage` and `earn.symbol` /
 * `earn.vault`. The investment detail's claim travels as a normal asset
 * row; the airdrop read's (the USDe cooled down at Ethena, reached through
 * Pendle) as an airdrop row, which Pendle resolves from symbol and vault.
 */
export function toPositionClaim(
  position: IEarnPortfolioPosition,
): IEarnPositionClaim | undefined {
  const { earn } = position;
  const { claim } = earn;
  if (!claim) {
    return undefined;
  }
  const asset = position.assets[0];
  const rewardSymbol = asset?.symbol ?? earn.symbol;
  const metadata = {
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
  if (earn.claimSource === 'airdrop') {
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
  const { investment } = earn;
  const row = [
    ...(investment.rewardAssets ?? []),
    ...(investment.assetsStatus ?? []),
  ].find((entry) => entry.kind === 'claimablePrincipal' && entry.button);
  return {
    asset: {
      token: {
        info: { symbol: earn.symbol, logoURI: asset?.meta.logoUrl ?? '' },
      },
      deposit: investment.deposit ?? {
        title: EMPTY_TEXT,
        description: EMPTY_TEXT,
      },
      earnings24h: investment.earnings24h ?? { title: EMPTY_TEXT },
      ...(investment.totalReward
        ? { totalReward: investment.totalReward }
        : {}),
      rewardAssets: [],
      assetsStatus: [],
      buttons: [],
      metadata,
    },
    reward: {
      ...row,
      title: row?.title ?? EMPTY_TEXT,
      description: row?.description ?? EMPTY_TEXT,
      button: claim,
    },
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
