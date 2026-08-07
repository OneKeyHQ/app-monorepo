import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Dialog,
  Icon,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  ICustomInjectionAutoReviewEvent,
  ICustomInjectionRecordingCommand,
  ICustomInjectionRecordingEvent,
  IElectronWebViewEvents,
} from '@onekeyhq/kit/src/components/WebView/types';
import { useBrowserTabActions } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import {
  logCustomInjectedClientError,
  logCustomInjectedClientOperation,
} from '@onekeyhq/kit/src/utils/customInjectedClientOperationLog';
import {
  acquireCustomInjectedProtocolSelectionLock,
  activateCustomInjectedProtocolRuntime,
  consumeCustomInjectedInitialProtocolUrl,
  deactivateCustomInjectedProtocolRuntime,
  getCustomInjectedProtocolSelectionLock,
  isCustomInjectedE2ECleanSessionAllowed,
  isCustomInjectedProtocolSelectionAllowed,
  markCustomInjectedProtocolRuntimeReady,
  subscribeCustomInjectedProtocolSelectionLock,
} from '@onekeyhq/kit/src/utils/customInjectedProtocolRuntime';
import type { ICustomInjectedProtocolRuntimeScope } from '@onekeyhq/kit/src/utils/customInjectedProtocolRuntime';
import {
  activateCustomInjectedWorkspace,
  deactivateCustomInjectedWorkspace,
  getActiveCustomInjectedWorkspace,
  setActiveCustomInjectedWorkspace,
  subscribeActiveCustomInjectedWorkspace,
  subscribeCustomInjectedProtocolSelection,
} from '@onekeyhq/kit/src/utils/customInjectedWorkspaceRuntime';
import type {
  ICustomInjectedClientOperationLogRequest,
  ICustomInjectedProtocol,
  ICustomInjectedSession,
} from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiWebview';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { isAllowedWebViewUrl } from '@onekeyhq/shared/src/utils/webViewUrlSafety';

import CustomInjectedToolbar from '../../components/CustomInjectedToolbar';
import HeaderRightToolBar from '../../components/HeaderRightToolBar';
import { useDAppNotifyChanges } from '../../hooks/useDAppNotifyChanges';
import {
  useActiveTabId,
  useWebTabDataById,
  useWebTabs,
} from '../../hooks/useWebTabs';
import { webviewRefs } from '../../utils/explorerUtils';
import { HistoryIconButton } from '../components/HistoryIconButton';

import DesktopBrowserContent from './DesktopBrowserContent';
import DesktopBrowserNavigationContainer from './DesktopBrowserNavigationContainer';
import { withBrowserProvider } from './WithBrowserProvider';

import type { IElectronWebView } from '@onekeyfe/cross-inpage-provider-types';

type ICustomInjectionRecordingState = {
  token: string;
  startOperationId: string;
  startOperationStartedAt: number;
  recorderOperationId?: string;
  recorderOperationStartedAt?: number;
  stopOperationId?: string;
  stopOperationStartedAt?: number;
  partition: string;
  tabId: string;
  sessionId: string;
  protocolId: string;
  bundleSha256: string;
  expectedRegistrySha256: string;
  phase: 'preparing' | 'recording' | 'stopping' | 'saving';
};

type ICustomInjectionE2EPassState = {
  operationId: string;
  partition: string;
  tabId: string;
};

type ICustomInjectionE2EPassReadyWaiter = {
  operationId: string;
  resolve: (ready: boolean) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type ICustomInjectionPendingE2EGeneration = {
  sessionId: string;
  protocolId: string;
  stepCount: number;
};

type ICustomInjectionProtocolNavigation = {
  expectedHostname: string;
  initialNavigationStarted: boolean;
  instanceKey: string;
  protocolId: string;
  redirectHostname?: string;
  redirectUrl?: string;
  sessionId: string;
  tabId: string;
};

type ICustomInjectionWebViewInstance = ICustomInjectedProtocolRuntimeScope & {
  url: string;
};

function safeCustomInjectionUrl(url: string) {
  if (!isAllowedWebViewUrl(url)) {
    return undefined;
  }
  const parsed = new URL(url);
  return {
    hostname: parsed.hostname.toLowerCase(),
    url: parsed.origin,
  };
}

const RECORDING_STOP_TIMEOUT_MS = 15_000;
const E2E_PASS_READY_TIMEOUT_MS = 45_000;

export function DevelopmentDesktopBrowser() {
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();
  const { tab: activeTab } = useWebTabDataById(activeTabId ?? '');
  const isHomeType = activeTab?.type === 'home';
  const { addBrowserHomeTab, setWebTabData } = useBrowserTabActions().current;
  const [customSession, setCustomSession] = useState(
    getActiveCustomInjectedWorkspace,
  );
  const [selectedProtocolId, setSelectedProtocolId] = useState<string>();
  const [customInjectionWebViewInstance, setCustomInjectionWebViewInstance] =
    useState<ICustomInjectionWebViewInstance>();
  const customInjectionWebViewInstanceRef = useRef<
    ICustomInjectionWebViewInstance | undefined
  >(undefined);
  const [recordingState, setRecordingState] =
    useState<ICustomInjectionRecordingState>();
  const [e2ePassState, setE2EPassState] =
    useState<ICustomInjectionE2EPassState>();
  const [pendingE2EGeneration, setPendingE2EGeneration] =
    useState<ICustomInjectionPendingE2EGeneration>();
  const [e2eGenerating, setE2EGenerating] = useState(false);
  const [protocolSwitchingLocked, setProtocolSwitchingLocked] = useState(() =>
    Boolean(getCustomInjectedProtocolSelectionLock()),
  );
  const autoReviewInFlightRef = useRef(new Set<string>());
  const activeE2EPassKeyRef = useRef<string | undefined>(undefined);
  const e2ePassRequestRef = useRef(0);
  const e2ePassReadyWaiterRef = useRef<
    ICustomInjectionE2EPassReadyWaiter | undefined
  >(undefined);
  const e2eGenerationStopRequestedRef = useRef(false);
  const progressPersistenceQueueRef = useRef(Promise.resolve());
  const protocolNavigationRef = useRef<
    ICustomInjectionProtocolNavigation | undefined
  >(undefined);
  const redirectPromptRef = useRef<
    | {
        dialog: ReturnType<typeof Dialog.show>;
        key: string;
      }
    | undefined
  >(undefined);
  const [devSettings] = useDevSettingsPersistAtom();
  const customInjection = devSettings.settings?.customInjection;
  const isCustomInjectionAllowed = Boolean(
    devSettings.enabled &&
    customInjection?.enabled &&
    customInjection.workspace,
  );
  const effectiveCustomSession = isCustomInjectionAllowed
    ? customSession
    : undefined;
  const isSelectedProtocolAutoReviewable = Boolean(
    effectiveCustomSession?.protocols.some(
      (protocol) =>
        protocol.key === selectedProtocolId &&
        protocol.manualReview.state !== 'processed',
    ),
  );

  useEffect(
    () =>
      subscribeActiveCustomInjectedWorkspace((session) => {
        setCustomSession(session);
      }),
    [],
  );

  useEffect(
    () =>
      subscribeCustomInjectedProtocolSelectionLock((lock) => {
        setProtocolSwitchingLocked(Boolean(lock));
      }),
    [],
  );

  useEffect(() => {
    if (!isCustomInjectionAllowed || !customInjection?.workspace) {
      void deactivateCustomInjectedWorkspace();
      return;
    }
    void activateCustomInjectedWorkspace({
      workspace: customInjection.workspace,
      devSettingsEnabled: devSettings.enabled,
      customInjectionEnabled: customInjection.enabled,
    }).catch((error) => {
      setActiveCustomInjectedWorkspace(undefined);
      console.warn('Unable to restore Custom Injection', error);
    });
  }, [
    customInjection?.enabled,
    customInjection?.workspace,
    devSettings.enabled,
    isCustomInjectionAllowed,
  ]);

  useEffect(() => {
    appEventBus.on(EAppEventBusNames.CreateNewBrowserTab, addBrowserHomeTab);
    return () => {
      appEventBus.off(EAppEventBusNames.CreateNewBrowserTab, addBrowserHomeTab);
    };
  }, [addBrowserHomeTab]);

  useDAppNotifyChanges({ tabId: activeTabId });

  // Sort tabs by id to maintain stable order and prevent re-renders
  const orderTabs = useMemo(
    () => tabs.toSorted((a, b) => a.id.localeCompare(b.id)),
    [tabs],
  );

  const renderHeaderRight = useCallback(() => {
    if (isHomeType) {
      return <HistoryIconButton />;
    }
    return <HeaderRightToolBar />;
  }, [isHomeType]);

  const dismissRedirectPrompt = useCallback(() => {
    const prompt = redirectPromptRef.current;
    redirectPromptRef.current = undefined;
    if (prompt) {
      void prompt.dialog.close();
    }
  }, []);

  const replaceCustomInjectionWebViewInstance = useCallback(
    (
      instance: ICustomInjectionWebViewInstance | undefined,
      options?: { lockToken?: string },
    ) => {
      if (
        instance &&
        !isCustomInjectedProtocolSelectionAllowed({
          lockToken: options?.lockToken,
          sessionId: instance.sessionId,
        })
      ) {
        return false;
      }
      const previous = customInjectionWebViewInstanceRef.current;
      if (instance) {
        activateCustomInjectedProtocolRuntime({
          instanceKey: instance.instanceKey,
          protocolId: instance.protocolId,
          sessionId: instance.sessionId,
          tabId: instance.tabId,
        });
      } else if (previous) {
        deactivateCustomInjectedProtocolRuntime(previous);
      }
      customInjectionWebViewInstanceRef.current = instance;
      setCustomInjectionWebViewInstance(instance);
      return true;
    },
    [],
  );

  const settleCustomInjectionE2EPassReady = useCallback(
    (operationId: string | undefined, ready: boolean) => {
      const waiter = e2ePassReadyWaiterRef.current;
      if (!waiter || (operationId && waiter.operationId !== operationId)) {
        return;
      }
      e2ePassReadyWaiterRef.current = undefined;
      clearTimeout(waiter.timeout);
      waiter.resolve(ready);
    },
    [],
  );

  const resetCustomInjectionE2EPass = useCallback(() => {
    e2ePassRequestRef.current += 1;
    activeE2EPassKeyRef.current = undefined;
    settleCustomInjectionE2EPassReady(undefined, false);
    setE2EPassState(undefined);
  }, [settleCustomInjectionE2EPassReady]);

  const beginProtocolNavigation = useCallback(
    (
      protocol: ICustomInjectedProtocol,
      session: ICustomInjectedSession,
      tabId: string,
      instanceKey: string,
    ) => {
      dismissRedirectPrompt();
      const expected = safeCustomInjectionUrl(protocol.url);
      protocolNavigationRef.current = expected
        ? {
            expectedHostname: expected.hostname,
            initialNavigationStarted: false,
            instanceKey,
            protocolId: protocol.key,
            sessionId: session.sessionId,
            tabId,
          }
        : undefined;
    },
    [dismissRedirectPrompt],
  );

  const selectCustomInjectedProtocol = useCallback(
    (
      protocol: ICustomInjectedProtocol,
      nextCustomSession: ICustomInjectedSession,
      options?: { lockToken?: string },
    ) => {
      if (
        !activeTab?.id ||
        recordingState ||
        e2eGenerating ||
        !isCustomInjectedProtocolSelectionAllowed({
          lockToken: options?.lockToken,
          sessionId: nextCustomSession.sessionId,
        })
      ) {
        return;
      }
      const operationId = stringUtils.generateUUID();
      const startedAt = Date.now();
      logCustomInjectedClientOperation({
        sessionId: nextCustomSession.sessionId,
        protocolId: protocol.key,
        operationId,
        operation: 'protocol.select',
        status: 'start',
        input: { tabId: activeTab.id },
      });
      try {
        beginProtocolNavigation(
          protocol,
          nextCustomSession,
          activeTab.id,
          operationId,
        );
        setActiveCustomInjectedWorkspace(nextCustomSession);
        setSelectedProtocolId(protocol.key);
        const scope = {
          instanceKey: operationId,
          protocolId: protocol.key,
          sessionId: nextCustomSession.sessionId,
          tabId: activeTab.id,
          url: protocol.url,
        };
        replaceCustomInjectionWebViewInstance(scope, options);
        setWebTabData({
          id: activeTab.id,
          url: protocol.url,
          title: protocol.name,
        });
        logCustomInjectedClientOperation({
          sessionId: nextCustomSession.sessionId,
          protocolId: protocol.key,
          operationId,
          operation: 'protocol.select',
          status: 'result',
          durationMs: Date.now() - startedAt,
          result: { tabId: activeTab.id, url: protocol.url },
        });
        return scope;
      } catch (error) {
        logCustomInjectedClientOperation({
          sessionId: nextCustomSession.sessionId,
          protocolId: protocol.key,
          operationId,
          operation: 'protocol.select',
          status: 'error',
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [
      activeTab?.id,
      beginProtocolNavigation,
      e2eGenerating,
      recordingState,
      replaceCustomInjectionWebViewInstance,
      setWebTabData,
    ],
  );

  const handleCustomInjectionDidStartNavigation = useCallback<
    (
      event: Parameters<
        NonNullable<IElectronWebViewEvents['onDidStartNavigation']>
      >[0],
      instanceKey?: string,
    ) => void
  >(
    (event, instanceKey) => {
      const navigation = protocolNavigationRef.current;
      if (
        !navigation ||
        navigation.instanceKey !== instanceKey ||
        customInjectionWebViewInstanceRef.current?.instanceKey !==
          instanceKey ||
        !event.isMainFrame ||
        event.isInPlace
      ) {
        return;
      }
      const target = safeCustomInjectionUrl(event.url);
      if (!target || navigation.tabId !== activeTab?.id) {
        protocolNavigationRef.current = undefined;
        return;
      }
      if (!navigation.initialNavigationStarted) {
        if (target.hostname === navigation.expectedHostname) {
          navigation.initialNavigationStarted = true;
        } else {
          protocolNavigationRef.current = undefined;
        }
        return;
      }

      // A server redirect does not start a second navigation. Seeing one here
      // means the page or user initiated a new navigation, so the selection
      // can no longer authenticate a later redirect.
      protocolNavigationRef.current = undefined;
    },
    [activeTab?.id],
  );

  const handleCustomInjectionDidRedirectNavigation = useCallback<
    (
      event: Parameters<
        NonNullable<IElectronWebViewEvents['onDidRedirectNavigation']>
      >[0],
      instanceKey?: string,
    ) => void
  >(
    (event, instanceKey) => {
      const navigation = protocolNavigationRef.current;
      if (
        !navigation?.initialNavigationStarted ||
        navigation.instanceKey !== instanceKey ||
        customInjectionWebViewInstanceRef.current?.instanceKey !==
          instanceKey ||
        !event.isMainFrame ||
        event.isInPlace ||
        navigation.tabId !== activeTab?.id
      ) {
        return;
      }
      const target = safeCustomInjectionUrl(event.url);
      if (!target || target.hostname === navigation.expectedHostname) {
        navigation.redirectHostname = undefined;
        navigation.redirectUrl = undefined;
        return;
      }
      navigation.redirectHostname = target.hostname;
      navigation.redirectUrl = target.url;
    },
    [activeTab?.id],
  );

  const handleCustomInjectionNavigationSettled = useCallback(
    (loaded: boolean, instanceKey?: string) => {
      const navigation = protocolNavigationRef.current;
      if (
        !navigation ||
        navigation.instanceKey !== instanceKey ||
        customInjectionWebViewInstanceRef.current?.instanceKey !== instanceKey
      ) {
        return;
      }
      protocolNavigationRef.current = undefined;
      const currentSession = getActiveCustomInjectedWorkspace();
      if (
        !loaded ||
        !navigation.redirectHostname ||
        !navigation.redirectUrl ||
        navigation.sessionId !== currentSession?.sessionId ||
        navigation.tabId !== activeTab?.id
      ) {
        return;
      }
      const protocol = currentSession.protocols.find(
        (candidate) => candidate.key === navigation.protocolId,
      );
      if (!protocol) {
        return;
      }

      const redirectHostname = navigation.redirectHostname;
      const redirectUrl = navigation.redirectUrl;
      const redirectError =
        `Custom injection protocol hostname mismatch for "${protocol.key}": ` +
        `actual="${redirectHostname}" (redirected WebView), ` +
        `expected="${navigation.expectedHostname}" (selected protocol). ` +
        'Update the protocol URL to continue automatic review.';
      logCustomInjectedClientOperation({
        sessionId: navigation.sessionId,
        protocolId: protocol.key,
        operationId: stringUtils.generateUUID(),
        operation: 'protocol.redirect',
        status: 'error',
        input: {
          actualUrl: redirectUrl,
          expectedUrl: protocol.url,
        },
        error: redirectError,
      });
      dismissRedirectPrompt();
      const promptKey = `${navigation.sessionId}:${navigation.protocolId}:${redirectUrl}`;
      const clearPrompt = () => {
        if (redirectPromptRef.current?.key === promptKey) {
          redirectPromptRef.current = undefined;
        }
      };
      const dialog = Dialog.show({
        title: 'Protocol URL changed',
        tone: 'warning',
        showCancelButton: true,
        onCancelText: 'Keep old URL',
        onConfirmText: 'Update URL',
        renderContent: (
          <YStack gap="$3">
            <YStack
              borderWidth={1}
              borderColor="$borderSubdued"
              borderRadius="$3"
              overflow="hidden"
            >
              <XStack gap="$3" px="$3" py="$2.5" bg="$bgSubdued">
                <SizableText
                  width={64}
                  flexShrink={0}
                  size="$bodySmMedium"
                  color="$textSubdued"
                >
                  Old URL
                </SizableText>
                <SizableText
                  testID="custom-injected-redirect-old-url"
                  flex={1}
                  size="$bodySm"
                  fontFamily="$monoRegular"
                  userSelect="text"
                  style={{ wordBreak: 'break-all' }}
                >
                  {protocol.url}
                </SizableText>
              </XStack>
              <Stack height={1} bg="$borderSubdued" />
              <XStack gap="$3" px="$3" py="$2.5" bg="$bgCautionSubdued">
                <SizableText
                  width={64}
                  flexShrink={0}
                  size="$bodySmMedium"
                  color="$textCaution"
                >
                  New URL
                </SizableText>
                <SizableText
                  testID="custom-injected-redirect-new-url"
                  flex={1}
                  size="$bodySmMedium"
                  fontFamily="$monoRegular"
                  userSelect="text"
                  style={{ wordBreak: 'break-all' }}
                >
                  {redirectUrl}
                </SizableText>
              </XStack>
            </YStack>
            <XStack gap="$2" alignItems="center">
              <Icon name="InfoCircleOutline" size="$4" color="$iconCaution" />
              <SizableText size="$bodySm" color="$textSubdued">
                Update only if you trust the new URL.
              </SizableText>
            </XStack>
          </YStack>
        ),
        onCancel: clearPrompt,
        onClose: clearPrompt,
        onConfirm: async () => {
          const rejectRedirectUpdate = (message: string): never => {
            logCustomInjectedClientError({
              sessionId: navigation.sessionId,
              protocolId: navigation.protocolId,
              operation: 'protocol.redirect.update',
              input: {
                actualUrl: redirectUrl,
                expectedUrl: protocol.url,
              },
              error: message,
            });
            throw new OneKeyLocalError(message);
          };
          if (
            customInjectionWebViewInstanceRef.current?.instanceKey !==
            navigation.instanceKey
          ) {
            rejectRedirectUpdate(
              'The protocol changed after the redirect was detected. Select it again to retry.',
            );
          }
          const currentUrl = (() => {
            try {
              const webview = webviewRefs[navigation.tabId]?.innerRef as
                | IElectronWebView
                | undefined;
              return webview?.getURL();
            } catch {
              return undefined;
            }
          })();
          if (
            safeCustomInjectionUrl(currentUrl || '')?.hostname !==
            redirectHostname
          ) {
            rejectRedirectUpdate(
              'The page changed after the redirect was detected. Select the protocol again to retry.',
            );
          }

          const latestSession =
            await globalThis.desktopApiProxy.webview.getCustomInjectedWorkspace(
              navigation.sessionId,
            );
          const latestProtocol = latestSession.protocols.find(
            (candidate) => candidate.key === navigation.protocolId,
          );
          if (!latestProtocol) {
            return rejectRedirectUpdate('Custom Injection protocol not found');
          }
          const confirmedLatestProtocol = latestProtocol;
          const latestUrl = safeCustomInjectionUrl(confirmedLatestProtocol.url);
          if (latestUrl?.hostname === redirectHostname) {
            setCustomSession(latestSession);
            setActiveCustomInjectedWorkspace(latestSession);
            clearPrompt();
            return;
          }
          if (latestUrl?.hostname !== navigation.expectedHostname) {
            rejectRedirectUpdate(
              'The saved protocol URL changed after the redirect was detected. Select the protocol again to retry.',
            );
          }

          const next =
            await globalThis.desktopApiProxy.webview.updateCustomInjectedProtocol(
              {
                action: 'set-url',
                sessionId: latestSession.sessionId,
                protocolId: confirmedLatestProtocol.key,
                expectedRegistrySha256: confirmedLatestProtocol.registrySha256,
                url: redirectUrl,
              },
            );
          if (
            customInjectionWebViewInstanceRef.current?.instanceKey !==
            navigation.instanceKey
          ) {
            rejectRedirectUpdate(
              'The protocol changed while its URL was being updated. Select it again to continue.',
            );
          }
          setCustomSession(next);
          setActiveCustomInjectedWorkspace(next);
          clearPrompt();
          const updatedProtocol = next.protocols.find(
            (candidate) => candidate.key === navigation.protocolId,
          );
          if (updatedProtocol) {
            selectCustomInjectedProtocol(updatedProtocol, next);
          }
        },
      });
      redirectPromptRef.current = { dialog, key: promptKey };
    },
    [activeTab?.id, dismissRedirectPrompt, selectCustomInjectedProtocol],
  );

  useEffect(
    () =>
      subscribeCustomInjectedProtocolSelection(selectCustomInjectedProtocol),
    [selectCustomInjectedProtocol],
  );

  useEffect(() => {
    protocolNavigationRef.current = undefined;
    dismissRedirectPrompt();
  }, [activeTab?.id, dismissRedirectPrompt, effectiveCustomSession?.sessionId]);

  useEffect(
    () => () => {
      dismissRedirectPrompt();
      const currentScope = customInjectionWebViewInstanceRef.current;
      if (currentScope) {
        deactivateCustomInjectedProtocolRuntime(currentScope);
      }
    },
    [dismissRedirectPrompt],
  );

  const handleCustomInjectionDomReady = useCallback(
    (instanceKey?: string, e2ePassKey?: string) => {
      const currentScope = customInjectionWebViewInstanceRef.current;
      if (
        !currentScope ||
        currentScope.instanceKey !== instanceKey ||
        activeE2EPassKeyRef.current !== e2ePassKey
      ) {
        return;
      }
      markCustomInjectedProtocolRuntimeReady(currentScope);
      if (e2ePassKey) {
        settleCustomInjectionE2EPassReady(e2ePassKey, true);
      }
    },
    [settleCustomInjectionE2EPassReady],
  );

  useEffect(() => {
    if (!effectiveCustomSession) {
      setSelectedProtocolId(undefined);
      replaceCustomInjectionWebViewInstance(undefined);
      return;
    }
    if (
      customInjectionWebViewInstance?.sessionId ===
      effectiveCustomSession.sessionId
    ) {
      if (
        customInjectionWebViewInstance.tabId === activeTab?.id &&
        selectedProtocolId &&
        customInjectionWebViewInstance.protocolId === selectedProtocolId &&
        effectiveCustomSession.protocols.some(
          (protocol) => protocol.key === selectedProtocolId,
        )
      ) {
        const isInitialProtocolNavigationPending =
          protocolNavigationRef.current?.instanceKey ===
          customInjectionWebViewInstance.instanceKey;
        if (
          !isInitialProtocolNavigationPending &&
          activeTab.url &&
          customInjectionWebViewInstance.url !== activeTab.url
        ) {
          const nextInstance = {
            ...customInjectionWebViewInstance,
            url: activeTab.url,
          };
          customInjectionWebViewInstanceRef.current = nextInstance;
          setCustomInjectionWebViewInstance(nextInstance);
        }
        return;
      }
    }

    const protocol =
      effectiveCustomSession.protocols.find(
        (candidate) =>
          candidate.key === customInjection?.lastSelectedProtocolId,
      ) ??
      effectiveCustomSession.protocols.find(
        (candidate) =>
          candidate.source === 'defillama' &&
          candidate.id === customInjection?.lastSelectedProtocolId,
      ) ??
      effectiveCustomSession.protocols.find(
        (candidate) => candidate.id === customInjection?.lastSelectedProtocolId,
      ) ??
      effectiveCustomSession.protocols.find(
        (candidate) => candidate.manualReview.state === 'pending',
      ) ??
      effectiveCustomSession.protocols[0];
    if (!protocol || !activeTab?.id || e2eGenerating) {
      return;
    }
    if (
      !isCustomInjectedProtocolSelectionAllowed({
        sessionId: effectiveCustomSession.sessionId,
      })
    ) {
      return;
    }

    const instanceKey = stringUtils.generateUUID();
    const shouldApplyInitialProtocolUrl =
      consumeCustomInjectedInitialProtocolUrl();
    const runtimeUrl = shouldApplyInitialProtocolUrl
      ? protocol.url
      : activeTab.url;
    if (!runtimeUrl) {
      return;
    }
    if (shouldApplyInitialProtocolUrl) {
      beginProtocolNavigation(
        protocol,
        effectiveCustomSession,
        activeTab.id,
        instanceKey,
      );
      setWebTabData({
        id: activeTab.id,
        url: protocol.url,
        title: protocol.name,
      });
    } else {
      protocolNavigationRef.current = undefined;
      dismissRedirectPrompt();
    }
    setSelectedProtocolId(protocol.key);
    replaceCustomInjectionWebViewInstance({
      instanceKey,
      protocolId: protocol.key,
      sessionId: effectiveCustomSession.sessionId,
      tabId: activeTab.id,
      url: runtimeUrl,
    });
  }, [
    activeTab?.id,
    activeTab?.url,
    beginProtocolNavigation,
    customInjection?.lastSelectedProtocolId,
    customInjectionWebViewInstance,
    effectiveCustomSession,
    e2eGenerating,
    dismissRedirectPrompt,
    protocolSwitchingLocked,
    replaceCustomInjectionWebViewInstance,
    selectedProtocolId,
    setWebTabData,
  ]);

  useEffect(() => {
    if (
      !effectiveCustomSession ||
      !selectedProtocolId ||
      customInjection?.lastSelectedProtocolId === selectedProtocolId
    ) {
      return;
    }
    const { workspace } = effectiveCustomSession;
    progressPersistenceQueueRef.current = progressPersistenceQueueRef.current
      .then(async () => {
        const latestDevSettings =
          await backgroundApiProxy.serviceDevSetting.getDevSetting();
        const latestConfig = latestDevSettings.settings?.customInjection;
        if (
          !latestConfig ||
          latestConfig.workspace !== workspace ||
          latestConfig.lastSelectedProtocolId === selectedProtocolId
        ) {
          return;
        }
        await backgroundApiProxy.serviceDevSetting.updateDevSetting(
          'customInjection',
          {
            ...latestConfig,
            lastSelectedProtocolId: selectedProtocolId,
          },
        );
      })
      .catch((error) => {
        console.warn('Unable to persist Custom Injection progress', error);
        logCustomInjectedClientError({
          sessionId: effectiveCustomSession.sessionId,
          protocolId: selectedProtocolId,
          operation: 'workspace.progress.persist',
          error,
        });
      });
  }, [
    customInjection?.lastSelectedProtocolId,
    effectiveCustomSession,
    selectedProtocolId,
  ]);

  const reloadCustomInjectedWebView = useCallback(
    (nextCustomSession: ICustomInjectedSession, expectedProtocolId: string) => {
      if (
        customInjectionWebViewInstanceRef.current?.protocolId !==
        expectedProtocolId
      ) {
        return;
      }
      const protocol = nextCustomSession.protocols.find(
        (candidate) => candidate.key === expectedProtocolId,
      );
      if (protocol) {
        selectCustomInjectedProtocol(protocol, nextCustomSession);
        return;
      }
      setActiveCustomInjectedWorkspace(nextCustomSession);
      setSelectedProtocolId(undefined);
      replaceCustomInjectionWebViewInstance(undefined);
    },
    [replaceCustomInjectionWebViewInstance, selectCustomInjectedProtocol],
  );

  const getCurrentCustomInjectedWebViewUrl = useCallback(() => {
    const fallbackUrl = activeTab?.url;
    if (!activeTab?.id) {
      return fallbackUrl;
    }
    try {
      const webview = webviewRefs[activeTab.id]?.innerRef as
        | IElectronWebView
        | undefined;
      return webview?.getURL() || fallbackUrl;
    } catch (error) {
      if (effectiveCustomSession) {
        logCustomInjectedClientError({
          sessionId: effectiveCustomSession.sessionId,
          protocolId: selectedProtocolId,
          operation: 'webview.url.read',
          error,
        });
      }
      return fallbackUrl;
    }
  }, [
    activeTab?.id,
    activeTab?.url,
    effectiveCustomSession,
    selectedProtocolId,
  ]);

  const handleCustomInjectionAutoReview = useCallback(
    async (
      event: ICustomInjectionAutoReviewEvent,
      instanceKey?: string,
      e2ePassKey?: string,
    ) => {
      const session = effectiveCustomSession;
      const protocol = session?.protocols.find(
        (candidate) => candidate.key === selectedProtocolId,
      );
      if (
        customInjectionWebViewInstanceRef.current?.instanceKey !==
          instanceKey ||
        customInjectionWebViewInstanceRef.current?.protocolId !==
          protocol?.key ||
        activeE2EPassKeyRef.current !== e2ePassKey ||
        !session ||
        !protocol ||
        protocol.manualReview.state === 'processed' ||
        devSettings.enabled !== true ||
        customInjection?.enabled !== true
      ) {
        return;
      }
      const inFlightKey = `${session.sessionId}:${protocol.key}:${session.bundleSha256}:${
        e2ePassKey || 'default'
      }`;
      if (autoReviewInFlightRef.current.has(inFlightKey)) {
        return;
      }
      autoReviewInFlightRef.current.add(inFlightKey);
      try {
        const result =
          await globalThis.desktopApiProxy.webview.processCustomInjectedAutoReview(
            {
              sessionId: session.sessionId,
              protocolId: protocol.key,
              pageUrl: event.pageUrl,
              webContentsId: event.webContentsId,
              bundleSha256: session.bundleSha256,
              expectedRegistrySha256: protocol.registrySha256,
              devSettingsEnabled: devSettings.enabled,
              customInjectionEnabled: customInjection.enabled,
            },
          );
        const currentInstance = customInjectionWebViewInstanceRef.current;
        if (
          currentInstance &&
          currentInstance.instanceKey === instanceKey &&
          currentInstance.sessionId === session.sessionId &&
          currentInstance.protocolId === protocol.key &&
          activeE2EPassKeyRef.current === e2ePassKey
        ) {
          setActiveCustomInjectedWorkspace(result.session);
        }
      } catch (error) {
        console.warn('Custom Injection auto-review was rejected', error);
      } finally {
        autoReviewInFlightRef.current.delete(inFlightKey);
      }
    },
    [
      customInjection?.enabled,
      devSettings.enabled,
      effectiveCustomSession,
      selectedProtocolId,
    ],
  );

  const startCustomInjectionRecording = useCallback(() => {
    const session = effectiveCustomSession;
    const protocol = session?.protocols.find(
      (candidate) => candidate.key === selectedProtocolId,
    );
    if (
      !session ||
      !protocol ||
      !activeTab?.id ||
      recordingState ||
      !isCustomInjectedProtocolSelectionAllowed({
        sessionId: session.sessionId,
      })
    ) {
      return;
    }
    const token = stringUtils.generateUUID();
    const operationId = stringUtils.generateUUID();
    const operationStartedAt = Date.now();
    logCustomInjectedClientOperation({
      sessionId: session.sessionId,
      protocolId: protocol.key,
      operationId,
      operation: 'recording.start',
      status: 'start',
      input: { tabId: activeTab.id, bundleSha256: session.bundleSha256 },
    });
    resetCustomInjectionE2EPass();
    setWebTabData({
      id: activeTab.id,
      url: protocol.url,
      title: protocol.name,
    });
    setRecordingState({
      token,
      startOperationId: operationId,
      startOperationStartedAt: operationStartedAt,
      partition: `onekey-custom-recording-${token.replace(/[^a-z0-9]/giu, '')}`,
      tabId: activeTab.id,
      sessionId: session.sessionId,
      protocolId: protocol.key,
      bundleSha256: session.bundleSha256,
      expectedRegistrySha256: protocol.registrySha256,
      phase: 'preparing',
    });
  }, [
    activeTab?.id,
    effectiveCustomSession,
    recordingState,
    resetCustomInjectionE2EPass,
    selectedProtocolId,
    setWebTabData,
  ]);

  const prepareCustomInjectionE2EPass = useCallback(async () => {
    const currentSession = effectiveCustomSession;
    const currentProtocol = currentSession?.protocols.find(
      (candidate) => candidate.key === selectedProtocolId,
    );
    if (!currentSession || !currentProtocol) {
      return false;
    }

    const requestId = e2ePassRequestRef.current + 1;
    e2ePassRequestRef.current = requestId;
    const operationId = stringUtils.generateUUID();
    const startedAt = Date.now();
    const logPreparationError = (error: unknown) => {
      logCustomInjectedClientOperation({
        sessionId: currentSession.sessionId,
        protocolId: currentProtocol.key,
        operationId,
        operation: 'e2e.clean-session.prepare',
        status: 'error',
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
    };
    if (!activeTab?.id) {
      logPreparationError('No active DApp tab is available');
      return false;
    }
    if (recordingState) {
      logPreparationError('A recording is already running');
      return false;
    }
    if (
      !isCustomInjectedE2ECleanSessionAllowed({
        sessionId: currentSession.sessionId,
      })
    ) {
      logPreparationError('A conflicting Workbench operation is running');
      return false;
    }
    const expectedInstanceKey =
      customInjectionWebViewInstanceRef.current?.instanceKey;
    const expectedTabId = activeTab.id;
    settleCustomInjectionE2EPassReady(undefined, false);
    logCustomInjectedClientOperation({
      sessionId: currentSession.sessionId,
      protocolId: currentProtocol.key,
      operationId,
      operation: 'e2e.clean-session.prepare',
      status: 'start',
      input: {
        tabId: expectedTabId,
        bundleSha256: currentSession.bundleSha256,
      },
    });

    let session: ICustomInjectedSession;
    try {
      session =
        await globalThis.desktopApiProxy.webview.getCustomInjectedWorkspace(
          currentSession.sessionId,
        );
    } catch (error) {
      logPreparationError(error);
      return false;
    }

    const currentInstance = customInjectionWebViewInstanceRef.current;
    const protocol = session.protocols.find(
      (candidate) => candidate.key === currentProtocol.key,
    );
    if (
      e2ePassRequestRef.current !== requestId ||
      !protocol ||
      currentInstance?.instanceKey !== expectedInstanceKey ||
      currentInstance?.sessionId !== session.sessionId ||
      currentInstance?.protocolId !== protocol.key ||
      currentInstance?.tabId !== expectedTabId ||
      !isCustomInjectedE2ECleanSessionAllowed({
        sessionId: session.sessionId,
      })
    ) {
      logPreparationError(
        'The protocol runtime changed while preparing a fresh E2E session',
      );
      return false;
    }

    setCustomSession(session);
    setActiveCustomInjectedWorkspace(session);
    const token = stringUtils.generateUUID();
    activeE2EPassKeyRef.current = operationId;
    const ready = new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        settleCustomInjectionE2EPassReady(operationId, false);
      }, E2E_PASS_READY_TIMEOUT_MS);
      e2ePassReadyWaiterRef.current = { operationId, resolve, timeout };
    });
    setWebTabData({
      id: expectedTabId,
      url: protocol.url,
      title: protocol.name,
    });
    setE2EPassState({
      operationId,
      partition: `onekey-custom-e2e-${token.replace(/[^a-z0-9]/giu, '')}`,
      tabId: expectedTabId,
    });
    const isReady = await ready;
    if (isReady) {
      logCustomInjectedClientOperation({
        sessionId: session.sessionId,
        protocolId: protocol.key,
        operationId,
        operation: 'e2e.clean-session.prepare',
        status: 'result',
        durationMs: Date.now() - startedAt,
        result: {
          partitionRequested: true,
          ready: true,
          tabId: expectedTabId,
          bundleSha256: session.bundleSha256,
        },
      });
    } else {
      logPreparationError('The fresh E2E WebView did not become ready');
    }
    return isReady;
  }, [
    activeTab?.id,
    effectiveCustomSession,
    recordingState,
    selectedProtocolId,
    settleCustomInjectionE2EPassReady,
    setWebTabData,
  ]);

  const getCustomInjectionPartition = useCallback(
    (tabId: string) => {
      if (recordingState?.tabId === tabId) return recordingState.partition;
      if (e2ePassState?.tabId === tabId) return e2ePassState.partition;
      return undefined;
    },
    [e2ePassState, recordingState],
  );

  useEffect(() => {
    resetCustomInjectionE2EPass();
  }, [
    activeTab?.id,
    effectiveCustomSession?.sessionId,
    resetCustomInjectionE2EPass,
    selectedProtocolId,
  ]);

  useEffect(
    () => () => settleCustomInjectionE2EPassReady(undefined, false),
    [settleCustomInjectionE2EPassReady],
  );

  const stopCustomInjectionRecording = useCallback(() => {
    if (recordingState?.phase !== 'recording') return;
    const operationId = stringUtils.generateUUID();
    const operationStartedAt = Date.now();
    logCustomInjectedClientOperation({
      sessionId: recordingState.sessionId,
      protocolId: recordingState.protocolId,
      operationId,
      operation: 'recording.stop',
      status: 'start',
    });
    setRecordingState({
      ...recordingState,
      phase: 'stopping',
      stopOperationId: operationId,
      stopOperationStartedAt: operationStartedAt,
    });
  }, [recordingState]);

  useEffect(() => {
    if (recordingState?.phase !== 'stopping') return undefined;
    const token = recordingState.token;
    const timeout = setTimeout(() => {
      if (recordingState.stopOperationId) {
        logCustomInjectedClientOperation({
          sessionId: recordingState.sessionId,
          protocolId: recordingState.protocolId,
          operationId: recordingState.stopOperationId,
          operation: 'recording.stop',
          status: 'error',
          durationMs: recordingState.stopOperationStartedAt
            ? Date.now() - recordingState.stopOperationStartedAt
            : undefined,
          error: 'The recorder did not respond while stopping',
        });
      }
      if (recordingState.recorderOperationId) {
        logCustomInjectedClientOperation({
          sessionId: recordingState.sessionId,
          protocolId: recordingState.protocolId,
          operationId: recordingState.recorderOperationId,
          operation: 'recording.recorder',
          status: 'error',
          durationMs: recordingState.recorderOperationStartedAt
            ? Date.now() - recordingState.recorderOperationStartedAt
            : undefined,
          error: 'The recorder did not respond while stopping',
        });
      }
      setRecordingState((current) =>
        current?.token === token && current.phase === 'stopping'
          ? undefined
          : current,
      );
    }, RECORDING_STOP_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [recordingState]);

  const handleCustomInjectionRecordingEvent = useCallback(
    async (event: ICustomInjectionRecordingEvent) => {
      const current = recordingState;
      if (!current || current.token !== event.token) {
        return;
      }
      if (event.status === 'started') {
        const recorderOperationId = stringUtils.generateUUID();
        const recorderOperationStartedAt = Date.now();
        logCustomInjectedClientOperation({
          sessionId: current.sessionId,
          protocolId: current.protocolId,
          operationId: current.startOperationId,
          operation: 'recording.start',
          status: 'result',
          durationMs: Date.now() - current.startOperationStartedAt,
          result: {
            webContentsId: event.webContentsId,
            pageUrl: event.pageUrl,
          },
        });
        logCustomInjectedClientOperation({
          sessionId: current.sessionId,
          protocolId: current.protocolId,
          operationId: recorderOperationId,
          operation: 'recording.recorder',
          status: 'start',
          input: { webContentsId: event.webContentsId, pageUrl: event.pageUrl },
        });
        setRecordingState((state) =>
          state?.token === event.token
            ? {
                ...state,
                phase: 'recording',
                recorderOperationId,
                recorderOperationStartedAt,
              }
            : state,
        );
        return;
      }
      if (event.status === 'error') {
        let operation: ICustomInjectedClientOperationLogRequest['operation'] =
          'recording.recorder';
        let operationId = current.recorderOperationId;
        let operationStartedAt = current.recorderOperationStartedAt;
        if (current.phase === 'stopping') {
          operation = 'recording.stop';
          operationId = current.stopOperationId;
          operationStartedAt = current.stopOperationStartedAt;
        } else if (current.phase === 'preparing') {
          operation = 'recording.start';
          operationId = current.startOperationId;
          operationStartedAt = current.startOperationStartedAt;
        }
        if (operationId) {
          logCustomInjectedClientOperation({
            sessionId: current.sessionId,
            protocolId: current.protocolId,
            operationId,
            operation,
            status: 'error',
            durationMs: operationStartedAt
              ? Date.now() - operationStartedAt
              : undefined,
            error: event.error,
          });
        }
        setRecordingState(undefined);
        return;
      }

      if (current.stopOperationId) {
        logCustomInjectedClientOperation({
          sessionId: current.sessionId,
          protocolId: current.protocolId,
          operationId: current.stopOperationId,
          operation: 'recording.stop',
          status: 'result',
          durationMs: current.stopOperationStartedAt
            ? Date.now() - current.stopOperationStartedAt
            : undefined,
          result: { stepCount: event.recording.steps.length },
        });
      }
      if (current.recorderOperationId) {
        logCustomInjectedClientOperation({
          sessionId: current.sessionId,
          protocolId: current.protocolId,
          operationId: current.recorderOperationId,
          operation: 'recording.recorder',
          status: 'result',
          durationMs: current.recorderOperationStartedAt
            ? Date.now() - current.recorderOperationStartedAt
            : undefined,
          result: {
            stepCount: event.recording.steps.length,
            outcome: event.recording.outcome,
          },
        });
      }

      setRecordingState((state) =>
        state?.token === event.token ? { ...state, phase: 'saving' } : state,
      );
      try {
        const result =
          await globalThis.desktopApiProxy.webview.saveCustomInjectedRecording({
            sessionId: current.sessionId,
            protocolId: current.protocolId,
            pageUrl: event.pageUrl,
            webContentsId: event.webContentsId,
            bundleSha256: current.bundleSha256,
            expectedRegistrySha256: current.expectedRegistrySha256,
            devSettingsEnabled: devSettings.enabled,
            customInjectionEnabled: customInjection?.enabled === true,
            recording: event.recording,
          });
        e2eGenerationStopRequestedRef.current = false;
        setE2EGenerating(true);
        setPendingE2EGeneration({
          sessionId: current.sessionId,
          protocolId: current.protocolId,
          stepCount: result.stepCount,
        });
      } catch (error) {
        console.warn('Unable to save Custom Injection recording', error);
      } finally {
        setRecordingState(undefined);
      }
    },
    [customInjection?.enabled, devSettings.enabled, recordingState],
  );

  useEffect(() => {
    if (!pendingE2EGeneration || recordingState) {
      return undefined;
    }
    let disposed = false;
    let selectionLock:
      | ReturnType<typeof acquireCustomInjectedProtocolSelectionLock>
      | undefined;
    setE2EGenerating(true);
    try {
      selectionLock = acquireCustomInjectedProtocolSelectionLock({
        reason: 'E2E generation',
        sessionId: pendingE2EGeneration.sessionId,
      });
    } catch (error) {
      console.warn('Unable to isolate Custom Injection E2E generation', error);
      logCustomInjectedClientError({
        sessionId: pendingE2EGeneration.sessionId,
        protocolId: pendingE2EGeneration.protocolId,
        operation: 'e2e.generate.prepare',
        error,
      });
      setE2EGenerating(false);
      setPendingE2EGeneration(undefined);
      return undefined;
    }
    void (async () => {
      try {
        const pendingSession =
          await globalThis.desktopApiProxy.webview.prepareCustomInjectedE2EValidation(
            pendingE2EGeneration.sessionId,
            pendingE2EGeneration.protocolId,
          );
        if (disposed) return;
        setCustomSession(pendingSession);
        setActiveCustomInjectedWorkspace(pendingSession);
        if (e2eGenerationStopRequestedRef.current) return;
        await globalThis.desktopApiProxy.webview.generateCustomInjectedE2E(
          pendingE2EGeneration.sessionId,
          pendingE2EGeneration.protocolId,
        );
      } catch (error) {
        if (disposed) return;
        console.warn('Unable to generate Custom Injection E2E', error);
      } finally {
        selectionLock?.release();
        if (!disposed) {
          setE2EGenerating(false);
          setPendingE2EGeneration(undefined);
        }
      }
    })();
    return () => {
      disposed = true;
    };
  }, [pendingE2EGeneration, recordingState]);

  const stopCustomInjectionE2EGeneration = useCallback(async () => {
    if (!pendingE2EGeneration) {
      return { stopped: false };
    }
    e2eGenerationStopRequestedRef.current = true;
    const result =
      await globalThis.desktopApiProxy.webview.stopCustomInjectedE2EGeneration(
        pendingE2EGeneration.sessionId,
        pendingE2EGeneration.protocolId,
      );
    return result.stopped ? result : { stopped: true };
  }, [pendingE2EGeneration]);

  const recordingCommand = useMemo<
    ICustomInjectionRecordingCommand | undefined
  >(() => {
    if (!recordingState || recordingState.phase === 'saving') {
      return undefined;
    }
    return {
      token: recordingState.token,
      action: recordingState.phase === 'stopping' ? 'stop' : 'start',
    };
  }, [recordingState]);

  const activeCustomInjectionTabId =
    customInjectionWebViewInstance &&
    customInjectionWebViewInstance.sessionId ===
      effectiveCustomSession?.sessionId &&
    customInjectionWebViewInstance.tabId === activeTabId
      ? activeTabId
      : undefined;

  return (
    <Page>
      <Page.Header
        // @ts-expect-error
        headerTitle={
          !isHomeType ? DesktopBrowserNavigationContainer : undefined
        }
        headerRight={renderHeaderRight}
        headerRightContainerStyle={{
          flexBasis: 'auto',
          flexGrow: 0,
        }}
        headerTitleContainerStyle={{
          maxWidth: '100%',
          flex: 1,
        }}
      />
      <Page.Body>
        <Stack flex={1}>
          {orderTabs.map((t) => (
            <DesktopBrowserContent
              key={t.id}
              id={t.id}
              activeTabId={activeTabId}
              customInjectionUrl={
                customInjectionWebViewInstance?.tabId === t.id &&
                customInjectionWebViewInstance.sessionId ===
                  effectiveCustomSession?.sessionId
                  ? customInjectionWebViewInstance.url
                  : undefined
              }
              customInjectionWebViewKey={
                customInjectionWebViewInstance?.tabId === t.id &&
                customInjectionWebViewInstance.sessionId ===
                  effectiveCustomSession?.sessionId
                  ? customInjectionWebViewInstance.instanceKey
                  : undefined
              }
              customInjectionE2EPassKey={
                e2ePassState?.tabId === t.id
                  ? e2ePassState.operationId
                  : undefined
              }
              desktopPreloadUrl={
                effectiveCustomSession &&
                customInjectionWebViewInstance?.tabId === t.id &&
                customInjectionWebViewInstance.sessionId ===
                  effectiveCustomSession.sessionId
                  ? effectiveCustomSession.preloadUrl
                  : undefined
              }
              onCustomInjectionAutoReview={
                t.id === activeCustomInjectionTabId &&
                isSelectedProtocolAutoReviewable
                  ? handleCustomInjectionAutoReview
                  : undefined
              }
              onCustomInjectionDidStartNavigation={
                t.id === activeCustomInjectionTabId
                  ? handleCustomInjectionDidStartNavigation
                  : undefined
              }
              onCustomInjectionDidRedirectNavigation={
                t.id === activeCustomInjectionTabId
                  ? handleCustomInjectionDidRedirectNavigation
                  : undefined
              }
              onCustomInjectionNavigationSettled={
                t.id === activeCustomInjectionTabId
                  ? handleCustomInjectionNavigationSettled
                  : undefined
              }
              onCustomInjectionDomReady={
                t.id === activeCustomInjectionTabId
                  ? handleCustomInjectionDomReady
                  : undefined
              }
              partition={getCustomInjectionPartition(t.id)}
              customInjectionRecordingCommand={
                recordingState?.tabId === t.id ? recordingCommand : undefined
              }
              onCustomInjectionRecordingEvent={
                recordingState?.tabId === t.id
                  ? handleCustomInjectionRecordingEvent
                  : undefined
              }
            />
          ))}
        </Stack>
        {effectiveCustomSession &&
        selectedProtocolId &&
        activeCustomInjectionTabId ? (
          <CustomInjectedToolbar
            key={customInjectionWebViewInstance?.instanceKey}
            activeSession={effectiveCustomSession}
            activeBundleSha256={effectiveCustomSession.bundleSha256}
            selectedProtocolId={selectedProtocolId}
            sessionId={effectiveCustomSession.sessionId}
            getCurrentWebViewUrl={getCurrentCustomInjectedWebViewUrl}
            recordingPhase={recordingState?.phase}
            e2eGenerating={e2eGenerating}
            protocolRuntimeScope={customInjectionWebViewInstance}
            protocolSwitchingLocked={protocolSwitchingLocked}
            onStartRecording={startCustomInjectionRecording}
            onStopRecording={stopCustomInjectionRecording}
            onStopE2EGeneration={stopCustomInjectionE2EGeneration}
            onPrepareE2EPass={prepareCustomInjectionE2EPass}
            onReload={reloadCustomInjectedWebView}
            onSelectProtocol={selectCustomInjectedProtocol}
          />
        ) : null}
      </Page.Body>
    </Page>
  );
}

export default memo(withBrowserProvider(DevelopmentDesktopBrowser));
