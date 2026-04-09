import type { IWalletBanner } from '@onekeyhq/shared/types/walletBanner';

import { createJotaiContext } from '../../utils/createJotaiContext';

export function buildOverviewOwnerKey(
  accountId: string | undefined,
  networkId: string | undefined,
) {
  if (!accountId || !networkId) {
    return '';
  }
  return `${accountId}__${networkId}`;
}

const {
  Provider: ProviderJotaiContextAccountOverview,
  withProvider: withAccountOverviewProvider,
  contextAtom,
  contextAtomMethod,
} = createJotaiContext();

export {
  ProviderJotaiContextAccountOverview,
  contextAtomMethod,
  withAccountOverviewProvider,
};

export const { atom: walletStatusAtom, use: useWalletStatusAtom } =
  contextAtom<{
    showReceiveInfo: boolean;
    receiveInfoInit: boolean;
    showReferralCodeBlock: boolean;
    referralCodeBlockInit: boolean;
  }>({
    showReceiveInfo: false,
    receiveInfoInit: false,
    showReferralCodeBlock: false,
    referralCodeBlockInit: false,
  });

export const { atom: accountWorthAtom, use: useAccountWorthAtom } =
  contextAtom<{
    worth: Record<string, string>;
    createAtNetworkWorth: string;
    accountId: string;
    initialized: boolean;
    updateAll?: boolean;
  }>({
    worth: {},
    createAtNetworkWorth: '0',
    accountId: '',
    initialized: false,
    updateAll: false,
  });

export const {
  atom: accountOverviewStateAtom,
  use: useAccountOverviewStateAtom,
} = contextAtom<{
  isRefreshing: boolean;
  initialized: boolean;
}>({
  isRefreshing: false,
  initialized: false,
});

export const {
  atom: lastConfirmedOverviewBalanceAtom,
  use: useLastConfirmedOverviewBalanceAtom,
} = contextAtom<{
  latest: string;
  byOwner: Record<string, string>;
}>({
  latest: '',
  byOwner: {},
});

export const {
  atom: overviewTokenCacheStateAtom,
  use: useOverviewTokenCacheStateAtom,
} = contextAtom<{
  ownerKey: string;
  hasCache?: boolean;
}>({
  ownerKey: '',
  hasCache: undefined,
});

export const {
  atom: overviewDeFiDataStateAtom,
  use: useOverviewDeFiDataStateAtom,
} = contextAtom<{
  ownerKey: string;
  isReady?: boolean;
}>({
  ownerKey: '',
  isReady: undefined,
});

export const { atom: allNetworksStateAtom, use: useAllNetworksStateStateAtom } =
  contextAtom<{
    visibleCount: number;
  }>({
    visibleCount: 0,
  });

export const { atom: approvalsInfoAtom, use: useApprovalsInfoAtom } =
  contextAtom<{
    hasRiskApprovals: boolean;
    riskApprovalsCount: number;
  }>({
    hasRiskApprovals: false,
    riskApprovalsCount: 0,
  });

export const { atom: walletTopBannersAtom, use: useWalletTopBannersAtom } =
  contextAtom<{
    banners: IWalletBanner[];
  }>({
    banners: [],
  });

export const {
  atom: accountDeFiOverviewAtom,
  use: useAccountDeFiOverviewAtom,
} = contextAtom<{
  totalValue: number;
  totalDebt: number;
  totalReward: number;
  netWorth: number;
  currency: string;
  accountId: string;
  networkId: string;
}>({
  totalValue: 0,
  totalDebt: 0,
  totalReward: 0,
  netWorth: 0,
  currency: '',
  accountId: '',
  networkId: '',
});
