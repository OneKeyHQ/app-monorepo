import { AppState, NativeEventEmitter, NativeModules } from 'react-native';

import { defaultColorScheme } from '../../config/appConfig';
import { OneKeyLocalError } from '../../errors';
import { EAppEventBusNames, appEventBus } from '../../eventBus/appEventBus';
import { defaultLogger } from '../../logger/logger';
import platformEnv from '../../platformEnv';
import appStorage from '../../storage/appStorage';
import { EAppSyncStorageKeys } from '../../storage/syncStorageKeys';

import { getCurrentIntercomUserId, getIntercomCredentials } from './identity';
import { notifyIntercomOpenFailed } from './openFailure';
import {
  type IIntercomLockPolicy,
  type IShowIntercomParams,
  createIntercomOpenGuard,
  getInstanceId,
  getIntercomLanguageOverride,
} from './utils';
import { showIntercom as showWebIntercom } from './webView.native';

import type {
  IIntercomUnreadTrigger,
  ISupportReplyResyncResult,
} from '../../logger/scopes/notification/scenes/support';

type IIntercomSdk = typeof import('@intercom/intercom-react-native');
type IUserId = string | null;
type IIntercomThemeMode = 'light' | 'dark' | 'system';

// The SDK cache can change without a delivered unread event (observed on iOS),
// so the foreground app re-reads it periodically. The read is a local getter.
const UNREAD_POLL_INTERVAL_MS = 30_000;

let sdkPromise: Promise<IIntercomSdk> | undefined;
let sessionPromise: Promise<void> | undefined;
let requestedUserId: IUserId | undefined;
let activeUserId: IUserId | undefined;
let activeSessionGeneration = 0;
let sessionGeneration = 0;
let unreadRequestId = 0;
let unreadCount = 0;
let currentTheme: IIntercomThemeMode = defaultColorScheme;
let unreadPollTimer: ReturnType<typeof setInterval> | undefined;
let messengerLocked = false;
// A support reply received in the background resyncs on the next foreground.
let supportReplyResyncPending = false;
const intercomOpenGuard = createIntercomOpenGuard(notifyIntercomOpenFailed);
const unreadListeners = new Set<() => void>();

type IOneKeyIntercom = {
  initialized: boolean;
  refreshUnreadCount?: (languageOverride: string) => Promise<void>;
  updateLockPolicy?: (
    locked: boolean,
    validFromMs: number,
    lockAtMs: number,
  ) => Promise<void>;
};

const nativeIntercom = NativeModules.OneKeyIntercom as
  | IOneKeyIntercom
  | undefined;

function canUseNativeSdk() {
  // Older installed binaries and Catalyst keep the existing WebView entry.
  return (
    !platformEnv.isNativeIOSMacCatalyst &&
    nativeIntercom?.initialized === true &&
    !!NativeModules.IntercomEventEmitter
  );
}

function setUnreadCount(count: number) {
  unreadCount = count;
  unreadListeners.forEach((listener) => listener());
}

export const getIntercomUnreadCount = () => unreadCount;

export const subscribeToIntercomUnreadCount = (listener: () => void) => {
  unreadListeners.add(listener);
  return () => {
    unreadListeners.delete(listener);
  };
};

async function refreshUnreadCount(
  sdk: IIntercomSdk,
  trigger: IIntercomUnreadTrigger,
) {
  const generation = activeSessionGeneration;
  unreadRequestId += 1;
  const requestId = unreadRequestId;
  const count = await sdk.default.getUnreadConversationCount();
  const userId = await getCurrentIntercomUserId();
  if (
    generation === sessionGeneration &&
    requestId === unreadRequestId &&
    activeUserId === userId
  ) {
    if (count !== unreadCount) {
      defaultLogger.notification.support.intercomUnreadChanged({
        trigger,
        previousCount: unreadCount,
        count,
      });
    }
    setUnreadCount(count);
    return;
  }
  // A poll that keeps missing the session would log every tick.
  if (trigger !== 'poll') {
    defaultLogger.notification.support.intercomUnreadDiscarded({ trigger });
  }
}

async function isCurrentSession(userId: IUserId, generation: number) {
  const currentUserId = await getCurrentIntercomUserId();
  return generation === sessionGeneration && currentUserId === userId;
}

function logUnreadRefreshFailed(
  trigger: IIntercomUnreadTrigger,
  error: unknown,
) {
  console.warn('Failed to refresh Intercom unread count');
  defaultLogger.notification.support.intercomUnreadRefreshFailed({
    trigger,
    errorName: (error as Error | undefined)?.name,
  });
}

function requestUnreadRefresh(
  sdk: IIntercomSdk,
  trigger: IIntercomUnreadTrigger,
) {
  void refreshUnreadCount(sdk, trigger).catch((error: unknown) =>
    logUnreadRefreshFailed(trigger, error),
  );
}

function syncUnreadPolling(sdk: IIntercomSdk, active: boolean) {
  if (!active) {
    clearInterval(unreadPollTimer);
    unreadPollTimer = undefined;
    return;
  }
  unreadPollTimer ??= setInterval(
    () => requestUnreadRefresh(sdk, 'poll'),
    UNREAD_POLL_INTERVAL_MS,
  );
}

function toSdkThemeMode(sdk: IIntercomSdk, theme: IIntercomThemeMode) {
  if (theme === 'system') {
    // Lets an open Messenger follow OS appearance changes on its own; on
    // Android the app Activity does not see them until it resumes.
    return sdk.ThemeMode.SYSTEM;
  }
  return theme === 'dark' ? sdk.ThemeMode.DARK : sdk.ThemeMode.LIGHT;
}

// Support pushes must reach the server. Android first invalidates attribute
// dedup; SDK unread events publish response changes alongside the local read.
async function resyncUnreadFromServer(
  sdk: IIntercomSdk,
  trigger: IIntercomUnreadTrigger,
) {
  const languageOverride = await getIntercomLanguageOverride();
  if (trigger === 'support-push' && platformEnv.isNativeAndroid) {
    if (!nativeIntercom?.refreshUnreadCount) {
      throw new OneKeyLocalError(
        'Intercom unread refresh requires an updated Android binary',
      );
    }
    await nativeIntercom.refreshUnreadCount(languageOverride);
  } else {
    await sdk.default.updateUser({ languageOverride });
  }
  await refreshUnreadCount(sdk, trigger);
}

// In the foreground the SDK only learns about a new reply from its realtime
// socket and keeps a stale unread cache when that event never arrives
// (OK-67112). The OneKey support-reply push still reaches bg, so main resyncs.
async function resyncUnreadOnSupportReply(
  sdk: IIntercomSdk,
): Promise<ISupportReplyResyncResult> {
  // Defer a background user update to the next foreground. Only an explicit
  // 'background' defers: a state that never changes would never flush it.
  if (AppState.currentState === 'background') {
    supportReplyResyncPending = true;
    return 'deferred-to-foreground';
  }
  supportReplyResyncPending = false;
  // A session sync in flight ends with its own resync, so do not wait on it.
  if (activeSessionGeneration !== sessionGeneration) {
    return 'session-syncing';
  }
  const userId = activeUserId;
  const generation = activeSessionGeneration;
  if (userId === undefined) {
    return 'no-session';
  }
  if (!(await isCurrentSession(userId, generation))) {
    return 'identity-changed';
  }
  await resyncUnreadFromServer(sdk, 'support-push');
  return 'resynced';
}

function requestSupportReplyResync(sdk: IIntercomSdk) {
  void resyncUnreadOnSupportReply(sdk)
    .then((result) =>
      defaultLogger.notification.support.supportReplyResync({ result }),
    )
    .catch((error: unknown) => {
      supportReplyResyncPending = true;
      logUnreadRefreshFailed('support-push', error);
    });
}

async function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = (async () => {
      const sdk = await import('@intercom/intercom-react-native');
      // Native initialization (BaseMainApplication / OneKeyIntercom.mm) owns
      // the keys and hides the launcher, in-app messages and proactive content
      // before either JS runtime starts.
      await sdk.default.setThemeMode(toSdkThemeMode(sdk, currentTheme));
      // The SDK requires its Android listener before app-owned emitters.
      sdk.default.bootstrapEventListeners();
      const emitter = new NativeEventEmitter(
        NativeModules.IntercomEventEmitter,
      );
      // One listener belongs to the main runtime for the native SDK lifetime.
      emitter.addListener(sdk.IntercomEvents.IntercomUnreadCountDidChange, () =>
        requestUnreadRefresh(sdk, 'sdk-event'),
      );
      // Closing the Messenger marks conversations read.
      emitter.addListener(sdk.IntercomEvents.IntercomWindowDidHide, () =>
        requestUnreadRefresh(sdk, 'messenger-closed'),
      );
      appEventBus.on(EAppEventBusNames.SupportReplyReceived, () =>
        requestSupportReplyResync(sdk),
      );
      AppState.addEventListener('change', (state) => {
        const active = state === 'active';
        if (active) {
          if (supportReplyResyncPending) {
            requestSupportReplyResync(sdk);
          } else {
            requestUnreadRefresh(sdk, 'foreground');
          }
        }
        syncUnreadPolling(sdk, active);
      });
      syncUnreadPolling(sdk, AppState.currentState === 'active');
      // Records whether the foreground poll started at load, e.g. after an
      // in-process main runtime restart.
      defaultLogger.notification.support.intercomSdkLoaded({
        appState: AppState.currentState,
        pollActive: !!unreadPollTimer,
      });
      return sdk;
    })();
    void sdkPromise.catch(() => {
      sdkPromise = undefined;
    });
  }
  return sdkPromise;
}

// Native never shows Intercom in-app messages; unread dots and OneKey push
// cover replies. The SDK keeps an unread reply cached after it is swiped away
// and re-presents it whenever in-app messages turn visible again (OK-67003).
// Native init sets GONE per process and the SDK never resets it; reassert it
// per JS main runtime in case an older bundle in this process enabled it.
async function hideInAppMessages(): Promise<void> {
  if (!canUseNativeSdk()) {
    return;
  }
  // Setting visibility needs no session, so do not initialize one here.
  const sdk = await import('@intercom/intercom-react-native');
  await sdk.default.setInAppMessageVisibility(sdk.Visibility.GONE);
}

export async function setIntercomInAppMessageVisibility(_visible: boolean) {
  if (!platformEnv.isNativeMainThread) {
    return;
  }
  await hideInAppMessages();
}

export async function setIntercomMessengerLocked(
  locked: boolean,
  policy?: IIntercomLockPolicy,
) {
  if (!platformEnv.isNativeMainThread) {
    return;
  }
  messengerLocked = locked;
  // IntercomLockGuard syncs the lock on mount at every main runtime start.
  void hideInAppMessages().catch(() => {
    console.warn('Failed to hide Intercom in-app messages');
  });
  if (locked) {
    // Cancel pre-lock opens and allow an immediate deliberate reopen after unlock.
    intercomOpenGuard.reset();
  }
  if (platformEnv.isNativeAndroid && policy) {
    await nativeIntercom?.updateLockPolicy?.(
      locked,
      policy.validFromMs,
      policy.lockAtMs,
    );
  }
  // Only a loaded SDK can be presenting the native Messenger.
  if (!locked || !sdkPromise) {
    return;
  }
  const sdk = await sdkPromise;
  await sdk.default.hideIntercom();
}

export async function setIntercomTheme(
  theme: 'light' | 'dark',
  followSystem = false,
) {
  if (!platformEnv.isNativeMainThread) {
    return;
  }
  currentTheme = followSystem ? 'system' : theme;
  if (!canUseNativeSdk()) {
    return;
  }
  // Keep theme changes from eagerly initializing the native SDK; loadSdk
  // applies the latest theme once it initializes.
  if (sdkPromise) {
    const sdk = await sdkPromise;
    await sdk.default.setThemeMode(toSdkThemeMode(sdk, currentTheme));
  }
}

async function syncSession(
  sdk: IIntercomSdk,
  userId: IUserId,
  generation: number,
) {
  if (generation !== sessionGeneration) {
    return;
  }
  // Retire a signed-in previous account before the next JWT request can fail,
  // so its Messenger never stays open under another wallet identity. An
  // anonymous session is kept so identifying it can retain its history.
  if (activeUserId && activeUserId !== userId) {
    activeUserId = undefined;
    await sdk.default.hideIntercom();
    await sdk.default.removeUserJwtProvider();
    await sdk.default.logout();
  }
  const credentials = userId ? await getIntercomCredentials(userId) : undefined;
  if (!(await isCurrentSession(userId, generation))) {
    return;
  }
  if (userId && !credentials) {
    return;
  }

  const loggedIn = await sdk.default.isUserLoggedIn();
  const previous = loggedIn
    ? await sdk.default.fetchLoggedInUserAttributes()
    : {};
  const wasIdentified = !!(previous.userId || previous.email);
  const sameIdentity = credentials
    ? previous.userId === credentials.attributes.userId
    : !wasIdentified;

  if (!(await isCurrentSession(userId, generation))) {
    return;
  }
  await sdk.default.removeUserJwtProvider();
  if (loggedIn && !sameIdentity) {
    await sdk.default.hideIntercom();
    // Preserve the anonymous session so identifying it can retain its history.
    if (wasIdentified) {
      await sdk.default.logout();
    }
  }
  if (!(await isCurrentSession(userId, generation))) {
    return;
  }

  if (credentials && userId) {
    await sdk.default.setUserJwt(credentials.token);
    if (!loggedIn || !sameIdentity) {
      await sdk.default.loginUserWithUserAttributes(credentials.attributes);
    }
    await sdk.default.setUserJwtProvider(async () => {
      if (!(await isCurrentSession(userId, generation))) {
        return null;
      }
      const refreshed = await getIntercomCredentials(userId);
      return (await isCurrentSession(userId, generation))
        ? (refreshed?.token ?? null)
        : null;
    });
  } else if (!loggedIn || !sameIdentity) {
    await sdk.default.loginUnidentifiedUser();
  }

  if (!(await isCurrentSession(userId, generation))) {
    return;
  }
  activeUserId = userId;
  activeSessionGeneration = generation;
  await resyncUnreadFromServer(sdk, 'session');
}

function hasOpenedNativeSupport() {
  return (
    appStorage.syncStorage.getBoolean(
      EAppSyncStorageKeys.onekey_intercom_native_support_opened,
    ) === true
  );
}

async function syncCurrentSession(userId: IUserId) {
  intercomOpenGuard.setIdentity(userId);
  if (sessionPromise && requestedUserId === userId) {
    return sessionPromise;
  }
  requestedUserId = userId;
  sessionGeneration += 1;
  const generation = sessionGeneration;
  setUnreadCount(0);
  const previous = sessionPromise ?? Promise.resolve();
  const operation = previous
    .catch(() => undefined)
    .then(async () => {
      await syncSession(await loadSdk(), userId, generation);
    });
  sessionPromise = operation;
  try {
    await operation;
    // An identity change can cancel sync without throwing. Do not cache that
    // fulfilled operation as a usable session if the user comes back later.
    if (
      sessionPromise === operation &&
      activeSessionGeneration !== generation
    ) {
      sessionPromise = undefined;
    }
  } catch (error) {
    if (sessionPromise === operation) {
      sessionPromise = undefined;
    }
    throw error;
  }
}

export async function initIntercom() {
  if (!platformEnv.isNativeMainThread) {
    return;
  }
  const userId = await getCurrentIntercomUserId();
  intercomOpenGuard.setIdentity(userId);
  if (!canUseNativeSdk()) {
    return;
  }
  // Anonymous users only need the SDK after they have contacted support;
  // a loaded SDK still syncs so sign-out clears the previous identity.
  if (userId === null && !sdkPromise && !hasOpenedNativeSupport()) {
    return;
  }
  await syncCurrentSession(userId);
}

async function openIntercom(
  params: IShowIntercomParams | undefined,
  expectedUserId: IUserId,
  canPresent: () => boolean,
): Promise<boolean> {
  if (!platformEnv.isNativeMainThread) {
    throw new OneKeyLocalError('Intercom must be opened in the main runtime');
  }
  const nativeSdkReady = canUseNativeSdk();
  if (!nativeSdkReady) {
    defaultLogger.notification.support.supportReplyBranch({
      conversationId: params?.conversationId,
      selectedBranch: 'native-webview-fallback',
      nativeSdkReady,
    });
    return showWebIntercom(
      params,
      (userId) => userId === expectedUserId && !messengerLocked && canPresent(),
    );
  }
  if ((await getCurrentIntercomUserId()) !== expectedUserId) {
    throw new OneKeyLocalError('Intercom user changed; please try again');
  }
  await syncCurrentSession(expectedUserId);
  const generation = activeSessionGeneration;
  const userId = activeUserId;
  if (
    userId !== expectedUserId ||
    !(await isCurrentSession(userId, generation))
  ) {
    throw new OneKeyLocalError('Intercom user changed; please try again');
  }
  const sdk = await loadSdk();
  const instanceId = await getInstanceId();
  if (instanceId || params?.requestId) {
    await sdk.default.logEvent('client info', {
      ...(instanceId ? { instanceId } : {}),
      ...(params?.requestId ? { requestId: params.requestId } : {}),
    });
  }
  let appliedTheme: IIntercomThemeMode;
  do {
    appliedTheme = currentTheme;
    await sdk.default.setThemeMode(toSdkThemeMode(sdk, appliedTheme));
    if (!(await isCurrentSession(userId, generation))) {
      throw new OneKeyLocalError('Intercom user changed; please try again');
    }
    // Theme application is asynchronous and can outlive identity or lock changes.
    if (messengerLocked || !canPresent()) {
      return false;
    }
  } while (appliedTheme !== currentTheme);
  void appStorage.syncStorage.set(
    EAppSyncStorageKeys.onekey_intercom_native_support_opened,
    true,
  );
  // A lock during the awaits above already hid the Messenger; do not reopen.
  if (messengerLocked) {
    return false;
  }
  const hasUnreadConversations = unreadCount > 0;
  const defaultBranch = hasUnreadConversations
    ? 'native-messages'
    : 'native-home';
  defaultLogger.notification.support.supportReplyBranch({
    conversationId: params?.conversationId,
    selectedBranch: params?.conversationId
      ? 'native-conversation'
      : defaultBranch,
    nativeSdkReady,
  });
  if (params?.conversationId) {
    return (
      (await sdk.default.presentContent(
        sdk.IntercomContent.conversationWithConversationId(
          params.conversationId,
        ),
      )) !== false
    );
  }
  if (hasUnreadConversations) {
    return (await sdk.default.presentSpace(sdk.Space.messages)) !== false;
  }
  return (await sdk.default.present()) !== false;
}

export async function showIntercom(params?: IShowIntercomParams) {
  try {
    if (!platformEnv.isNativeMainThread) {
      throw new OneKeyLocalError('Intercom must be opened in the main runtime');
    }
    const userId = await getCurrentIntercomUserId();
    await intercomOpenGuard.run(userId, params, (canPresent) =>
      openIntercom(params, userId, canPresent),
    );
  } catch (error) {
    notifyIntercomOpenFailed(error);
  }
}

export const update = () => {};
