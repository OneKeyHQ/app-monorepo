import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import type { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import keylessWebBridge from '@onekeyhq/shared/src/keylessWallet/keylessWebBridge';
import {
  EKeylessWebFlowStep,
  type IKeylessPendingLogin,
  type IKeylessWebSessionState,
  KEYLESS_WEB_HASH_KEYS,
} from '@onekeyhq/shared/src/keylessWallet/keylessWebTypes';
import {
  isKeylessWebAutoConnectOriginAllowed,
  isKeylessWebConnectAlertMessage,
} from '@onekeyhq/shared/src/keylessWallet/keylessWebUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EDAppConnectionModal,
  EModalRoutes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { getOneKeyExtensionStoreUrl } from '@onekeyhq/shared/src/utils/extensionStoreUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { waitForDataLoaded } from '@onekeyhq/shared/src/utils/promiseUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';

import { useRouteIsFocused } from '../useRouteIsFocused';

import keylessWebPendingLoginCache from './keylessWebPendingLoginCache';
import { useConnectExternalWallet } from './useConnectExternalWallet';
import { useOneKeyWalletDetection } from './useOneKeyWalletDetection';

const DEFAULT_KEYLESS_WEB_SESSION_STATE: IKeylessWebSessionState = {
  pluginInstalled: false,
  walletExists: false,
  siteConnected: false,
};

type IKeylessConnectAlertParams = {
  provider?: EOAuthSocialLoginProvider;
  nonce?: string;
};

type IKeylessConnectAlertSubscriber = {
  instanceId: string;
  isFocused: boolean;
  priority: number;
  executor: (params?: IKeylessConnectAlertParams) => Promise<void>;
};

const handledKeylessAlertNonceSet = new Set<string>();
const keylessConnectAlertSubscribers = new Map<
  string,
  IKeylessConnectAlertSubscriber
>();
let keylessConnectAlertOwnerId: string | undefined;
let keylessConnectAlertSubscriberPriority = 0;
let keylessConnectAlertWindowListener: ((event: Event) => void) | undefined;

function syncKeylessConnectAlertOwner() {
  let nextOwner: IKeylessConnectAlertSubscriber | undefined;

  keylessConnectAlertSubscribers.forEach((subscriber) => {
    if (
      !nextOwner ||
      Number(subscriber.isFocused) > Number(nextOwner.isFocused) ||
      (subscriber.isFocused === nextOwner.isFocused &&
        subscriber.priority > nextOwner.priority)
    ) {
      nextOwner = subscriber;
    }
  });

  keylessConnectAlertOwnerId = nextOwner?.instanceId;
}

function getKeylessConnectAlertOwner() {
  if (
    !keylessConnectAlertOwnerId ||
    !keylessConnectAlertSubscribers.has(keylessConnectAlertOwnerId)
  ) {
    syncKeylessConnectAlertOwner();
  }

  if (!keylessConnectAlertOwnerId) {
    return undefined;
  }

  return keylessConnectAlertSubscribers.get(keylessConnectAlertOwnerId);
}

function ensureKeylessConnectAlertWindowListener() {
  if (keylessConnectAlertWindowListener || !platformEnv.isWebDappMode) {
    return;
  }

  keylessConnectAlertWindowListener = (event: Event) => {
    const messageEvent = event as Event & { data?: unknown };
    if (!isKeylessWebConnectAlertMessage(messageEvent.data)) {
      return;
    }

    const activeOwner = getKeylessConnectAlertOwner();
    if (!activeOwner) {
      return;
    }

    const keylessProvider = messageEvent.data.provider;
    const keylessNonce = messageEvent.data.nonce;

    if (keylessNonce) {
      if (handledKeylessAlertNonceSet.has(keylessNonce)) {
        console.log(
          'connectOneKeyWalletSilently_skip_duplicate_alert',
          keylessNonce,
        );
        return;
      }
      handledKeylessAlertNonceSet.add(keylessNonce);
    }

    console.log('connectOneKeyWalletSilently_on_extension_message');
    void activeOwner.executor({
      provider: keylessProvider,
      nonce: keylessNonce,
    });
  };

  globalThis.addEventListener?.('message', keylessConnectAlertWindowListener);
}

function cleanupKeylessConnectAlertWindowListener() {
  if (
    keylessConnectAlertSubscribers.size > 0 ||
    !keylessConnectAlertWindowListener
  ) {
    return;
  }

  globalThis.removeEventListener?.(
    'message',
    keylessConnectAlertWindowListener,
  );
  keylessConnectAlertWindowListener = undefined;
  keylessConnectAlertOwnerId = undefined;
}

function parseHashState(url: URL) {
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  if (!hash) {
    return {
      hashPath: '',
      hashParams: new URLSearchParams(),
    };
  }

  const queryIndex = hash.indexOf('?');
  if (queryIndex >= 0) {
    return {
      hashPath: hash.slice(0, queryIndex),
      hashParams: new URLSearchParams(hash.slice(queryIndex + 1)),
    };
  }

  if (hash.includes('=')) {
    return {
      hashPath: '',
      hashParams: new URLSearchParams(hash),
    };
  }

  return {
    hashPath: hash,
    hashParams: new URLSearchParams(),
  };
}

function replaceHashState(
  url: URL,
  {
    hashPath,
    hashParams,
  }: {
    hashPath: string;
    hashParams: URLSearchParams;
  },
) {
  if (typeof globalThis.history?.replaceState !== 'function') {
    return;
  }

  const hashQuery = hashParams.toString();
  const nextHash = hashPath
    ? `${hashPath}${hashQuery ? `?${hashQuery}` : ''}`
    : hashQuery;
  const nextUrl = `${url.pathname}${url.search}${nextHash ? `#${nextHash}` : ''}`;
  const currentUrl = `${url.pathname}${url.search}${url.hash}`;

  if (nextUrl !== currentUrl) {
    globalThis.history.replaceState(null, '', nextUrl);
  }
}

function writePendingAutoConnectHashParams({
  provider,
  nonce,
}: {
  provider: EOAuthSocialLoginProvider;
  nonce: string;
}) {
  if (typeof globalThis.location?.href !== 'string') {
    return;
  }

  try {
    const currentUrl = new URL(globalThis.location.href);
    if (!isKeylessWebAutoConnectOriginAllowed(currentUrl)) {
      return;
    }

    const { hashPath, hashParams } = parseHashState(currentUrl);
    hashParams.set(KEYLESS_WEB_HASH_KEYS.provider, provider);
    hashParams.set(KEYLESS_WEB_HASH_KEYS.nonce, nonce);
    hashParams.delete(KEYLESS_WEB_HASH_KEYS.error);

    replaceHashState(currentUrl, { hashPath, hashParams });
  } catch {
    // ignore hash update failures
  }
}

function clearAutoConnectHashParams() {
  if (typeof globalThis.location?.href !== 'string') {
    return;
  }

  try {
    const currentUrl = new URL(globalThis.location.href);
    const { hashPath, hashParams } = parseHashState(currentUrl);

    hashParams.delete(KEYLESS_WEB_HASH_KEYS.origin);
    hashParams.delete(KEYLESS_WEB_HASH_KEYS.provider);
    hashParams.delete(KEYLESS_WEB_HASH_KEYS.status);
    hashParams.delete(KEYLESS_WEB_HASH_KEYS.nonce);
    hashParams.delete(KEYLESS_WEB_HASH_KEYS.at);
    hashParams.delete(KEYLESS_WEB_HASH_KEYS.error);

    replaceHashState(currentUrl, { hashPath, hashParams });
  } catch {
    // ignore hash cleanup failures
  }
}

function hasPendingAutoConnectHashParams() {
  if (typeof globalThis.location?.href !== 'string') {
    return false;
  }

  try {
    const currentUrl = new URL(globalThis.location.href);
    const { hashParams } = parseHashState(currentUrl);
    const provider = hashParams.get(KEYLESS_WEB_HASH_KEYS.provider);
    const nonce = hashParams.get(KEYLESS_WEB_HASH_KEYS.nonce);
    return Boolean(provider && nonce);
  } catch {
    return false;
  }
}

function clearAutoConnectHashParamsIfNeeded() {
  if (!platformEnv.isWebDappMode) {
    return;
  }
  if (!hasPendingAutoConnectHashParams()) {
    return;
  }
  clearAutoConnectHashParams();
}

export function useKeylessWebAutoConnectHashCleanup() {
  useEffect(() => {
    clearAutoConnectHashParamsIfNeeded();
  }, []);
}

function readActivePendingLogin(): IKeylessPendingLogin | undefined {
  const pendingLogin = keylessWebPendingLoginCache.readKeylessPendingLogin();
  if (!pendingLogin || pendingLogin.status !== 'pending') {
    return undefined;
  }
  return pendingLogin;
}

function buildSessionState({
  pluginInstalled,
  siteConnected,
  pendingLogin,
}: {
  pluginInstalled: boolean;
  siteConnected: boolean;
  pendingLogin?: IKeylessPendingLogin;
}): IKeylessWebSessionState {
  return {
    ...DEFAULT_KEYLESS_WEB_SESSION_STATE,
    pluginInstalled,
    siteConnected,
    pendingProvider: pendingLogin?.provider,
    pendingNonce: pendingLogin?.nonce,
  };
}

export function useKeylessWebConnectAlert() {
  const isFocused = useRouteIsFocused();
  const { isOneKeyInstalled, getOneKeyConnectionInfo } =
    useOneKeyWalletDetection();
  const { connectToWalletForKeylessSilently } = useConnectExternalWallet();
  const isConnectingRef = useRef(false);
  const instanceIdRef = useRef<string | undefined>(undefined);

  if (!instanceIdRef.current) {
    instanceIdRef.current = generateUUID();
  }

  const connectOneKeyWalletSilently = useCallback(
    async ({
      provider,
      nonce,
    }: {
      provider?: EOAuthSocialLoginProvider;
      nonce?: string;
    } = {}) => {
      if (!isOneKeyInstalled) {
        void openUrlExternal(getOneKeyExtensionStoreUrl());
        return;
      }

      const connectionInfo = getOneKeyConnectionInfo();
      if (!connectionInfo || isConnectingRef.current) {
        return;
      }

      isConnectingRef.current = true;
      try {
        await connectToWalletForKeylessSilently(
          connectionInfo,
          provider ? { provider, nonce } : undefined,
        );
      } finally {
        isConnectingRef.current = false;
      }
    },
    [
      connectToWalletForKeylessSilently,
      getOneKeyConnectionInfo,
      isOneKeyInstalled,
    ],
  );

  useEffect(() => {
    if (!platformEnv.isWebDappMode) {
      return;
    }

    const instanceId = instanceIdRef.current;
    if (!instanceId) {
      return;
    }

    keylessConnectAlertSubscribers.set(instanceId, {
      instanceId,
      isFocused,
      priority: (keylessConnectAlertSubscriberPriority += 1),
      executor: connectOneKeyWalletSilently,
    });
    syncKeylessConnectAlertOwner();
    ensureKeylessConnectAlertWindowListener();

    return () => {
      keylessConnectAlertSubscribers.delete(instanceId);
      syncKeylessConnectAlertOwner();
      cleanupKeylessConnectAlertWindowListener();
    };
  }, [connectOneKeyWalletSilently, isFocused]);
}

export function useKeylessWebFlow() {
  const [step, setStep] = useState<EKeylessWebFlowStep>(
    EKeylessWebFlowStep.Idle,
  );
  const [flowLoading, setFlowLoading] = useState(false);
  const [sessionState, setSessionState] = useState<IKeylessWebSessionState>(
    DEFAULT_KEYLESS_WEB_SESSION_STATE,
  );

  const { isOneKeyInstalled } = useOneKeyWalletDetection();

  const syncSessionState = useCallback(async () => {
    const pendingLogin = readActivePendingLogin();
    const nextState = buildSessionState({
      pluginInstalled: isOneKeyInstalled,
      siteConnected: step === EKeylessWebFlowStep.Connected,
      pendingLogin,
    });

    setSessionState(nextState);
    return nextState;
  }, [isOneKeyInstalled, step]);

  const startKeylessWebFlow = useCallback(
    async (provider: EOAuthSocialLoginProvider) => {
      if (flowLoading) {
        return;
      }

      setFlowLoading(true);
      try {
        const nonce = generateUUID();
        const pendingLogin =
          keylessWebPendingLoginCache.createKeylessPendingLogin({
            provider,
            nonce,
          });

        writePendingAutoConnectHashParams({
          provider,
          nonce,
        });

        setSessionState(
          buildSessionState({
            pluginInstalled: isOneKeyInstalled,
            siteConnected: false,
            pendingLogin,
          }),
        );
        setStep(EKeylessWebFlowStep.LoginLoading);
      } finally {
        setFlowLoading(false);
      }
    },
    [isOneKeyInstalled, flowLoading],
  );

  const resetKeylessFlow = useCallback(() => {
    const pendingLogin = keylessWebPendingLoginCache.readKeylessPendingLogin();
    keylessWebPendingLoginCache.clearKeylessPendingLogin({
      nonce: pendingLogin?.nonce,
    });
    clearAutoConnectHashParams();

    setStep(EKeylessWebFlowStep.Idle);
    setFlowLoading(false);
    setSessionState(
      buildSessionState({
        pluginInstalled: isOneKeyInstalled,
        siteConnected: false,
      }),
    );
  }, [isOneKeyInstalled]);

  useEffect(() => {
    clearAutoConnectHashParamsIfNeeded();

    const pendingLogin = readActivePendingLogin();
    if (!pendingLogin) {
      return;
    }

    setStep(EKeylessWebFlowStep.LoginLoading);
    setSessionState(
      buildSessionState({
        pluginInstalled: isOneKeyInstalled,
        siteConnected: false,
        pendingLogin,
      }),
    );
  }, [isOneKeyInstalled]);

  useEffect(() => {
    void syncSessionState();
  }, [syncSessionState]);

  const pendingLogin = readActivePendingLogin();

  const isKeylessFlowProcessing = useMemo(
    () =>
      flowLoading ||
      step === EKeylessWebFlowStep.InstallPrompt ||
      step === EKeylessWebFlowStep.LoginLoading,
    [flowLoading, step],
  );

  return {
    step,
    flowLoading,
    pendingLogin,
    sessionState,
    isKeylessFlowProcessing,
    startKeylessWebFlow,
    resetKeylessFlow,
    syncSessionState,
  };
}

export function useKeylessWebFlowAutoConnectDapp() {
  const pendingKeylessAutoConnectWalletIdRef = useRef<string | undefined>(
    undefined,
  );

  const setPendingKeylessAutoConnectWalletId = useCallback(
    (walletId: string | undefined) => {
      pendingKeylessAutoConnectWalletIdRef.current = walletId;
    },
    [],
  );

  const openKeylessAutoConnectDappModal = useCallback(async () => {
    const walletId = pendingKeylessAutoConnectWalletIdRef.current;
    pendingKeylessAutoConnectWalletIdRef.current = undefined;
    if (
      !walletId ||
      !platformEnv.isExtension ||
      !accountUtils.isKeylessWallet({ walletId })
    ) {
      return;
    }

    await waitForDataLoaded({
      data: () => appGlobals.$navigationRef?.current,
      logName: 'web_keyless_auto_connect_wait_navigationRef',
      wait: 1000,
      timeout: 10_000,
    });

    const navigationInstance = appGlobals.$navigationRef?.current;
    const autoConnectParams = await keylessWebBridge.clearTabWebHashAndReload();
    const autoConnectOrigin = autoConnectParams?.autoConnectOrigin;
    if (!autoConnectOrigin) {
      return;
    }

    const request = {
      origin: autoConnectOrigin,
      scope: IInjectedProviderNames.ethereum,
      data: {
        method: 'eth_requestAccounts',
      },
      isWalletConnectRequest: false,
    };

    const $sourceInfo: IDappSourceInfo = {
      id: stringUtils.generateUUID(),
      origin: request.origin,
      hostname: uriUtils.getHostNameFromUrl({
        url: request.origin,
      }),
      scope: request.scope,
      data: request.data as any,
      isWalletConnectRequest: !!request.isWalletConnectRequest,
    };

    const routeParams = {
      // stringify required, nested object not working with Ext route linking
      query: JSON.stringify(
        {
          $sourceInfo,
          keylessAutoConnectNonce: autoConnectParams?.nonce,
          _$t: Date.now(),
        },
        (key, value) =>
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          typeof value === 'bigint' ? value.toString() : value,
      ),
    };

    navigationInstance?.navigate?.(ERootRoutes.Modal, {
      screen: EModalRoutes.DAppConnectionModal,
      params: {
        screen: EDAppConnectionModal.ConnectionModal,
        params: routeParams,
      },
    });
  }, []);

  const notifyKeylessWebConnectSuccess = useCallback(
    async ({ nonce }: { nonce?: string } = {}) => {
      await keylessWebBridge.notifyKeylessWebConnectSuccess({
        nonce,
      });
    },
    [],
  );

  return {
    setPendingKeylessAutoConnectWalletId,
    openKeylessAutoConnectDappModal,
    notifyKeylessWebConnectSuccess,
  };
}
