import { NativeEventEmitter, NativeModules } from 'react-native';

import { OneKeyLocalError } from '../../errors';
import platformEnv from '../../platformEnv';
import appStorage from '../../storage/appStorage';
import { EAppSyncStorageKeys } from '../../storage/syncStorageKeys';

import { getCurrentIntercomUserId, getIntercomCredentials } from './identity';
import { notifyIntercomOpenFailed } from './openFailure';
import {
  type IIntercomLockPolicy,
  type IShowIntercomParams,
  getInstanceId,
  getIntercomLanguageOverride,
} from './utils';
import { showIntercom as showWebIntercom } from './webView.native';

type IIntercomSdk = typeof import('@intercom/intercom-react-native');
type IUserId = string | null;

let sdkPromise: Promise<IIntercomSdk> | undefined;
let sessionPromise: Promise<void> | undefined;
let requestedUserId: IUserId | undefined;
let activeUserId: IUserId | undefined;
let activeSessionGeneration = 0;
let sessionGeneration = 0;
let unreadRequestId = 0;
let unreadCount = 0;
let currentTheme: 'light' | 'dark' | undefined;
let messengerLocked = false;
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

function toSdkThemeMode(sdk: IIntercomSdk, theme: 'light' | 'dark') {
  return theme === 'dark' ? sdk.ThemeMode.DARK : sdk.ThemeMode.LIGHT;
}

async function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = (async () => {
      const sdk = await import('@intercom/intercom-react-native');
      // Both platforms initialize before either JS runtime starts. Native owns
      // readiness and keys, so OTA configuration cannot strand an old session.
      await sdk.default.setLauncherVisibility(sdk.Visibility.GONE);
      await sdk.default.setInAppMessageVisibility(sdk.Visibility.GONE);
      await sdk.default.suppressProactiveContent([
        sdk.ProactiveContentType.Carousel,
        sdk.ProactiveContentType.Survey,
      ]);
      if (currentTheme) {
        await sdk.default.setThemeMode(toSdkThemeMode(sdk, currentTheme));
      }
      // The SDK requires its Android listener before app-owned emitters.
      sdk.default.bootstrapEventListeners();
      const emitter = new NativeEventEmitter(
        NativeModules.IntercomEventEmitter,
      );
      // One listener belongs to the main runtime for the native SDK lifetime.
      emitter.addListener(
        sdk.IntercomEvents.IntercomUnreadCountDidChange,
        () => {
          void refreshUnreadCount(sdk).catch(() => {
            console.warn('Failed to refresh Intercom unread count');
          });
        },
      );
      return sdk;
    })();
    void sdkPromise.catch(() => {
      sdkPromise = undefined;
    });
  }
  return sdkPromise;
}

export async function setIntercomInAppMessageVisibility(_visible: boolean) {
  // Native keeps in-app messages off; unread dots and OneKey push cover replies.
}

export async function setIntercomMessengerLocked(
  locked: boolean,
  policy?: IIntercomLockPolicy,
) {
  if (!platformEnv.isNativeMainThread) {
    return;
  }
  messengerLocked = locked;
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

export async function setIntercomTheme(theme: 'light' | 'dark') {
  if (!platformEnv.isNativeMainThread || !canUseNativeSdk()) {
    return;
  }
  currentTheme = theme;
  // Keep theme changes from eagerly initializing the native SDK; loadSdk
  // applies the latest theme once it initializes.
  if (sdkPromise) {
    const sdk = await sdkPromise;
    await sdk.default.setThemeMode(toSdkThemeMode(sdk, theme));
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
  if (!platformEnv.isNativeMainThread || !canUseNativeSdk()) {
    return;
  }
  const userId = await getCurrentIntercomUserId();
  // Anonymous users only need the SDK after they have contacted support;
  // a loaded SDK still syncs so sign-out clears the previous identity.
  if (userId === null && !sdkPromise && !hasOpenedNativeSupport()) {
    return;
  }
  await syncCurrentSession(userId);
}

async function openIntercom(params?: IShowIntercomParams) {
  if (!platformEnv.isNativeMainThread) {
    throw new OneKeyLocalError('Intercom must be opened in the main runtime');
  }
  if (!canUseNativeSdk()) {
    return showWebIntercom(params);
  }
  await syncCurrentSession(await getCurrentIntercomUserId());
  const generation = activeSessionGeneration;
  const userId = activeUserId;
  if (userId === undefined || !(await isCurrentSession(userId, generation))) {
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
  if (!(await isCurrentSession(userId, generation))) {
    throw new OneKeyLocalError('Intercom user changed; please try again');
  }
  void appStorage.syncStorage.set(
    EAppSyncStorageKeys.onekey_intercom_native_support_opened,
    true,
  );
  // A lock during the awaits above already hid the Messenger; do not reopen.
  if (messengerLocked) {
    return;
  }
  if (params?.conversationId) {
    await sdk.default.presentContent(
      sdk.IntercomContent.conversationWithConversationId(params.conversationId),
    );
  } else {
    await sdk.default.present();
  }
}

export async function showIntercom(params?: IShowIntercomParams) {
  try {
    await openIntercom(params);
  } catch (error) {
    notifyIntercomOpenFailed(error);
  }
}

export const update = () => {};
