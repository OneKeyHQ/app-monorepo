import type { IWalletBanner } from '@onekeyhq/shared/types/walletBanner';

import { createJotaiContext } from '../../utils/createJotaiContext';

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

export const { atom: allNetworksStateAtom, use: useAllNetworksStateStateAtom } =
  contextAtom<{
    visibleCount: number;
  }>({
    visibleCount: 0,
  });

export const { atom: approvalsInfoAtom, use: useApprovalsInfoAtom } =
  contextAtom<{
    hasRiskApprovals: boolean;
  }>({
    hasRiskApprovals: false,
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
}>({
  totalValue: 0,
  totalDebt: 0,
  totalReward: 0,
  netWorth: 0,
  currency: '',
});
