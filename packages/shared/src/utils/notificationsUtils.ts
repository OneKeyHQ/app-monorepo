import { CommonActions, StackActions } from '@react-navigation/native';

import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';

import {
  ENotificationPermission,
  ENotificationPushMessageAckAction,
  ENotificationPushMessageMode,
} from '../../types/notification';
import appGlobals from '../appGlobals';
import { EAppEventBusNames, appEventBus } from '../eventBus/appEventBus';
import { ETranslations } from '../locale';
import { defaultLogger } from '../logger/logger';
import platformEnv from '../platformEnv';
import {
  EModalAssetDetailRoutes,
  EModalReferFriendsRoutes,
  EModalRoutes,
  ETabReferFriendsRoutes,
  ETabRoutes,
  EWebViewRoutes,
} from '../routes';
import { EModalNotificationsRoutes } from '../routes/notifications';
import { ERootRoutes } from '../routes/root';

import extUtils from './extUtils';
import { openUrlExternal } from './openUrlUtils';
import { buildModalRouteParams } from './routeUtils';
import timerUtils from './timerUtils';
import { isAllowedWebViewUrl } from './webViewUrlSafety';

import type { INetworkAccount } from '../../types/account';
import type {
  ENotificationPushTopicTypes,
  INotificationPushMessageInfo,
} from '../../types/notification';
import type { IWebViewPageParams } from '../routes';

function convertWebPermissionToEnum(
  permission: NotificationPermission,
): ENotificationPermission {
  switch (permission) {
    case 'default':
      return ENotificationPermission.default;
    case 'denied':
      return ENotificationPermission.denied;
    case 'granted':
      return ENotificationPermission.granted;
    default:
      return ENotificationPermission.default;
  }
}

export const NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_ENABLED: true | false =
  false;
export const NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_MAX_ACCOUNT_COUNT = 20;

type IGetEarnAccountFunc = (params: {
  accountId: string;
  networkId: string;
  indexedAccountId?: string;
}) => Promise<{
  walletId: string;
  accountId: string;
  networkId: string;
  accountAddress: string;
  account: INetworkAccount;
} | null>;

const popToMainRoute = async () => {
  const state = appGlobals.$navigationRef.current?.getRootState();
  if (!state) return;
  const mainRoutes = state.routes.filter(
    (route) => route.name === ERootRoutes.Main,
  );
  if (mainRoutes.length === 0 || mainRoutes.length === state.routes.length) {
    return;
  }
  appGlobals.$navigationRef.current?.dispatch(
    CommonActions.reset({
      ...state,
      routes: mainRoutes,
      index: mainRoutes.length - 1,
    }),
  );
  await timerUtils.wait(100);
};

export async function navigateToNotificationDetailByLocalParams({
  payload,
  localParams: originalLocalParams,
  getEarnAccount,
}: {
  payload: {
    screen: string;
    params: Record<string, any>;
  };
  localParams: Record<string, string | undefined>;
  getEarnAccount: IGetEarnAccountFunc;
}) {
  const { screen, params: navigationParams } = payload;
  // Recursively find and merge the deepest params

  const localParams = { ...originalLocalParams };

  let targetParams = navigationParams;
  while (targetParams?.params && typeof targetParams.params === 'object') {
    targetParams = targetParams.params;
  }

  if (targetParams) {
    if (targetParams?.networkId) {
      const accountInfos = await getEarnAccount({
        accountId: localParams.accountId || '',
        networkId: targetParams.networkId,
        indexedAccountId: localParams.indexedAccountId || '',
      });
      if (accountInfos) {
        localParams.accountId =
          accountInfos?.accountId || localParams.accountId;
        localParams.indexedAccountId =
          accountInfos?.account.indexedAccountId ||
          localParams.indexedAccountId;
      }
    }
    // Replace template variables in targetParams values with localParams values
    for (const [key, value] of Object.entries(targetParams)) {
      if (typeof value === 'string' && value.includes('{')) {
        targetParams[key] = value.replace(
          /\{local_(\w+)\}/g,
          (match, param) => {
            return localParams[param as keyof typeof localParams] || match;
          },
        );
        // Remove params with unresolved template variables
        if (
          typeof targetParams[key] === 'string' &&
          targetParams[key].includes('{local_')
        ) {
          delete targetParams[key];
        }
      }
    }
  }

  // Guard WebView navigation: enforce URL safety and source tag after template
  // replacement so an attacker cannot smuggle a blocked URL via {local_xxx}
  // variables, and so mode=dialog callers (which bypass parseNotificationPayload)
  // are also protected here — the single authoritative check before dispatch.
  if (screen === ERootRoutes.WebView) {
    if (!targetParams || !isAllowedWebViewUrl(targetParams.url as string)) {
      return;
    }
    targetParams.source = 'notification';
  }

  // Handle Market/Earn tab redirection for native platforms
  // On native, Market and Earn are sub-tabs within Discovery, not separate tabs
  // Returns a function that performs the redirection when called
  const createNativeTabRedirection = () => {
    let tab:
      | ETranslations.global_browser
      | ETranslations.global_earn
      | ETranslations.global_market
      | undefined;
    if (platformEnv.isNative) {
      if (navigationParams?.screen === ETabRoutes.Market) {
        navigationParams.screen = ETabRoutes.Discovery;
        tab = ETranslations.global_market;
      } else if (navigationParams?.screen === ETabRoutes.Earn) {
        navigationParams.screen = ETabRoutes.Discovery;
        tab = ETranslations.global_earn;
      }
    }
    // Return a function that emits the event after navigation completes
    return () => {
      if (tab) {
        setTimeout(() => {
          appEventBus.emit(EAppEventBusNames.SwitchDiscoveryTabInNative, {
            tab,
          });
        }, 150);
      }
    };
  };

  if (screen === ERootRoutes.Main) {
    // On native, ReferFriends is a modal, not a tab
    if (
      platformEnv.isNative &&
      navigationParams?.screen === ETabRoutes.ReferFriends
    ) {
      const subScreen = navigationParams?.params?.screen;
      const modalScreen =
        subScreen === ETabReferFriendsRoutes.TabInviteReward
          ? EModalReferFriendsRoutes.InviteReward
          : EModalReferFriendsRoutes.ReferAFriend;
      appGlobals.$navigationRef.current?.navigate(ERootRoutes.Modal, {
        screen: EModalRoutes.ReferFriendsModal,
        params: { screen: modalScreen },
      });
      return;
    }

    if (
      appGlobals.$tabletMainViewNavigationRef?.current &&
      navigationParams?.screen &&
      !navigationParams?.params?.screen
    ) {
      const redirectTab = createNativeTabRedirection();
      appGlobals.$tabletMainViewNavigationRef.current.navigate(
        screen,
        navigationParams,
        {
          pop: true,
        },
      );
      requestIdleCallback(() => {
        appGlobals.$navigationRef.current?.navigate(screen, navigationParams, {
          pop: true,
        });
      });
      // Execute tab redirection after navigation
      redirectTab();
    } else {
      await popToMainRoute();
      await timerUtils.wait(350);
      const redirectTab = createNativeTabRedirection();
      appGlobals.$navigationRef.current?.navigate(screen, navigationParams, {
        pop: true,
      });
      // Execute tab redirection after navigation
      redirectTab();
    }
  } else if (screen === ERootRoutes.Modal) {
    let rootNavigator = appGlobals.$navigationRef.current;
    const rootState = appGlobals.$navigationRef.current?.getRootState();
    if (rootState?.routes?.[rootState.index]?.name === ERootRoutes.Modal) {
      while (rootNavigator?.getParent()) {
        rootNavigator = rootNavigator.getParent();
      }
    }
    rootNavigator?.navigate(screen, navigationParams);
  } else {
    appGlobals.$navigationRef.current?.dispatch(
      StackActions.push(screen, navigationParams),
    );
  }
}
export interface INavigateToNotificationDetailParams {
  notificationId: string;
  notificationAccountId?: string;
  message: INotificationPushMessageInfo | undefined;
  isFromNotificationClick?: boolean; // click by system notification banner
  navigation?: IAppNavigation;
  mode?: ENotificationPushMessageMode;
  payload?: string;
  topicType?: ENotificationPushTopicTypes;
  isRead?: boolean;
}

export function parseNotificationPayload(
  mode: ENotificationPushMessageMode,
  payload: string | undefined,
  fallbackHandler: () => void,
  extras?: {
    params?: {
      coin?: string;
      type?: string;
      [key: string]: any;
    };
    [key: string]: any;
  },
) {
  switch (mode) {
    case ENotificationPushMessageMode.page:
      try {
        const payloadObj = JSON.parse(payload || '');
        // When mode=page targets the WebView overlay, apply the same URL safety
        // and source enforcement as mode=openInApp to prevent policy bypass.
        // Without this guard an attacker could craft a page payload that routes
        // to ERootRoutes.WebView with an http://, local-address, or userinfo URL
        // and omits source:'notification', skipping resolveOverlayDisplay checks.
        if (payloadObj.screen === ERootRoutes.WebView) {
          // Traverse to the leaf params (same logic as navigateToNotificationDetailByLocalParams).
          let leaf: Record<string, unknown> = payloadObj.params ?? {};
          while (leaf.params && typeof leaf.params === 'object') {
            leaf = leaf.params as Record<string, unknown>;
          }
          const url = typeof leaf.url === 'string' ? leaf.url : null;
          if (!url || !isAllowedWebViewUrl(url)) break;
          // Force source so resolveOverlayDisplay enforces notification-entry
          // display restrictions (hides attacker-supplied title, etc.).
          leaf.source = 'notification';
        }
        appEventBus.emit(EAppEventBusNames.ShowNotificationPageNavigation, {
          payload: payloadObj,
          extras,
        });
      } catch (_error) {
        fallbackHandler();
      }
      break;
    case ENotificationPushMessageMode.dialog:
      try {
        const payloadObj = JSON.parse(payload || '');
        appEventBus.emit(EAppEventBusNames.ShowNotificationViewDialog, {
          payload: payloadObj,
        });
      } catch (_error) {
        fallbackHandler();
      }

      break;
    case ENotificationPushMessageMode.openInBrowser:
      if (payload) {
        openUrlExternal(payload);
      }
      break;
    case ENotificationPushMessageMode.openInApp:
      if (payload) {
        // payload accepts two shapes — both end up in the root-level WebView
        // overlay; the kit-side subscriber runs the same URL safety policy
        // as in-app callers:
        //   1. JSON object       → { url, title?, hideHeader?, showAddressBar? }
        //   2. plain URL string  → 'https://onekey.so'
        let webViewParams: IWebViewPageParams | null = null;
        try {
          const parsed: unknown = JSON.parse(payload);
          if (
            parsed &&
            typeof parsed === 'object' &&
            typeof (parsed as { url?: unknown }).url === 'string'
          ) {
            const obj = parsed as Record<string, unknown>;
            webViewParams = {
              url: obj.url as string,
              title: typeof obj.title === 'string' ? obj.title : undefined,
              hideHeader:
                typeof obj.hideHeader === 'boolean'
                  ? obj.hideHeader
                  : undefined,
              showAddressBar:
                typeof obj.showAddressBar === 'boolean'
                  ? obj.showAddressBar
                  : undefined,
              source: 'notification',
            };
          }
        } catch (_error) {
          // not JSON — treat payload as a plain URL string below
        }
        if (!webViewParams) {
          webViewParams = { url: payload, source: 'notification' };
        }
        // Fail closed before dispatching, so the WebView overlay's URL policy
        // (https-only, no userinfo, no local addresses, no custom ports, no
        // download targets, no IDN homographs) also gates the extension
        // background `openUrlExternal` fallback below. Without this, the
        // notification entry would have a platform-dependent security
        // boundary: desktop/native runs `openWebView`'s `isAllowedWebViewUrl`
        // check inside the kit subscriber, but extension background bypasses
        // it because the subscriber doesn't exist in that runtime.
        if (!isAllowedWebViewUrl(webViewParams.url)) {
          break;
        }
        // `appEventBus` is in-process per runtime, and the
        // `ShowNotificationInWebViewOverlay` subscriber lives in the kit UI
        // layer. In the extension background runtime (notification click
        // handler) that subscriber doesn't exist, so an emit would silently
        // drop the click. Fall back to the legacy chrome.tabs.create path
        // (same one `openInBrowser` already uses) so the link still opens.
        if (platformEnv.isExtensionBackground) {
          openUrlExternal(webViewParams.url);
        } else {
          appEventBus.emit(
            EAppEventBusNames.ShowNotificationInWebViewOverlay,
            webViewParams,
          );
        }
      }
      break;
    case ENotificationPushMessageMode.openInDapp:
      appEventBus.emit(
        EAppEventBusNames.ShowNotificationInDappPage,
        payload as string,
      );
      break;
    case ENotificationPushMessageMode.command:
      try {
        const { action, data } = JSON.parse(payload || '{}') as {
          action?: string;
          data?: Record<string, unknown>;
        };
        if (!action) {
          fallbackHandler();
          return;
        }
        // Merge extras.params with data, extras.params takes precedence for orderId etc.
        const mergedData = { ...data, ...extras?.params };
        appEventBus.emit(EAppEventBusNames.ExecuteNotificationCommand, {
          action,
          data: mergedData,
        });
      } catch (_error) {
        fallbackHandler();
      }
      break;
    default:
      break;
  }
}

async function navigateToNotificationDetail({
  notificationId,
  notificationAccountId,
  message,
  isFromNotificationClick,
  navigation,
  mode,
  payload,
  topicType,
  isRead = false,
}: INavigateToNotificationDetailParams) {
  let routes: string[] = [];
  let params: any = {};
  let shouldAckRead = true;

  if (!isRead) {
    setTimeout(() => {
      defaultLogger.app.page.notificationItemClicked(
        notificationId,
        topicType || 'unknown',
        isFromNotificationClick ? 'app' : 'system',
      );
    });
  }

  if (isFromNotificationClick) {
    const statusRoutes = platformEnv.isExtensionBackground
      ? []
      : appGlobals.$navigationRef.current?.getState().routes;
    const currentRoute = statusRoutes?.length
      ? statusRoutes?.[statusRoutes.length - 1]
      : undefined;
    if (
      currentRoute &&
      currentRoute.name === ERootRoutes.Modal &&
      (
        currentRoute.params as {
          screen?: EModalRoutes;
        }
      )?.screen === EModalRoutes.NotificationsModal
    ) {
      routes = [];
      appEventBus.emit(EAppEventBusNames.UpdateNotificationBadge, undefined);
    } else {
      routes = [
        ERootRoutes.Modal,
        EModalRoutes.NotificationsModal,
        EModalNotificationsRoutes.NotificationList,
      ];
    }
  }

  // show Transaction Detail Modal
  if (message?.extras?.params?.transactionHash) {
    // ack readed after detail page opened
    shouldAckRead = false;
    routes = [
      ERootRoutes.Modal,
      EModalRoutes.MainModal,
      EModalAssetDetailRoutes.HistoryDetails,
    ];
    if (message?.extras?.params) {
      const { accountId, networkId, accountAddress, transactionHash } =
        message?.extras?.params || {};
      params = {
        accountId,
        networkId,
        accountAddress,
        transactionHash,
        notificationId,
        notificationAccountId,
        checkIsFocused: false,
        allowClickAccountNameSwitch: true,
      };
    }
  }

  const showFallbackUpdateDialog = () => {
    appEventBus.emit(EAppEventBusNames.ShowFallbackUpdateDialog, {
      version: message?.extras?.miniBundlerVersion,
    });
  };

  // For new versions with mode set, handle the mode properly
  if (shouldAckRead) {
    void appGlobals?.$backgroundApiProxy?.serviceNotification.ackNotificationMessage(
      {
        msgId: notificationId,
        action: ENotificationPushMessageAckAction.readed,
      },
    );
  }

  if (mode) {
    parseNotificationPayload(
      mode,
      payload,
      showFallbackUpdateDialog,
      message?.extras,
    );
    return;
  }

  // For backward compatibility with older versions:
  // If no specific mode is set, use default navigation behavior
  // - For extension background: open in expanded tab or side panel
  // - For other platforms: use modal navigation with route params
  // eslint-disable-next-line import/no-named-as-default-member, no-lonely-if

  if (routes.length === 0) {
    return;
  }

  if (platformEnv.isExtensionBackground) {
    // TODO not working for side panel
    await extUtils.openExpandTabOrSidePanel({
      routes,
      params,
    });
    // await chrome.tabs.create({
    //   url: `https://example.com?notificationId=`,
    // });
  } else {
    const modalParams = buildModalRouteParams({
      screens: routes,
      routeParams: params,
    });
    if (
      navigation &&
      routes?.length === 3 &&
      routes?.[0] === ERootRoutes.Modal
    ) {
      const [, screen1, screen2] = routes;
      navigation.pushModal(screen1 as any, {
        screen: screen2,
        params,
      });
    } else {
      const pushAction = StackActions.push(
        modalParams.screen,
        modalParams.params,
      );
      appGlobals.$navigationRef.current?.dispatch(pushAction);
    }
  }
}

/**
 * Build a notification payload that opens the given URL in the WebView overlay
 * route when the notification is tapped.
 *
 * Intended primarily as a reference for the backend that composes push payloads:
 * the resulting object is the exact shape `navigateToNotificationDetailByLocalParams`
 * routes through, so no additional app-side wiring is required.
 *
 * Three-level nesting is required by RootModalNavigator + ModalFlowNavigator:
 *   ERootRoutes.WebView         (root stack push target)
 *     └─ EWebViewRoutes.WebView  (RootModalNavigator / outer screen)
 *         └─ EWebViewRoutes.WebView  (ModalFlowNavigator / inner screen → WebViewPage)
 *
 * Only the innermost `params` reach `route.params` inside WebViewPage.
 * Mirror the structure used by openWebView() (see webViewNavigation.ts).
 *
 * Backend MUST validate the URL (https/http only) before sending; the app-side
 * `openWebView()` enforces the same rule defensively.
 */
export const buildWebViewNotificationPayload = (params: {
  url: string;
  title?: string;
  hideHeader?: boolean;
  /** Address bar is hidden by default — opt-in by passing `true`. */
  showAddressBar?: boolean;
}) => ({
  screen: ERootRoutes.WebView,
  params: {
    screen: EWebViewRoutes.WebView,
    params: {
      screen: EWebViewRoutes.WebView,
      params: { ...params, source: 'notification' as const },
    },
  },
});

export default {
  convertWebPermissionToEnum,
  navigateToNotificationDetail,
};
