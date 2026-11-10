import { defaultColorScheme } from '../../config/appConfig';
import { OneKeyLocalError } from '../../errors';
import platformEnv from '../../platformEnv';

import { EIntercomBridge } from './bridge';
import {
  assertIntercomUserUnchanged,
  getCurrentIntercomUserId,
  getIntercomCredentials,
} from './identity';
import { notifyIntercomOpenFailed } from './openFailure';
import {
  type IIntercomLockPolicy,
  type IShowIntercomParams,
  buildIntercomUrl,
  createIntercomOpenGuard,
  getInstanceId,
  getIntercomLanguageOverride,
  getIntercomSupportUrl,
} from './utils';

import type { InitType } from '@intercom/messenger-js-sdk/dist/types';

type IIntercomSdk = typeof import('@intercom/messenger-js-sdk');

let intercomSdkPromise: Promise<IIntercomSdk> | undefined;
let intercomInitPromise: Promise<void> | undefined;
let intercomUnreadCount = 0;
let requestedUserId: string | null | undefined;
let activeUserId: string | null | undefined;
let activeGeneration = 0;
let sessionGeneration = 0;
let unreadRevision = 0;
let hasBooted = false;
let sdkInitialized = false;
let inAppMessagesVisible = false;
let messengerLocked = false;
let currentTheme: 'light' | 'dark' = defaultColorScheme;
const intercomOpenGuard = createIntercomOpenGuard(notifyIntercomOpenFailed);
const unreadCountListeners = new Set<() => void>();

export const setIntercomInAppMessageVisibility = async (visible: boolean) => {
  inAppMessagesVisible = visible;
  if (hasBooted) {
    // The installed npm SDK does not expose the hideNotifications method.
    const intercom = globalThis.window?.Intercom as
      | ((method: 'hideNotifications', hidden: boolean) => void)
      | undefined;
    intercom?.('hideNotifications', !inAppMessagesVisible);
  }
};

function setUnreadCount(count: number) {
  intercomUnreadCount = count;
  unreadCountListeners.forEach((listener) => listener());
}

export const getIntercomUnreadCount = () => intercomUnreadCount;

export const subscribeToIntercomUnreadCount = (listener: () => void) => {
  unreadCountListeners.add(listener);
  return () => {
    unreadCountListeners.delete(listener);
  };
};

const loadIntercomSdk = () => {
  intercomSdkPromise ||= import('@intercom/messenger-js-sdk');
  return intercomSdkPromise;
};

// Web and desktop observe OS appearance changes live, so the resolved theme
// is enough here; `followSystem` only matters for the native SDK.
export const setIntercomTheme = async (
  theme: 'light' | 'dark',
  _followSystem?: boolean,
) => {
  currentTheme = theme;
  if (hasBooted) {
    const sdk = await loadIntercomSdk();
    if (hasBooted) {
      sdk.update({ theme_mode: currentTheme });
    }
  }
};

export const setIntercomMessengerLocked = async (
  locked: boolean,
  _policy?: IIntercomLockPolicy,
) => {
  messengerLocked = locked;
  if (locked && hasBooted) {
    const sdk = await loadIntercomSdk();
    sdk.hide();
  }
};

const clearIntercomOpenOnBoot = (appId: string) => {
  try {
    const key = `intercom.intercom-state-${appId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const state = JSON.parse(raw);
      if (state.openOnBoot?.metadata?.articleIds?.length) {
        delete state.openOnBoot;
        localStorage.setItem(key, JSON.stringify(state));
      }
    }
  } catch {
    // ignore
  }
};

function clearIntercomCookies() {
  const cookieNames = (globalThis.document?.cookie ?? '')
    .split(';')
    .map((cookie) => cookie.trim().split('=')[0])
    .filter((name) => name.startsWith('intercom-'));
  const domains = [''];
  let domain = globalThis.location?.hostname ?? '';
  while (domain.includes('.')) {
    domains.push(`; domain=${domain}`);
    domain = domain.slice(domain.indexOf('.') + 1);
  }
  for (const name of cookieNames) {
    for (const cookieDomain of domains) {
      globalThis.document.cookie = `${name}=; max-age=0; path=/${cookieDomain}`;
    }
  }
}

function setGlobalIntercomSettings(settings: InitType) {
  const target = globalThis.window;
  if (target) {
    const apiBase = settings.api_base ?? target.intercomSettings?.api_base;
    target.intercomSettings = {
      ...settings,
      ...(apiBase ? { api_base: apiBase } : {}),
    };
  }
}

async function isCurrentSession(userId: string | null, generation: number) {
  const currentUserId = await getCurrentIntercomUserId();
  return generation === sessionGeneration && currentUserId === userId;
}

async function bootSession(userId: string | null, generation: number) {
  const sdk = await loadIntercomSdk();
  if (!(await isCurrentSession(userId, generation))) {
    return;
  }
  const appId = process.env.INTERCOM_APP_ID || 'vbbj4ssb';
  if (hasBooted && activeUserId !== null && activeUserId !== userId) {
    sdk.shutdown();
    clearIntercomCookies();
    setGlobalIntercomSettings({ app_id: appId });
    hasBooted = false;
    activeUserId = undefined;
    activeGeneration = 0;
  }
  const [credentials, languageOverride] = await Promise.all([
    userId ? getIntercomCredentials(userId) : undefined,
    getIntercomLanguageOverride(),
  ]);
  if (!(await isCurrentSession(userId, generation))) {
    return;
  }
  if (userId && !credentials) {
    return;
  }

  clearIntercomOpenOnBoot(appId);
  const bootSettings: InitType = {
    app_id: appId,
    hide_default_launcher: true,
    alignment: 'right',
    horizontal_padding: 10,
    vertical_padding: 55,
    ...(languageOverride ? { language_override: languageOverride } : {}),
    hide_notifications: !inAppMessagesVisible,
    theme_mode: currentTheme,
    ...(credentials ? { intercom_user_jwt: credentials.token } : {}),
  };
  setGlobalIntercomSettings(bootSettings);
  // The npm initializer only loads/updates the widget; reboot explicitly after shutdown.
  if (sdkInitialized || globalThis.window?.Intercom) {
    sdk.boot(bootSettings);
  } else {
    sdk.default(bootSettings);
  }
  sdkInitialized = true;
  hasBooted = true;
  activeUserId = userId;
  activeGeneration = generation;
  sdk.onUnreadCountChange((count: number) => {
    if (generation !== sessionGeneration) {
      return;
    }
    unreadRevision += 1;
    const revision = unreadRevision;
    void isCurrentSession(userId, generation)
      .then((current) => {
        if (
          current &&
          generation === sessionGeneration &&
          revision === unreadRevision
        ) {
          setUnreadCount(count);
        }
      })
      .catch(() => {
        console.warn('Failed to refresh Intercom unread state');
      });
  });
  sdk.onShow(() => {
    void (async () => {
      const instanceId = await getInstanceId();
      if (await isCurrentSession(userId, generation)) {
        sdk.trackEvent('client info', { instanceId });
      }
    })().catch(() => {
      console.warn('Failed to update Intercom client info');
    });
  });
}

export const initIntercom = async () => {
  // Desktop opens Intercom in an in-app webview instead of injecting the SDK.
  if (platformEnv.isDesktop) {
    return;
  }
  const userId = await getCurrentIntercomUserId();
  intercomOpenGuard.setIdentity(userId);
  if (intercomInitPromise && requestedUserId === userId) {
    return intercomInitPromise;
  }
  requestedUserId = userId;
  sessionGeneration += 1;
  const generation = sessionGeneration;
  setUnreadCount(0);
  const previous = intercomInitPromise ?? Promise.resolve();
  const operation = previous
    .catch(() => undefined)
    .then(() => bootSession(userId, generation));
  intercomInitPromise = operation;
  try {
    await operation;
    if (intercomInitPromise === operation && activeGeneration !== generation) {
      intercomInitPromise = undefined;
    }
  } catch (error) {
    if (intercomInitPromise === operation) {
      intercomInitPromise = undefined;
    }
    throw error;
  }
};

const openIntercom = async (
  params: IShowIntercomParams | undefined,
  expectedUserId: string | null,
  canPresent: () => boolean,
): Promise<boolean> => {
  if ((await getCurrentIntercomUserId()) !== expectedUserId) {
    throw new OneKeyLocalError('Intercom user changed; please try again');
  }
  await initIntercom();
  const userId = activeUserId;
  const generation = activeGeneration;
  if (
    userId !== expectedUserId ||
    !(await isCurrentSession(userId, generation))
  ) {
    throw new OneKeyLocalError('Intercom user changed; please try again');
  }
  const {
    show,
    showConversation,
    trackEvent,
    update: updateIntercom,
  } = await loadIntercomSdk();
  const [instanceIdValue, languageOverride, credentials] = await Promise.all([
    getInstanceId(),
    getIntercomLanguageOverride(),
    userId ? getIntercomCredentials(userId) : undefined,
  ]);

  if (!(await isCurrentSession(userId, generation))) {
    throw new OneKeyLocalError('Intercom user changed; please try again');
  }

  updateIntercom({
    theme_mode: currentTheme,
    ...(languageOverride ? { language_override: languageOverride } : {}),
    ...(credentials ? { intercom_user_jwt: credentials.token } : {}),
  });

  trackEvent('client info', {
    instanceId: instanceIdValue,
    requestId: params?.requestId,
  });

  // A lock during the awaits above already hid the Messenger; do not reopen.
  if (messengerLocked || !canPresent()) {
    return false;
  }
  if (params?.conversationId) {
    showConversation(params.conversationId);
  } else {
    show();
  }
  return true;
};

export const showIntercom = async (params?: IShowIntercomParams) => {
  if (platformEnv.isDesktop) {
    try {
      const userId = await getCurrentIntercomUserId();
      await intercomOpenGuard.run(userId, params, async (canPresent) => {
        const [instanceId, languageOverride, supportUrl] = await Promise.all([
          getInstanceId(),
          getIntercomLanguageOverride(),
          getIntercomSupportUrl(),
        ]);
        const url = buildIntercomUrl(supportUrl, {
          bridge: EIntercomBridge.Injected,
          instanceId,
          requestId: params?.requestId,
          conversationId: params?.conversationId,
          languageOverride,
        });
        await assertIntercomUserUnchanged(userId);
        if (!canPresent()) {
          return false;
        }
        // Lazy import: the web index must stay importable without pulling the
        // expo-linking based URL opener into non-desktop runtimes/tests.
        const { default: openUrlUtils } =
          await import('../../utils/openUrlUtils');
        openUrlUtils.openUrlInApp(url, 'Support', {
          hideHeaderRight: true,
          redirectExternalNavigation: true,
          disableBridge: true,
          intercomUserId: userId,
          ...(params?.conversationId
            ? { intercomConversationId: params.conversationId }
            : {}),
        });
        return true;
      });
    } catch (error) {
      notifyIntercomOpenFailed(error);
    }
    return;
  }
  try {
    const userId = await getCurrentIntercomUserId();
    await intercomOpenGuard.run(userId, params, (canPresent) =>
      openIntercom(params, userId, canPresent),
    );
  } catch (error) {
    notifyIntercomOpenFailed(error);
  }
};

// Export update for dynamic launcher visibility control
export const update = async (...args: Parameters<IIntercomSdk['update']>) => {
  // Desktop never loads the Intercom SDK: launcher visibility is controlled by
  // the in-app webview page instead.
  if (platformEnv.isDesktop) {
    return;
  }
  await initIntercom();
  const sdk = await loadIntercomSdk();
  return sdk.update({ ...args[0], theme_mode: currentTheme });
};
