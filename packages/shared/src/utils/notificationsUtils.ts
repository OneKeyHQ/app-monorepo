import { CommonActions, StackActions } from '@react-navigation/native';

import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';

import {
  ENotificationCommand,
  ENotificationPermission,
  ENotificationPushMessageAckAction,
  ENotificationPushMessageMode,
} from '../../types/notification';
import appGlobals from '../appGlobals';
import { OneKeyLocalError } from '../errors';
import {
  EAppEventBusNames,
  type IAppEventBusPayload,
  appEventBus,
} from '../eventBus/appEventBus';
import { ETranslations } from '../locale';
import { defaultLogger } from '../logger/logger';
import platformEnv from '../platformEnv';
import {
  EModalAssetDetailRoutes,
  EModalReferFriendsRoutes,
  EModalRoutes,
  ETabDiscoveryRoutes,
  ETabMarketRoutes,
  ETabReferFriendsRoutes,
  ETabRoutes,
  EWebViewRoutes,
} from '../routes';
import { EModalNotificationsRoutes } from '../routes/notifications';
import { ERootRoutes } from '../routes/root';

import extUtils from './extUtils';
import networkUtils from './networkUtils';
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
  navigationAction,
  localParams: originalLocalParams,
  getEarnAccount,
}: {
  payload: {
    screen: string;
    params: Record<string, any>;
  };
  navigationAction?: 'push';
  localParams: Record<string, string | undefined>;
  getEarnAccount: IGetEarnAccountFunc;
}) {
  const { screen, params: navigationParams } = payload;
  // Covers callers that bypass parseNotificationPayload (the mode=dialog
  // navigate action): throwing surfaces their fallback dialog instead of
  // dispatching push(undefined).
  if (typeof screen !== 'string' || !screen) {
    throw new OneKeyLocalError(
      'navigateToNotificationDetail: payload has no target screen',
    );
  }
  const isLegacyModalPush =
    navigationAction === 'push' && screen === ERootRoutes.Modal;
  // Recursively find and merge the deepest params

  const localParams = { ...originalLocalParams };

  let targetParams = navigationParams;
  while (targetParams?.params && typeof targetParams.params === 'object') {
    targetParams = targetParams.params;
  }

  const hasLocalTemplate =
    isLegacyModalPush &&
    Object.values(targetParams || {}).some(
      (value) => typeof value === 'string' && /\{local_\w+\}/.test(value),
    );

  if (targetParams && (!isLegacyModalPush || hasLocalTemplate)) {
    const networkId =
      typeof targetParams.networkId === 'string'
        ? targetParams.networkId.replace(
            /\{local_(\w+)\}/g,
            (match, param: string) => localParams[param] || match,
          )
        : undefined;
    if (
      networkId &&
      !networkId.includes('{local_') &&
      !networkUtils.isAllNetwork({ networkId })
    ) {
      const accountInfos = await getEarnAccount({
        accountId: localParams.accountId || '',
        networkId,
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

  // Handle Earn tab redirection and legacy Discovery-embedded Market payload
  // compatibility for native platforms. On native in 6.7+, Market is a
  // standalone tab while Earn remains a sub-tab within Discovery.
  if (
    platformEnv.isNative &&
    screen === ERootRoutes.Main &&
    navigationParams?.screen === ETabRoutes.Discovery
  ) {
    const subScreen = navigationParams.params?.screen as string | undefined;
    const isLegacyDiscoveryMarketSubRoute =
      subScreen === ETabMarketRoutes.TabMarket ||
      subScreen === ETabMarketRoutes.MarketDetail ||
      subScreen === ETabMarketRoutes.MarketDetailV2 ||
      subScreen === ETabMarketRoutes.MarketStockDetail ||
      subScreen === ETabMarketRoutes.MarketNativeDetail ||
      subScreen === ETabMarketRoutes.MarketBannerDetail;
    const isLegacyDiscoveryMarketTab =
      (!subScreen || subScreen === ETabDiscoveryRoutes.TabDiscovery) &&
      (navigationParams.params?.params?.defaultTab ===
        ETranslations.global_market ||
        navigationParams.params?.defaultTab === ETranslations.global_market);

    if (isLegacyDiscoveryMarketSubRoute) {
      navigationParams.screen = ETabRoutes.Market;
    } else if (isLegacyDiscoveryMarketTab) {
      navigationParams.screen = ETabRoutes.Market;
      const rawNestedParams =
        subScreen === ETabDiscoveryRoutes.TabDiscovery
          ? navigationParams.params?.params
          : navigationParams.params;
      // The outer navigate `pop` option is not inherited by the nested Market
      // stack; React Navigation reads `pop` from the nested params instead, so
      // set it here to pop existing detail routes back to TabMarket.
      if (rawNestedParams && typeof rawNestedParams === 'object') {
        const {
          defaultTab: _defaultTab,
          screen: _screen,
          params: _params,
          ...restParams
        } = rawNestedParams as Record<string, unknown>;
        navigationParams.params =
          Object.keys(restParams).length > 0
            ? {
                screen: ETabMarketRoutes.TabMarket,
                params: restParams,
                pop: true,
              }
            : { screen: ETabMarketRoutes.TabMarket, pop: true };
      } else {
        navigationParams.params = {
          screen: ETabMarketRoutes.TabMarket,
          pop: true,
        };
      }
    }
  }

  const createNativeTabRedirection = () => {
    let tab:
      | ETranslations.global_browser
      | ETranslations.global_earn
      | undefined;
    if (platformEnv.isNative && navigationParams?.screen === ETabRoutes.Earn) {
      navigationParams.screen = ETabRoutes.Discovery;
      tab = ETranslations.global_earn;
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
      (!navigationParams?.params?.screen ||
        navigationParams?.params?.screen === ETabMarketRoutes.TabMarket)
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
    if (isLegacyModalPush) {
      if (
        navigationParams?.screen === EModalRoutes.NotificationsModal &&
        navigationParams?.params?.screen ===
          EModalNotificationsRoutes.NotificationList
      ) {
        const state = appGlobals.$navigationRef.current?.getState();
        const currentRoute = state?.routes[state.index ?? 0];
        const currentModalParams = currentRoute?.params as
          | { screen?: EModalRoutes }
          | undefined;
        const currentModalState = currentRoute?.state;
        const currentModalRoute =
          currentModalState?.routes[currentModalState.index ?? 0];
        if (
          currentRoute?.name === ERootRoutes.Modal &&
          (currentModalRoute?.name ?? currentModalParams?.screen) ===
            EModalRoutes.NotificationsModal
        ) {
          appEventBus.emit(
            EAppEventBusNames.UpdateNotificationBadge,
            undefined,
          );
          return;
        }
      }
      appGlobals.$navigationRef.current?.dispatch(
        StackActions.push(screen, navigationParams),
      );
      return;
    }
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

export type INotificationPageNavigationEvent =
  IAppEventBusPayload[EAppEventBusNames.ShowNotificationPageNavigation];

// Foreground page events are buffered after they reach this JS runtime. Native
// BG legacy and page clicks keep their latest intent in one BG slot:
// SharedRPC writes made before main installs its observer are not replayed.
type INotificationPageNavigationProcessor = (
  event: INotificationPageNavigationEvent,
) => void | Promise<void>;
type IConsumePendingLegacyNavigation = () => Promise<
  INotificationPageNavigationEvent | undefined
>;
type INotificationPageNavigationRegistration = {
  processor: INotificationPageNavigationProcessor;
  consumePendingLegacyNavigation?: IConsumePendingLegacyNavigation;
  retryCount: number;
  retryTimer?: ReturnType<typeof setTimeout>;
};

const LEGACY_NAVIGATION_RETRY_DELAYS = [250, 1000, 3000];

let notificationPageNavigationRegistration: INotificationPageNavigationRegistration | null =
  null;
let pendingNotificationPageNavigationEvent: INotificationPageNavigationEvent | null =
  null;
let pendingLegacyNavigationEvent: INotificationPageNavigationEvent | undefined;
let pendingTakenLegacyNavigationEvent:
  | INotificationPageNavigationEvent
  | undefined;
let legacyNavigationDrainPromise: Promise<void> | undefined;
let legacyNavigationDrainDirty = false;

export function takePendingLegacyNavigationEvent() {
  const pending = pendingLegacyNavigationEvent;
  pendingLegacyNavigationEvent = undefined;
  return pending;
}

function scheduleLegacyNavigationRetry(
  registration: INotificationPageNavigationRegistration,
) {
  if (notificationPageNavigationRegistration !== registration) {
    return;
  }
  legacyNavigationDrainDirty = true;
  const delay = LEGACY_NAVIGATION_RETRY_DELAYS[registration.retryCount];
  registration.retryCount += 1;
  if (delay !== undefined) {
    registration.retryTimer = setTimeout(() => {
      if (notificationPageNavigationRegistration !== registration) {
        return;
      }
      registration.retryTimer = undefined;
      startLegacyNavigationDrain();
    }, delay);
  }
}

async function drainPendingLegacyNavigation() {
  for (;;) {
    const registration = notificationPageNavigationRegistration;
    if (!registration?.consumePendingLegacyNavigation) {
      return;
    }
    let event = pendingTakenLegacyNavigationEvent;
    if (event) {
      pendingTakenLegacyNavigationEvent = undefined;
    } else if (legacyNavigationDrainDirty) {
      legacyNavigationDrainDirty = false;
      try {
        event = await registration.consumePendingLegacyNavigation();
      } catch (error) {
        console.error(
          'Failed to consume pending legacy notification navigation',
          error,
        );
        scheduleLegacyNavigationRetry(registration);
        return;
      }
    } else {
      return;
    }

    if (event) {
      const currentRegistration = notificationPageNavigationRegistration;
      if (!currentRegistration?.consumePendingLegacyNavigation) {
        pendingTakenLegacyNavigationEvent = event;
        return;
      }
      try {
        await currentRegistration.processor(event);
      } catch (error) {
        console.error(
          'Failed to process legacy notification navigation',
          error,
        );
      }
    }
  }
}

function startLegacyNavigationDrain() {
  const registration = notificationPageNavigationRegistration;
  if (
    legacyNavigationDrainPromise ||
    !registration?.consumePendingLegacyNavigation ||
    registration.retryTimer !== undefined ||
    // The initial attempt can schedule three retries; the fourth failure stops.
    registration.retryCount > LEGACY_NAVIGATION_RETRY_DELAYS.length ||
    (!legacyNavigationDrainDirty && !pendingTakenLegacyNavigationEvent)
  ) {
    return;
  }
  legacyNavigationDrainPromise = Promise.resolve()
    .then(drainPendingLegacyNavigation)
    .finally(() => {
      legacyNavigationDrainPromise = undefined;
      startLegacyNavigationDrain();
    });
}

function requestLegacyNavigationDrain() {
  const registration = notificationPageNavigationRegistration;
  if (registration) {
    registration.retryCount = 0;
    if (registration.retryTimer !== undefined) {
      clearTimeout(registration.retryTimer);
      registration.retryTimer = undefined;
    }
  }
  legacyNavigationDrainDirty = true;
  startLegacyNavigationDrain();
}

function deliverNotificationPageNavigation(
  event: INotificationPageNavigationEvent,
) {
  if (event.navigationAction === 'push' || event.isNativeBackgroundNavigation) {
    requestLegacyNavigationDrain();
    return;
  }
  if (notificationPageNavigationRegistration) {
    pendingNotificationPageNavigationEvent = null;
    void notificationPageNavigationRegistration.processor(event);
    return;
  }
  pendingNotificationPageNavigationEvent = event;
}

export function registerNotificationPageNavigationProcessor(
  processor: INotificationPageNavigationProcessor,
  consumePendingLegacyNavigation?: IConsumePendingLegacyNavigation,
) {
  const previousRegistration = notificationPageNavigationRegistration;
  if (previousRegistration?.retryTimer !== undefined) {
    clearTimeout(previousRegistration.retryTimer);
    previousRegistration.retryTimer = undefined;
  }
  const registration: INotificationPageNavigationRegistration = {
    processor,
    consumePendingLegacyNavigation,
    retryCount: 0,
  };
  notificationPageNavigationRegistration = registration;
  const pending = pendingNotificationPageNavigationEvent;
  if (pending) {
    pendingNotificationPageNavigationEvent = null;
    void processor(pending);
  }
  if (consumePendingLegacyNavigation) {
    requestLegacyNavigationDrain();
  }
  return () => {
    if (registration.retryTimer !== undefined) {
      clearTimeout(registration.retryTimer);
      registration.retryTimer = undefined;
    }
    if (notificationPageNavigationRegistration === registration) {
      notificationPageNavigationRegistration = null;
    }
  };
}

// Register the permanent foreground capture listener once at module load.
// Skipped on the native background runtime (no UI processor lives there; the
// foreground copy of this module receives the cross-process broadcast).
if (!platformEnv.isNativeBackgroundThread) {
  appEventBus.on(
    EAppEventBusNames.ShowNotificationPageNavigation,
    deliverNotificationPageNavigation,
  );
}

// Push notification `mode` arrives as a NUMBER from the in-app bell list
// (server JSON) but as a STRING (e.g. "1") from JPush system-push extras on
// native. The enum values are numeric, so a strict `switch(mode)` silently
// misses every case for the system-push path (the OK-55681 regression). Coerce
// to the numeric enum before switching.
export function normalizeNotificationMode(
  mode: ENotificationPushMessageMode | string | number | undefined | null,
): ENotificationPushMessageMode | undefined {
  if (mode === null || mode === undefined || mode === '') {
    return undefined;
  }
  const numericMode = Number(mode);
  if (Number.isFinite(numericMode)) {
    return numericMode as ENotificationPushMessageMode;
  }
  if (typeof mode === 'string') {
    const name = mode.toLowerCase().replace(/[^a-z]/g, '');
    if (name === 'page' || name === 'navigate' || name === 'navigation') {
      return ENotificationPushMessageMode.page;
    }
    if (name === 'dialog') return ENotificationPushMessageMode.dialog;
    if (name === 'openinbrowser') {
      return ENotificationPushMessageMode.openInBrowser;
    }
    if (name === 'openinapp') return ENotificationPushMessageMode.openInApp;
    if (name === 'openindapp') return ENotificationPushMessageMode.openInDapp;
    if (name === 'command') return ENotificationPushMessageMode.command;
  }
  return undefined;
}

function toSupportConversationId(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value.trim() || undefined;
  }
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return String(value);
  }
  return undefined;
}

export function parseNotificationPayload(
  mode: ENotificationPushMessageMode | string | number,
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
): boolean {
  // The `false` branches include deliberate no-ops (blocked WebView URL,
  // empty payload, unknown mode) that never run `fallbackHandler`, so callers
  // cannot use the handler alone to detect that nothing happened.
  const normalizedMode = normalizeNotificationMode(mode);
  switch (normalizedMode) {
    case ENotificationPushMessageMode.page:
      try {
        const payloadObj = JSON.parse(payload || '');
        // `JSON.parse('{}')` succeeds, so a payload with no target used to
        // reach the navigator as `push(undefined)` — a silent dead tap.
        if (
          !payloadObj ||
          typeof payloadObj !== 'object' ||
          typeof payloadObj.screen !== 'string' ||
          !payloadObj.screen
        ) {
          fallbackHandler();
          return false;
        }
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
          if (!url || !isAllowedWebViewUrl(url)) return false;
          // Force source so resolveOverlayDisplay enforces notification-entry
          // display restrictions (hides attacker-supplied title, etc.).
          leaf.source = 'notification';
        }
        const event: INotificationPageNavigationEvent = {
          payload: payloadObj,
          extras,
        };
        if (platformEnv.isNative && platformEnv.isNativeBackgroundThread) {
          // Main treats this broadcast only as a wake for the BG-owned slot.
          event.isNativeBackgroundNavigation = true;
          pendingLegacyNavigationEvent = event;
        }
        appEventBus.emit(
          EAppEventBusNames.ShowNotificationPageNavigation,
          event,
        );
        return true;
      } catch (_error) {
        fallbackHandler();
        return false;
      }
    case ENotificationPushMessageMode.dialog:
      try {
        const payloadObj = JSON.parse(payload || '');
        appEventBus.emit(EAppEventBusNames.ShowNotificationViewDialog, {
          payload: payloadObj,
        });
        return true;
      } catch (_error) {
        fallbackHandler();
        return false;
      }
    case ENotificationPushMessageMode.openInBrowser:
      if (!payload || !/^https?:\/\//i.test(payload.trim())) {
        return false;
      }
      // The push protocol's openInBrowser mode promises the OS browser;
      // openInApp below is the in-app counterpart.
      openUrlExternal(payload, { useSystemBrowser: true });
      return true;
    case ENotificationPushMessageMode.openInApp:
      if (!payload) {
        return false;
      }
      {
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
          return false;
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
        return true;
      }
    case ENotificationPushMessageMode.openInDapp:
      if (!payload) {
        return false;
      }
      if (!isAllowedWebViewUrl(payload)) {
        defaultLogger.app.error.log(
          'parseNotificationPayload: blocked unsafe url in openInDapp',
        );
        return false;
      }
      appEventBus.emit(EAppEventBusNames.ShowNotificationInDappPage, payload);
      return true;
    case ENotificationPushMessageMode.command:
      try {
        const parsedPayload = JSON.parse(payload || '{}') as {
          action?: string;
          data?: Record<string, unknown>;
          conversationId?: unknown;
        };
        const action =
          typeof parsedPayload.action === 'string'
            ? parsedPayload.action.trim()
            : parsedPayload.action;
        const { data } = parsedPayload;
        if (!action) {
          fallbackHandler();
          return false;
        }
        // Merge extras.params with data, extras.params takes precedence for orderId etc.
        const mergedData = { ...data, ...extras?.params };
        if (action === ENotificationCommand.openSupportConversation) {
          // The backend contract is
          // {"action":"openSupportConversation","data":{"conversationId":"499"}}.
          // An id placed next to `action`, or delivered as a JSON number, must
          // not be dropped: without it the click silently opens the Messenger
          // home (a brand-new conversation window) instead of the target
          // conversation (OK-66809).
          const payloadTopLevelConversationId = (
            parsedPayload as { conversationId?: unknown }
          ).conversationId;
          const paramsConversationId = extras?.params?.conversationId;
          const dataConversationId = data?.conversationId;
          // `extras.params` wins over the payload when both carry an id, so an
          // explicit undefined in params must not hide a payload id.
          const rawConversationId =
            paramsConversationId !== undefined
              ? paramsConversationId
              : (dataConversationId ?? payloadTopLevelConversationId);
          const conversationId = toSupportConversationId(rawConversationId);
          // A blank string means "no id" (open the support entry); only a
          // present but unusable value (object/boolean) keeps the old fallback.
          const isBlankConversationId =
            typeof rawConversationId === 'string' &&
            rawConversationId.trim() === '';
          const hasUnusableConversationId =
            rawConversationId !== undefined &&
            rawConversationId !== null &&
            conversationId === undefined &&
            !isBlankConversationId;
          // `extras.params` wins over the payload when both carry an id, so
          // report which field actually supplied the opened conversation.
          let conversationIdSource:
            | 'extras.params'
            | 'data'
            | 'payload'
            | undefined;
          if (paramsConversationId !== undefined) {
            conversationIdSource = 'extras.params';
          } else if (dataConversationId !== undefined) {
            conversationIdSource = 'data';
          } else if (payloadTopLevelConversationId !== undefined) {
            conversationIdSource = 'payload';
          }
          defaultLogger.notification.support.supportReplyReceived({
            mode:
              typeof mode === 'string' || typeof mode === 'number'
                ? mode
                : undefined,
            action,
            conversationId,
            conversationIdSource,
            msgId:
              typeof extras?.params?.msgId === 'string'
                ? extras.params.msgId
                : undefined,
          });
          if (hasUnusableConversationId) {
            fallbackHandler();
            return false;
          }
          void appGlobals.$backgroundApiProxy.serviceNotification
            .requestOpenSupportConversation({
              sourceNodeId: platformEnv.isExtensionUi
                ? appEventBus.nodeId
                : undefined,
              conversationId,
            })
            .catch(fallbackHandler);
          return true;
        }
        appEventBus.emit(EAppEventBusNames.ExecuteNotificationCommand, {
          action,
          data: mergedData,
        });
        return true;
      } catch (_error) {
        fallbackHandler();
        return false;
      }
    default:
      return false;
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

  // OK-66809: record the clicked notification routing inputs before mode
  // handling. This funnel sees both system-push and message-center clicks, so
  // an old-version payload (mode != command) or a missing payload is still
  // diagnosable even when no support command log follows.
  defaultLogger.notification.support.supportReplyClicked({
    mode: typeof mode === 'number' ? mode : undefined,
    hasPayload: !!payload,
    isFromNotificationClick: !!isFromNotificationClick,
  });

  if (isFromNotificationClick) {
    // `$navigationRef` only exists in the foreground runtime. On native this
    // function also runs in the BACKGROUND runtime (system-push click), where
    // `appGlobals.$navigationRef` is undefined — guard every hop so we don't
    // throw before reaching the page-mode emit (OK-55681). The real navigation
    // happens later in the foreground via ShowNotificationPageNavigation.
    const statusRoutes = platformEnv.isExtensionBackground
      ? []
      : appGlobals.$navigationRef?.current?.getState()?.routes;
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
    if (platformEnv.isNativeBackgroundThread) {
      const event: INotificationPageNavigationEvent = {
        payload: modalParams,
        navigationAction: 'push',
      };
      pendingLegacyNavigationEvent = event;
      appEventBus.emit(EAppEventBusNames.ShowNotificationPageNavigation, event);
    } else if (
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
