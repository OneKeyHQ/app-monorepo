import { Toast } from '@onekeyhq/components';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import type { IMarketTokenDetailRouteParams } from '@onekeyhq/shared/src/routes/tabMarket';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import type { IMarketWidgetLinkTarget } from '@onekeyhq/shared/src/utils/marketWidgetUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { whenAppUnlocked } from '../../../utils/passwordUtils';
import { prepareMarketDetailTabBarTransition } from '../../../views/Market/utils/marketDetailNavigation';

import { createMarketWidgetLinkHandler } from './marketWidgetLinkUtils';

type IWidgetDetail = {
  screen: ETabMarketRoutes.MarketDetailV2 | ETabMarketRoutes.MarketNativeDetail;
  params: IMarketTokenDetailRouteParams;
};

const handleLink = createMarketWidgetLinkHandler<IWidgetDetail | undefined>({
  waitForUnlock: whenAppUnlocked,
  isReady: () =>
    Boolean(
      appGlobals.$rootAppNavigation &&
      appGlobals.$navigationRef?.current?.isReady(),
    ),
  wait: () => timerUtils.wait(100),
  isAllowed: () => !travelModeManager.isMaskingDataSync(),
  async resolve(target) {
    if (target.kind === 'home') return undefined;
    let token: {
      chainId: string;
      contractAddress: string;
      isNative: boolean;
      marketTokenId?: string;
      marketVariantId?: string;
    };
    if (target.kind === 'asset') {
      const { selectedVariant } =
        await backgroundApiProxy.serviceMarket.fetchMarketAssetDetail({
          assetId: target.assetId,
          currency: 'usd',
          autoHandleError: false,
        });
      if (!selectedVariant) return undefined;
      token = {
        chainId: selectedVariant.networkId,
        contractAddress: selectedVariant.tokenAddress,
        isNative: selectedVariant.isNative,
        marketTokenId: target.assetId,
        marketVariantId: selectedVariant.variantId,
      };
    } else {
      token = target;
    }
    return {
      screen:
        token.isNative && !token.contractAddress
          ? ETabMarketRoutes.MarketNativeDetail
          : ETabMarketRoutes.MarketDetailV2,
      params: {
        network:
          networkUtils.getNetworkShortCode({ networkId: token.chainId }) ||
          token.chainId,
        tokenAddress: token.contractAddress,
        isNative: token.isNative,
        marketTokenId: token.marketTokenId,
        marketVariantId: token.marketVariantId,
        ...(token.marketTokenId
          ? { marketTokenCategory: MARKET_TOP_COINS_CATEGORY_ID }
          : {}),
        showFavoriteButton: true,
      },
    };
  },
  navigate(detail) {
    const navigation = appGlobals.$rootAppNavigation;
    if (detail) {
      prepareMarketDetailTabBarTransition();
      navigation?.navigate(ERootRoutes.Main, {
        screen: ETabRoutes.Market,
        params: detail,
      });
    } else {
      navigation?.navigate(ERootRoutes.Main, {
        screen: ETabRoutes.Market,
        params: { screen: ETabMarketRoutes.TabMarket },
      });
    }
  },
  onError: () => {
    defaultLogger.app.error.log('Market widget deep link could not be opened');
    Toast.error({
      // Deep links run outside React; this executes after the unlock gate.
      // eslint-disable-next-line onekey/no-app-locale-main-thread
      title: appLocale.intl.formatMessage({
        id: ETranslations.global_an_error_occurred,
      }),
    });
  },
});

export async function handleMarketWidgetLink({
  target,
  shouldContinue,
}: {
  target: IMarketWidgetLinkTarget;
  shouldContinue: () => boolean;
}) {
  await handleLink(target, shouldContinue);
}
