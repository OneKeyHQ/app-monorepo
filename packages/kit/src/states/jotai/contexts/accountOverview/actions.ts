import { useRef } from 'react';

import BigNumber from 'bignumber.js';

import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { IWalletBanner } from '@onekeyhq/shared/types/walletBanner';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  accountOverviewStateAtom,
  accountWorthAtom,
  allNetworksStateAtom,
  approvalsInfoAtom,
  contextAtomMethod,
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
    (get, set, payload: { hasRiskApprovals?: boolean }) => {
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

  return useRef({
    updateAllNetworksState,
    updateAccountWorth,
    updateAccountOverviewState,
    updateApprovalsInfo,
    updateWalletStatus,
    updateWalletTopBanners,
  });
}
