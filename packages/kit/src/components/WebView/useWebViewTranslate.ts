import { useCallback, useEffect, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import {
  ETranslateDisplayMode,
  ETranslateEngine,
} from '@onekeyhq/shared/types/discovery';
import type { IPrimeFreeTrialError } from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

import { getWebviewWrapperRef } from '../../views/Discovery/utils/explorerUtils';

import {
  TRANSLATE_COMMAND_TYPE,
  TRANSLATE_CONSOLE_PREFIX,
  TRANSLATE_REQUEST_TYPE,
  TRANSLATE_RESPONSE_TYPE,
  offTabNavigation,
  offTabNavigationEnd,
  onTabNavigation,
  onTabNavigationEnd,
  registerTranslateHandler,
  unregisterTranslateHandler,
} from './translateBridge';
// @ts-expect-error — inlined as string by babel-plugin-inline-import
import translateInjectScript from './translateInject.text-js';
import { createMessageInjectedScript } from './utils';

import type { ITranslateRequest } from './translateBridge';
import type { IElectronWebView } from '@onekeyfe/cross-inpage-provider-types';
import type { WebView } from 'react-native-webview';

type ITranslateResult = Array<string | null>;

export type IFreeTrialTranslateStopPayload = {
  freeTrialError: IPrimeFreeTrialError;
  sessionId: string;
  targetLang: string;
};

type ITranslateRequestOptions = {
  // `billed`: at least one batch was translated (and billed) by the server;
  // false when every batch fell back to the original text.
  onSuccess?: (result: { billed: boolean }) => void;
  onTranslateUnavailable?: (payload: {
    code: number;
    sessionId?: string;
    targetLang: string;
  }) => void;
  // Free trial exhausted / closed: true skips the background call and
  // answers with the original texts.
  isSessionFreeTrialStopped?: (sessionId?: string) => boolean;
  onRequestStart?: (sessionId?: string) => void;
  onRequestEnd?: (sessionId?: string) => void;
  onFreeTrialError?: (payload: IFreeTrialTranslateStopPayload) => void;
  testFlag?: string;
};

// Mirrors TRANSLATE_TIMEOUT_MS in translateInject.js (that constant lives in
// the injected script string and cannot be imported). After a free-trial
// stop, in-flight requests get at most this long before `stop` is forced.
const FREE_TRIAL_STOP_MAX_WAIT_MS = 15_000;

type ITranslateResponsePayload = {
  translations?: ITranslateResult;
  sessionId?: string;
  abort?: boolean;
};

function injectScript(tabId: string, script: string) {
  const ref = getWebviewWrapperRef(tabId);
  if (!ref) return;

  if (platformEnv.isNative) {
    try {
      (ref.innerRef as WebView)?.injectJavaScript(script);
    } catch (e) {
      console.error('[Translate] injectJavaScript error:', e);
    }
  } else if (platformEnv.isDesktop) {
    try {
      void (ref.innerRef as IElectronWebView)?.executeJavaScript(script);
    } catch (e) {
      console.error('[Translate] executeJavaScript error:', e);
    }
  }
}

async function translateTexts(
  texts: string[],
  targetLang: string,
  engine: ETranslateEngine,
  testFlag?: string,
): Promise<{
  translations: ITranslateResult;
  freeTrialError?: IPrimeFreeTrialError;
  hasBilledBatch: boolean;
}> {
  const result = (await backgroundApiProxy.servicePrime.apiTranslate({
    texts,
    sourceLang: 'auto',
    targetLang,
    engine,
    testFlag,
  })) as
    | {
        translations?: ITranslateResult;
        freeTrialError?: IPrimeFreeTrialError;
        hasBilledBatch?: boolean;
      }
    | undefined;
  const translations = result?.translations;
  return {
    translations: Array.isArray(translations) ? translations : texts,
    freeTrialError: result?.freeTrialError,
    hasBilledBatch: Boolean(result?.hasBilledBatch),
  };
}

function isAITranslateUnavailableError(error: unknown): error is IOneKeyError {
  const code = Number((error as IOneKeyError | undefined)?.code);
  return code === 90_104 || code === 90_105;
}

const TRANSLATE_MAX_ATTEMPTS = 2;
const TRANSLATE_RETRY_DELAY_MS = 500;
const TRANSLATE_START_DELAY_MS = 50;

function sendTranslationResponse(
  tabId: string,
  requestId: string,
  { translations, sessionId, abort }: ITranslateResponsePayload,
) {
  const responseScript = createMessageInjectedScript({
    type: TRANSLATE_RESPONSE_TYPE,
    id: requestId,
    translations,
    sessionId,
    abort,
  });
  injectScript(tabId, responseScript);
}

function handleTranslateRequest(
  tabId: string,
  data: ITranslateRequest,
  engine: ETranslateEngine,
  {
    onSuccess,
    onTranslateUnavailable,
    isSessionFreeTrialStopped,
    onRequestStart,
    onRequestEnd,
    onFreeTrialError,
    testFlag,
  }: ITranslateRequestOptions = {},
): void {
  // A free-trial error comes back in the return value, never as a throw, so
  // it never triggers the whole-request retry below (which would re-bill the
  // batches that already succeeded).
  const attemptTranslate = async (): Promise<{
    translations: ITranslateResult;
    freeTrialError?: IPrimeFreeTrialError;
    hasBilledBatch: boolean;
  } | null> => {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= TRANSLATE_MAX_ATTEMPTS; attempt += 1) {
      try {
        return await translateTexts(
          data.texts,
          data.targetLang,
          engine,
          testFlag,
        );
      } catch (err) {
        lastErr = err;
        if (
          engine === ETranslateEngine.ai &&
          isAITranslateUnavailableError(err)
        ) {
          throw err;
        }
        if (attempt < TRANSLATE_MAX_ATTEMPTS) {
          await timerUtils.wait(TRANSLATE_RETRY_DELAY_MS);
        }
      }
    }
    console.error('[Translate] API error:', lastErr);
    return null;
  };

  const handler = async () => {
    if (isSessionFreeTrialStopped?.(data.sessionId)) {
      // The session hit its free-trial limit: no new billed request.
      sendTranslationResponse(tabId, data.id, {
        translations: data.texts,
        sessionId: data.sessionId,
      });
      return;
    }
    onRequestStart?.(data.sessionId);
    try {
      const result = await attemptTranslate();
      if (result) {
        // Already billed translations are written back first.
        sendTranslationResponse(tabId, data.id, {
          translations: result.translations,
          sessionId: data.sessionId,
        });
        const freeTrialError = data.sessionId
          ? result.freeTrialError
          : undefined;
        if (!freeTrialError || result.hasBilledBatch) {
          onSuccess?.({ billed: result.hasBilledBatch });
        }
        if (freeTrialError && data.sessionId) {
          onFreeTrialError?.({
            freeTrialError,
            sessionId: data.sessionId,
            targetLang: data.targetLang,
          });
        }
      } else {
        sendTranslationResponse(tabId, data.id, {
          translations: data.texts,
          sessionId: data.sessionId,
        });
      }
    } catch (err) {
      if (
        engine === ETranslateEngine.ai &&
        isAITranslateUnavailableError(err)
      ) {
        sendTranslationResponse(tabId, data.id, {
          sessionId: data.sessionId,
          abort: true,
        });
        onTranslateUnavailable?.({
          code: Number(err.code),
          sessionId: data.sessionId,
          targetLang: data.targetLang,
        });
      }
    } finally {
      onRequestEnd?.(data.sessionId);
    }
  };
  void handler();
}

export function useWebViewTranslate({
  tabId,
  onNavigate,
  engine = ETranslateEngine.standard,
  displayMode = ETranslateDisplayMode.replace,
  dappUrl,
  onAITranslateUnavailable,
  onFreeTrialUnavailable,
  entitlementSource,
  currentTargetLang,
}: {
  tabId: string;
  onNavigate?: (stillTranslating: boolean) => void;
  engine?: ETranslateEngine;
  displayMode?: ETranslateDisplayMode;
  dappUrl?: string;
  onAITranslateUnavailable?: (payload: {
    code: number;
    targetLang: string;
  }) => void;
  // Free trial exhausted (90600) or closed (90601) during a session; called
  // once per session after the session was stopped.
  onFreeTrialUnavailable?: (payload: IFreeTrialTranslateStopPayload) => void;
  // Analytics only: Prime subscription or monthly free trial.
  entitlementSource?: 'prime' | 'freeTrial';
  currentTargetLang?: string;
}) {
  const translatingRef = useRef(false);
  const desktopCleanupRef = useRef<(() => void) | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoggedSuccessRef = useRef(false);
  const hasLoggedFreeTrialUsageRef = useRef(false);
  const activeSessionIdRef = useRef<string | null>(null);
  const sessionEngineRef = useRef(engine);
  const engineRef = useRef(engine);
  const displayModeRef = useRef(displayMode);
  const dappUrlRef = useRef(dappUrl);
  // Tracks the currently configured target lang so sticky re-translate picks
  // up user setting changes after the initial startTranslate.
  const targetLangRef = useRef(currentTargetLang);
  const handledUnavailableSessionRef = useRef<string | null>(null);
  // Electron fires did-finish-load / did-stop-loading / did-fail-load for the
  // same navigation; WebContent.desktop binds all three to the same callback,
  // so notifyTabNavigationEnd arrives multiple times. Consume once per nav.
  const navEndConsumedRef = useRef(false);
  // Hold via ref so callers don't have to memoize the callback; otherwise a
  // fresh inline lambda would invalidate the downstream memo chain and
  // re-register nav handlers on every render.
  const onAITranslateUnavailableRef = useRef(onAITranslateUnavailable);
  const onFreeTrialUnavailableRef = useRef(onFreeTrialUnavailable);
  const entitlementSourceRef = useRef(entitlementSource);
  entitlementSourceRef.current = entitlementSource;
  engineRef.current = engine;
  displayModeRef.current = displayMode;
  dappUrlRef.current = dappUrl;
  targetLangRef.current = currentTargetLang;
  onAITranslateUnavailableRef.current = onAITranslateUnavailable;
  onFreeTrialUnavailableRef.current = onFreeTrialUnavailable;

  // Free-trial stop state of the current page's session.
  const freeTrialStoppedSessionRef = useRef<string | null>(null);
  // Session whose `stop` was already sent (by the last in-flight request or
  // the wait cap), so a request finishing after the cap sends no second one.
  // Session ids are unique, so it never needs a reset.
  const freeTrialStopSentSessionRef = useRef<string | null>(null);
  const inFlightRequestsRef = useRef<{ sessionId: string; count: number }>({
    sessionId: '',
    count: 0,
  });
  const freeTrialStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const clearFreeTrialStopTimer = useCallback(() => {
    if (freeTrialStopTimerRef.current) {
      clearTimeout(freeTrialStopTimerRef.current);
      freeTrialStopTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => unregisterTranslateHandler(tabId), [tabId]);

  useEffect(() => {
    onTabNavigation(tabId, () => {
      activeSessionIdRef.current = null;
      handledUnavailableSessionRef.current = null;
      hasLoggedSuccessRef.current = false;
      hasLoggedFreeTrialUsageRef.current = false;
      navEndConsumedRef.current = false;
      // The old page (and its injected script) is gone: an old session's
      // free-trial stop must not touch the new page.
      freeTrialStoppedSessionRef.current = null;
      inFlightRequestsRef.current = { sessionId: '', count: 0 };
      clearFreeTrialStopTimer();
      if (startTimerRef.current) {
        clearTimeout(startTimerRef.current);
        startTimerRef.current = null;
      }
      if (!translatingRef.current) {
        unregisterTranslateHandler(tabId);
      }
      onNavigate?.(translatingRef.current);
    });
    return () => offTabNavigation(tabId);
  }, [tabId, onNavigate, clearFreeTrialStopTimer]);

  useEffect(
    () => () => {
      desktopCleanupRef.current?.();
      if (startTimerRef.current) {
        clearTimeout(startTimerRef.current);
        startTimerRef.current = null;
      }
      clearFreeTrialStopTimer();
    },
    [clearFreeTrialStopTimer],
  );

  const logTranslateSuccess = useCallback(
    (targetLang: string, sessionId: string | undefined, billed: boolean) => {
      if (!sessionId || sessionId !== activeSessionIdRef.current) {
        return;
      }
      if (!hasLoggedSuccessRef.current) {
        hasLoggedSuccessRef.current = true;
        defaultLogger.prime.usage.dappTranslateSuccess({
          engine: sessionEngineRef.current,
          targetLang,
          displayMode: displayModeRef.current,
          dappDomain: uriUtils.getHostNameFromUrl({
            url: dappUrlRef.current ?? '',
          }),
          featureName: EPrimeFeatures.DAppTranslate,
          entitlementSource: entitlementSourceRef.current,
        });
      }
      if (
        billed &&
        entitlementSourceRef.current === 'freeTrial' &&
        !hasLoggedFreeTrialUsageRef.current
      ) {
        // Translate is metered by the server; one consumption event per
        // session, once a batch was actually billed.
        hasLoggedFreeTrialUsageRef.current = true;
        defaultLogger.prime.subscription.primeFreeTrialUsageSuccess({
          featureName: EPrimeFeatures.DAppTranslate,
          featureId: EPrimeFeatures.DAppTranslate,
          entitlementSource: 'freeTrial',
        });
      }
    },
    [],
  );

  const restoreOriginal = useCallback(() => {
    if (startTimerRef.current) {
      clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
    clearFreeTrialStopTimer();
    freeTrialStoppedSessionRef.current = null;
    injectScript(
      tabId,
      createMessageInjectedScript({
        type: TRANSLATE_COMMAND_TYPE,
        command: 'restore',
      }),
    );
    unregisterTranslateHandler(tabId);
    desktopCleanupRef.current?.();
    handledUnavailableSessionRef.current = null;
    activeSessionIdRef.current = null;
    translatingRef.current = false;
  }, [tabId, clearFreeTrialStopTimer]);

  // Sends `stop` (keeps the written translations, unlike `restore`) once the
  // stopped session has no request in flight: `stop` drops the script's
  // pending responses, so sending it early would lose billed results.
  const finishFreeTrialStop = useCallback(
    (sessionId: string) => {
      if (
        freeTrialStoppedSessionRef.current !== sessionId ||
        freeTrialStopSentSessionRef.current === sessionId
      ) {
        return;
      }
      freeTrialStopSentSessionRef.current = sessionId;
      clearFreeTrialStopTimer();
      injectScript(
        tabId,
        createMessageInjectedScript({
          type: TRANSLATE_COMMAND_TYPE,
          command: 'stop',
        }),
      );
      unregisterTranslateHandler(tabId);
      desktopCleanupRef.current?.();
      if (activeSessionIdRef.current === sessionId) {
        activeSessionIdRef.current = null;
      }
    },
    [tabId, clearFreeTrialStopTimer],
  );

  const isSessionFreeTrialStopped = useCallback(
    (sessionId?: string) =>
      Boolean(sessionId) && freeTrialStoppedSessionRef.current === sessionId,
    [],
  );

  const onRequestStart = useCallback((sessionId?: string) => {
    if (!sessionId) return;
    const current = inFlightRequestsRef.current;
    inFlightRequestsRef.current =
      current.sessionId === sessionId
        ? { sessionId, count: current.count + 1 }
        : { sessionId, count: 1 };
  }, []);

  const onRequestEnd = useCallback(
    (sessionId?: string) => {
      if (!sessionId) return;
      const current = inFlightRequestsRef.current;
      if (current.sessionId !== sessionId) return;
      const count = Math.max(0, current.count - 1);
      inFlightRequestsRef.current = { sessionId, count };
      if (count === 0 && freeTrialStoppedSessionRef.current === sessionId) {
        finishFreeTrialStop(sessionId);
      }
    },
    [finishFreeTrialStop],
  );

  const handleFreeTrialError = useCallback(
    (payload: IFreeTrialTranslateStopPayload) => {
      const { sessionId } = payload;
      if (
        sessionId !== activeSessionIdRef.current ||
        freeTrialStoppedSessionRef.current === sessionId
      ) {
        return;
      }
      freeTrialStoppedSessionRef.current = sessionId;
      // No sticky re-translate after a navigation for this tab.
      translatingRef.current = false;
      if (startTimerRef.current) {
        clearTimeout(startTimerRef.current);
        startTimerRef.current = null;
      }
      clearFreeTrialStopTimer();
      freeTrialStopTimerRef.current = setTimeout(() => {
        freeTrialStopTimerRef.current = null;
        finishFreeTrialStop(sessionId);
      }, FREE_TRIAL_STOP_MAX_WAIT_MS);
      onFreeTrialUnavailableRef.current?.(payload);
    },
    [clearFreeTrialStopTimer, finishFreeTrialStop],
  );

  const freeTrialRequestOptions = useMemo(
    () => ({
      isSessionFreeTrialStopped,
      onRequestStart,
      onRequestEnd,
      onFreeTrialError: handleFreeTrialError,
    }),
    [
      handleFreeTrialError,
      isSessionFreeTrialStopped,
      onRequestEnd,
      onRequestStart,
    ],
  );

  const handleTranslateUnavailable = useCallback(
    ({
      code,
      sessionId,
      targetLang,
    }: {
      code: number;
      sessionId?: string;
      targetLang: string;
    }) => {
      if (
        !sessionId ||
        sessionId !== activeSessionIdRef.current ||
        handledUnavailableSessionRef.current === sessionId
      ) {
        return;
      }

      handledUnavailableSessionRef.current = sessionId;
      restoreOriginal();
      onAITranslateUnavailableRef.current?.({
        code,
        targetLang,
      });
    },
    [restoreOriginal],
  );

  const setupDesktopListener = useCallback(
    (
      selectedEngine: ETranslateEngine = engineRef.current,
      testFlag?: string,
    ) => {
      if (!platformEnv.isDesktop) return;
      desktopCleanupRef.current?.();

      const ref = getWebviewWrapperRef(tabId);
      if (!ref?.innerRef) return;

      const webview = ref.innerRef as IElectronWebView;
      const handleConsoleMessage = (event: { message: string }) => {
        if (
          typeof event.message === 'string' &&
          event.message.startsWith(TRANSLATE_CONSOLE_PREFIX)
        ) {
          try {
            const data = JSON.parse(
              event.message.slice(TRANSLATE_CONSOLE_PREFIX.length),
            ) as ITranslateRequest;
            if (data.type === TRANSLATE_REQUEST_TYPE) {
              handleTranslateRequest(tabId, data, selectedEngine, {
                onSuccess: ({ billed }) =>
                  logTranslateSuccess(data.targetLang, data.sessionId, billed),
                onTranslateUnavailable: handleTranslateUnavailable,
                ...freeTrialRequestOptions,
                testFlag,
              });
            }
          } catch {
            // ignore parse errors
          }
        }
      };

      webview.addEventListener(
        'console-message',
        handleConsoleMessage as never,
      );
      desktopCleanupRef.current = () => {
        webview.removeEventListener(
          'console-message',
          handleConsoleMessage as never,
        );
        desktopCleanupRef.current = null;
      };
    },
    [
      tabId,
      logTranslateSuccess,
      handleTranslateUnavailable,
      freeTrialRequestOptions,
    ],
  );

  const ensureInjected = useCallback(
    (
      selectedEngine: ETranslateEngine = engineRef.current,
      testFlag?: string,
    ) => {
      injectScript(tabId, translateInjectScript);
      setupDesktopListener(selectedEngine, testFlag);
    },
    [tabId, setupDesktopListener],
  );

  const startTranslate = useCallback(
    (
      targetLang = 'zh',
      selectedEngine: ETranslateEngine = engineRef.current,
      testFlag?: string,
    ) => {
      if (translatingRef.current) {
        restoreOriginal();
      }

      const sid = generateUUID({ removeDashes: true });
      activeSessionIdRef.current = sid;
      sessionEngineRef.current = selectedEngine;
      handledUnavailableSessionRef.current = null;
      hasLoggedSuccessRef.current = false;
      hasLoggedFreeTrialUsageRef.current = false;
      freeTrialStoppedSessionRef.current = null;
      clearFreeTrialStopTimer();

      registerTranslateHandler(tabId, (data) =>
        handleTranslateRequest(tabId, data, selectedEngine, {
          onSuccess: ({ billed }) =>
            logTranslateSuccess(data.targetLang, data.sessionId, billed),
          onTranslateUnavailable: handleTranslateUnavailable,
          ...freeTrialRequestOptions,
          testFlag,
        }),
      );

      ensureInjected(selectedEngine, testFlag);
      if (startTimerRef.current) {
        clearTimeout(startTimerRef.current);
      }
      translatingRef.current = true;
      startTimerRef.current = setTimeout(() => {
        startTimerRef.current = null;
        injectScript(
          tabId,
          createMessageInjectedScript({
            type: TRANSLATE_COMMAND_TYPE,
            command: 'start',
            targetLang,
            displayMode: displayModeRef.current,
            sessionId: sid,
          }),
        );
      }, TRANSLATE_START_DELAY_MS);
    },
    [
      tabId,
      ensureInjected,
      handleTranslateUnavailable,
      logTranslateSuccess,
      restoreOriginal,
      freeTrialRequestOptions,
      clearFreeTrialStopTimer,
    ],
  );

  useEffect(() => {
    onTabNavigationEnd(tabId, () => {
      if (navEndConsumedRef.current) return;
      if (!translatingRef.current) return;
      const nextTargetLang = targetLangRef.current;
      if (!nextTargetLang) return;
      navEndConsumedRef.current = true;
      // Fresh page — nothing to restore. Skip the bogus restore inject that
      // startTranslate would otherwise fire via its re-entry path.
      translatingRef.current = false;
      startTranslate(nextTargetLang, engineRef.current);
    });
    return () => offTabNavigationEnd(tabId);
  }, [tabId, startTranslate]);

  const toggleTranslate = useCallback(
    (targetLang = 'zh') => {
      if (translatingRef.current) {
        restoreOriginal();
      } else {
        startTranslate(targetLang);
      }
    },
    [startTranslate, restoreOriginal],
  );

  return {
    startTranslate,
    restoreOriginal,
    toggleTranslate,
    translatingRef,
  };
}
