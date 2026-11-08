import { AppState, NativeEventEmitter, NativeModules } from 'react-native';

import { defaultColorScheme } from '../../config/appConfig';
import { OneKeyLocalError } from '../../errors';
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
  getIntercomSupportUrlOverride,
} from './utils';
import { showIntercom as showWebIntercom } from './webView.native';

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
let inAppMessagesRequested = false;
let visibilityApplication: Promise<void> = Promise.resolve();
let unreadPollTimer: ReturnType<typeof setInterval> | undefined;
let messengerLocked = false;
const intercomOpenGuard = createIntercomOpenGuard(notifyIntercomOpenFailed);
const unreadListeners = new Set<() => void>();

type IOneKeyIntercom = {
  initialized: boolean;
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

async function refreshUnreadCount(sdk: IIntercomSdk) {
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
    setUnreadCount(count);
  }
}

async function isCurrentSession(userId: IUserId, generation: number) {
  const currentUserId = await getCurrentIntercomUserId();
  return generation === sessionGeneration && currentUserId === userId;
}

function requestUnreadRefresh(sdk: IIntercomSdk) {
  void refreshUnreadCount(sdk).catch(() => {
    console.warn('Failed to refresh Intercom unread count');
  });
}

function syncUnreadPolling(sdk: IIntercomSdk, active: boolean) {
  if (!active) {
    clearInterval(unreadPollTimer);
    unreadPollTimer = undefined;
    return;
  }
  unreadPollTimer ??= setInterval(
    () => requestUnreadRefresh(sdk),
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

function toSdkVisibility(sdk: IIntercomSdk, visible: boolean) {
  return visible ? sdk.Visibility.VISIBLE : sdk.Visibility.GONE;
}

async function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = (async () => {
      const sdk = await import('@intercom/intercom-react-native');
      // Native initialization (BaseMainApplication / OneKeyIntercom.mm) owns
      // the keys and hides the launcher, in-app messages and proactive content
      // before either JS runtime starts. In-app messages stay hidden until a
      // session for the current identity is established.
      await sdk.default.setThemeMode(toSdkThemeMode(sdk, currentTheme));
      // The SDK requires its Android listener before app-owned emitters.
      sdk.default.bootstrapEventListeners();
      const emitter = new NativeEventEmitter(
        NativeModules.IntercomEventEmitter,
      );
      // One listener belongs to the main runtime for the native SDK lifetime.
      emitter.addListener(sdk.IntercomEvents.IntercomUnreadCountDidChange, () =>
        requestUnreadRefresh(sdk),
      );
      // Closing the Messenger marks conversations read.
      emitter.addListener(sdk.IntercomEvents.IntercomWindowDidHide, () =>
        requestUnreadRefresh(sdk),
      );
      AppState.addEventListener('change', (state) => {
        const active = state === 'active';
        if (active) {
          requestUnreadRefresh(sdk);
        }
        syncUnreadPolling(sdk, active);
      });
      syncUnreadPolling(sdk, AppState.currentState === 'active');
      return sdk;
    })();
    void sdkPromise.catch(() => {
      sdkPromise = undefined;
    });
  }
  return sdkPromise;
}

function isSessionReady() {
  return (
    activeUserId !== undefined &&
    activeUserId === requestedUserId &&
    activeSessionGeneration === sessionGeneration
  );
}

function shouldShowInAppMessages() {
  return inAppMessagesRequested && !messengerLocked && isSessionReady();
}

// The native SDK may still hold a restored or retiring account's session, so
// messages are shown only once that session matches the current identity.
// Calls are serialized and each reads the latest state, so the last state
// change always wins; a hide queued after a pending show lands after it.
function syncInAppMessageVisibility(): Promise<void> {
  if (!canUseNativeSdk()) {
    return Promise.resolve();
  }
  const pendingSdk = sdkPromise;
  const run = visibilityApplication
    .catch(() => undefined)
    .then(async () => {
      if (!pendingSdk) {
        // A restarted main runtime has no SDK state yet, while the
        // process-wide native SDK may still show messages enabled by the
        // previous runtime. Hide them without starting a session; the
        // container calls this on mount, so it runs at runtime startup.
        const sdkModule = await import('@intercom/intercom-react-native');
        await sdkModule.default.setInAppMessageVisibility(
          sdkModule.Visibility.GONE,
        );
        return;
      }
      const sdk = await pendingSdk;
      const userId = activeUserId;
      const generation = sessionGeneration;
      let visible = shouldShowInAppMessages();
      if (visible && userId !== undefined) {
        visible =
          (await isCurrentSession(userId, generation)) &&
          activeUserId === userId &&
          shouldShowInAppMessages();
      }
      await sdk.default.setInAppMessageVisibility(
        toSdkVisibility(sdk, visible),
      );
    });
  visibilityApplication = run;
  return run;
}

export async function setIntercomInAppMessageVisibility(visible: boolean) {
  if (!platformEnv.isNativeMainThread) {
    return;
  }
  inAppMessagesRequested = visible;
  await syncInAppMessageVisibility();
}

export async function setIntercomMessengerLocked(
  locked: boolean,
  policy?: IIntercomLockPolicy,
) {
  if (!platformEnv.isNativeMainThread) {
    return;
  }
  messengerLocked = locked;
  void syncInAppMessageVisibility().catch(() => {
    console.warn('Failed to update Intercom message visibility');
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
  // A visibility failure must not fail the session; messages stay hidden.
  await syncInAppMessageVisibility().catch(() => {
    console.warn('Failed to update Intercom message visibility');
  });
  await sdk.default.updateUser({
    languageOverride: await getIntercomLanguageOverride(),
  });
  await refreshUnreadCount(sdk);
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
  // Hide before the previous SDK identity is retired or replaced.
  void syncInAppMessageVisibility().catch(() => {
    console.warn('Failed to hide Intercom messages');
  });
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
  // A developer support URL override only applies to the hosted page, so it
  // routes around the native Messenger. The hosted page cannot open a specific
  // conversation, so notification opens keep using the SDK when it exists.
  if (
    !canUseNativeSdk() ||
    (!params?.conversationId && (await getIntercomSupportUrlOverride()))
  ) {
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
  if (params?.conversationId) {
    return (
      (await sdk.default.presentContent(
        sdk.IntercomContent.conversationWithConversationId(
          params.conversationId,
        ),
      )) !== false
    );
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
