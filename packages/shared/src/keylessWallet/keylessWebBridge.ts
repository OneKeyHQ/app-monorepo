/* eslint-disable no-continue */
import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import {
  ONBOARDING_FROM_EXT_PARAM,
  ONBOARDING_GET_STARTED_PATH,
} from '@onekeyhq/shared/src/consts/onboardingConsts';
import { KEYLESS_WEB_TAB_URL_PATTERNS } from '@onekeyhq/shared/src/keylessWallet/keylessWebTabUrlPatternsConstants';
import type {
  IAutoConnectParams,
  IKeylessWebConnectAlertMessage,
  IStoredPendingWebTab,
} from '@onekeyhq/shared/src/keylessWallet/keylessWebTypes';
import {
  KEYLESS_WEB_CONNECT_ALERT_MESSAGE_TYPE,
  KEYLESS_WEB_HASH_KEYS,
  KEYLESS_WEB_PENDING_TAB_STORAGE_KEY,
} from '@onekeyhq/shared/src/keylessWallet/keylessWebTypes';
import { isKeylessWebAutoConnectOriginAllowed } from '@onekeyhq/shared/src/keylessWallet/keylessWebUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOnboardingAutoConnectOrigin } from '@onekeyhq/shared/src/routes/onboardingv2';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';

let latestResolvedKeylessWebTab: IStoredPendingWebTab | undefined;

function readHashSearchParams(url: URL) {
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  if (!hash) {
    return new URLSearchParams();
  }
  const queryIndex = hash.indexOf('?');
  if (queryIndex >= 0) {
    return new URLSearchParams(hash.slice(queryIndex + 1));
  }
  if (hash.includes('=')) {
    return new URLSearchParams(hash);
  }
  return new URLSearchParams();
}

function readHashPath(url: URL) {
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  if (!hash) {
    return '';
  }
  const queryIndex = hash.indexOf('?');
  if (queryIndex >= 0) {
    return hash.slice(0, queryIndex);
  }
  if (hash.includes('=')) {
    return '';
  }
  return hash;
}

function buildHashWithParams(url: URL, params: URLSearchParams) {
  const hashPath = readHashPath(url);
  const hashQuery = params.toString();
  const nextHash = hashPath
    ? `${hashPath}${hashQuery ? `?${hashQuery}` : ''}`
    : hashQuery;

  return `${url.origin}${url.pathname}${url.search}${
    nextHash ? `#${nextHash}` : ''
  }`;
}

function parseProvider(
  rawProvider: string | null,
): EOAuthSocialLoginProvider | undefined {
  if (rawProvider === EOAuthSocialLoginProvider.Google) {
    return EOAuthSocialLoginProvider.Google;
  }
  if (rawProvider === EOAuthSocialLoginProvider.Apple) {
    return EOAuthSocialLoginProvider.Apple;
  }
  return undefined;
}

function normalizeAutoConnectOrigin(
  rawOrigin: string,
): IOnboardingAutoConnectOrigin | undefined {
  try {
    const parsed = new URL(rawOrigin);
    if (isKeylessWebAutoConnectOriginAllowed(parsed)) {
      return parsed.origin;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

async function updateTabHashUrl(
  tabId: number,
  updater: (params: URLSearchParams) => void,
) {
  if (!chrome.tabs?.get || !chrome.tabs?.update) {
    return;
  }

  const tab = await chrome.tabs.get(tabId);
  if (!tab.url) {
    return;
  }

  const url = new URL(tab.url);
  const params = readHashSearchParams(url);
  updater(params);

  const nextUrl = buildHashWithParams(url, params);
  if (nextUrl !== tab.url) {
    await chrome.tabs.update(tabId, { url: nextUrl });
  }
}

async function savePendingWebTabStorage(data: IStoredPendingWebTab) {
  await appStorage.setItem(
    KEYLESS_WEB_PENDING_TAB_STORAGE_KEY,
    JSON.stringify(data),
  );
}

async function savePendingWebTab(data: IStoredPendingWebTab) {
  if (
    typeof data.tabId !== 'number' ||
    !Number.isFinite(data.tabId) ||
    !data.autoConnectParams.nonce ||
    !data.autoConnectParams.autoConnectOrigin
  ) {
    return;
  }

  await savePendingWebTabStorage(data);
}

async function clearPendingWebTabStorage() {
  await appStorage.removeItem(KEYLESS_WEB_PENDING_TAB_STORAGE_KEY);
}

async function readPendingWebTabStorage(): Promise<
  IStoredPendingWebTab | undefined
> {
  try {
    const raw = await appStorage.getItem(KEYLESS_WEB_PENDING_TAB_STORAGE_KEY);
    if (!raw) {
      return undefined;
    }

    const parsed = JSON.parse(raw) as Partial<IStoredPendingWebTab> | undefined;
    const tabId = parsed?.tabId;
    const nonce = parsed?.autoConnectParams?.nonce;
    const rawOrigin = parsed?.autoConnectParams?.autoConnectOrigin;

    if (typeof tabId !== 'number' || !Number.isFinite(tabId)) {
      return undefined;
    }
    if (!nonce) {
      return undefined;
    }
    if (typeof rawOrigin !== 'string') {
      return undefined;
    }

    const autoConnectOrigin = normalizeAutoConnectOrigin(rawOrigin);
    if (!autoConnectOrigin) {
      return undefined;
    }

    const autoLoginKeylessProvider = parseProvider(
      parsed?.autoConnectParams?.autoLoginKeylessProvider ?? null,
    );

    return {
      tabId,
      autoConnectParams: {
        nonce,
        autoConnectOrigin,
        autoLoginKeylessProvider,
      },
      fromInitialInstall: parsed?.fromInitialInstall === true,
    };
  } catch {
    return undefined;
  }
}

async function clearTabWebHashAndReload(): Promise<
  IAutoConnectParams | undefined
> {
  if (!chrome.tabs?.get || !chrome.tabs?.update) {
    return undefined;
  }

  latestResolvedKeylessWebTab = undefined;

  const pendingWebTab = await readPendingWebTabStorage();
  if (!pendingWebTab) {
    return undefined;
  }

  try {
    const tab = await chrome.tabs.get(pendingWebTab.tabId);
    if (!tab.url) {
      return undefined;
    }

    const hashParams = readHashSearchParams(new URL(tab.url));
    const nonce = hashParams.get(KEYLESS_WEB_HASH_KEYS.nonce) ?? '';
    if (!nonce || nonce !== pendingWebTab.autoConnectParams.nonce) {
      return undefined;
    }

    // Only reload the web tab when coming from initial extension install.
    // In setup panel mode (extension already installed), the web page
    // receives a connect-success message instead and does not need a reload.
    if (pendingWebTab.fromInitialInstall) {
      await updateTabHashUrl(pendingWebTab.tabId, (params) => {
        params.delete(KEYLESS_WEB_HASH_KEYS.origin);
        params.delete(KEYLESS_WEB_HASH_KEYS.provider);
        params.delete(KEYLESS_WEB_HASH_KEYS.status);
        params.delete(KEYLESS_WEB_HASH_KEYS.nonce);
        params.delete(KEYLESS_WEB_HASH_KEYS.at);
        params.delete(KEYLESS_WEB_HASH_KEYS.error);
      });
    }

    latestResolvedKeylessWebTab = pendingWebTab;
    return pendingWebTab.autoConnectParams;
  } catch (error) {
    latestResolvedKeylessWebTab = undefined;
    console.error('clearWebHash', error);
    return undefined;
  } finally {
    await clearPendingWebTabStorage();
  }
}

async function notifyKeylessWebConnectSuccess({
  nonce,
}: {
  nonce?: string;
} = {}) {
  const pendingWebTab = latestResolvedKeylessWebTab;

  if (!pendingWebTab || !chrome.tabs?.sendMessage) {
    return;
  }
  if (!nonce || pendingWebTab.autoConnectParams.nonce !== nonce) {
    return;
  }

  latestResolvedKeylessWebTab = undefined;

  const payload: IKeylessWebConnectAlertMessage = {
    type: KEYLESS_WEB_CONNECT_ALERT_MESSAGE_TYPE,
    message: 'OneKey extension connected successfully.',
    timestamp: Date.now(),
    provider: pendingWebTab.autoConnectParams.autoLoginKeylessProvider,
    nonce: pendingWebTab.autoConnectParams.nonce,
  };

  try {
    await chrome.tabs.sendMessage(pendingWebTab.tabId, payload);
    console.log(
      'notifyKeylessWebConnectSuccess__832735',
      `await chrome.tabs.sendMessage(${pendingWebTab.tabId}, ${JSON.stringify(payload)})`,
    );
  } catch (error) {
    console.error('notifyKeylessWebConnectSuccess', error);
  }
}

function parsePendingRequestFromTabUrl(
  tabUrl: string,
): IAutoConnectParams | undefined {
  try {
    const url = new URL(tabUrl);
    const hashParams = readHashSearchParams(url);
    const status = hashParams.get(KEYLESS_WEB_HASH_KEYS.status);
    if (status && status !== 'pending') {
      return undefined;
    }

    const nonce = hashParams.get(KEYLESS_WEB_HASH_KEYS.nonce) ?? '';
    if (!nonce) {
      return undefined;
    }

    const autoConnectOrigin = normalizeAutoConnectOrigin(url.origin);
    if (!autoConnectOrigin) {
      return undefined;
    }

    const autoLoginKeylessProvider = parseProvider(
      hashParams.get(KEYLESS_WEB_HASH_KEYS.provider),
    );

    return {
      nonce,
      autoConnectOrigin,
      autoLoginKeylessProvider,
    };
  } catch {
    return undefined;
  }
}

async function openExtensionOnboardingGetStarts({
  nonce,
  autoConnectOrigin,
  autoLoginKeylessProvider,
}: IAutoConnectParams) {
  if (!chrome.tabs?.create) {
    return;
  }

  await extUtils.openExpandTab({
    // routes: [ // routes not working
    //   ERootRoutes.Onboarding,
    //   EOnboardingV2Routes.OnboardingV2,
    //   EOnboardingPagesV2.GetStarted,
    // ],
    path: ONBOARDING_GET_STARTED_PATH,
    params: {
      ...ONBOARDING_FROM_EXT_PARAM,
      autoConnectOrigin,
      autoLoginKeylessProvider,
      autoConnectNonce: nonce,
    },
  });

  // `chrome.sidePanel.open()` may only be called in response to a user gesture.
  // This scan runs from background lifecycle/events, so keep the old side-panel
  // code commented for future user-gesture entry points.
  // if (!chrome.sidePanel?.open || typeof tab.id !== 'number') {
  //   return;
  // }
  // await chrome.sidePanel.setOptions({
  //   tabId: tab.id,
  //   path: sidePanelPath,
  //   enabled: true,
  // });
  // if (tab.windowId) {
  //   await chrome.sidePanel.open({
  //     windowId: tab.windowId,
  //   });
  // }
}

async function scanWebLoginTabs() {
  if (!chrome.tabs?.query) {
    return;
  }

  const tabs = await chrome.tabs.query({
    url: KEYLESS_WEB_TAB_URL_PATTERNS,
  });

  for (const tab of tabs) {
    if (!tab.url || typeof tab.id !== 'number') {
      continue;
    }

    const autoConnectParams = parsePendingRequestFromTabUrl(tab.url);
    if (!autoConnectParams) {
      continue;
    }

    try {
      await savePendingWebTabStorage({
        tabId: tab.id,
        autoConnectParams,
        fromInitialInstall: true,
      });
      await openExtensionOnboardingGetStarts(autoConnectParams);
      break;
    } catch (error) {
      console.error('scanPendingTabsAndNotify', error);
      await clearPendingWebTabStorage();
    }
  }
}

function setupKeylessWebBridgeInBackground() {
  const runScan = () => {
    setTimeout(() => {
      void scanWebLoginTabs();
    }, 300);
  };

  chrome.runtime.onInstalled.addListener((details) => {
    // It triggers only during the initial installation;
    // it does not trigger when the extension is disabled and then re-enabled.
    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
      runScan();
      return;
    }
    if (
      platformEnv.isDev &&
      details.reason === chrome.runtime.OnInstalledReason.UPDATE
    ) {
      runScan();
    }
  });
}

export default {
  clearPendingWebTabStorage,
  clearTabWebHashAndReload,
  notifyKeylessWebConnectSuccess,
  savePendingWebTab,
  setupKeylessWebBridgeInBackground,
};
