import BigNumber from 'bignumber.js';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IEarnPortfolioAirdropAsset,
  IEarnPortfolioInvestment,
  IEarnProtocolCategory,
  IEarnRewardsPortfolioGroup,
  IEarnRewardsPortfolioItem,
} from '@onekeyhq/shared/types/staking';

import type { IPortfolioClaimSourceCandidate } from '../../../utils/portfolioClaimUtils';

/**
 * Pure helpers behind the phone "My portfolio" page (OK-61377).
 *
 * The page draws from two sources and has to keep them from overlapping:
 *   - useEarnPortfolio: one investment per vault, the same data the wide
 *     layout renders, now grouped per provider for the DeFi Assets tab.
 *   - POST /earn/v1/rewards/portfolio: ledger rewards (airdrops, rebates)
 *     in three stages for the Rewards tab.
 *
 * Providers whose /v1/investment/airdrop-detail rows are the same ledger
 * rows the rewards endpoint now returns must not be listed twice; see
 * LEDGER_AIRDROP_PROVIDERS.
 */

/**
 * Providers whose airdrop-detail rows come from the EarnRewards ledger
 * (server: native.service / spark.service `_sumAirdropRewards`). The rewards
 * endpoint returns those same rows, so on this page their airdropAssets are
 * dropped from the Claimable list. Morpho / Lista / Pendle airdrop rows are
 * on-chain figures the ledger does not hold and stay.
 */
export const LEDGER_AIRDROP_PROVIDERS: readonly string[] = ['native', 'spark'];

export function isLedgerAirdropProvider(providerCode: string): boolean {
  return LEDGER_AIRDROP_PROVIDERS.includes(providerCode.toLowerCase());
}

/** simpleEarn / fixedRate -> Yield, staking -> Staked, lending -> Loans. */
export function categoryLabelId(
  category: IEarnProtocolCategory | undefined,
): ETranslations | undefined {
  switch (category) {
    case 'simpleEarn':
    case 'fixedRate':
      return ETranslations.earn_yield;
    case 'staking':
      // i18n: pending "Staked" key (OK-61377); this reads "Staking" until
      // it lands.
      return ETranslations.wallet_defi_position_module_staked;
    case 'lending':
      return ETranslations.earn_loans;
    default:
      return undefined;
  }
}

export type IProtocolGroup = {
  key: string;
  providerCode: string;
  providerName: string;
  providerLogoURI: string;
  /** every vault the user holds under this provider, in incoming order */
  investments: IEarnPortfolioInvestment[];
  totalFiatValue: string;
};

/**
 * DeFi Assets tab: one row per provider, each holding the user's positions.
 * A provider present on several networks still gets one row; the token rows
 * carry the network badge.
 */
export function groupInvestmentsByProvider(
  investments: IEarnPortfolioInvestment[],
): IProtocolGroup[] {
  const groups = new Map<string, IProtocolGroup>();
  for (const investment of investments) {
    const { providerDetail } = investment.protocol;
    const key = providerDetail.code;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        providerCode: providerDetail.code,
        providerName: providerDetail.name,
        providerLogoURI: providerDetail.logoURI,
        investments: [],
        totalFiatValue: '0',
      };
      groups.set(key, group);
    }
    group.investments.push(investment);
    group.totalFiatValue = new BigNumber(group.totalFiatValue)
      .plus(investment.totalFiatValue || '0')
      .toFixed();
  }
  return Array.from(groups.values()).toSorted((a, b) =>
    new BigNumber(b.totalFiatValue).comparedTo(a.totalFiatValue),
  );
}

/** Network filter options: which networks the user holds on, and how many vaults each. */
export function countInvestmentsByNetwork(
  investments: IEarnPortfolioInvestment[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const investment of investments) {
    const { networkId } = investment.network;
    counts[networkId] = (counts[networkId] ?? 0) + 1;
  }
  return counts;
}

export function filterInvestmentsByNetworks(
  investments: IEarnPortfolioInvestment[],
  selectedNetworkIds: string[],
): IEarnPortfolioInvestment[] {
  if (selectedNetworkIds.length === 0) {
    return investments;
  }
  const selected = new Set(selectedNetworkIds);
  return investments.filter((investment) =>
    selected.has(investment.network.networkId),
  );
}

/**
 * Claimable rows the page already holds through the investment detail: the
 * protocol rewards a position accrues (rewardAssets) and the on-chain airdrop
 * rows of providers whose airdrop-detail is NOT the ledger.
 */
export function selectProtocolClaimableInvestments(
  investments: IEarnPortfolioInvestment[],
): IEarnPortfolioInvestment[] {
  return investments.filter((investment) => {
    const hasRewardRows = investment.assets.some(
      (asset) => (asset.rewardAssets?.length ?? 0) > 0,
    );
    const hasAirdropRows =
      !isLedgerAirdropProvider(investment.protocol.providerDetail.code) &&
      investment.airdropAssets.some(
        (asset) => (asset.airdropAssets?.length ?? 0) > 0,
      );
    return hasRewardRows || hasAirdropRows;
  });
}

/**
 * Header "Rewards" figure: the ledger's claimable + pending (server total)
 * plus the on-chain airdrop fiat the page holds for non-ledger providers.
 *
 * Known gap: protocol reward rows (rewardAssets, e.g. Everstake staking
 * rewards) arrive as rendered text with no numeric fiat, so they are listed
 * under Claimable but cannot be summed here until the server carries a
 * numeric rewardsFiatValue on the investment detail.
 */
export function sumRewardsHeaderFiat({
  ledgerRewardsFiatValue,
  investments,
}: {
  ledgerRewardsFiatValue: string | undefined;
  investments: IEarnPortfolioInvestment[];
}): string {
  return investments
    .filter(
      (investment) =>
        !isLedgerAirdropProvider(investment.protocol.providerDetail.code),
    )
    .reduce(
      (total, investment) => total.plus(investment.airdropFiatValue || '0'),
      new BigNumber(ledgerRewardsFiatValue || '0'),
    )
    .toFixed();
}

/**
 * Candidates for resolving which protocol a ledger claim belongs to — the
 * same list the existing positions page hands to its airdrop rows, built from
 * every vault the user holds.
 */
export function buildClaimSourceCandidates(
  investments: IEarnPortfolioInvestment[],
): IPortfolioClaimSourceCandidate[] {
  return investments.flatMap((investment) =>
    investment.assets.map((asset) => ({
      networkId: asset.metadata.network.networkId,
      providerName: asset.metadata.protocol.providerDetail.code,
      symbol: asset.token.info.symbol,
      vault: asset.metadata.protocol.vault,
    })),
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
