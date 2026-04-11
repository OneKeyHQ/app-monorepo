import { useCallback, useEffect, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ETranslateDisplayMode,
  ETranslateEngine,
} from '@onekeyhq/shared/types/discovery';

import { getWebviewWrapperRef } from '../../views/Discovery/utils/explorerUtils';

import {
  TRANSLATE_COMMAND_TYPE,
  TRANSLATE_CONSOLE_PREFIX,
  TRANSLATE_REQUEST_TYPE,
  TRANSLATE_RESPONSE_TYPE,
  offTabNavigation,
  onTabNavigation,
  registerTranslateHandler,
  unregisterTranslateHandler,
} from './translateBridge';
// @ts-expect-error text-js module imported as string by babel-plugin-inline-import / esbuild
import translateInjectScript from './translateInject.text-js';
import { createMessageInjectedScript } from './utils';

import type { ITranslateRequest } from './translateBridge';
import type { IElectronWebView } from '@onekeyfe/cross-inpage-provider-types';
import type { WebView } from 'react-native-webview';

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
): Promise<string[]> {
  const result = await backgroundApiProxy.servicePrime.apiTranslate({
    texts,
    sourceLang: 'auto',
    targetLang,
    engine,
  });
  return result?.translations ?? texts;
}

function handleTranslateRequest(
  tabId: string,
  data: ITranslateRequest,
  engine: ETranslateEngine,
  onSuccess?: () => void,
): void {
  const handler = async () => {
    try {
      const translations = await translateTexts(
        data.texts,
        data.targetLang,
        engine,
      );
      sendTranslationResponse(tabId, data.id, translations, data.sessionId);
      onSuccess?.();
    } catch (err) {
      console.error('[Translate] API error:', err);
      sendTranslationResponse(tabId, data.id, data.texts, data.sessionId);
    }
  };
  void handler();
}

let sessionCounter = 0;

function generateSessionId(): string {
  sessionCounter += 1;
  return `s${Date.now().toString(36)}${sessionCounter.toString(36)}`;
}

function sendTranslationResponse(
  tabId: string,
  requestId: string,
  translations: string[],
  sessionId?: string,
) {
  const responseScript = createMessageInjectedScript({
    type: TRANSLATE_RESPONSE_TYPE,
    id: requestId,
    translations,
    sessionId,
  });
  injectScript(tabId, responseScript);
}

export function useWebViewTranslate(
  tabId: string,
  onNavigate?: () => void,
  engine: ETranslateEngine = ETranslateEngine.standard,
  displayMode: ETranslateDisplayMode = ETranslateDisplayMode.replace,
  dappUrl?: string,
) {
  const translatingRef = useRef(false);
  const desktopCleanupRef = useRef<(() => void) | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoggedSuccessRef = useRef(false);
  const activeSessionIdRef = useRef<string | null>(null);
  const engineRef = useRef(engine);
  const displayModeRef = useRef(displayMode);
  const dappUrlRef = useRef(dappUrl);
  engineRef.current = engine;
  displayModeRef.current = displayMode;
  dappUrlRef.current = dappUrl;

  useEffect(() => () => unregisterTranslateHandler(tabId), [tabId]);

  // Unregister handler on navigation so new pages can't trigger translate without user action
  useEffect(() => {
    onTabNavigation(tabId, () => {
      translatingRef.current = false;
      activeSessionIdRef.current = null;
      unregisterTranslateHandler(tabId);
      if (startTimerRef.current) {
        clearTimeout(startTimerRef.current);
        startTimerRef.current = null;
      }
      onNavigate?.();
    });
    return () => offTabNavigation(tabId);
  }, [tabId, onNavigate]);

  useEffect(
    () => () => {
      desktopCleanupRef.current?.();
      if (startTimerRef.current) {
        clearTimeout(startTimerRef.current);
        startTimerRef.current = null;
      }
    },
    [],
  );

  // Stable callback — reads current values from refs to avoid cascading callback recreations.
  // sessionId guard prevents stale in-flight requests from consuming the new session's dedup slot.
  const logTranslateSuccess = useCallback(
    (targetLang: string, sessionId?: string) => {
      if (
        !hasLoggedSuccessRef.current &&
        sessionId &&
        sessionId === activeSessionIdRef.current
      ) {
        hasLoggedSuccessRef.current = true;
        defaultLogger.prime.usage.dappTranslateSuccess({
          engine: engineRef.current,
          targetLang,
          displayMode: displayModeRef.current,
          dappDomain: dappUrlRef.current ?? '',
        });
      }
    },
    [],
  );

  const setupDesktopListener = useCallback(() => {
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
            handleTranslateRequest(tabId, data, engine, () =>
              logTranslateSuccess(data.targetLang, data.sessionId),
            );
          }
        } catch {
          // ignore parse errors
        }
      }
    };

    webview.addEventListener('console-message', handleConsoleMessage as never);
    desktopCleanupRef.current = () => {
      webview.removeEventListener(
        'console-message',
        handleConsoleMessage as never,
      );
      desktopCleanupRef.current = null;
    };
  }, [tabId, engine, logTranslateSuccess]);

  const ensureInjected = useCallback(() => {
    // Re-injection is needed after page navigation clears the old context;
    // the script has an idempotency guard for same-page calls.
    injectScript(tabId, translateInjectScript);
    setupDesktopListener();
  }, [tabId, setupDesktopListener]);

  const startTranslate = useCallback(
    (targetLang = 'zh') => {
      const sid = generateSessionId();
      activeSessionIdRef.current = sid;
      hasLoggedSuccessRef.current = false;
      registerTranslateHandler(tabId, (data) =>
        handleTranslateRequest(tabId, data, engine, () =>
          logTranslateSuccess(data.targetLang, data.sessionId),
        ),
      );
      ensureInjected();
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
            displayMode,
            sessionId: sid,
          }),
        );
      }, 50);
    },
    [tabId, ensureInjected, engine, displayMode, logTranslateSuccess],
  );

  const stopTranslate = useCallback(() => {
    if (startTimerRef.current) {
      clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
    injectScript(
      tabId,
      createMessageInjectedScript({
        type: TRANSLATE_COMMAND_TYPE,
        command: 'stop',
      }),
    );
    unregisterTranslateHandler(tabId);
    desktopCleanupRef.current?.();
    activeSessionIdRef.current = null;
    translatingRef.current = false;
  }, [tabId]);

  const restoreOriginal = useCallback(() => {
    if (startTimerRef.current) {
      clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
    injectScript(
      tabId,
      createMessageInjectedScript({
        type: TRANSLATE_COMMAND_TYPE,
        command: 'restore',
      }),
    );
    unregisterTranslateHandler(tabId);
    desktopCleanupRef.current?.();
    activeSessionIdRef.current = null;
    translatingRef.current = false;
  }, [tabId]);

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
    stopTranslate,
    restoreOriginal,
    toggleTranslate,
    translatingRef,
  };
}
