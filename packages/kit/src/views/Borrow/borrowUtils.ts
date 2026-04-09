import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import {
  WEB_APP_URL,
  WEB_APP_URL_DEV,
} from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EModalStakingRoutes,
  ETabEarnRoutes,
} from '@onekeyhq/shared/src/routes';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';
import type { IStakingInfo } from '@onekeyhq/shared/types/staking';

import { safePushToEarnRoute } from '../Earn/earnUtils';

import type { IAppNavigation } from '../../hooks/useAppNavigation';
import type { EManagePositionType } from '../Staking/pages/ManagePosition/hooks/useManagePage';
import type { IntlShape } from 'react-intl';

export const BorrowNavigation = {
  // Navigate from deep link (when user clicks a borrow share link)
  async pushToBorrowReserveDetailsFromDeeplink(
    navigation: IAppNavigation,
    params: {
      networkId: string;
      provider: string;
      marketAddress: string;
      reserveAddress: string;
      symbol: string;
    },
  ) {
    await safePushToEarnRoute(navigation, ETabEarnRoutes.BorrowReserveDetails, {
      networkId: params.networkId,
      provider: params.provider,
      marketAddress: params.marketAddress,
      reserveAddress: params.reserveAddress,
      symbol: params.symbol,
    });
  },

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
      accountId?: string;
      indexedAccountId?: string;
    },
  ) {
    const routeParams = {
      networkId: params.networkId,
      provider: params.provider,
      marketAddress: params.marketAddress,
      reserveAddress: params.reserveAddress,
      symbol: params.symbol,
      logoURI: params.logoURI,
      accountId: params.accountId,
      indexedAccountId: params.indexedAccountId,
    };

    if (params.isModal) {
      navigation.push(EModalStakingRoutes.BorrowReserveDetails, routeParams);
    } else {
      void safePushToEarnRoute(
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
      marketAddress: string;
      title?: string;
      type?: string;
      isModal?: boolean;
    },
  ) {
    const historyParams = {
      accountId: params.accountId,
      networkId: params.networkId,
      provider: params.provider,
      marketAddress: params.marketAddress,
      title: params.title,
      type: params.type,
    };

    if (params.isModal) {
      navigation.push(EModalStakingRoutes.BorrowHistoryList, historyParams);
    } else {
      navigation.pushModal(EModalRoutes.StakingModal, {
        screen: EModalStakingRoutes.BorrowHistoryList,
        params: historyParams,
      });
    }
  },

  pushToStakingHistory(
    navigation: IAppNavigation,
    params: {
      accountId: string;
      networkId: string;
      symbol: string;
      provider: string;
      stakeTag?: string;
      protocolVault?: string;
      isModal?: boolean;
    },
  ) {
    const historyParams = {
      accountId: params.accountId,
      networkId: params.networkId,
      symbol: params.symbol,
      provider: params.provider,
      stakeTag: params.stakeTag,
      protocolVault: params.protocolVault,
    };

    if (params.isModal) {
      navigation.navigate(EModalStakingRoutes.HistoryList, historyParams);
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

    // URL Format: /borrow/{networkId}/{symbol}/{provider}?marketAddress=xxx&reserveAddress=xxx
    // Example: https://app.onekey.so/borrow/evm--1/usdc/aave?marketAddress=0x...&reserveAddress=0x...
    //
    // Deep link route is configured in packages/kit/src/routes/Tab/Earn/router.ts
    // as BorrowReserveDetailsShare with rewrite: '/borrow/:networkId/:symbol/:provider'
    const baseUrl = `/borrow/${networkId}/${symbol.toLowerCase()}/${provider.toLowerCase()}`;
    const queryParams = new URLSearchParams();

    queryParams.append('marketAddress', marketAddress);
    queryParams.append('reserveAddress', reserveAddress);

    const queryString = queryParams.toString();
    return `${origin}${baseUrl}?${queryString}`;
  },
};

export const isBorrowTx = (unsignedTx: IUnsignedTxPro | undefined) => {
  if (!unsignedTx) return false;
  return unsignedTx?.stakingInfo?.tags?.includes(EEarnLabels.Borrow);
};

export const getBorrowTxTitle = ({
  intl,
  stakingInfo,
}: {
  intl: IntlShape;
  stakingInfo: IStakingInfo | undefined;
}) => {
  switch (stakingInfo?.label) {
    case EEarnLabels.Supply:
      return intl.formatMessage({ id: ETranslations.defi_supply });
    case EEarnLabels.Borrow:
      return intl.formatMessage({ id: ETranslations.global_borrow });
    case EEarnLabels.Repay:
      return intl.formatMessage({ id: ETranslations.defi_repay });
    case EEarnLabels.Withdraw:
      return intl.formatMessage({ id: ETranslations.global_withdraw });
    case EEarnLabels.Claim:
      return intl.formatMessage({ id: ETranslations.earn_claim });
    default:
      return undefined;
  }
};
