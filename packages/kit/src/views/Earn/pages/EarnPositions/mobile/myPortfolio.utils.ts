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
 * The helpers here bridge the position model into the claim button the
 * detail page already runs, and adapt ledger rows into the same button.
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
    providerName: position.protocol,
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
    earnUtils.isPendleProvider({ providerName: position.protocol }) &&
    earn.symbol === 'USDe' &&
    (earn.investment.buttons?.length ?? 0) === 0
  );
}

const EMPTY_TEXT = { text: '' };

/**
 * The claim button the detail page runs (WrappedActionButton +
 * usePortfolioAction) reads its protocol, network and token off an
 * investment-detail asset. A position carries the same facts in `earn`, so
 * this rebuilds that asset from them: the detail texts it does not render
 * are filled with empties, the claim identity (symbol + vault) is exact.
 */
export function toPositionClaimAsset(
  position: IEarnPortfolioPosition,
): IEarnPortfolioAsset {
  const { earn } = position;
  const { investment } = earn;
  return {
    token: {
      info: {
        symbol: earn.symbol,
        logoURI: position.assets[0]?.meta.logoUrl ?? '',
      },
    },
    deposit: investment.deposit ?? {
      title: EMPTY_TEXT,
      description: EMPTY_TEXT,
    },
    earnings24h: investment.earnings24h ?? { title: EMPTY_TEXT },
    totalReward: investment.totalReward,
    rewardAssets: investment.rewardAssets ?? [],
    assetsStatus: investment.assetsStatus ?? [],
    buttons: investment.buttons ?? [],
    metadata: {
      protocol: {
        networkId: position.networkId,
        provider: position.protocol,
        symbol: earn.symbol,
        vault: earn.vault,
        vaultName: earn.vaultName,
        category: earn.protocolCategory,
        type: earn.protocolType,
        providerDetail: {
          code: position.protocol,
          name: position.protocolName,
          logoURI: earn.providerLogoURI ?? '',
        },
      },
      network: earn.network,
      fiatValue: investment.totalFiatValue,
      fiatValueUsd: investment.totalFiatValueUsd,
      netPnl: investment.netPnl,
      netPnlFiatValue: investment.netPnlFiatValue,
    },
  };
}

/** The claimable row behind a claimable position, in the shape the claim button takes. */
export function toPositionClaimReward(position: IEarnPortfolioPosition):
  | {
      title: IEarnPortfolioAsset['assetsStatus'][number]['title'];
      description: IEarnPortfolioAsset['assetsStatus'][number]['description'];
      button: IEarnActionIcon;
    }
  | undefined {
  const { claim, row } = position.earn;
  if (!claim) {
    return undefined;
  }
  return {
    title: row?.title ?? EMPTY_TEXT,
    description: row?.description ?? EMPTY_TEXT,
    button: claim,
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
    providerName: position.protocol,
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
