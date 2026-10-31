import { StackActions } from '@react-navigation/native';

import { Toast, rootNavigationRef } from '@onekeyhq/components';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import marketWidget from '@onekeyhq/shared/src/modules/MarketWidget';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { EFullScreenPushRoutes } from '@onekeyhq/shared/src/routes/fullScreenPush';
import type { IMarketTokenDetailRouteParams } from '@onekeyhq/shared/src/routes/tabMarket';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import type { IMarketWidgetLinkTarget } from '@onekeyhq/shared/src/utils/marketWidgetUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { whenAppUnlocked } from '../../../utils/passwordUtils';
import { EModalMarketRoutes } from '../../../views/Market/router/types';
import { prepareMarketDetailTabBarTransition } from '../../../views/Market/utils/marketDetailNavigation';

import { createMarketWidgetLinkHandler } from './marketWidgetLinkUtils';

type IWidgetDetail = {
  screen: ETabMarketRoutes.MarketDetailV2 | ETabMarketRoutes.MarketNativeDetail;
  params: IMarketTokenDetailRouteParams;
};

type IWidgetDestination =
  | Extract<IMarketWidgetLinkTarget, { kind: 'editor' }>
  | { kind: 'detail'; detail: IWidgetDetail }
  | { kind: 'stock'; stockId: string }
  | { kind: 'home' };

function dismissAndroidMoreMenu() {
  if (!platformEnv.isNativeAndroid) return;
  const root = rootNavigationRef.current;
  const state = root?.getRootState();
  const current = state?.routes[state.index];
  const screen =
    current?.state?.routes[current.state.index ?? 0]?.name ??
    (current?.params && 'screen' in current.params
      ? current.params.screen
      : undefined);
  if (
    !state?.index ||
    current?.name !== ERootRoutes.FullScreenPush ||
    screen !== EFullScreenPushRoutes.ActionCenter
  ) {
    return;
  }
  // Main's tab navigation can be handled below this root overlay on Android.
  // Dismiss only the focused More page, preserving other root flows.
  root?.dispatch({
    ...StackActions.pop(1),
    source: current.key,
    target: state.key,
  });
}

const handleLink = createMarketWidgetLinkHandler<IWidgetDestination>({
  waitForUnlock: whenAppUnlocked,
  isReady: () =>
    Boolean(
      appGlobals.$rootAppNavigation &&
      appGlobals.$navigationRef?.current?.isReady(),
    ),
  wait: () => timerUtils.wait(100),
  isAllowed: () => !travelModeManager.isMaskingDataSync(),
  async resolve(target) {
    if (target.kind === 'home') return target;
    if (target.kind === 'stock') return target;
    if (target.kind === 'editor') {
      if (
        !marketWidget.supportsSettingsEditing() ||
        (platformEnv.isNativeAndroid && !target.editorSession) ||
        (platformEnv.isNativeIOS && !!target.editorSession)
      ) {
        throw new OneKeyLocalError(
          'Market widget profile editing is unavailable',
        );
      }
      if (target.editorSession)
        await marketWidget.getEditorState(target.editorSession);
      return target;
    }
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
      if (!selectedVariant) return { kind: 'home' };
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
      kind: 'detail',
      detail: {
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
      },
    };
  },
  navigate(destination) {
    const navigation = appGlobals.$rootAppNavigation;
    if (destination.kind !== 'editor') dismissAndroidMoreMenu();
    if (destination.kind === 'editor') {
      if (
        destination.profileId ||
        destination.widgetKind ||
        destination.editorSession
      ) {
        navigation?.pushModal(EModalRoutes.MarketModal, {
          screen: EModalMarketRoutes.MarketWidgetEditor,
          params: {
            profileId: destination.profileId,
            kind: destination.widgetKind,
            editorSession: destination.editorSession,
          },
        });
      } else {
        navigation?.pushModal(EModalRoutes.MarketModal, {
          screen: EModalMarketRoutes.MarketWidgetList,
        });
      }
    } else if (destination.kind === 'stock') {
      prepareMarketDetailTabBarTransition();
      navigation?.navigate(ERootRoutes.Main, {
        screen: ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.MarketStockDetail,
          params: { stockId: destination.stockId },
        },
      });
    } else if (destination.kind === 'detail') {
      prepareMarketDetailTabBarTransition();
      navigation?.navigate(ERootRoutes.Main, {
        screen: ETabRoutes.Market,
        params: destination.detail,
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
