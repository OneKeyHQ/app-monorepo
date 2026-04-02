import { useRef } from 'react';

import BigNumber from 'bignumber.js';

import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { IWalletBanner } from '@onekeyhq/shared/types/walletBanner';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  accountDeFiOverviewAtom,
  accountOverviewStateAtom,
  accountWorthAtom,
  allNetworksStateAtom,
  approvalsInfoAtom,
  buildOverviewOwnerKey,
  contextAtomMethod,
  overviewDeFiDataStateAtom,
  walletStatusAtom,
  walletTopBannersAtom,
} from './atoms';

class ContextJotaiActionsAccountOverview extends ContextJotaiActionsBase {
  updateAllNetworksState = contextAtomMethod(
    (get, set, payload: { visibleCount: number }) => {
      set(allNetworksStateAtom(), {
        ...get(allNetworksStateAtom()),
        ...payload,
      });
    },
  );

  updateAccountOverviewState = contextAtomMethod(
    (get, set, payload: { initialized?: boolean; isRefreshing?: boolean }) => {
      set(accountOverviewStateAtom(), {
        ...get(accountOverviewStateAtom()),
        ...payload,
      });
    },
  );

  updateAccountWorth = contextAtomMethod(
    (
      get,
      set,
      payload: {
        worth: Record<string, string>;
        createAtNetworkWorth?: string;
        initialized: boolean;
        accountId: string;
        updateAll?: boolean;
        merge?: boolean;
      },
    ) => {
      if (payload.merge) {
        const { worth, createAtNetworkWorth } = get(accountWorthAtom());
        set(accountWorthAtom(), {
          worth: {
            ...worth,
            ...payload.worth,
          },
          createAtNetworkWorth: new BigNumber(createAtNetworkWorth ?? '0')
            .plus(payload.createAtNetworkWorth ?? '0')
            .toFixed(),
          initialized: payload.initialized,
          accountId: payload.accountId,
          updateAll: payload.updateAll,
        });
        return;
      }

      set(accountWorthAtom(), {
        worth: payload.worth,
        createAtNetworkWorth: payload.createAtNetworkWorth ?? '0',
        initialized: payload.initialized,
        accountId: payload.accountId,
        updateAll: payload.updateAll,
      });
    },
  );

  updateApprovalsInfo = contextAtomMethod(
    (
      get,
      set,
      payload: { hasRiskApprovals?: boolean; riskApprovalsCount?: number },
    ) => {
      set(approvalsInfoAtom(), {
        ...get(approvalsInfoAtom()),
        ...payload,
      });
    },
  );

  updateWalletStatus = contextAtomMethod(
    (
      get,
      set,
      payload: {
        showReceiveInfo?: boolean;
        receiveInfoInit?: boolean;
        showReferralCodeBlock?: boolean;
        referralCodeBlockInit?: boolean;
      },
    ) => {
      set(walletStatusAtom(), {
        ...get(walletStatusAtom()),
        ...payload,
      });
    },
  );

  updateWalletTopBanners = contextAtomMethod(
    (get, set, payload: { banners: IWalletBanner[] }) => {
      set(walletTopBannersAtom(), {
        banners: payload.banners,
      });
    },
  );

  updateAccountDeFiOverview = contextAtomMethod(
    (
      get,
      set,
      value: {
        overview: {
          totalValue: number;
          totalDebt: number;
          totalReward: number;
          netWorth: number;
        };
        merge?: boolean;
        currency?: string;
        accountId?: string;
        networkId?: string;
        isReady?: boolean;
      },
    ) => {
      const overview = get(accountDeFiOverviewAtom());

      if (value.merge) {
        const newOverview = {
          totalValue: new BigNumber(overview.totalValue)
            .plus(value.overview.totalValue)
            .toNumber(),
          totalDebt: new BigNumber(overview.totalDebt ?? 0)
            .plus(value.overview.totalDebt ?? 0)
            .toNumber(),
          netWorth: new BigNumber(overview.netWorth ?? 0)
            .plus(value.overview.netWorth ?? 0)
            .toNumber(),
          totalReward: new BigNumber(overview.totalReward ?? 0)
            .plus(value.overview.totalReward ?? 0)
            .toNumber(),
          currency: overview.currency,
          accountId: value.accountId ?? overview.accountId,
          networkId: value.networkId ?? overview.networkId,
        };
        set(accountDeFiOverviewAtom(), newOverview);
      } else {
        set(accountDeFiOverviewAtom(), {
          ...value.overview,
          currency: value.currency ?? overview.currency,
          accountId: value.accountId ?? overview.accountId,
          networkId: value.networkId ?? overview.networkId,
        });
      }

      // Auto-set DeFi state when readiness is explicitly provided
      if ('isReady' in value) {
        set(overviewDeFiDataStateAtom(), {
          ownerKey: buildOverviewOwnerKey(
            value.accountId ?? overview.accountId,
            value.networkId ?? overview.networkId,
          ),
          isReady: value.isReady,
        });
      }
    },
  );

  updateOverviewDeFiDataState = contextAtomMethod(
    (
      get,
      set,
      value: {
        accountId?: string;
        networkId?: string;
        isReady?: boolean;
      },
    ) => {
      set(overviewDeFiDataStateAtom(), {
        ownerKey: buildOverviewOwnerKey(value.accountId, value.networkId),
        isReady: value.isReady,
      });
    },
  );
}

const createActions = memoFn(() => {
  // console.log('new ContextJotaiActionsAccountOverview()', Date.now());
  return new ContextJotaiActionsAccountOverview();
});

export function useAccountOverviewActions() {
  const actions = createActions();

  const updateAccountWorth = actions.updateAccountWorth.use();
  const updateAccountOverviewState = actions.updateAccountOverviewState.use();
  const updateAllNetworksState = actions.updateAllNetworksState.use();
  const updateApprovalsInfo = actions.updateApprovalsInfo.use();
  const updateWalletStatus = actions.updateWalletStatus.use();
  const updateWalletTopBanners = actions.updateWalletTopBanners.use();
  const updateAccountDeFiOverview = actions.updateAccountDeFiOverview.use();
  const updateOverviewDeFiDataState = actions.updateOverviewDeFiDataState.use();

  return useRef({
    updateAllNetworksState,
    updateAccountWorth,
    updateAccountOverviewState,
    updateApprovalsInfo,
    updateWalletStatus,
    updateWalletTopBanners,
    updateAccountDeFiOverview,
    updateOverviewDeFiDataState,
  });
}
