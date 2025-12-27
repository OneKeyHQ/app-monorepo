import { rootNavigationRef } from '@onekeyhq/components';
import {
  WEB_APP_URL,
  WEB_APP_URL_DEV,
} from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EModalStakingRoutes,
  ERootRoutes,
  ETabEarnRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import type { IAppNavigation } from '../../hooks/useAppNavigation';
import type { EManagePositionType } from '../Staking/pages/ManagePosition/hooks/useManagePage';

async function safePushToBorrowRoute(
  navigation: IAppNavigation,
  route: ETabEarnRoutes,
  params?: any,
) {
  const targetTab = platformEnv.isNative
    ? ETabRoutes.Discovery
    : ETabRoutes.Earn;

  navigation.switchTab(targetTab);
  await timerUtils.wait(0);

  rootNavigationRef.current?.navigate(ERootRoutes.Main, {
    screen: targetTab,
    params: {
      screen: route,
      params,
    },
  });
}

export const BorrowNavigation = {
  pushToBorrowReserveDetails(
    navigation: IAppNavigation,
    params: {
      networkId: string;
      provider: string;
      marketAddress: string;
      reserveAddress: string;
      symbol: string;
      logoURI?: string;
      isModal?: boolean;
    },
  ) {
    const routeParams = {
      networkId: params.networkId,
      provider: params.provider,
      marketAddress: params.marketAddress,
      reserveAddress: params.reserveAddress,
      symbol: params.symbol,
      logoURI: params.logoURI,
    };

    if (params.isModal) {
      navigation.push(EModalStakingRoutes.BorrowReserveDetails, routeParams);
    } else {
      void safePushToBorrowRoute(
        navigation,
        ETabEarnRoutes.BorrowReserveDetails,
        routeParams,
      );
    }
  },

  pushToBorrowHistory(
    navigation: IAppNavigation,
    params: {
      accountId: string;
      networkId: string;
      provider: string;
      symbol: string;
      marketAddress?: string;
      stakeTag: string;
      protocolVault?: string;
      filterType?: string;
      isModal?: boolean;
    },
  ) {
    const historyParams = {
      accountId: params.accountId,
      networkId: params.networkId,
      provider: params.provider,
      symbol: params.symbol,
      stakeTag: params.stakeTag,
      protocolVault: params.protocolVault,
      filterType: params.filterType,
    };

    if (params.isModal) {
      navigation.push(EModalStakingRoutes.HistoryList, historyParams);
    } else {
      navigation.pushModal(EModalRoutes.StakingModal, {
        screen: EModalStakingRoutes.HistoryList,
        params: historyParams,
      });
    }
  },

  pushToBorrowManagePosition(
    navigation: IAppNavigation,
    params: {
      accountId: string;
      networkId: string;
      provider: string;
      marketAddress: string;
      reserveAddress: string;
      symbol: string;
      logoURI?: string;
      providerLogoURI?: string;
      type: EManagePositionType;
      borrowReserves?: IBorrowReserveItem;
    },
  ) {
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.BorrowManagePosition,
      params: {
        accountId: params.accountId,
        networkId: params.networkId,
        provider: params.provider,
        marketAddress: params.marketAddress,
        reserveAddress: params.reserveAddress,
        symbol: params.symbol,
        logoURI: params.logoURI,
        providerLogoURI: params.providerLogoURI,
        type: params.type,
        borrowReserves: params.borrowReserves,
      },
    });
  },

  generateBorrowShareLink({
    networkId,
    symbol,
    provider,
    marketAddress,
    reserveAddress,
    isDevMode = false,
  }: {
    networkId: string;
    symbol: string;
    provider: string;
    marketAddress: string;
    reserveAddress: string;
    isDevMode?: boolean;
  }): string {
    let origin = WEB_APP_URL;
    if (platformEnv.isWeb) {
      origin = globalThis.location.origin;
    }
    if (!platformEnv.isWeb && isDevMode) {
      origin = WEB_APP_URL_DEV;
    }

    // TODO: Update URL format when borrow share route is implemented
    const baseUrl = `/borrow/${networkId}/${symbol.toLowerCase()}/${provider.toLowerCase()}`;
    const queryParams = new URLSearchParams();

    queryParams.append('marketAddress', marketAddress);
    queryParams.append('reserveAddress', reserveAddress);

    const queryString = queryParams.toString();
    return `${origin}${baseUrl}?${queryString}`;
  },
};
